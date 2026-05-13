import type { Invoice } from "../schema";
import { embedText, embeddingDistance } from "./embedding";
import { randomUUID } from "node:crypto";

export interface MemoryHit {
  id: string;
  score: number;
  vendor?: string;
  invoiceNumber?: string;
  textPreview?: string;
  invoice?: Invoice;
}

export interface MemoryContext {
  enabled: boolean;
  provider: "qdrant";
  collection: string;
  hits: MemoryHit[];
  stored?: boolean;
}

interface QdrantPoint {
  id: string;
  score?: number;
  payload?: {
    vendor?: string;
    invoiceNumber?: string;
    textPreview?: string;
    invoice?: Invoice;
  };
}

function qdrantUrl(): string | undefined {
  return process.env.QDRANT_URL?.replace(/\/+$/, "");
}

function collectionName(): string {
  return process.env.QDRANT_COLLECTION ?? "invoice_parse_agent";
}

function headers() {
  const result: Record<string, string> = { "content-type": "application/json" };
  if (process.env.QDRANT_API_KEY) {
    result["api-key"] = process.env.QDRANT_API_KEY;
  }
  return result;
}

async function request(path: string, init: RequestInit = {}) {
  const baseUrl = qdrantUrl();
  if (!baseUrl) {
    throw new Error("QDRANT_URL is not configured.");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Qdrant request failed: ${response.status} ${detail}`);
  }
  return response.json() as Promise<unknown>;
}

export function isQdrantEnabled(): boolean {
  return Boolean(qdrantUrl());
}

export async function ensureInvoiceCollection(collection = collectionName(), vectorSize: number) {
  if (!isQdrantEnabled()) {
    return;
  }

  const exists = await fetch(`${qdrantUrl()}/collections/${encodeURIComponent(collection)}`, {
    headers: headers()
  });
  if (exists.ok) {
    const body = (await exists.json()) as { result?: { config?: { params?: { vectors?: { size?: number } } } } };
    const existingSize = body.result?.config?.params?.vectors?.size;
    if (existingSize !== undefined && existingSize !== vectorSize) {
      throw new Error(
        `Qdrant collection '${collection}' uses vector size ${existingSize}, but current embedding size is ${vectorSize}. Use a new QDRANT_COLLECTION or recreate the collection.`
      );
    }
    return;
  }

  const body = {
    vectors: {
      size: vectorSize,
      distance: embeddingDistance
    }
  };
  await request(`/collections/${encodeURIComponent(collection)}`, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export async function searchInvoiceMemory(text: string, limit = 3): Promise<MemoryContext | undefined> {
  if (!isQdrantEnabled()) {
    return undefined;
  }

  const collection = collectionName();
  const embedding = await embedText(text);
  await ensureInvoiceCollection(collection, embedding.vector.length);
  const response = (await request(`/collections/${encodeURIComponent(collection)}/points/search`, {
    method: "POST",
    body: JSON.stringify({
      vector: embedding.vector,
      limit,
      with_payload: true
    })
  })) as { result?: QdrantPoint[] };

  return {
    enabled: true,
    provider: "qdrant",
    collection,
    hits: (response.result ?? []).map((point) => {
      const hit: MemoryHit = {
        id: point.id,
        score: point.score ?? 0
      };
      if (point.payload?.vendor !== undefined) {
        hit.vendor = point.payload.vendor;
      }
      if (point.payload?.invoiceNumber !== undefined) {
        hit.invoiceNumber = point.payload.invoiceNumber;
      }
      if (point.payload?.textPreview !== undefined) {
        hit.textPreview = point.payload.textPreview;
      }
      if (point.payload?.invoice !== undefined) {
        hit.invoice = point.payload.invoice;
      }
      return hit;
    })
  };
}

export async function storeInvoiceMemory(text: string, invoice: Invoice): Promise<MemoryContext | undefined> {
  if (!isQdrantEnabled()) {
    return undefined;
  }

  const collection = collectionName();
  const embedding = await embedText(text);
  await ensureInvoiceCollection(collection, embedding.vector.length);
  const id = randomUUID();
  await request(`/collections/${encodeURIComponent(collection)}/points?wait=true`, {
    method: "PUT",
    body: JSON.stringify({
      points: [
        {
          id,
          vector: embedding.vector,
          payload: {
            vendor: invoice.vendor.name,
            invoiceNumber: invoice.invoiceNumber,
            embeddingProvider: embedding.provider,
            embeddingModel: embedding.model,
            textPreview: text.slice(0, 600),
            invoice
          }
        }
      ]
    })
  });

  return {
    enabled: true,
    provider: "qdrant",
    collection,
    hits: [],
    stored: true
  };
}

export function formatMemoryForPrompt(memory?: MemoryContext): string {
  if (!memory?.hits.length) {
    return "No prior invoice examples were retrieved.";
  }

  return memory.hits
    .map((hit, index) => {
      const invoice = hit.invoice ? JSON.stringify(hit.invoice) : "no parsed invoice payload";
      return `Example ${index + 1} score=${hit.score.toFixed(3)} vendor=${hit.vendor ?? "unknown"} invoice=${hit.invoiceNumber ?? "unknown"}\n${invoice}`;
    })
    .join("\n\n");
}
