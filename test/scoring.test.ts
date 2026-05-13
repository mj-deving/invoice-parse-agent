import { describe, expect, test } from "bun:test";
import { groundTruthCases } from "../src/eval/groundTruth";
import { scoreInvoice, summarizeScores } from "../src/eval/scoring";

describe("eval scoring", () => {
  test("scores a perfect invoice as 100 percent", () => {
    const item = groundTruthCases[0];
    if (!item) {
      throw new Error("missing ground truth");
    }
    const score = scoreInvoice(item.id, item.expected, item.expected);
    expect(score.hitRate).toBe(1);
    expect(score.misses).toEqual([]);
  });

  test("summarizes case scores", () => {
    const item = groundTruthCases[0];
    if (!item) {
      throw new Error("missing ground truth");
    }
    const report = summarizeScores([scoreInvoice(item.id, item.expected, item.expected)]);
    expect(report.totals.fieldHitRate).toBe(1);
    expect(report.totals.fields).toBeGreaterThan(5);
  });
});
