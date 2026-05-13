import { z } from "zod";

export const MoneySchema = z.object({
  amount: z.number(),
  currency: z.string().min(3).max(3).default("EUR")
});

export const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().nonnegative(),
  unitPrice: MoneySchema,
  taxRate: z.number().min(0).max(1).optional(),
  lineTotal: MoneySchema
});

export const InvoiceSchema = z.object({
  vendor: z.object({
    name: z.string().min(1),
    taxId: z.string().optional(),
    address: z.string().optional()
  }),
  customer: z.object({
    name: z.string().optional(),
    address: z.string().optional()
  }).default({}),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lineItems: z.array(LineItemSchema).min(1),
  tax: MoneySchema,
  total: MoneySchema,
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([])
});

export const ParseResponseSchema = z.object({
  source: z.object({
    mode: z.enum(["pdf-text", "ocr", "plain-text", "vision-fallback"]),
    pages: z.number().int().positive(),
    bytes: z.number().int().nonnegative()
  }),
  invoice: InvoiceSchema,
  rawText: z.string()
});

export type Invoice = z.infer<typeof InvoiceSchema>;
export type ParseResponse = z.infer<typeof ParseResponseSchema>;

export const jsonSchemaForPrompt = {
  type: "object",
  additionalProperties: false,
  required: [
    "vendor",
    "customer",
    "invoiceNumber",
    "invoiceDate",
    "lineItems",
    "tax",
    "total",
    "confidence",
    "warnings"
  ],
  properties: {
    vendor: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: { type: "string" },
        taxId: { type: "string" },
        address: { type: "string" }
      }
    },
    customer: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        address: { type: "string" }
      }
    },
    invoiceNumber: { type: "string" },
    invoiceDate: { type: "string", description: "ISO date YYYY-MM-DD" },
    dueDate: { type: "string", description: "ISO date YYYY-MM-DD" },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "quantity", "unitPrice", "lineTotal"],
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unitPrice: { "$ref": "#/$defs/money" },
          taxRate: { type: "number" },
          lineTotal: { "$ref": "#/$defs/money" }
        }
      }
    },
    tax: { "$ref": "#/$defs/money" },
    total: { "$ref": "#/$defs/money" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    warnings: { type: "array", items: { type: "string" } }
  },
  "$defs": {
    money: {
      type: "object",
      additionalProperties: false,
      required: ["amount", "currency"],
      properties: {
        amount: { type: "number" },
        currency: { type: "string", minLength: 3, maxLength: 3 }
      }
    }
  }
} as const;
