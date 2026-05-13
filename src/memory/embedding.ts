const vectorSize = 64;

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
  const vector = Array.from({ length: vectorSize }, () => 0);
  for (const token of tokenize(text)) {
    const hash = hashToken(token);
    const index = hash % vectorSize;
    const sign = hash & 1 ? 1 : -1;
    vector[index] = (vector[index] ?? 0) + sign;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

export const embeddingConfig = {
  size: vectorSize,
  distance: "Cosine"
} as const;
