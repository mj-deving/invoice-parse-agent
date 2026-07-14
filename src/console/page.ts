// Console, built against the shared mjdeving-lab design lock.
// Lock + tokens: MJ-OS references/design-system/lab/{reference-lock.md,design.md,tokens.css}
// Archetype A (console). Project accent: rose #e58aa8 (documents, receipts).
// Only --accent, --accent-dim and --accent-faint are overridden. Every other token is shared.
// Accent role = signal only: the one action, the active chip, the confidence bar. Never a wash.
// Mono role = technical metadata only. Prose stays sans.
//
// The one interaction is: pick a bundled document, parse it, read the fields and the marks.
// There is no upload field, and the page says so rather than leaving a visitor to wonder.
// UI language is English because the corpus, the field labels and the repo are English.
export function renderConsole(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>invoice-parse-agent / extraction console</title>
  <style>
:root{
  --canvas:#0a0b0d; --surface:#121417; --surface-2:#171a1e;
  --border:#23272d; --border-bright:#2e343b;
  --text:#e7e9ec; --text-muted:#9aa1a8; --text-dim:#656b72;
  --accent:#e58aa8; --accent-dim:#9c637b; --accent-faint:rgba(229,138,168,.12);
  --danger:#e5674c;
  --font-sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
  --radius:8px; --radius-sm:6px; --maxw:820px;
  color-scheme:dark;
}
*{box-sizing:border-box}
body{margin:0;background:var(--canvas);color:var(--text);font-family:var(--font-sans);
  font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 20px}

header{border-bottom:1px solid var(--border);padding:22px 0 18px;margin-bottom:28px}
.headrow{display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap}
.mark{font-weight:700;font-size:19px;letter-spacing:-.01em}
.mark .dim{color:var(--text-dim);font-weight:400}
.tag{color:var(--text-muted);font-size:13.5px;margin-top:4px;max-width:64ch}
.stack{display:flex;gap:6px;flex-wrap:wrap}
.prim{font-family:var(--font-mono);font-size:11px;color:var(--text-dim);
  border:1px solid var(--border);border-radius:5px;padding:2px 7px;white-space:nowrap}

.health{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;min-height:22px}
.badge{font-family:var(--font-mono);font-size:11px;color:var(--text-dim);
  border:1px solid var(--border);border-radius:5px;padding:2px 7px}
.badge.live{color:var(--accent);border-color:var(--accent-dim)}
.badge.off{color:var(--danger);border-color:var(--danger)}

.field{display:flex;gap:10px;align-items:stretch}
#doc{flex:1;min-width:0;background:var(--surface);color:var(--text);border:1px solid var(--border);
  border-radius:var(--radius);padding:14px 16px;font-family:var(--font-mono);font-size:13.5px;
  outline:none;text-overflow:ellipsis}
#parse{background:var(--accent);color:#24101a;border:0;border-radius:var(--radius);
  padding:0 20px;font-weight:600;font-size:14px;cursor:pointer;font-family:var(--font-sans);
  transition:background .12s ease;white-space:nowrap}
#parse:hover{background:#eda3bb}
#parse:disabled{background:var(--accent-dim);opacity:.55;cursor:not-allowed}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.chip{font-family:var(--font-mono);font-size:12px;color:var(--text-muted);background:transparent;
  border:1px solid var(--border);border-radius:var(--radius-sm);padding:5px 10px;cursor:pointer;
  transition:border-color .12s ease,color .12s ease;text-align:left}
.chip:hover{border-color:var(--border-bright);color:var(--text)}
.chip.on{color:var(--accent);border-color:var(--accent-dim);background:var(--accent-faint)}
.hint{margin-top:12px;color:var(--text-dim);font-size:12.5px;max-width:72ch}
.hint a{color:var(--text-muted);text-decoration:none;border-bottom:1px solid var(--border)}

.region{margin-top:32px;min-height:4px}
.meta{display:flex;align-items:center;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.tally{font-size:14px;color:var(--text-muted);margin-bottom:14px}
.tally b{color:var(--text);font-weight:600}
.tally .marked{color:var(--danger);font-weight:600}

.rows{display:grid;gap:8px}
.row{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);
  padding:11px 13px}
