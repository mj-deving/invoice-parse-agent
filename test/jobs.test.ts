import { describe, expect, test } from "bun:test";
import { app } from "../src/server";
import { getJob, listJobs, resetJobsForTests } from "../src/jobs/store";

// The review queue is the operator surface, which the public demo seals. See test/demo.test.ts.
process.env.DEMO_MODE = "false";

const text = `Vendor: Review Desk Logistics
Invoice No: RDL-42
Invoice Date: 2026-05-08
ITEM 1: Manual review workflow | qty=1 | unit=EUR 25.00 | line=EUR 25.00
Tax: EUR 4.75
Total: EUR 29.75`;

describe("invoice review jobs", () => {
  test("creates a review job from a parse and saves corrected invoice JSON", async () => {
    resetJobsForTests();
    const parseResponse = await app.request("/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text })
    });
    expect(parseResponse.status).toBe(200);
    const parsed = await parseResponse.json();
    expect(parsed.job.status).toBe("needs_review");
    expect(listJobs()).toHaveLength(1);

    const job = getJob(parsed.job.id);
    if (!job) {
      throw new Error("Expected parse job to exist.");
    }
    expect(job?.invoiceNumber).toBe("RDL-42");

    const invoice = { ...job.invoice, confidence: 0.98 };
    const reviewResponse = await app.request(`/jobs/${parsed.job.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invoice, reviewNote: "Corrected total and approved." })
    });
    expect(reviewResponse.status).toBe(200);
    const reviewed = await reviewResponse.json();
    expect(reviewed.job.status).toBe("reviewed");
    expect(reviewed.job.confidence).toBe(0.98);
  });

  test("lists jobs for the dashboard queue", async () => {
    const response = await app.request("/jobs");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.jobs)).toBe(true);
  });
});
