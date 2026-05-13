import type { Context } from "hono";

const sampleInvoiceText = `Vendor: Mustard Yellow Logistics GmbH
Vendor Tax ID: DE317000111
Vendor Address: Dockstrasse 12, 20457 Hamburg
Customer: Synergy Energy Logistics
Customer Address: Harbour Road 8, Tallinn
Invoice No: MYL-2026-001
Invoice Date: 2026-04-30
Due Date: 2026-05-14
ITEM 1: Pallet handling Hamburg terminal | qty=12 | unit=EUR 18.00 | tax=19% | line=EUR 216.00
ITEM 2: Customs document preparation | qty=1 | unit=EUR 95.00 | tax=19% | line=EUR 95.00
Tax: EUR 59.09
Total: EUR 370.09`;

const html = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice Parse Agent Dashboard</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #151a1f;
        --muted: #52606b;
        --line: #d8dee4;
        --bg: #f6f8fa;
        --panel: #ffffff;
        --accent: #16745f;
        --accent-2: #a45212;
        --danger: #a42a2a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font: 14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      header {
        border-bottom: 1px solid var(--line);
        background: var(--panel);
      }
      .shell {
        width: min(1180px, calc(100vw - 32px));
        margin: 0 auto;
      }
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        min-height: 76px;
      }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 24px; font-weight: 760; letter-spacing: 0; }
      h2 { font-size: 15px; font-weight: 720; letter-spacing: 0; }
      h3 { font-size: 13px; font-weight: 720; color: var(--muted); letter-spacing: 0; text-transform: uppercase; }
      .sub { color: var(--muted); margin-top: 4px; max-width: 760px; }
      .status {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fafdff;
        white-space: nowrap;
        color: var(--muted);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 99px;
        background: var(--accent);
      }
      main {
        display: grid;
        grid-template-columns: 360px 1fr;
        gap: 16px;
        padding: 16px 0 28px;
      }
      section {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 14px;
      }
      .stack { display: grid; gap: 12px; }
      .controls { display: grid; gap: 10px; }
      label { display: grid; gap: 6px; color: var(--muted); font-weight: 620; }
      textarea {
        width: 100%;
        min-height: 220px;
        resize: vertical;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px;
        color: var(--ink);
        font: 12px/1.45 ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      }
      input[type="file"] {
        border: 1px dashed var(--line);
        border-radius: 8px;
        padding: 10px;
        background: #fbfcfd;
      }
      button {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
        color: var(--ink);
        min-height: 38px;
        padding: 0 12px;
        font-weight: 700;
        cursor: pointer;
      }
      button.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
      button.warning {
        border-color: #e5bf94;
        color: var(--accent-2);
      }
      .button-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }
      .metric {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 12px;
        background: #fbfcfd;
      }
      .metric strong {
        display: block;
        margin-top: 6px;
        font-size: 24px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th, td {
        padding: 8px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
      }
      th { color: var(--muted); font-size: 12px; }
      pre {
        min-height: 420px;
        margin: 0;
        overflow: auto;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 12px;
        background: #0f1720;
        color: #e6edf3;
        font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      }
      .error { color: var(--danger); font-weight: 700; }
      @media (max-width: 900px) {
        main, .grid { grid-template-columns: 1fr; }
        .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .top { align-items: flex-start; flex-direction: column; padding: 14px 0; }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="shell top">
        <div>
          <h1>Invoice Parse Agent</h1>
          <p class="sub">OCR and structured extraction dashboard for semi-structured B2B invoices, with evaluation proof and confidence gating.</p>
        </div>
        <div class="status"><span class="dot"></span><span id="health">Service ready</span></div>
      </div>
    </header>
    <div class="shell">
      <main>
        <section class="stack">
          <div>
            <h2>Parse Invoice</h2>
            <p class="sub">Upload a PDF or parse the sample invoice text.</p>
          </div>
          <div class="controls">
            <label>
              PDF or image upload
              <input id="file" type="file" accept=".pdf,image/*,text/plain" />
            </label>
            <div class="button-row">
              <button class="primary" id="parseFile">Parse upload</button>
              <button id="loadSample">Load sample</button>
              <button class="warning" id="runEval">Run eval</button>
            </div>
            <label>
              Invoice text
              <textarea id="invoiceText"></textarea>
            </label>
            <button class="primary" id="parseText">Parse text</button>
          </div>
        </section>
        <div class="stack">
          <section class="stack">
            <div>
              <h2>Evaluation</h2>
              <p class="sub">Ground truth corpus: 5 logistics invoices, field-level scoring.</p>
            </div>
            <div class="metrics">
              <div class="metric"><h3>Field Hit Rate</h3><strong id="hitRate">--</strong></div>
              <div class="metric"><h3>Fields</h3><strong id="fields">--</strong></div>
              <div class="metric"><h3>Hits</h3><strong id="hits">--</strong></div>
              <div class="metric"><h3>Avg Confidence</h3><strong id="confidence">--</strong></div>
            </div>
            <table>
              <thead><tr><th>Case</th><th>Hit Rate</th><th>Misses</th></tr></thead>
              <tbody id="caseRows"><tr><td colspan="3">Run eval to populate results.</td></tr></tbody>
            </table>
          </section>
          <div class="grid">
            <section class="stack">
              <h2>Structured JSON</h2>
              <pre id="jsonOut">{}</pre>
            </section>
            <section class="stack">
              <h2>Operational Fit</h2>
              <table>
                <tbody>
                  <tr><th>Self-host OCR</th><td>Tesseract.js path for Docker deployments.</td></tr>
                  <tr><th>Managed OCR</th><td>Vision/Document AI adapter boundary is explicit.</td></tr>
                  <tr><th>Memory</th><td>Optional Qdrant retrieval of similar prior invoices.</td></tr>
                  <tr><th>Extraction</th><td>Claude Haiku 4.5 schema-driven JSON with validation.</td></tr>
                  <tr><th>Automation</th><td>n8n webhook template with confidence gate.</td></tr>
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </main>
    </div>
    <script>
      const sample = ${JSON.stringify(sampleInvoiceText)};
      const out = document.getElementById("jsonOut");
      const health = document.getElementById("health");
      const textArea = document.getElementById("invoiceText");
      const caseRows = document.getElementById("caseRows");

      function setJson(value) {
        out.textContent = JSON.stringify(value, null, 2);
      }

      function setError(error) {
        health.innerHTML = '<span class="error">' + error.message + "</span>";
        setJson({ error: error.message });
      }

      async function parseText() {
        health.textContent = "Parsing text...";
        const response = await fetch("/parse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: textArea.value })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Parse failed");
        health.textContent = "Parsed invoice " + body.invoice.invoiceNumber;
        setJson(body);
      }

      async function parseFile() {
        const input = document.getElementById("file");
        if (!input.files.length) throw new Error("Choose a PDF or image first.");
        const form = new FormData();
        form.append("file", input.files[0]);
        health.textContent = "Parsing upload...";
        const response = await fetch("/parse", { method: "POST", body: form });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Parse failed");
        health.textContent = "Parsed invoice " + body.invoice.invoiceNumber;
        setJson(body);
      }

      async function runEval() {
        health.textContent = "Running eval...";
        const response = await fetch("/eval");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Eval failed");
        const totals = body.totals;
        document.getElementById("hitRate").textContent = Math.round(totals.fieldHitRate * 100) + "%";
        document.getElementById("fields").textContent = totals.fields;
        document.getElementById("hits").textContent = totals.hits;
        document.getElementById("confidence").textContent = Math.round(totals.averageConfidence * 100) + "%";
        caseRows.innerHTML = body.cases.map((item) => {
          const misses = item.misses.length ? item.misses.join(", ") : "none";
          return "<tr><td>" + item.id + "</td><td>" + Math.round(item.hitRate * 100) + "%</td><td>" + misses + "</td></tr>";
        }).join("");
        health.textContent = "Eval complete";
        setJson(body);
      }

      document.getElementById("loadSample").addEventListener("click", () => {
        textArea.value = sample;
        health.textContent = "Sample loaded";
      });
      document.getElementById("parseText").addEventListener("click", () => parseText().catch(setError));
      document.getElementById("parseFile").addEventListener("click", () => parseFile().catch(setError));
      document.getElementById("runEval").addEventListener("click", () => runEval().catch(setError));

      textArea.value = sample;
      runEval().catch(setError);
    </script>
  </body>
</html>`;

export function dashboardRequest(c: Context) {
  return c.html(html);
}
