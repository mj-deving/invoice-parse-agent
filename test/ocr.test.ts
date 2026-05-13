import { describe, expect, test } from "bun:test";
import { extractTextFromDocument } from "../src/ocr/tesseract";

describe("document text extraction", () => {
  test("uses plain-text mode for text fixtures", async () => {
    const result = await extractTextFromDocument(new TextEncoder().encode("Vendor: Demo\nInvoice No: D-1\nTotal: EUR 1.00"), "text/plain");
    expect(result.mode).toBe("plain-text");
    expect(result.text).toContain("Invoice No");
  });
});
