import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { app } from "../src/server";

const previous = process.env.DEMO_MODE;

beforeEach(() => {
  process.env.DEMO_MODE = "true";
});

afterAll(() => {
  if (previous === undefined) {
    delete process.env.DEMO_MODE;
  } else {
    process.env.DEMO_MODE = previous;
  }
});

describe("public demo surface", () => {
  test("GET / serves the console", async () => {
    const response = await app.request("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("invoice-parse-agent");
    // The one token this project is allowed to override from the shared lab lock.
    expect(html).toContain("--accent:#e58aa8");
  });

  test("GET /demo/documents lists the bundled documents and never a filesystem path", async () => {
    const response = await app.request("/demo/documents");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.documents.length).toBe(6);
    expect(body.documents.every((doc: { id: string }) => doc.id.length > 0)).toBe(true);
    expect(body.upload).toBe(false);
    expect(JSON.stringify(body)).not.toContain("corpus/");
  });

  test("POST /demo/parse runs the real pipeline on a bundled document and returns field evidence", async () => {
    const response = await app.request("/demo/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "rhein-freight-778" })
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.invoice.invoiceNumber).toBe("RFS-778");
    expect(body.evidence.fields.length).toBeGreaterThan(8);
    expect(body.extractor.name.length).toBeGreaterThan(0);
    expect(body.rawText).toContain("RFS-778");
    expect(typeof body.timings.totalMs).toBe("number");
  }, 30000);

  test("POST /demo/parse refuses an id that is not a bundled document", async () => {
    const response = await app.request("/demo/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "../../etc/passwd" })
    });
    expect(response.status).toBe(400);
  });

  test("the demo persists nothing: a demo parse creates no job", async () => {
    await app.request("/demo/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "alpine-spares-9201" })
    });

    process.env.DEMO_MODE = "false";
    const jobs = await app.request("/jobs");
    const body = await jobs.json();
    expect(body.jobs.find((job: { invoiceNumber: string }) => job.invoiceNumber === "AS-9201")).toBeUndefined();
  }, 30000);
});

describe("demo mode seals the operator surface", () => {
  test("POST /parse is refused, so no stranger's document reaches the server", async () => {
    const response = await app.request("/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data/" })
    });
    expect(response.status).toBe(403);
  });

  test("GET /jobs is refused, so no parsed document is readable by a visitor", async () => {
    const response = await app.request("/jobs");
    expect(response.status).toBe(403);
  });

  test("GET /dashboard is refused", async () => {
    const response = await app.request("/dashboard");
    expect(response.status).toBe(403);
  });

  test("the operator surface is reachable when the operator turns demo mode off", async () => {
    process.env.DEMO_MODE = "false";
    expect((await app.request("/jobs")).status).toBe(200);
    expect((await app.request("/dashboard")).status).toBe(200);
  });
});