.row.flagged{border-color:var(--danger)}
.row-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.row-label{font-family:var(--font-mono);font-size:11.5px;color:var(--text-dim);white-space:nowrap}
.row-value{font-size:14.5px;color:var(--text);overflow-wrap:anywhere;min-width:0}
.row.flagged .row-value{color:var(--danger)}
.flag{font-family:var(--font-mono);font-size:10.5px;color:var(--danger);
  border:1px solid var(--danger);border-radius:5px;padding:1px 6px;white-space:nowrap}
.checks{margin-top:8px;display:grid;gap:4px}
.check{font-family:var(--font-mono);font-size:11.5px;color:var(--text-dim);display:flex;gap:8px}
.check.fail{color:var(--danger)}
.check .k{color:var(--text-dim);min-width:74px}
.bar{margin-top:7px;height:3px;background:var(--border);border-radius:2px;overflow:hidden}
.bar span{display:block;height:100%;background:var(--accent)}
.row.flagged .bar span{background:var(--danger)}

details{margin-top:24px;border:1px solid var(--border);border-radius:var(--radius-sm);
  background:var(--surface);padding:11px 13px}
summary{cursor:pointer;font-family:var(--font-mono);font-size:12px;color:var(--text-muted)}
summary:hover{color:var(--text)}
pre{margin:12px 0 0;font-family:var(--font-mono);font-size:12px;color:var(--text-muted);
  white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow-y:auto}
.err{color:var(--danger);font-family:var(--font-mono);font-size:12.5px;margin-top:16px}

footer{margin:44px 0 40px;padding-top:18px;border-top:1px solid var(--border);
  color:var(--text-dim);font-size:12px;font-family:var(--font-mono)}
footer a{color:var(--text-muted);text-decoration:none;border-bottom:1px solid var(--border)}

@media (max-width:520px){
  .field{flex-direction:column}
  #parse{padding:12px 20px}
  .check .k{min-width:64px}
}
  </style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="headrow">
      <div>
        <div class="mark">invoice-parse-agent<span class="dim">/</span></div>
        <div class="tag">Invoices become structured JSON. Every field is checked back against the document it came from, and the fields the pipeline was not sure about are marked instead of quietly passed on.</div>
      </div>
      <div class="stack" aria-label="pipeline primitives">
        <span class="prim">Bun</span><span class="prim">Hono</span><span class="prim">poppler</span>
        <span class="prim">Tesseract</span><span class="prim">zod</span>
      </div>
    </div>
  </header>

  <div class="health" id="health"><span class="badge">reading documents ...</span></div>

  <div class="field">
    <input id="doc" type="text" readonly value="Pick a document below">
    <button id="parse" disabled>Parse</button>
  </div>
  <div class="chips" id="chips"></div>
  <div class="hint">The demo accepts no upload and fetches no URL: it runs the six documents it ships with, and stores nothing. A field is marked when Tesseract read it under confidence <span id="floor">0.80</span>, when its value is not in the source text, or when the arithmetic does not close. The source text is under the fields, so every mark can be checked. <a href="/eval">See what it scores against ground truth</a>.</div>

  <div class="region" id="region"></div>

  <footer>
    6 bundled documents &middot; synthetic, no real company or person &middot;
    <a href="https://github.com/mj-deving/invoice-parse-agent" target="_blank" rel="noreferrer">github.com/mj-deving/invoice-parse-agent</a>
  </footer>
</div>

