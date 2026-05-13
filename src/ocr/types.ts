export type TextSourceMode = "pdf-text" | "ocr" | "plain-text" | "vision-fallback";

export interface TextExtractionResult {
  text: string;
  mode: TextSourceMode;
  pages: number;
  bytes: number;
  confidence?: number;
}

export interface OcrOptions {
  enableVisionFallback?: boolean;
}
