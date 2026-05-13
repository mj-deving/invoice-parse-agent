const hashVectorSize = 64;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (const char of token) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function vectorizeText(text: string): number[] {
  const vector = Array.from({ length: hashVectorSize }, () => 0);
  for (const token of tokenize(text)) {
    const hash = hashToken(token);
    const index = hash % hashVectorSize;
    const sign = hash & 1 ? 1 : -1;
    vector[index] = (vector[index] ?? 0) + sign;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

export interface EmbeddingResult {
  vector: number[];
  provider: "hash" | "openai";
  model: string;
}

async function embedWithOpenAI(text: string): Promise<EmbeddingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY.");
  }

  const model = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? "1536");
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: text,
      dimensions
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI embedding request failed: ${response.status} ${detail}`);
  }

  const body = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  const vector = body.data?.[0]?.embedding;
  if (!vector?.length) {
    throw new Error("OpenAI embedding response did not include a vector.");
  }

  return { vector, provider: "openai", model };
}

export async function embedText(text: string): Promise<EmbeddingResult> {
  if (process.env.EMBEDDING_PROVIDER === "openai") {
    return embedWithOpenAI(text);
  }

  return {
    vector: vectorizeText(text),
    provider: "hash",
    model: "local-hash-v1"
  };
}

export const embeddingDistance = "Cosine";