<script>
  var healthEl = document.getElementById("health");
  var chipsEl = document.getElementById("chips");
  var docEl = document.getElementById("doc");
  var parseEl = document.getElementById("parse");
  var regionEl = document.getElementById("region");
  var selected = null;

  function esc(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c];
    });
  }

  function badge(label, cls) {
    var b = document.createElement("span");
    b.className = "badge " + (cls || "");
    b.textContent = label;
    return b;
  }

  fetch("/demo/documents").then(function (r) { return r.json(); }).then(function (body) {
    healthEl.innerHTML = "";
    healthEl.appendChild(badge(body.documents.length + " documents", "live"));
    healthEl.appendChild(badge(body.extractor.name));
    healthEl.appendChild(badge("no upload"));
    document.getElementById("floor").textContent = body.ocrFloor.toFixed(2);

    body.documents.forEach(function (item) {
      var b = document.createElement("button");
      b.className = "chip";
      b.textContent = item.label;
      b.title = item.kind + ". " + item.note;
      b.addEventListener("click", function () {
        selected = item;
        chipsEl.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("on"); });
        b.classList.add("on");
        docEl.value = item.label + "  ·  " + item.kind;
        parseEl.disabled = false;
        parse();
      });
      chipsEl.appendChild(b);
    });
  }).catch(function () {
    healthEl.innerHTML = "";
    healthEl.appendChild(badge("service unreachable", "off"));
  });

  function checkRow(check) {
    var fail = check.status === "fail";
    if (check.status === "not-applicable") {
      return '<div class="check"><span class="k">' + esc(check.name) + '</span><span>' + esc(check.detail) + "</span></div>";
    }
    return '<div class="check' + (fail ? " fail" : "") + '"><span class="k">' + esc(check.name) +
      '</span><span>' + esc(check.detail) + "</span></div>";
  }

  function fieldRow(field) {
    var flagged = field.status === "flagged";
    var ocr = field.checks.filter(function (c) { return c.name === "ocr" && typeof c.value === "number"; })[0];
    var bar = ocr ? '<div class="bar"><span style="width:' + Math.round(ocr.value * 100) + '%"></span></div>' : "";
    return '<div class="row' + (flagged ? " flagged" : "") + '">' +
      '<div class="row-top">' +
        '<span class="row-value">' + esc(field.value) + "</span>" +
        (flagged ? '<span class="flag">not sure</span>' : "") +
      "</div>" +
      '<div class="row-label">' + esc(field.label) + "</div>" +
      bar +
      '<div class="checks">' + field.checks.map(checkRow).join("") + "</div>" +
    "</div>";
  }

  function parse() {
    if (!selected) return;
    parseEl.disabled = true;
    regionEl.innerHTML = '<div class="meta"><span class="badge">extracting ...</span></div>';

    fetch("/demo/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: selected.id })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        parseEl.disabled = false;
        if (res.error) {
          regionEl.innerHTML = '<div class="err">' + esc(res.error) + "</div>";
          return;
        }

        var meta = document.createElement("div");
        meta.className = "meta";
        meta.appendChild(badge(res.source.mode));
        meta.appendChild(badge(res.extractor.name));
        if (typeof res.source.confidence === "number") {
          meta.appendChild(badge("OCR " + res.source.confidence.toFixed(2) + " page average"));
        }
        meta.appendChild(badge(res.cached ? "cached" : res.timings.totalMs + "ms"));

        var ev = res.evidence;
        var tally = document.createElement("div");
        tally.className = "tally";
        tally.innerHTML = ev.flagged === 0
          ? "<b>" + ev.verified + "</b> fields, every one of them checked out."
          : "<b>" + ev.verified + "</b> fields checked out. <span class=\\"marked\\">" + ev.flagged +
            "</span> " + (ev.flagged === 1 ? "is" : "are") + " marked below, because the pipeline was not sure.";

        // Marked fields first. The point of the page is the doubt, so it does not make
        // a reader scroll past twelve fields that were fine to reach the two that were not.
        // Each row names its own position, so document order is not carrying meaning here.
        var ordered = ev.fields.slice().sort(function (a, b) {
          return (a.status === "flagged" ? 0 : 1) - (b.status === "flagged" ? 0 : 1);
        });

        var rows = document.createElement("div");
        rows.className = "rows";
        rows.innerHTML = ordered.map(fieldRow).join("");

        var raw = document.createElement("details");
        raw.innerHTML = "<summary>Source text the fields were read from</summary><pre>" + esc(res.rawText) + "</pre>";

        regionEl.innerHTML = "";
        regionEl.appendChild(meta);
        regionEl.appendChild(tally);
        regionEl.appendChild(rows);
        regionEl.appendChild(raw);
      })
      .catch(function (error) {
        parseEl.disabled = false;
        regionEl.innerHTML = '<div class="err">' + esc(String(error)) + "</div>";
      });
  }

  parseEl.addEventListener("click", parse);
</script>
</body>
</html>`;
}
