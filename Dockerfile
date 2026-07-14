FROM oven/bun:1.3.9-slim

ENV DEBIAN_FRONTEND=noninteractive

# poppler-utils gives pdftoppm, which rasterizes a scanned PDF before Tesseract reads it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY . .

# Read one bundled scan at build time. This does two jobs.
#
# It caches the language data. tesseract.js is WASM and looks for eng.traineddata in the
# working directory, downloading it from a CDN at the first OCR if it is absent. Running
# OCR here leaves the file in /app, so the container reads documents with no network and
# the first visitor after a cold start does not wait for a 5 MB download.
#
# It also pins WHICH language data. Debian's tesseract-ocr-eng ships a different build to
# the one tesseract.js fetches, and a different build reads the same scan differently: the
# marks this demo shows are confidence numbers, so a swapped file would make the deployed
# demo disagree with the test suite that verified it. Letting tesseract.js fetch its own
# default means the image, the tests and CI all read with the same file.
#
# And it is a gate: if OCR cannot run, the build fails here rather than in front of a visitor.
RUN bun -e 'import { extractTextFromDocument } from "./src/ocr/tesseract"; \
  const bytes = new Uint8Array(await Bun.file("corpus/mustard-logistics-001-scan.png").arrayBuffer()); \
  const result = await extractTextFromDocument(bytes, "image/png"); \
  if (result.mode !== "ocr" || !result.text.includes("MYL-2026-001")) throw new Error("OCR warmup failed"); \
  console.log("OCR warmup ok, page confidence", result.confidence);' \
  && test -f /app/eng.traineddata

# Demo mode is the default, so a deploy that sets no env cannot take a stranger's
# document or hand one visitor's parse to the next. See src/server.ts.
ENV DEMO_MODE=true
ENV PORT=8787
EXPOSE 8787
CMD ["bun", "run", "start"]
