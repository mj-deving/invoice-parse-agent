// Per-field evidence. The pipeline already knows more about its own uncertainty than
// it reports: Tesseract scores every word it reads, the source text either contains an
// extracted value or it does not, and an invoice carries its own arithmetic. None of
// that survives into the JSON, so a field the model guessed looks exactly like a field
// it read. This module recovers those three signals and attaches them to each field.
//
// Every check here is one a reader can re-run against the raw text shown next to it.
// There is deliberately no model self-reported per-field score: a number the extractor
// invents about its own output cannot be checked by anyone.
import type { Invoice } from "../schema";
import type { OcrLine, OcrWord, TextExtractionResult } from "../ocr/types";

/** Tesseract's own convention: below 80 the read is shaky. Kept as the flag line. */
export const OCR_CONFIDENCE_FLOOR = 0.8;

/** Cents-level tolerance, so float noise does not read as a broken invoice. */
const MONEY_TOLERANCE = 0.01;

export type CheckName = "ocr" | "source" | "arithmetic";
export type CheckStatus = "pass" | "fail" | "not-applicable";

export interface FieldCheck {
  name: CheckName;
  status: CheckStatus;
  detail: string;
  /** The measured OCR confidence, when this is an OCR check that ran. */
  value?: number;
}

export interface FieldEvidence {
  path: string;
  label: string;
  value: string;
  status: "verified" | "flagged";
  checks: FieldCheck[];
}

export interface EvidenceReport {
  fields: FieldEvidence[];
  verified: number;
  flagged: number;
  ocrFloor: number;
  /** True when the source carried word-level OCR confidence at all. */
  ocrAvailable: boolean;
}

type Money = { amount: number; currency: string };

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Number tokens inside a word, with the decimal comma folded onto the point. */
function numberTokens(text: string): number[] {
  const matches = text.replace(/(\d),(\d)/g, "$1.$2").match(/\d+(?:\.\d+)?/g) ?? [];
  return matches.map(Number).filter((n) => Number.isFinite(n));
}

function moneyLabel(money: Money): string {
  return `${money.amount.toFixed(2)} ${money.currency}`;
}

/** The written forms an amount plausibly takes in a document. */
function amountForms(amount: number): string[] {
  const fixed = amount.toFixed(2);
  return [fixed, fixed.replace(".", ","), String(amount), String(amount).replace(".", ",")];
}

/** The written forms an ISO date plausibly takes in a document. */
function dateForms(iso: string): string[] {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return [iso];
  }
  const [, year, month, day] = match;
  return [iso, `${day}.${month}.${year}`, `${day}/${month}/${year}`, `${month}/${day}/${year}`];
}

/**
 * Is this number in the text as a figure in its own right?
 *
 * Substring matching is not good enough here: a quantity of 9 is "found" inside the tax
 * ID DE812345900, and the check would then wave through a number the document never
 * states. So each written form is matched with digit boundaries on both sides.
 */
function containsAmount(haystack: string, amount: number): boolean {
  return amountForms(amount).some((form) =>
    new RegExp(`(?<![\\d.,])${form.replace(/\./g, "\\.")}(?![\\d.,])`).test(haystack)
  );
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(normalize(needle)));
}

/** The written forms a currency takes. A document may print the code or the symbol. */
const CURRENCY_SYMBOLS: Record<string, string[]> = {
  EUR: ["eur", "€"],
  GBP: ["gbp", "£"],
  USD: ["usd", "$"]
};

function containsCurrency(haystack: string, currency: string): boolean {
  const forms = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? [currency.toLowerCase()];
  return containsAny(haystack, forms);
}

/**
 * The OCR words that carry this field's value, scoped to the line it came from.
 * A string field matches on its word tokens; a number field matches on an exact
 * numeric token, so `tax=19%` is not mistaken for a quantity of 1.
 */
