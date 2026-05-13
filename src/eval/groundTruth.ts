import type { Invoice } from "../schema";

export interface GroundTruthCase {
  id: string;
  documentPath: string;
  expected: Invoice;
}

const money = (amount: number, currency = "EUR") => ({ amount, currency });

export const groundTruthCases: GroundTruthCase[] = [
  {
    id: "mustard-logistics-001",
    documentPath: "corpus/mustard-logistics-001.txt",
    expected: {
      vendor: { name: "Mustard Yellow Logistics GmbH", taxId: "DE317000111", address: "Dockstrasse 12, 20457 Hamburg" },
      customer: { name: "Synergy Energy Logistics", address: "Harbour Road 8, Tallinn" },
      invoiceNumber: "MYL-2026-001",
      invoiceDate: "2026-04-30",
      dueDate: "2026-05-14",
      lineItems: [
        { description: "Pallet handling Hamburg terminal", quantity: 12, unitPrice: money(18), taxRate: 0.19, lineTotal: money(216) },
        { description: "Customs document preparation", quantity: 1, unitPrice: money(95), taxRate: 0.19, lineTotal: money(95) }
      ],
      tax: money(59.09),
      total: money(370.09),
      confidence: 1,
      warnings: []
    }
  },
  {
    id: "northsea-parts-1042",
    documentPath: "corpus/northsea-parts-1042.txt",
    expected: {
      vendor: { name: "Northsea Parts OU", taxId: "EE102233445", address: "Toostuse 44, Tallinn" },
      customer: { name: "Marius Deving Automation" },
      invoiceNumber: "NSP-1042",
      invoiceDate: "2026-05-02",
      dueDate: "2026-05-16",
      lineItems: [
        { description: "Bearing kit BK-88", quantity: 4, unitPrice: money(42.5), taxRate: 0.22, lineTotal: money(170) },
        { description: "Express freight", quantity: 1, unitPrice: money(38), taxRate: 0.22, lineTotal: money(38) }
      ],
      tax: money(45.76),
      total: money(253.76),
      confidence: 1,
      warnings: []
    }
  },
  {
    id: "rhein-freight-778",
    documentPath: "corpus/rhein-freight-778.txt",
    expected: {
      vendor: { name: "Rhein Freight Services AG", taxId: "DE812345900" },
      customer: { name: "Synergy Energy Logistics" },
      invoiceNumber: "RFS-778",
      invoiceDate: "2026-04-28",
      dueDate: "2026-05-12",
      lineItems: [
        { description: "ADR transport Cologne to Rotterdam", quantity: 2, unitPrice: money(410), taxRate: 0.19, lineTotal: money(820) }
      ],
      tax: money(155.8),
      total: money(975.8),
      confidence: 1,
      warnings: []
    }
  },
  {
    id: "baltic-coldchain-512",
    documentPath: "corpus/baltic-coldchain-512.txt",
    expected: {
      vendor: { name: "Baltic Coldchain SIA", taxId: "LV40103999999" },
      customer: { name: "Nordic Food Trading" },
      invoiceNumber: "BCC-512",
      invoiceDate: "2026-05-05",
      dueDate: "2026-05-20",
      lineItems: [
        { description: "Temperature controlled storage", quantity: 7, unitPrice: money(64), taxRate: 0.21, lineTotal: money(448) },
        { description: "Sensor log export", quantity: 1, unitPrice: money(24), taxRate: 0.21, lineTotal: money(24) }
      ],
      tax: money(99.12),
      total: money(571.12),
      confidence: 1,
      warnings: []
    }
  },
  {
    id: "alpine-spares-9201",
    documentPath: "corpus/alpine-spares-9201.txt",
    expected: {
      vendor: { name: "Alpine Spares Ltd", taxId: "GB441998712" },
      customer: { name: "Synergy Energy Logistics" },
      invoiceNumber: "AS-9201",
      invoiceDate: "2026-05-06",
      dueDate: "2026-05-21",
      lineItems: [
        { description: "Hydraulic valve HV-30", quantity: 3, unitPrice: { amount: 120, currency: "GBP" }, taxRate: 0.2, lineTotal: { amount: 360, currency: "GBP" } }
      ],
      tax: { amount: 72, currency: "GBP" },
      total: { amount: 432, currency: "GBP" },
      confidence: 1,
      warnings: []
    }
  }
];
