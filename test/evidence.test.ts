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

  test("a money field whose currency is not the document's currency is flagged", async () => {
    // The row displays "432.00 GBP". Checking only the number would certify the field
    // while half of what it shows was never looked at.
    const gbp = await Bun.file("corpus/alpine-spares-9201.txt").text();
    const source = await extractTextFromDocument(new TextEncoder().encode(gbp), "text/plain");
    const invoice = extractInvoiceDeterministically(source.text);
    expect(invoice.total.currency).toBe("GBP");

    invoice.total.currency = "EUR";
    const report = buildEvidence(invoice, source);
    const total = report.fields.find((field) => field.path === "total");

    expect(total?.value).toContain("EUR");
    expect(total?.status).toBe("flagged");
  });

  test("a line priced in a currency the invoice does not use is flagged", async () => {
    const source = await extractTextFromDocument(new TextEncoder().encode(cleanText), "text/plain");
    const invoice = extractInvoiceDeterministically(source.text);
    invoice.lineItems[0]!.unitPrice.currency = "USD";

    const report = buildEvidence(invoice, source);
    const unitPrice = report.fields.find((field) => field.path === "lineItems.0.unitPrice");

    expect(unitPrice?.status).toBe("flagged");
  });

  test("a currency mentioned elsewhere in the document does not vouch for this amount", async () => {
    // The document names USD in its payment terms. That is not evidence that THIS line
    // is priced in USD, so a currency found somewhere else must not verify the field.
    const withPaymentTerms = `${cleanText}\nPayment terms: net 14 days. USD invoices are settled at the daily rate.`;
    const source = await extractTextFromDocument(new TextEncoder().encode(withPaymentTerms), "text/plain");
    const invoice = extractInvoiceDeterministically(source.text);

    // Both sides of the line move together, so the line arithmetic still agrees with itself.
    invoice.lineItems[0]!.unitPrice.currency = "USD";
    invoice.lineItems[0]!.lineTotal.currency = "USD";

    const report = buildEvidence(invoice, source);
    const unitPrice = report.fields.find((field) => field.path === "lineItems.0.unitPrice");

    expect(unitPrice?.checks.find((check) => check.name === "source")?.status).toBe("fail");
    expect(unitPrice?.status).toBe("flagged");
  });

  // Every amount below is distinct, so a passing source check can only have matched the
  // line it is about. An earlier version of this test reused 410.00 for both the line and
  // the invoice total, and would have passed on the total without touching the line at all.
  async function lineTotalSource(line: string, override?: { amount: number; currency: string }) {
    const text = `Vendor: Rhein Freight Services AG\nInvoice No: RFS-778\nInvoice Date: 2026-04-28\n${line}\nTax: EUR 7.00\nTotal: EUR 417.00`;
    const source = await extractTextFromDocument(new TextEncoder().encode(text), "text/plain");
    const invoice = extractInvoiceDeterministically(source.text);
    if (override) {
      invoice.lineItems[0]!.lineTotal = { ...override };
    }
    const report = buildEvidence(invoice, source);
    const field = report.fields.find((item) => item.path === "lineItems.0.lineTotal");
    return { value: field?.value, source: field?.checks.find((check) => check.name === "source")?.status };
  }

  test("a currency code written straight against its amount still verifies", async () => {
    const compact = await lineTotalSource("ITEM 1: Compact | qty=2 | unit=EUR205.00 | line=EUR410.00");
    expect(compact.value).toBe("410.00 EUR");
    expect(compact.source).toBe("pass");

    const trailing = await lineTotalSource("ITEM 1: Trailing | qty=2 | unit=205.00 EUR | line=410.00 EUR");
    expect(trailing.value).toBe("410.00 EUR");
    expect(trailing.source).toBe("pass");
  });

  test("a currency symbol against its amount verifies, and a bare amount does not", async () => {
    // The regex extractor cannot read "€410.00", so the money is set directly here: the
    // check under test is whether the document's symbol form counts as evidence for it.
    const euroSign = await lineTotalSource("ITEM 1: Symbol | qty=2 | unit=€205.00 | line=€410.00", {
      amount: 410,
      currency: "EUR"
    });
    expect(euroSign.source).toBe("pass");

    // The same amount with no currency anywhere near it is not evidence that it is EUR.
    const bare = await lineTotalSource("ITEM 1: Bare | qty=2 | unit=205.00 | line=410.00", {
      amount: 410,
      currency: "EUR"
    });
    expect(bare.source).toBe("fail");
  });

  test("a currency code buried in an identifier is not money", async () => {
    const buried = await lineTotalSource("ITEM 1: Buried | qty=2 | unit=205.00 | line=ref123EUR410.00X", {
      amount: 410,
      currency: "EUR"
    });
    expect(buried.source).toBe("fail");
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
