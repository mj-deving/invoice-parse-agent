import { describe, expect, test } from "bun:test";
import { extractInvoiceDeterministically } from "../src/extract/fallback";
import { InvoiceSchema } from "../src/schema";

const sample = `Vendor: Test Logistics GmbH
Vendor Tax ID: DE123
Invoice No: INV-1
Invoice Date: 2026-05-01
Due Date: 2026-05-15
ITEM 1: Port handling | qty=2 | unit=EUR 50.00 | tax=19% | line=EUR 100.00
Tax: EUR 19.00
Total: EUR 119.00`;

describe("deterministic extraction", () => {
  test("extracts invoice fields when Claude is not configured", () => {
    const invoice = extractInvoiceDeterministically(sample);
    expect(invoice.vendor.name).toBe("Test Logistics GmbH");
    expect(invoice.invoiceNumber).toBe("INV-1");
    expect(invoice.lineItems[0]?.lineTotal.amount).toBe(100);
  });

  test("returns data that conforms to the public invoice schema", () => {
    const invoice = extractInvoiceDeterministically(sample);
    expect(() => InvoiceSchema.parse(invoice)).not.toThrow();
  });
});
