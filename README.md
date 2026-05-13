# Invoice Parse Agent

OCR and document-processing hero repo for turning invoice PDFs into structured JSON:

```bash
curl -s -X POST http://localhost:8787/parse \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/invoice.pdf"}'
```

The API extracts document text, asks Claude Haiku 4.5 for schema-constrained invoice JSON, and reports evaluation accuracy against a small ground-truth corpus.

Live proof dashboard: https://mj-deving.github.io/invoice-parse-agent/

Rendered dashboard proof: `docs/proof/dashboard-local.png`

## Why this exists

This is a hiring-proof repo for invoice, order, and logistics process automation. It does not claim to support every document. It targets semi-structured B2B invoices where the fields are predictable but layout and OCR noise vary.

## Architecture

```text
POST /parse
  URL or multipart PDF/image
  -> document text layer extraction for embedded-text PDFs
  -> Tesseract.js OCR for image/scanned inputs
  -> optional managed Vision/Document AI adapter boundary
  -> optional Qdrant retrieval of similar prior invoices
  -> Claude structured extraction
  -> optional Qdrant storage of parsed invoice memory
  -> zod-validated invoice JSON

GET /eval
  5 invoice fixtures
  -> extraction
  -> field hit-rate + confidence report
```

## Tradeoffs

### Tesseract.js vs managed Vision APIs

Tesseract.js is the primary OCR path because it is self-hosted, cheap, inspectable, and works in Docker without sending invoice images to a third party. That matters for supplier invoices, logistics documents, and regulated customer data.

Managed OCR such as Google Vision API, AWS Textract, or Azure Document Intelligence is the better production choice when handwriting, tables, rotated scans, multi-page invoices, or SLA-backed accuracy matter more than cost and data locality. This repo exposes `src/ocr/vision.ts` as the managed fallback boundary, but keeps it disabled by default.

### Hono on Node/Docker vs Cloudflare Workers

The runtime is Hono on Node via Bun. Cloudflare Workers are useful for routing and orchestration, but self-hosted Tesseract and PDF rasterization are a poor fit for Worker bundle size, CPU, filesystem, and native utility constraints. Docker is the deployable unit here; Workers can still call this service as an internal API.

### Claude structured extraction vs regex

Regex is reliable for the synthetic fixtures and remains as an offline fallback for tests. Claude Haiku 4.5 is used for the real extraction path because OCR output often shifts labels, table order, and address formatting. The schema boundary keeps the LLM output operational: invalid JSON fails fast instead of silently entering an accounting workflow.

### Qdrant vs no document memory

Qdrant is used as the optional vector memory layer, not as a replacement for OCR or structured extraction. When `QDRANT_URL` is configured, `/parse` retrieves similar prior invoices before extraction and stores the parsed result afterward. That gives vendor-specific examples to Claude and creates a reusable memory for recurring suppliers, purchase orders, and logistics documents.

The demo uses deterministic local hash vectors so the repo works without another model provider. In production, replace `src/memory/embedding.ts` with OpenAI, Voyage, Cohere, or local embedding vectors and keep the Qdrant storage/search contract unchanged.

Set `EMBEDDING_PROVIDER=openai` with `OPENAI_API_KEY` to use production OpenAI embeddings for Qdrant memory. The default `hash` provider stays deterministic for CI and local demos.

## Run

```bash
bun install
bun run fixtures
bun run dev
```

Open:

```bash
open http://localhost:8787/dashboard
curl http://localhost:8787/eval
curl -X POST http://localhost:8787/parse \
  -F "file=@corpus/mustard-logistics-001.pdf"
```

Set `.dev.vars` or environment variables:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-haiku-4-5
VISION_API_ENABLED=false
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=invoice_parse_agent
EMBEDDING_PROVIDER=hash
OPENAI_API_KEY=
```

Without `ANTHROPIC_API_KEY`, the app uses a deterministic extractor so tests and demos stay reproducible.

## Docker

```bash
docker build -t invoice-parse-agent .
docker run --rm -p 8787:8787 \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e ANTHROPIC_MODEL=claude-haiku-4-5 \
  invoice-parse-agent
```

With Qdrant:

```bash
docker compose up --build
```

The compose stack starts Qdrant on `localhost:6333` and the app on `localhost:8787`.

## API

### `POST /parse`

Accepted inputs:

- JSON URL: `{ "url": "https://..." }`
- JSON text for controlled tests: `{ "text": "Vendor: ..." }`
- multipart upload: field name `file`
- raw PDF/image/text body

Response shape:

```json
{
  "source": { "mode": "pdf-text", "pages": 1, "bytes": 12345 },
  "memory": { "provider": "qdrant", "collection": "invoice_parse_agent", "hits": 1, "stored": true },
  "invoice": {
    "vendor": { "name": "Mustard Yellow Logistics GmbH" },
    "invoiceNumber": "MYL-2026-001",
    "invoiceDate": "2026-04-30",
    "lineItems": [],
    "tax": { "amount": 59.09, "currency": "EUR" },
    "total": { "amount": 370.09, "currency": "EUR" },
    "confidence": 0.92,
    "warnings": []
  },
  "rawText": "..."
}
```

### `GET /eval`

Runs the ground-truth corpus and returns per-case misses plus aggregate field hit rate.

### `GET /dashboard`

Serves a browser dashboard for upload, sample parsing, eval metrics, JSON output, and operational fit.

Current deterministic eval output:

```bash
bun run eval
```

## n8n integration

`n8n-template.json` wires:

```text
Webhook -> /parse -> confidence gate -> email accounting / JSON response
```

This is the intended process-automation pattern: invoices enter via webhook, parsing is centralized, confidence gates decide whether to straight-through-process or send for review.

## Quality gates

```bash
bun run typecheck
bun test
bun run eval
```

## Corpus

The corpus uses synthetic invoices to avoid licensing ambiguity and to keep ground truth exact. The fixture names and fields are logistics-oriented: freight, cold chain, parts, terminal handling, and customs preparation.

`corpus/mustard-logistics-001-scan.png` is a rendered scanned-image fixture. The OCR smoke test runs the actual Tesseract.js wrapper against it and checks confidence plus recovered invoice identifiers.
