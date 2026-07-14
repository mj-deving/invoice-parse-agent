import { file, write } from "bun";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createWorker } from "tesseract.js";
import pdfParse from "pdf-parse";
import { extractWithVisionFallback } from "./vision";
import type { OcrLine, OcrOptions, TextExtractionResult } from "./types";

type RecognizeBlocks = Awaited<ReturnType<Awaited<ReturnType<typeof createWorker>>["recognize"]>>["data"]["blocks"];

function isPdf(bytes: Uint8Array): boolean {
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

function isProbablyText(bytes: Uint8Array, contentType?: string): boolean {
  if (contentType?.startsWith("text/")) {
    return true;
  }
  const sample = bytes.slice(0, Math.min(bytes.length, 2048));
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(sample);
  const printable = [...decoded].filter((char) => char === "\n" || char === "\r" || char === "\t" || char >= " ").length;
  return decoded.length > 0 && printable / decoded.length > 0.92 && /invoice|vendor|total|tax/i.test(decoded);
}

async function extractPdfText(bytes: Uint8Array): Promise<TextExtractionResult | null> {
  const parsed = await pdfParse(Buffer.from(bytes));
  const text = parsed.text.trim();
  if (text.length < 20) {
    return null;
  }

  return {
    text,
    mode: "pdf-text",
    pages: parsed.numpages || 1,
    bytes: bytes.byteLength
  };
}

async function renderFirstPdfPage(bytes: Uint8Array): Promise<Uint8Array | null> {
  const base = join(tmpdir(), `invoice-parse-${randomUUID()}`);
  const pdfPath = `${base}.pdf`;
  await write(pdfPath, bytes);

  const proc = Bun.spawn(["pdftoppm", "-f", "1", "-singlefile", "-png", "-r", "200", pdfPath, base], {
    stdout: "pipe",
    stderr: "pipe"
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    return null;
  }

  const png = file(`${base}.png`);
  if (!(await png.exists())) {
    return null;
  }
  return new Uint8Array(await png.arrayBuffer());
}

// Two Tesseract workers recognising at the same time tear down the WASM heap with
// "access to a null reference" inside the emscripten binding, which takes the request
// with it. Two visitors parsing a scan at once is not an exotic case for a public
// service, so recognition is serialised: each call waits for the one before it.
let ocrQueue: Promise<unknown> = Promise.resolve();

function serialise<T>(work: () => Promise<T>): Promise<T> {
  const result = ocrQueue.then(work, work);
  ocrQueue = result.catch(() => undefined);
  return result;
}

export function extractWithTesseract(bytes: Uint8Array): Promise<TextExtractionResult> {
  return serialise(async () => {
    const worker = await createWorker("eng");
    try {
      // `blocks` carries the per-word confidence. Without it Tesseract reports one
      // number for the whole page, which cannot tell a clean field from a shaky one.
      const result = await worker.recognize(Buffer.from(bytes), {}, { blocks: true, text: true });
      return {
        text: result.data.text.trim(),
        mode: "ocr" as const,
        pages: 1,
        bytes: bytes.byteLength,
        confidence: result.data.confidence / 100,
        lines: collectLines(result.data.blocks)
      };
    } finally {
      await worker.terminate();
    }
  });
}

function collectLines(blocks: RecognizeBlocks): OcrLine[] {
  const lines: OcrLine[] = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const words = (line.words ?? []).map((word) => ({
          text: word.text,
          confidence: word.confidence / 100
        }));
        if (words.length > 0) {
          lines.push({ text: line.text.trim(), words });
        }
      }
    }
  }
  return lines;
}

export async function extractTextFromDocument(
  bytes: Uint8Array,
  contentType?: string,
  options: OcrOptions = {}
): Promise<TextExtractionResult> {
  if (isProbablyText(bytes, contentType)) {
    return {
      text: new TextDecoder("utf-8").decode(bytes).trim(),
      mode: "plain-text",
      pages: 1,
      bytes: bytes.byteLength
    };
  }

  if (isPdf(bytes)) {
    const parsed = await extractPdfText(bytes).catch(() => null);
    if (parsed) {
      return parsed;
    }

    const rendered = await renderFirstPdfPage(bytes);
    if (rendered) {
      return extractWithTesseract(rendered);
    }
  }

  const ocr = await extractWithTesseract(bytes).catch(async (error: unknown) => {
    if (options.enableVisionFallback) {
      return extractWithVisionFallback(bytes);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Self-hosted OCR failed and managed fallback is disabled: ${message}`);
  });

  return ocr;
}
