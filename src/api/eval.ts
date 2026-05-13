import type { Context } from "hono";
import { runEval } from "../eval/runEval";

export async function evalRequest(c: Context) {
  const report = await runEval();
  return c.json(report);
}
