import { describe, expect, test } from "bun:test";
import { buildEvidence, OCR_CONFIDENCE_FLOOR } from "../src/verify/evidence";
import { extractInvoiceDeterministically } from "../src/extract/fallback";
import { extractTextFromDocument } from "../src/ocr/tesseract";

const cleanText = `Vendor: Rhein Freight Services AG
Vendor Tax ID: DE812345900
Customer: Synergy Energy Logistics
Invoice No: RFS-778
Invoice Date: 2026-04-28
Due Date: 2026-05-12
ITEM 1: ADR transport Cologne to Rotterdam | qty=2 | unit=EUR 410.00 | tax=19% | line=EUR 820.00
Tax: EUR 155.80
Total: EUR 975.80`;

async function evidenceFor(text: string) {
  const source = await extractTextFromDocument(new TextEncoder().encode(text), "text/plain");
  return buildEvidence(extractInvoiceDeterministically(source.text), source);
}

describe("field evidence", () => {
  test("a clean text invoice verifies every field it extracted", async () => {
    const report = await evidenceFor(cleanText);

    expect(report.fields.length).toBeGreaterThan(8);
    expect(report.flagged).toBe(0);
    expect(report.fields.every((field) => field.status === "verified")).toBe(true);
  });

  test("a value absent from the source text is flagged, not passed off as extracted", async () => {
    const source = await extractTextFromDocument(new TextEncoder().encode(cleanText), "text/plain");
    const invoice = extractInvoiceDeterministically(source.text);
    invoice.vendor.name = "Vendor That Was Never In The Document";

    const report = buildEvidence(invoice, source);
    const vendor = report.fields.find((field) => field.path === "vendor.name");

    expect(vendor?.status).toBe("flagged");
    expect(vendor?.checks.find((check) => check.name === "source")?.status).toBe("fail");
    expect(report.flagged).toBe(1);
  });

  test("line arithmetic that does not close is flagged", async () => {
    const source = await extractTextFromDocument(new TextEncoder().encode(cleanText), "text/plain");
    const invoice = extractInvoiceDeterministically(source.text);
    invoice.lineItems[0]!.quantity = 9;

    const report = buildEvidence(invoice, source);
    const quantity = report.fields.find((field) => field.path === "lineItems.0.quantity");

    expect(quantity?.status).toBe("flagged");
    expect(quantity?.checks.find((check) => check.name === "arithmetic")?.status).toBe("fail");
  });

  test("a total that does not reconcile against lines plus tax is flagged", async () => {
    const source = await extractTextFromDocument(new TextEncoder().encode(cleanText), "text/plain");
    const invoice = extractInvoiceDeterministically(source.text);
    invoice.total.amount = 1200;

    const report = buildEvidence(invoice, source);
    const total = report.fields.find((field) => field.path === "total");

    expect(total?.status).toBe("flagged");
    expect(total?.checks.find((check) => check.name === "arithmetic")?.status).toBe("fail");
  });

  test("the scanned fixture flags the quantity Tesseract misread, and says why", async () => {
    const bytes = new Uint8Array(await Bun.file("corpus/mustard-logistics-001-scan.png").arrayBuffer());
    const source = await extractTextFromDocument(bytes, "image/png");
    expect(source.mode).toBe("ocr");

    const report = buildEvidence(extractInvoiceDeterministically(source.text), source);
    const quantities = report.fields.filter((field) => /lineItems\.\d+\.quantity/.test(field.path));

    // Tesseract reads "qty=12" at 0.49 and misreads "qty=1" as "gty=1" at 0.56.
    // Both sit under the floor, so both quantities carry an OCR check that fails.
    expect(quantities.length).toBe(2);
    for (const field of quantities) {
      const ocr = field.checks.find((check) => check.name === "ocr");
      expect(ocr?.status).toBe("fail");
      expect(ocr?.value).toBeLessThan(OCR_CONFIDENCE_FLOOR);
      expect(field.status).toBe("flagged");
    }

    // The rest of the document is clean, so the marking is specific, not a blanket warning.
    expect(report.flagged).toBe(2);
    expect(report.verified).toBeGreaterThan(10);
  }, 30000);
});
