// The public demo path. It runs the real pipeline, and it is the only parse route a
// visitor can reach when DEMO_MODE is on.
//
// What it deliberately does not do:
//   - accept a document. No upload, no URL fetch. See README, "Grenzen".
//   - persist anything. No job is written, so nothing a visitor sees can be read back
//     by the next visitor.
//   - touch Qdrant. The demo neither reads nor writes invoice memory.
//
// The extraction is cached per document, because the six documents are fixed and the
// extractor runs at temperature 0. The first click after a cold start does the real
// call; the rest of that container's life serves the same result and says it is cached.
import type { Context } from "hono";
import { activeExtractor, extractInvoice } from "../extract/claude";
import { extractTextFromDocument } from "../ocr/tesseract";
import { buildEvidence, OCR_CONFIDENCE_FLOOR } from "../verify/evidence";
import { findDemoDocument, listDemoDocuments } from "./documents";

interface DemoResult {
  document: ReturnType<typeof listDemoDocuments>[number];
  source: { mode: string; pages: number; bytes: number; confidence?: number };
  extractor: ReturnType<typeof activeExtractor>;
  invoice: unknown;
  evidence: unknown;
  rawText: string;
  timings: { extractMs: number; totalMs: number };
}

const cache = new Map<string, DemoResult>();

export function listDemoDocumentsRequest(c: Context) {
  return c.json({
    documents: listDemoDocuments(),
    // Named, not claimed: without a key the regex path runs, and the console says so.
    extractor: activeExtractor(),
    ocrFloor: OCR_CONFIDENCE_FLOOR,
    upload: false
  });
}

export async function demoParseRequest(c: Context) {
  const body = await c.req.json<{ id?: unknown }>().catch(() => ({ id: undefined }));
  const document = findDemoDocument(body.id);
  if (!document) {
    return c.json({ error: "Unknown document. The demo only runs the documents it ships with." }, 400);
  }

  const cached = cache.get(document.id);
  if (cached) {
    return c.json({ ...cached, cached: true });
  }

  const startedAt = Date.now();
  const bytes = new Uint8Array(await Bun.file(document.path).arrayBuffer());
  const source = await extractTextFromDocument(bytes, document.contentType);

  const extractStartedAt = Date.now();
  const invoice = await extractInvoice(source.text);
  const extractMs = Date.now() - extractStartedAt;

  const { path: _path, ...publicDocument } = document;
  const result: DemoResult = {
    document: publicDocument,
    source: {
      mode: source.mode,
      pages: source.pages,
      bytes: source.bytes,
      ...(source.confidence === undefined ? {} : { confidence: source.confidence })
    },
    extractor: activeExtractor(),
    invoice,
    evidence: buildEvidence(invoice, source),
    rawText: source.text,
    timings: { extractMs, totalMs: Date.now() - startedAt }
  };

  cache.set(document.id, result);
  return c.json({ ...result, cached: false });
}

export function resetDemoCacheForTests() {
  cache.clear();
}
