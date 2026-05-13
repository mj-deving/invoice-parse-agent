import type { Invoice } from "../schema";
import { embeddingConfig, vectorizeText } from "./embedding";
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

export async function ensureInvoiceCollection(collection = collectionName()) {
  if (!isQdrantEnabled()) {
    return;
  }

  const exists = await fetch(`${qdrantUrl()}/collections/${encodeURIComponent(collection)}`, {
    headers: headers()
  });
  if (exists.ok) {
    return;
  }

  const body = {
    vectors: {
      size: embeddingConfig.size,
      distance: embeddingConfig.distance
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
  await ensureInvoiceCollection(collection);
  const response = (await request(`/collections/${encodeURIComponent(collection)}/points/search`, {
    method: "POST",
    body: JSON.stringify({
      vector: vectorizeText(text),
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
  await ensureInvoiceCollection(collection);
  const id = randomUUID();
  await request(`/collections/${encodeURIComponent(collection)}/points?wait=true`, {
    method: "PUT",
    body: JSON.stringify({
      points: [
        {
          id,
          vector: vectorizeText(text),
          payload: {
            vendor: invoice.vendor.name,
            invoiceNumber: invoice.invoiceNumber,
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