function wordsFor(lines: OcrLine[], lineMatcher: RegExp | undefined, value: string | number): OcrWord[] {
  const candidates = lineMatcher ? lines.filter((line) => lineMatcher.test(line.text)) : lines;
  const scope = candidates.length > 0 ? candidates : lines;

  if (typeof value === "number") {
    return scope
      .flatMap((line) => line.words)
      .filter((word) => numberTokens(word.text).some((token) => Math.abs(token - value) < MONEY_TOLERANCE));
  }

  const valueTokens = new Set(normalize(value).split(" ").filter(Boolean));
  return scope
    .flatMap((line) => line.words)
    .filter((word) => valueTokens.has(normalize(word.text).replace(/[:|]/g, "")));
}

function ocrCheck(source: TextExtractionResult, lineMatcher: RegExp | undefined, value: string | number): FieldCheck {
  if (source.mode !== "ocr" || !source.lines?.length) {
    return {
      name: "ocr",
      status: "not-applicable",
      detail: source.mode === "pdf-text" ? "PDF carried a text layer, no OCR ran" : "no OCR ran on this source"
    };
  }

  const words = wordsFor(source.lines, lineMatcher, value);
  if (words.length === 0) {
    return { name: "ocr", status: "not-applicable", detail: "no OCR word carries this value" };
  }

  const weakest = words.reduce((low, word) => (word.confidence < low.confidence ? word : low));
  const passed = weakest.confidence >= OCR_CONFIDENCE_FLOOR;
  return {
    name: "ocr",
    status: passed ? "pass" : "fail",
    value: weakest.confidence,
    detail: passed
      ? `Tesseract read this at ${weakest.confidence.toFixed(2)}`
      : `Tesseract read "${weakest.text}" at ${weakest.confidence.toFixed(2)}, under the ${OCR_CONFIDENCE_FLOOR.toFixed(2)} floor`
  };
}

function sourceCheck(found: boolean): FieldCheck {
  return {
    name: "source",
    status: found ? "pass" : "fail",
    detail: found ? "value appears in the source text" : "value is not in the source text"
  };
}

function textSourceCheck(haystack: string, forms: string[]): FieldCheck {
  return sourceCheck(containsAny(haystack, forms));
}

/**
 * A money row displays "432.00 GBP". Checking only the number would certify the field
 * while half of what it shows was never looked at, so an extractor that returned the
 * right amount under the wrong currency would come back verified.
 */
function moneySourceCheck(haystack: string, money: Money): FieldCheck {
  const amountFound = containsAmount(haystack, money.amount);
  const currencyFound = containsCurrency(haystack, money.currency);
  if (amountFound && currencyFound) {
    return sourceCheck(true);
  }
  return {
    name: "source",
    status: "fail",
    detail: amountFound
      ? `the amount is in the source text, but ${money.currency} is not`
      : "value is not in the source text"
  };
}

function amountSourceCheck(haystack: string, amount: number): FieldCheck {
  return sourceCheck(containsAmount(haystack, amount));
}

function arithmeticCheck(passed: boolean, detail: string): FieldCheck {
  return { name: "arithmetic", status: passed ? "pass" : "fail", detail };
}

function settle(
  path: string,
  label: string,
  value: string,
  checks: FieldCheck[]
): FieldEvidence {
  const flagged = checks.some((check) => check.status === "fail");
  return { path, label, value, status: flagged ? "flagged" : "verified", checks };
}

