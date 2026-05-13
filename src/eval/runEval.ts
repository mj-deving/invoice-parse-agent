import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractInvoice } from "../extract/claude";
import { scoreInvoice, summarizeScores } from "./scoring";
import { groundTruthCases } from "./groundTruth";

export async function runEval(root = process.cwd()) {
  const scores = [];
  for (const item of groundTruthCases) {
    const text = await readFile(join(root, item.documentPath), "utf8");
    const actual = await extractInvoice(text);
    scores.push(scoreInvoice(item.id, actual, item.expected));
  }
  return summarizeScores(scores);
}

if (import.meta.main) {
  const report = await runEval();
  console.log(JSON.stringify(report, null, 2));
}
