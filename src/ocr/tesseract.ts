import { file, write } from "bun";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createWorker } from "tesseract.js";
import pdfParse from "pdf-parse";
import { extractWithVisionFallback } from "./vision";
import type { OcrOptions, TextExtractionResult } from "./types";

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

export async function extractWithTesseract(bytes: Uint8Array): Promise<TextExtractionResult> {
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(Buffer.from(bytes));
    return {
      text: result.data.text.trim(),
      mode: "ocr",
      pages: 1,
      bytes: bytes.byteLength,
      confidence: result.data.confidence / 100
    };
  } finally {
    await worker.terminate();
  }
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
