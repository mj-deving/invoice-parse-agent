import { InvoiceSchema, type Invoice } from "../schema";

const currencyPattern = /(?:EUR|USD|GBP)?\s*([0-9]+(?:[.,][0-9]{2})?)/i;

function parseMoney(value: string | undefined, fallbackCurrency = "EUR") {
  const match = value?.match(/(EUR|USD|GBP)?\s*([0-9]+(?:[.,][0-9]{2})?)/i);
  return {
    amount: Number((match?.[2] ?? "0").replace(",", ".")),
    currency: (match?.[1] ?? fallbackCurrency).toUpperCase()
  };
}

function capture(text: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`^\\s*${escaped}\\s*:?\\s*(.+)`, "im"))?.[1]?.trim();
}

function parseLineItems(text: string, currency: string) {
  const lines = text.split(/\r?\n/);
  const itemLines = lines.filter((line) => /^ITEM\s+\d+/i.test(line.trim()));
  return itemLines.map((line) => {
    const description = line.match(/^ITEM\s+\d+\s*:\s*([^|]+)/i)?.[1]?.trim() ?? line.trim();
    const quantity = Number(line.match(/qty\s*=?\s*([0-9.]+)/i)?.[1] ?? "1");
    const unit = parseMoney(line.match(/unit\s*=?\s*((?:EUR|USD|GBP)?\s*[0-9.,]+)/i)?.[1], currency);
    const total = parseMoney(line.match(/line\s*=?\s*((?:EUR|USD|GBP)?\s*[0-9.,]+)/i)?.[1], currency);
    const taxRateRaw = line.match(/tax\s*=?\s*([0-9.]+)%?/i)?.[1];
    const taxRate = taxRateRaw === undefined ? undefined : Number(taxRateRaw) / 100;
    return {
      description,
      quantity,
      unitPrice: unit,
      ...(taxRate === undefined ? {} : { taxRate }),
      lineTotal: total.amount > 0 ? total : { amount: quantity * unit.amount, currency }
    };
  });
}

export function extractInvoiceDeterministically(text: string): Invoice {
  const total = parseMoney(capture(text, "Total") ?? text.match(new RegExp(`Total\\s*:?\\s*${currencyPattern.source}`, "i"))?.[0]);
  const currency = total.currency;
  const invoice: Invoice = {
    vendor: {
      name: capture(text, "Vendor") ?? "Unknown vendor",
      taxId: capture(text, "Vendor Tax ID"),
      address: capture(text, "Vendor Address")
    },
    customer: {
      name: capture(text, "Customer"),
      address: capture(text, "Customer Address")
    },
    invoiceNumber: capture(text, "Invoice No") ?? capture(text, "Invoice Number") ?? "UNKNOWN",
    invoiceDate: capture(text, "Invoice Date") ?? capture(text, "Date") ?? "1970-01-01",
    dueDate: capture(text, "Due Date"),
    lineItems: parseLineItems(text, currency),
    tax: parseMoney(capture(text, "Tax"), currency),
    total,
    confidence: 0.72,
    warnings: ["Deterministic fallback used because ANTHROPIC_API_KEY was not configured."]
  };

  if (invoice.lineItems.length === 0) {
    invoice.lineItems = [
      {
        description: "Unparsed invoice subtotal",
        quantity: 1,
        unitPrice: invoice.total,
        lineTotal: invoice.total
      }
    ];
    invoice.confidence = 0.45;
    invoice.warnings.push("No explicit line items were found.");
  }

  return InvoiceSchema.parse(invoice);
}
