import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { InvoiceSchema, type Invoice, type ParseResponse } from "../schema";

export type JobStatus = "parsed" | "needs_review" | "reviewed";

export interface JobRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: JobStatus;
  sourceMode: string;
  pages: number;
  bytes: number;
  vendor: string;
  invoiceNumber: string;
  totalAmount: number;
  totalCurrency: string;
  confidence: number;
  memoryHits: number;
  rawText: string;
  invoice: Invoice;
  reviewNote?: string;
}

const defaultDbPath = "data/invoices.sqlite";
let db: Database | undefined;

function threshold() {
  return Number(process.env.REVIEW_CONFIDENCE_THRESHOLD ?? "0.8");
}

function dbPath() {
  return process.env.INVOICE_DB_PATH ?? defaultDbPath;
}

function database() {
  if (db) {
    return db;
  }

  const path = dbPath();
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  db = new Database(path);
  db.exec(`
    create table if not exists invoice_jobs (
      id text primary key,
      created_at text not null,
      updated_at text not null,
      status text not null,
      source_mode text not null,
      pages integer not null,
      bytes integer not null,
      vendor text not null,
      invoice_number text not null,
      total_amount real not null,
      total_currency text not null,
      confidence real not null,
      memory_hits integer not null,
      raw_text text not null,
      invoice_json text not null,
      review_note text
    );
  `);
  return db;
}

function rowToJob(row: Record<string, unknown>): JobRecord {
  const invoice = InvoiceSchema.parse(JSON.parse(String(row.invoice_json)));
  const reviewNote = row.review_note === null || row.review_note === undefined ? undefined : String(row.review_note);
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    status: row.status as JobStatus,
    sourceMode: String(row.source_mode),
    pages: Number(row.pages),
    bytes: Number(row.bytes),
    vendor: String(row.vendor),
    invoiceNumber: String(row.invoice_number),
    totalAmount: Number(row.total_amount),
    totalCurrency: String(row.total_currency),
    confidence: Number(row.confidence),
    memoryHits: Number(row.memory_hits),
    rawText: String(row.raw_text),
    invoice,
    ...(reviewNote === undefined ? {} : { reviewNote })
  };
}

export function createJob(parse: ParseResponse): JobRecord {
  const now = new Date().toISOString();
  const id = randomUUID();
  const status: JobStatus = parse.invoice.confidence >= threshold() ? "parsed" : "needs_review";
  database()
    .query(`
      insert into invoice_jobs (
        id, created_at, updated_at, status, source_mode, pages, bytes, vendor,
        invoice_number, total_amount, total_currency, confidence, memory_hits,
        raw_text, invoice_json, review_note
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null)
    `)
    .run(
      id,
      now,
      now,
      status,
      parse.source.mode,
      parse.source.pages,
      parse.source.bytes,
      parse.invoice.vendor.name,
      parse.invoice.invoiceNumber,
      parse.invoice.total.amount,
      parse.invoice.total.currency,
      parse.invoice.confidence,
      parse.memory?.hits ?? 0,
      parse.rawText,
      JSON.stringify(parse.invoice)
    );

  const job = getJob(id);
  if (!job) {
    throw new Error("Created job could not be loaded.");
  }
  return job;
}

export function listJobs(limit = 25): JobRecord[] {
  const rows = database()
    .query("select * from invoice_jobs order by created_at desc limit ?")
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map(rowToJob);
}

export function getJob(id: string): JobRecord | undefined {
  const row = database().query("select * from invoice_jobs where id = ?").get(id) as Record<string, unknown> | null;
  return row ? rowToJob(row) : undefined;
}

export function reviewJob(id: string, invoice: Invoice, reviewNote?: string): JobRecord | undefined {
  const now = new Date().toISOString();
  database()
    .query(`
      update invoice_jobs
      set updated_at = ?,
          status = 'reviewed',
          vendor = ?,
          invoice_number = ?,
          total_amount = ?,
          total_currency = ?,
          confidence = ?,
          invoice_json = ?,
          review_note = ?
      where id = ?
    `)
    .run(
      now,
      invoice.vendor.name,
      invoice.invoiceNumber,
      invoice.total.amount,
      invoice.total.currency,
      invoice.confidence,
      JSON.stringify(invoice),
      reviewNote ?? null,
      id
    );
  return getJob(id);
}

export function resetJobsForTests() {
  database().exec("delete from invoice_jobs");
}
