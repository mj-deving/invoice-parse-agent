import { describe, expect, test } from "bun:test";
import { extractWithTesseract } from "../src/ocr/tesseract";

describe("scanned invoice OCR smoke", () => {
  test("extracts recognizable text from a rendered invoice image", async () => {
    const bytes = new Uint8Array(await Bun.file("corpus/mustard-logistics-001-scan.png").arrayBuffer());
    const result = await extractWithTesseract(bytes);
    expect(result.mode).toBe("ocr");
    expect(result.confidence ?? 0).toBeGreaterThan(0.8);
    expect(result.text).toContain("Mustard Yellow Logistics");
    expect(result.text).toContain("MYL-2026-001");
  }, 15_000);
});
