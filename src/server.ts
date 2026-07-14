import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { renderConsole } from "./console/page";
import { dashboardRequest } from "./api/dashboard";
import { demoParseRequest, listDemoDocumentsRequest } from "./demo/routes";
import { evalRequest } from "./api/eval";
import { getJobRequest, listJobsRequest, reviewJobRequest } from "./api/jobs";
import { parseInvoiceRequest } from "./api/parse";

export const app = new Hono();

/**
 * The operator surface takes a document from the caller and keeps what it parsed:
 * `POST /parse` fetches any URL it is handed and OCRs any bytes it is handed, and every
 * parse is persisted and then listed by `GET /jobs`. That is right for the operator who
 * runs this on their own invoices, and wrong for a public demo, where it would fetch on
 * a stranger's behalf and show one visitor's document to the next.
 *
 * So demo mode is the default and it seals those routes. A public deploy that sets no
 * env at all is safe; an operator turns the surface on deliberately with DEMO_MODE=false,
 * and if they forget, they get the message below rather than an open door.
 */
export function demoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}

const sealed = new Hono();
sealed.use("*", async (c, next) => {
  if (demoMode()) {
    return c.json(
      {
        error: "This route is off in demo mode.",
        detail:
          "It accepts a document and persists what it parsed, which a public demo must not do. Self-host and set DEMO_MODE=false to use it."
      },
      403
    );
  }
  await next();
});

sealed.get("/dashboard", dashboardRequest);
sealed.post("/parse", parseInvoiceRequest);
sealed.get("/jobs", listJobsRequest);
sealed.get("/jobs/:id", getJobRequest);
sealed.patch("/jobs/:id", reviewJobRequest);

app.get("/", (c) => c.html(renderConsole()));

// The demo runs only the documents it ships with, and writes nothing.
app.get("/demo/documents", listDemoDocumentsRequest);
app.post("/demo/parse", demoParseRequest);

// Read-only, takes no input, reports the ground-truth score. Open in both modes.
app.get("/eval", evalRequest);

app.route("/", sealed);

if (import.meta.main) {
  const port = Number(process.env.PORT ?? "8787");
  serve({ fetch: app.fetch, port });
  console.log(
    `invoice-parse-agent listening on http://localhost:${port} (${demoMode() ? "demo mode: upload and job routes are sealed" : "operator mode: full surface"})`
  );
}
