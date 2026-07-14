import { describe, expect, test } from "bun:test";
import { app } from "../src/server";
import { resetJobsForTests } from "../src/jobs/store";

// POST /parse is the operator surface, which the public demo seals. See test/demo.test.ts.
process.env.DEMO_MODE = "false";

const text = `Vendor: API Freight
Invoice No: API-7
Invoice Date: 2026-05-07
ITEM 1: Shipment matching | qty=1 | unit=EUR 10.00 | line=EUR 10.00
Tax: EUR 1.90
Total: EUR 11.90`;

describe("HTTP API", () => {
  test("POST /parse accepts JSON text and returns structured invoice JSON", async () => {
    resetJobsForTests();
    const response = await app.request("/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text })
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.invoice.invoiceNumber).toBe("API-7");
    expect(body.source.mode).toBe("plain-text");
    expect(typeof body.job.id).toBe("string");
  });

  test("GET /eval returns aggregate hit-rate report", async () => {
    const response = await app.request("/eval");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.totals.fieldHitRate).toBeGreaterThan(0.95);
    expect(body.cases.length).toBe(5);
  });
});