export function buildEvidence(invoice: Invoice, source: TextExtractionResult): EvidenceReport {
  const haystack = normalize(source.text);
  const fields: FieldEvidence[] = [];

  const text = (path: string, label: string, value: string | undefined, lineMatcher?: RegExp, forms?: string[]) => {
    if (!value) {
      return;
    }
    fields.push(
      settle(path, label, value, [
        ocrCheck(source, lineMatcher, value),
        textSourceCheck(haystack, forms ?? [value])
      ])
    );
  };

  text("vendor.name", "Vendor", invoice.vendor.name, /^vendor\s*:/i);
  text("vendor.taxId", "Vendor tax ID", invoice.vendor.taxId, /tax\s*id/i);
  text("vendor.address", "Vendor address", invoice.vendor.address, /^vendor\s+address/i);
  text("customer.name", "Customer", invoice.customer.name, /^customer\s*:/i);
  text("customer.address", "Customer address", invoice.customer.address, /^customer\s+address/i);
  text("invoiceNumber", "Invoice number", invoice.invoiceNumber, /invoice\s*no/i);
  // A document may write a date in any of several forms; the schema only ever holds ISO.
  text("invoiceDate", "Invoice date", invoice.invoiceDate, /invoice\s*date/i, dateForms(invoice.invoiceDate));
  text("dueDate", "Due date", invoice.dueDate, /due\s*date/i, invoice.dueDate ? dateForms(invoice.dueDate) : undefined);

  invoice.lineItems.forEach((item, index) => {
    const lineMatcher = new RegExp(`^item\\s+${index + 1}\\b`, "i");
    const base = `lineItems.${index}`;
    const position = `Line ${index + 1}`;

    text(`${base}.description`, `${position} description`, item.description, lineMatcher);

    // Amounts only mean something alongside the currency they are counted in, so the
    // line has to agree with itself on both before its arithmetic is worth anything.
    const sameCurrency = item.unitPrice.currency === item.lineTotal.currency;
    const closes = Math.abs(item.quantity * item.unitPrice.amount - item.lineTotal.amount) < MONEY_TOLERANCE;
    const math = arithmeticCheck(
      closes && sameCurrency,
      sameCurrency
        ? `${item.quantity} x ${item.unitPrice.amount.toFixed(2)} ${closes ? "=" : "!="} ${item.lineTotal.amount.toFixed(2)} ${item.lineTotal.currency}`
        : `unit price is ${item.unitPrice.currency} but the line total is ${item.lineTotal.currency}`
    );

    fields.push(
      settle(`${base}.quantity`, `${position} quantity`, String(item.quantity), [
        ocrCheck(source, lineMatcher, item.quantity),
        amountSourceCheck(haystack, item.quantity),
        math
      ])
    );
    fields.push(
      settle(`${base}.unitPrice`, `${position} unit price`, moneyLabel(item.unitPrice), [
        ocrCheck(source, lineMatcher, item.unitPrice.amount),
        moneySourceCheck(haystack, item.unitPrice),
        math
      ])
    );
    fields.push(
      settle(`${base}.lineTotal`, `${position} total`, moneyLabel(item.lineTotal), [
        ocrCheck(source, lineMatcher, item.lineTotal.amount),
        moneySourceCheck(haystack, item.lineTotal),
        math
      ])
    );
  });

  // Summing amounts across currencies produces a number that means nothing, so the
  // reconciliation only holds if the whole invoice is counted in one currency.
  const currencies = new Set([
    ...invoice.lineItems.map((item) => item.lineTotal.currency),
    invoice.tax.currency,
    invoice.total.currency
  ]);
  const oneCurrency = currencies.size === 1;
  const lineSum = invoice.lineItems.reduce((sum, item) => sum + item.lineTotal.amount, 0);
  const reconciles = Math.abs(lineSum + invoice.tax.amount - invoice.total.amount) < MONEY_TOLERANCE;
  const reconciliation = arithmeticCheck(
    reconciles && oneCurrency,
    oneCurrency
      ? `${lineSum.toFixed(2)} lines + ${invoice.tax.amount.toFixed(2)} tax ${reconciles ? "=" : "!="} ${invoice.total.amount.toFixed(2)} ${invoice.total.currency}`
      : `the invoice mixes ${[...currencies].join(", ")}, so its total cannot be reconciled`
  );

  fields.push(
    settle("tax", "Tax", moneyLabel(invoice.tax), [
      ocrCheck(source, /^tax\s*:/i, invoice.tax.amount),
      moneySourceCheck(haystack, invoice.tax),
      reconciliation
    ])
  );
  fields.push(
    settle("total", "Total", moneyLabel(invoice.total), [
      ocrCheck(source, /^total\s*:/i, invoice.total.amount),
      moneySourceCheck(haystack, invoice.total),
      reconciliation
    ])
  );

  const flagged = fields.filter((field) => field.status === "flagged").length;
  return {
    fields,
    flagged,
    verified: fields.length - flagged,
    ocrFloor: OCR_CONFIDENCE_FLOOR,
    ocrAvailable: source.mode === "ocr" && Boolean(source.lines?.length)
  };
}
