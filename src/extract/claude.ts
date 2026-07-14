import Anthropic from "@anthropic-ai/sdk";
import { extractInvoiceDeterministically } from "./fallback";
import { formatMemoryForPrompt, type MemoryContext } from "../memory/qdrant";
import { InvoiceSchema, jsonSchemaForPrompt, type Invoice } from "../schema";

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Claude response did not contain a JSON object.");
  }
  return JSON.parse(match[0]);
}

export interface ActiveExtractor {
  name: string;
  detail: string;
}

/**
 * Which extractor will actually run, so a surface can name it instead of claiming one.
 * Without a key the deterministic regex path runs, and a page that showed "Claude" then
 * would be lying about where its fields came from.
 */
export function activeExtractor(): ActiveExtractor {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      name: "deterministic fallback",
      detail: "No ANTHROPIC_API_KEY is set, so fields come from the regex extractor, not a model."
    };
  }
  const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
  return { name: model, detail: "Schema-constrained extraction, temperature 0." };
}

export async function extractInvoice(text: string, memory?: MemoryContext): Promise<Invoice> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return extractInvoiceDeterministically(text);
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
  const message = await client.messages.create({
    model,
    max_tokens: 1800,
    temperature: 0,
    system:
      "Extract invoice data from OCR text. Return only a JSON object matching the provided schema. Do not invent fields; lower confidence and add warnings when OCR evidence is weak.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `JSON schema:\n${JSON.stringify(jsonSchemaForPrompt)}\n\nPrior similar invoice examples from Qdrant:\n${formatMemoryForPrompt(memory)}\n\nOCR text:\n${text}`
          }
        ]
      }
    ]
  });

  const block = message.content.find((part) => part.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text block.");
  }

  return InvoiceSchema.parse(extractJson(block.text));
}
