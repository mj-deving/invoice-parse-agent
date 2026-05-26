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
    <title>Invoice Parse Agent &middot; Operator Terminal</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,900&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        color-scheme: light;
        --ink: #0e1b2c;
        --ink-soft: #2a3a4f;
        --muted: #6a7689;
        --hairline: #d6cfbf;
        --paper: #f4f1ea;
        --paper-2: #ece7d8;
        --panel: #fbf8f1;
        --stamp: #b85c25;
        --stamp-deep: #8a3f17;
        --verified: #2f5d3a;
        --danger: #9a2a2a;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        background: var(--paper);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13.5px;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      h1, h2, h3, h4, p { margin: 0; }
      .display {
        font-family: Fraunces, "Newsreader", "EB Garamond", Georgia, serif;
        font-optical-sizing: auto;
      }
      .mono {
        font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      }
      .micro {
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 10.5px;
        font-weight: 500;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .shell {
        width: min(1280px, calc(100vw - 32px));
        margin: 0 auto;
      }

      /* Masthead */
      header.masthead {
        background: var(--paper);
        border-bottom: 2px solid var(--ink);
        position: relative;
      }
      header.masthead::after {
        content: "";
        display: block;
        height: 3px;
        background: var(--ink);
        margin-top: 2px;
      }
      .masthead-top {
        padding: 14px 0 12px;
        border-bottom: 1px solid var(--hairline);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .masthead-top .lhs {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        align-items: center;
      }
      .masthead-bottom {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        gap: 32px;
        align-items: end;
        padding: 22px 0 22px;
      }
      .masthead-bottom h1 {
        font-family: Fraunces, Georgia, serif;
        font-weight: 900;
        font-size: clamp(30px, 4vw, 44px);
        line-height: 0.98;
        letter-spacing: -0.022em;
      }
      .masthead-bottom h1 em {
        font-style: italic;
        font-weight: 500;
        color: var(--stamp-deep);
      }
      .masthead-bottom .lede {
        font-family: Fraunces, Georgia, serif;
        font-size: 15px;
        line-height: 1.5;
        color: var(--ink-soft);
        max-width: 56ch;
        margin-top: 10px;
      }
      .status-block {
        display: grid;
        gap: 8px;
        padding: 14px 16px;
        border: 1px solid var(--hairline);
        border-radius: 2px;
        background: var(--panel);
      }
      .status-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        font-family: "JetBrains Mono", monospace;
        font-size: 11.5px;
      }
      .status-row .key {
        color: var(--muted);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 10px;
        font-weight: 600;
      }
      .status-row .val { color: var(--ink); font-weight: 700; }
      .status-dot {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 99px;
        background: var(--verified);
        box-shadow: 0 0 0 3px rgba(47, 93, 58, 0.18);
      }
      .seal {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 4px 9px;
        border: 1.5px solid var(--stamp);
        color: var(--stamp);
        font-family: "JetBrains Mono", monospace;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        border-radius: 2px;
        transform: rotate(-1.5deg);
      }
      .seal::before {
        content: "";
        width: 5px;
        height: 5px;
        border-radius: 99px;
        background: var(--stamp);
      }

      /* Main */
      main {
        padding: 22px 0 60px;
        display: grid;
        grid-template-columns: 380px 1fr;
        gap: 22px;
      }
      .col { display: grid; gap: 22px; align-content: start; }

      section.card {
        background: var(--panel);
        border: 1px solid var(--hairline);
        border-radius: 2px;
        box-shadow: 0 1px 0 rgba(14, 27, 44, 0.04);
        overflow: hidden;
      }
      .card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--hairline);
        background: var(--paper-2);
      }
      .card-head .title {
        display: flex;
        align-items: baseline;
        gap: 12px;
      }
      .card-head h2 {
        font-family: Fraunces, Georgia, serif;
        font-weight: 700;
        font-size: 17px;
        letter-spacing: -0.01em;
        color: var(--ink);
      }
      .card-head .ref {
        font-family: "JetBrains Mono", monospace;
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .card-body { padding: 16px; display: grid; gap: 14px; }

      .field-label {
        display: grid;
        gap: 6px;
        font-family: "JetBrains Mono", monospace;
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
      }
      textarea, input[type="file"] {
        width: 100%;
        border: 1px solid var(--hairline);
        border-radius: 2px;
        padding: 10px 12px;
        color: var(--ink);
        background: var(--paper);
        font: 12.5px/1.55 "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
        transition: border-color 120ms ease, background 120ms ease;
      }
      textarea {
        min-height: 200px;
        resize: vertical;
      }
      textarea:focus, input[type="file"]:focus {
        outline: none;
        border-color: var(--stamp);
        background: #fff;
        box-shadow: 0 0 0 2px rgba(184, 92, 37, 0.12);
      }
      input[type="file"] {
        border: 1.5px dashed var(--hairline);
        background: var(--paper);
        cursor: pointer;
      }
      input[type="file"]::file-selector-button {
        margin-right: 12px;
        padding: 6px 12px;
        border: 1px solid var(--ink);
        background: var(--ink);
        color: var(--paper);
        font-family: "JetBrains Mono", monospace;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        border-radius: 2px;
        cursor: pointer;
      }
      input[type="file"]::file-selector-button:hover {
        background: var(--stamp-deep);
        border-color: var(--stamp-deep);
      }

      button {
        border: 1px solid var(--ink);
        background: transparent;
        color: var(--ink);
        padding: 9px 14px;
        font-family: "JetBrains Mono", monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        border-radius: 2px;
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
      }
      button:hover {
        background: var(--ink);
        color: var(--paper);
      }
      button.primary {
        background: var(--stamp);
        border-color: var(--stamp);
        color: #fff;
      }
      button.primary:hover {
        background: var(--stamp-deep);
        border-color: var(--stamp-deep);
      }
      button.ghost {
        border-color: var(--hairline);
        color: var(--ink-soft);
        background: var(--paper);
      }
      button.ghost:hover {
        background: var(--paper-2);
        color: var(--ink);
        border-color: var(--ink);
      }
      .button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      /* Manifest metrics */
      .manifest {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .manifest .cell {
        padding: 16px 16px 18px;
        border-right: 1px solid var(--hairline);
        background: var(--panel);
      }
      .manifest .cell:last-child { border-right: none; }
      .manifest .cell .micro { display: block; margin-bottom: 8px; }
      .manifest .cell .value {
        font-family: Fraunces, Georgia, serif;
        font-weight: 700;
        font-size: 32px;
        line-height: 1;
        letter-spacing: -0.025em;
        color: var(--ink);
        font-variant-numeric: tabular-nums;
      }
      .manifest .cell .value.accent { color: var(--stamp-deep); }
      .manifest .cell .value .unit {
        font-size: 18px;
        color: var(--muted);
        margin-left: 2px;
      }

      /* Ledger table */
      table.ledger {
        width: 100%;
        border-collapse: collapse;
        font-family: "JetBrains Mono", monospace;
        font-size: 12px;
      }
      table.ledger thead th {
        text-align: left;
        padding: 9px 14px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--muted);
        border-bottom: 1.5px solid var(--ink);
        background: var(--paper-2);
      }
      table.ledger tbody td {
        padding: 11px 14px;
        border-bottom: 1px solid var(--hairline);
        color: var(--ink);
        vertical-align: middle;
      }
      table.ledger tbody tr:last-child td { border-bottom: none; }
      table.ledger tbody tr:hover td { background: rgba(184, 92, 37, 0.04); }
      .hit-pill {
        display: inline-block;
        padding: 2px 8px;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        background: var(--verified);
        color: var(--paper);
        border-radius: 2px;
      }
      .miss-none {
        font-family: Fraunces, Georgia, serif;
        font-style: italic;
        font-size: 12.5px;
        color: var(--muted);
      }

      /* Jobs table */
      table.jobs {
        width: 100%;
        border-collapse: collapse;
        font-family: "JetBrains Mono", monospace;
        font-size: 11.5px;
      }
      table.jobs thead th {
        text-align: left;
        padding: 8px 12px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
        border-bottom: 1.5px solid var(--ink);
        background: var(--paper-2);
      }
      table.jobs tbody td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--hairline);
        vertical-align: top;
      }
      table.jobs tbody tr:last-child td { border-bottom: none; }
      table.jobs td button {
        padding: 4px 8px;
        font-size: 10.5px;
        letter-spacing: 0.08em;
        border-color: var(--hairline);
        color: var(--stamp-deep);
        background: var(--paper);
        margin-bottom: 4px;
      }
      table.jobs td button:hover {
        background: var(--stamp-deep);
        color: var(--paper);
        border-color: var(--stamp-deep);
      }
      .vendor-line {
        display: block;
        color: var(--muted);
        font-size: 10.5px;
        margin-top: 2px;
        text-transform: none;
        letter-spacing: 0;
      }
      .job-status {
        display: inline-block;
        padding: 2px 7px;
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        border-radius: 2px;
        background: var(--ink);
        color: var(--paper);
      }

      /* Fit table */
      table.fit {
        width: 100%;
        border-collapse: collapse;
        font-size: 12.5px;
      }
      table.fit th {
        text-align: left;
        padding: 11px 14px 11px 0;
        font-family: "JetBrains Mono", monospace;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--stamp-deep);
        border-bottom: 1px solid var(--hairline);
        white-space: nowrap;
        vertical-align: top;
        width: 1%;
      }
      table.fit td {
        padding: 11px 0;
        border-bottom: 1px solid var(--hairline);
        color: var(--ink-soft);
        font-family: Fraunces, Georgia, serif;
        font-size: 13px;
        line-height: 1.5;
      }
      table.fit tr:last-child th, table.fit tr:last-child td { border-bottom: none; }

      /* JSON terminal */
      pre.terminal {
        margin: 0;
        overflow: auto;
        background: var(--ink);
        color: #e8e3d4;
        font-family: "JetBrains Mono", monospace;
        font-size: 12px;
        line-height: 1.6;
        padding: 16px 18px;
        border-radius: 2px;
        min-height: 360px;
        max-height: 520px;
        white-space: pre;
      }
      #reviewJson { min-height: 280px; }

      .placeholder {
        padding: 16px;
        font-family: Fraunces, Georgia, serif;
        font-style: italic;
        font-size: 13px;
        color: var(--muted);
        text-align: center;
      }
      .error {
        color: var(--danger);
        font-weight: 700;
        font-family: "JetBrains Mono", monospace;
      }

      .legend {
        font-family: Fraunces, Georgia, serif;
        font-style: italic;
        font-size: 12.5px;
        color: var(--muted);
        padding: 0 16px 14px;
      }

      /* Footer */
      footer {
        border-top: 2px solid var(--ink);
        padding: 18px 0 22px;
        background: var(--paper);
        margin-top: 8px;
      }
      footer .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        font-family: "JetBrains Mono", monospace;
        font-size: 10.5px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }
      footer .row b { color: var(--ink); font-weight: 700; }

      @media (max-width: 900px) {
        main { grid-template-columns: 1fr; }
        .manifest { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .manifest .cell:nth-child(2) { border-right: none; }
        .masthead-bottom { grid-template-columns: 1fr; gap: 18px; }
        .masthead-top { gap: 10px; }
      }
    </style>
  </head>
  <body>
    <header class="masthead">
      <div class="shell">
        <div class="masthead-top">
          <div class="lhs">
            <span class="micro">Terminal &middot; OPS-01</span>
            <span class="micro">Channel &middot; /dashboard</span>
            <span class="micro">Build &middot; Live</span>
          </div>
          <span class="seal">Customs &middot; Verified</span>
        </div>
        <div class="masthead-bottom">
          <div>
            <h1>Invoice Parse Agent <em>&mdash; operator terminal.</em></h1>
            <p class="lede">OCR, schema-driven extraction, and confidence-gated review for semi-structured B2B logistics invoices. Parse, evaluate, and reconcile in one surface.</p>
          </div>
          <div class="status-block">
            <div class="status-row">
              <span class="key">Service</span>
              <span class="status-dot"><span class="dot"></span><span class="val" id="health">Service ready</span></span>
            </div>
            <div class="status-row">
              <span class="key">Model</span>
              <span class="val">Claude Haiku 4.5</span>
            </div>
            <div class="status-row">
              <span class="key">Memory</span>
              <span class="val">Qdrant &middot; optional</span>
            </div>
            <div class="status-row">
              <span class="key">Audit</span>
              <span class="val">SQLite ledger</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div class="shell">
      <main>
        <div class="col">
          <section class="card">
            <div class="card-head">
              <div class="title">
                <h2>Intake bench</h2>
                <span class="ref">Sheet A / Parse</span>
              </div>
              <span class="micro">Upload &middot; Sample &middot; Text</span>
            </div>
            <div class="card-body">
              <label class="field-label">
                <span>PDF or image upload</span>
                <input id="file" type="file" accept=".pdf,image/*,text/plain" />
              </label>
              <div class="button-row">
                <button class="primary" id="parseFile">Parse upload</button>
                <button class="ghost" id="loadSample">Load sample</button>
                <button id="runEval">Run eval</button>
              </div>
              <label class="field-label">
                <span>Invoice text &middot; pasted source</span>
                <textarea id="invoiceText"></textarea>
              </label>
              <button class="primary" id="parseText">Parse text</button>
            </div>
          </section>

          <section class="card">
            <div class="card-head">
              <div class="title">
                <h2>Review queue</h2>
                <span class="ref">Sheet B / Reconcile</span>
              </div>
              <span class="micro">Low-confidence &middot; Editable</span>
            </div>
            <div class="card-body">
              <div class="button-row">
                <button class="ghost" id="refreshJobs">Refresh jobs</button>
                <button class="primary" id="saveReview">Save reviewed JSON</button>
              </div>
              <table class="jobs">
                <thead><tr><th>Status</th><th>Invoice</th><th>Total</th></tr></thead>
                <tbody id="jobRows"><tr><td colspan="3" class="placeholder">No jobs loaded.</td></tr></tbody>
              </table>
              <label class="field-label">
                <span>Editable invoice JSON</span>
                <textarea id="reviewJson"></textarea>
              </label>
            </div>
          </section>
        </div>

        <div class="col">
          <section class="card">
            <div class="card-head">
              <div class="title">
                <h2>Evaluation manifest</h2>
                <span class="ref">Sheet C / Eval</span>
              </div>
              <span class="micro">Field-level scoring</span>
            </div>
            <div class="manifest">
              <div class="cell">
                <span class="micro">Field hit rate</span>
                <div class="value accent"><span id="hitRate">--</span></div>
              </div>
              <div class="cell">
                <span class="micro">Fields</span>
                <div class="value"><span id="fields">--</span></div>
              </div>
              <div class="cell">
                <span class="micro">Hits</span>
                <div class="value"><span id="hits">--</span></div>
              </div>
              <div class="cell">
                <span class="micro">Avg confidence</span>
                <div class="value"><span id="confidence">--</span></div>
              </div>
            </div>
            <table class="ledger">
              <thead><tr><th>Case</th><th>Hit rate</th><th>Misses</th></tr></thead>
              <tbody id="caseRows"><tr><td colspan="3" class="placeholder">Run eval to populate results.</td></tr></tbody>
            </table>
            <p class="legend">Ground-truth corpus &mdash; 5 logistics invoices, scored by recovered field count against expected schema.</p>
          </section>

          <section class="card">
            <div class="card-head">
              <div class="title">
                <h2>Structured JSON</h2>
                <span class="ref">Sheet D / Output</span>
              </div>
              <span class="micro">Live response</span>
            </div>
            <div class="card-body" style="padding: 0;">
<pre class="terminal" id="jsonOut">{}</pre>
            </div>
          </section>

          <section class="card">
            <div class="card-head">
              <div class="title">
                <h2>Operational fit</h2>
                <span class="ref">Sheet E / Notes</span>
              </div>
              <span class="micro">Boundaries declared</span>
            </div>
            <div class="card-body">
              <table class="fit">
                <tbody>
                  <tr><th>Self-host OCR</th><td>Tesseract.js path for Docker deployments.</td></tr>
                  <tr><th>Managed OCR</th><td>Vision &middot; Document AI adapter boundary is explicit.</td></tr>
                  <tr><th>Memory</th><td>Optional Qdrant retrieval of similar prior invoices.</td></tr>
                  <tr><th>Extraction</th><td>Claude Haiku 4.5 schema-driven JSON with validation.</td></tr>
                  <tr><th>Automation</th><td>n8n webhook template with confidence gate.</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>

    <footer>
      <div class="shell row">
        <span>Invoice Parse Agent &middot; <b>Operator Terminal</b></span>
        <span>Bun &middot; Hono &middot; Tesseract &middot; Qdrant</span>
        <span>Doc <b>OPS-01</b></span>
      </div>
    </footer>
    <script>
      const sample = ${JSON.stringify(sampleInvoiceText)};
      const out = document.getElementById("jsonOut");
      const health = document.getElementById("health");
      const textArea = document.getElementById("invoiceText");
      const reviewJson = document.getElementById("reviewJson");
      const caseRows = document.getElementById("caseRows");
      const jobRows = document.getElementById("jobRows");
      let selectedJobId = null;

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[char]));
      }

      function setJson(value) {
        out.textContent = JSON.stringify(value, null, 2);
        if (value.invoice) {
          reviewJson.value = JSON.stringify(value.invoice, null, 2);
          selectedJobId = value.job?.id ?? selectedJobId;
        }
      }

      function setError(error) {
        health.innerHTML = '<span class="error">' + error.message + "</span>";
        setJson({ error: error.message });
      }

      async function parseText() {
        health.textContent = "Parsing text...";
        const response = await fetch("./parse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: textArea.value })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Parse failed");
        health.textContent = "Parsed invoice " + body.invoice.invoiceNumber + (body.job ? " · job " + body.job.status : "");
        setJson(body);
        await loadJobs();
      }

      async function parseFile() {
        const input = document.getElementById("file");
        if (!input.files.length) throw new Error("Choose a PDF or image first.");
        const form = new FormData();
        form.append("file", input.files[0]);
        health.textContent = "Parsing upload...";
        const response = await fetch("./parse", { method: "POST", body: form });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Parse failed");
        health.textContent = "Parsed invoice " + body.invoice.invoiceNumber + (body.job ? " · job " + body.job.status : "");
        setJson(body);
        await loadJobs();
      }

      async function loadJobs() {
        const response = await fetch("./jobs?limit=20");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load jobs");
        if (!body.jobs.length) {
          jobRows.innerHTML = '<tr><td colspan="3" class="placeholder">No jobs yet.</td></tr>';
          return;
        }
        jobRows.innerHTML = body.jobs.map((job) => {
          const total = job.totalAmount + " " + job.totalCurrency;
          return '<tr data-id="' + escapeHtml(job.id) + '"><td><span class="job-status">' + escapeHtml(job.status) + '</span></td><td><button data-job="' + escapeHtml(job.id) + '">' + escapeHtml(job.invoiceNumber) + '</button><span class="vendor-line">' + escapeHtml(job.vendor) + '</span></td><td>' + escapeHtml(total) + '</td></tr>';
        }).join("");
        jobRows.querySelectorAll("button[data-job]").forEach((button) => {
          button.addEventListener("click", () => selectJob(button.getAttribute("data-job")).catch(setError));
        });
      }

      async function selectJob(id) {
        const response = await fetch("./jobs/" + encodeURIComponent(id));
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load job");
        selectedJobId = body.job.id;
        reviewJson.value = JSON.stringify(body.job.invoice, null, 2);
        setJson(body);
        health.textContent = "Loaded job " + body.job.invoiceNumber;
      }

      async function saveReview() {
        if (!selectedJobId) throw new Error("Select or parse a job first.");
        const invoice = JSON.parse(reviewJson.value);
        const response = await fetch("./jobs/" + encodeURIComponent(selectedJobId), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ invoice, reviewNote: "Reviewed in dashboard" })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Review save failed");
        health.textContent = "Reviewed invoice " + body.job.invoiceNumber + " · Qdrant stored";
        setJson(body);
        await loadJobs();
      }

      async function runEval() {
        health.textContent = "Running eval...";
        const response = await fetch("./eval");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Eval failed");
        const totals = body.totals;
        document.getElementById("hitRate").textContent = Math.round(totals.fieldHitRate * 100) + "%";
        document.getElementById("fields").textContent = totals.fields;
        document.getElementById("hits").textContent = totals.hits;
        document.getElementById("confidence").textContent = Math.round(totals.averageConfidence * 100) + "%";
        caseRows.innerHTML = body.cases.map((item) => {
          const missesText = item.misses.length ? escapeHtml(item.misses.join(", ")) : '<span class="miss-none">none</span>';
          const rate = Math.round(item.hitRate * 100);
          return '<tr><td class="case-id">' + escapeHtml(item.id) + '</td><td><span class="hit-pill">' + rate + '%</span></td><td>' + missesText + '</td></tr>';
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
      document.getElementById("refreshJobs").addEventListener("click", () => loadJobs().catch(setError));
      document.getElementById("saveReview").addEventListener("click", () => saveReview().catch(setError));

      textArea.value = sample;
      runEval().catch(setError);
      loadJobs().catch(setError);
    </script>
  </body>
</html>`;

export function dashboardRequest(c: Context) {
  return c.html(html);
}
