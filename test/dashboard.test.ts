import { describe, expect, test } from "bun:test";
import { app } from "../src/server";

describe("dashboard", () => {
  test("serves the browser proof dashboard", async () => {
    const response = await app.request("/dashboard");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Invoice Parse Agent");
    expect(html).toContain("Run eval");
    expect(html).toContain("/parse");
  });
});
