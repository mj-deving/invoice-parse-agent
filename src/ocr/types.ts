export type TextSourceMode = "pdf-text" | "ocr" | "plain-text" | "vision-fallback";

/** One word as Tesseract read it, with the engine's own confidence in that read (0..1). */
export interface OcrWord {
  text: string;
  confidence: number;
}

/** Words stay grouped by line so a field can be scored against the line it came from. */
export interface OcrLine {
  text: string;
  words: OcrWord[];
}

export interface TextExtractionResult {
  text: string;
  mode: TextSourceMode;
  pages: number;
  bytes: number;
  confidence?: number;
  lines?: OcrLine[];
}

export interface OcrOptions {
  enableVisionFallback?: boolean;
}
