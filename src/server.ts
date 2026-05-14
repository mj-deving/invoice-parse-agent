import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { dashboardRequest } from "./api/dashboard";
import { evalRequest } from "./api/eval";
import { getJobRequest, listJobsRequest, reviewJobRequest } from "./api/jobs";
import { parseInvoiceRequest } from "./api/parse";

export const app = new Hono();

app.get("/", (c) =>
  c.json({
    service: "invoice-parse-agent",
    routes: ["GET /dashboard", "POST /parse", "GET /jobs", "GET /jobs/:id", "PATCH /jobs/:id", "GET /eval"]
  })
);
app.get("/dashboard", dashboardRequest);
app.post("/parse", parseInvoiceRequest);
app.get("/jobs", listJobsRequest);
app.get("/jobs/:id", getJobRequest);
app.patch("/jobs/:id", reviewJobRequest);
app.get("/eval", evalRequest);

if (import.meta.main) {
  const port = Number(process.env.PORT ?? "8787");
  serve({ fetch: app.fetch, port });
  console.log(`invoice-parse-agent listening on http://localhost:${port}`);
}
