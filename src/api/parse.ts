import type { Context } from "hono";
import { extractInvoice } from "../extract/claude";
import { createJob } from "../jobs/store";
import { searchInvoiceMemory, storeInvoiceMemory } from "../memory/qdrant";
import { extractTextFromDocument } from "../ocr/tesseract";
import { ParseResponseSchema, type ParseResponse } from "../schema";

async function readRequestBytes(c: Context): Promise<{ bytes: Uint8Array; contentType: string | undefined }> {
  const contentType = c.req.header("content-type");

  if (contentType?.includes("application/json")) {
    const body = await c.req.json<{ url?: string; text?: string }>();
    if (body.text) {
      return { bytes: new TextEncoder().encode(body.text), contentType: "text/plain" };
    }
    if (!body.url) {
      throw new Error("JSON body must include either url or text.");
    }
    const response = await fetch(body.url);
    if (!response.ok) {
      throw new Error(`Could not fetch URL: ${response.status} ${response.statusText}`);
    }
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? undefined
    };
  }

  if (contentType?.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    const upload = body.file;
    if (!(upload instanceof File)) {
      throw new Error("Multipart body must include a file field named 'file'.");
    }
    return {
      bytes: new Uint8Array(await upload.arrayBuffer()),
      contentType: upload.type || "application/octet-stream"
    };
  }

  return {
    bytes: new Uint8Array(await c.req.arrayBuffer()),
    contentType
  };
}

export async function parseInvoiceRequest(c: Context) {
  try {
    const { bytes, contentType } = await readRequestBytes(c);
    const source = await extractTextFromDocument(bytes, contentType, {
      enableVisionFallback: process.env.VISION_API_ENABLED === "true"
    });
    const retrievedMemory = await searchInvoiceMemory(source.text);
    const invoice = await extractInvoice(source.text, retrievedMemory);
    const storedMemory = await storeInvoiceMemory(source.text, invoice);
    const parseWithoutJob = ParseResponseSchema.parse({
      source: {
        mode: source.mode,
        pages: source.pages,
        bytes: source.bytes
      },
      invoice,
      memory: retrievedMemory || storedMemory
        ? {
            provider: "qdrant",
            collection: retrievedMemory?.collection ?? storedMemory?.collection ?? "invoice_parse_agent",
            hits: retrievedMemory?.hits.length ?? 0,
            stored: storedMemory?.stored
          }
        : undefined,
      rawText: source.text
    }) as ParseResponse;
    const job = createJob(parseWithoutJob);
    const response = ParseResponseSchema.parse({
      ...parseWithoutJob,
      job: {
        id: job.id,
        status: job.status,
        reviewUrl: `/jobs/${job.id}`
      }
    });

    return c.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
}
