import type { TextExtractionResult } from "./types";

export async function extractWithVisionFallback(_bytes: Uint8Array): Promise<TextExtractionResult> {
  if (process.env.VISION_API_ENABLED !== "true") {
    throw new Error("Vision API fallback is disabled. Set VISION_API_ENABLED=true and wire Google credentials.");
  }

  throw new Error(
    "Vision API adapter is intentionally a boundary in this repo. Use this hook for Google Vision or Document AI in managed deployments."
  );
}
