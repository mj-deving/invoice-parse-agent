import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { evalRequest } from "./api/eval";
import { parseInvoiceRequest } from "./api/parse";

export const app = new Hono();

app.get("/", (c) =>
  c.json({
    service: "invoice-parse-agent",
    routes: ["POST /parse", "GET /eval"]
  })
);
app.post("/parse", parseInvoiceRequest);
app.get("/eval", evalRequest);

if (import.meta.main) {
  const port = Number(process.env.PORT ?? "8787");
  serve({ fetch: app.fetch, port });
  console.log(`invoice-parse-agent listening on http://localhost:${port}`);
}
