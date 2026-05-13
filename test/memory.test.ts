import { describe, expect, test } from "bun:test";
import { embedText, vectorizeText } from "../src/memory/embedding";
import { formatMemoryForPrompt } from "../src/memory/qdrant";

describe("Qdrant memory helpers", () => {
  test("creates stable vectors for invoice text", () => {
    const first = vectorizeText("Vendor: Mustard Yellow Logistics Total EUR 370.09");
    const second = vectorizeText("Vendor: Mustard Yellow Logistics Total EUR 370.09");
    expect(first).toEqual(second);
    expect(first).toHaveLength(64);
  });

  test("defaults to local hash embeddings without external credentials", async () => {
    const embedding = await embedText("Vendor: Mustard Yellow Logistics Total EUR 370.09");
    expect(embedding.provider).toBe("hash");
    expect(embedding.model).toBe("local-hash-v1");
    expect(embedding.vector).toHaveLength(64);
  });

  test("formats retrieved invoice memory for Claude context", () => {
    const prompt = formatMemoryForPrompt({
      enabled: true,
      provider: "qdrant",
      collection: "invoice_parse_agent",
      hits: [
        {
          id: "mustard-yellow-logistics-myl-2026-001",
          score: 0.91,
          vendor: "Mustard Yellow Logistics GmbH",
          invoiceNumber: "MYL-2026-001"
        }
      ]
    });
    expect(prompt).toContain("score=0.910");
    expect(prompt).toContain("Mustard Yellow Logistics");
  });
});
