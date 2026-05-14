import type { Context } from "hono";
import { getJob, listJobs, reviewJob } from "../jobs/store";
import { storeInvoiceMemory } from "../memory/qdrant";
import { InvoiceSchema } from "../schema";

function requireId(c: Context) {
  const id = c.req.param("id");
  if (!id) {
    throw new Error("Missing job id.");
  }
  return id;
}

export function listJobsRequest(c: Context) {
  const limit = Number(c.req.query("limit") ?? "25");
  return c.json({ jobs: listJobs(limit) });
}

export function getJobRequest(c: Context) {
  const id = requireId(c);
  const job = getJob(id);
  if (!job) {
    return c.json({ error: "Job not found." }, 404);
  }
  return c.json({ job });
}

export async function reviewJobRequest(c: Context) {
  const id = requireId(c);
  const current = getJob(id);
  if (!current) {
    return c.json({ error: "Job not found." }, 404);
  }

  const body = await c.req.json<{ invoice?: unknown; reviewNote?: string }>();
  const invoice = InvoiceSchema.parse(body.invoice);
  const job = reviewJob(id, invoice, body.reviewNote);
  if (!job) {
    return c.json({ error: "Job not found." }, 404);
  }

  const memory = await storeInvoiceMemory(job.rawText, invoice);
  return c.json({
    job,
    memory: memory
      ? {
          provider: "qdrant",
          collection: memory.collection,
          stored: memory.stored ?? false
        }
      : undefined
  });
}
