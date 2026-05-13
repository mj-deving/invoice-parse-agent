import type { Invoice } from "../schema";

export interface CaseScore {
  id: string;
  fields: number;
  hits: number;
  hitRate: number;
  confidence: number;
  misses: string[];
}

export interface EvalReport {
  cases: CaseScore[];
  totals: {
    fields: number;
    hits: number;
    fieldHitRate: number;
    averageConfidence: number;
  };
}

function sameMoney(actual: { amount: number; currency: string }, expected: { amount: number; currency: string }) {
  return actual.currency === expected.currency && Math.abs(actual.amount - expected.amount) < 0.01;
}

function check(misses: string[], name: string, actual: unknown, expected: unknown): number {
  if (actual === expected) {
    return 1;
  }
  misses.push(name);
  return 0;
}

export function scoreInvoice(id: string, actual: Invoice, expected: Invoice): CaseScore {
  const misses: string[] = [];
  let hits = 0;
  let fields = 0;
  const add = (name: string, actualValue: unknown, expectedValue: unknown) => {
    fields += 1;
    hits += check(misses, name, actualValue, expectedValue);
  };

  add("vendor.name", actual.vendor.name, expected.vendor.name);
  add("invoiceNumber", actual.invoiceNumber, expected.invoiceNumber);
  add("invoiceDate", actual.invoiceDate, expected.invoiceDate);
  add("dueDate", actual.dueDate, expected.dueDate);
  add("lineItems.length", actual.lineItems.length, expected.lineItems.length);

  expected.lineItems.forEach((item, index) => {
    const actualItem = actual.lineItems[index];
    fields += 4;
    if (!actualItem) {
      misses.push(`lineItems.${index}`);
      return;
    }
    hits += check(misses, `lineItems.${index}.description`, actualItem.description, item.description);
    hits += check(misses, `lineItems.${index}.quantity`, actualItem.quantity, item.quantity);
    if (sameMoney(actualItem.unitPrice, item.unitPrice)) {
      hits += 1;
    } else {
      misses.push(`lineItems.${index}.unitPrice`);
    }
    if (sameMoney(actualItem.lineTotal, item.lineTotal)) {
      hits += 1;
    } else {
      misses.push(`lineItems.${index}.lineTotal`);
    }
  });

  fields += 2;
  if (sameMoney(actual.tax, expected.tax)) {
    hits += 1;
  } else {
    misses.push("tax");
  }
  if (sameMoney(actual.total, expected.total)) {
    hits += 1;
  } else {
    misses.push("total");
  }

  return {
    id,
    fields,
    hits,
    hitRate: hits / fields,
    confidence: actual.confidence,
    misses
  };
}

export function summarizeScores(cases: CaseScore[]): EvalReport {
  const fields = cases.reduce((sum, item) => sum + item.fields, 0);
  const hits = cases.reduce((sum, item) => sum + item.hits, 0);
  return {
    cases,
    totals: {
      fields,
      hits,
      fieldHitRate: fields === 0 ? 0 : hits / fields,
      averageConfidence: cases.reduce((sum, item) => sum + item.confidence, 0) / Math.max(cases.length, 1)
    }
  };
}
