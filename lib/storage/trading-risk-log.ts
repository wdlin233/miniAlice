import path from "node:path";

import { tradingRiskLogSchema, type TradingRiskLog } from "@/lib/schemas/trading";
import { appendJsonl, dataPaths, readTextFile } from "@/lib/storage/file-store";

const tradingRiskLogPath = path.join(dataPaths.trading, "risk-evaluations.jsonl");

export async function appendTradingRiskLog(entry: TradingRiskLog): Promise<void> {
  const payload = tradingRiskLogSchema.parse(entry);
  await appendJsonl(tradingRiskLogPath, payload);
}

export async function listTradingRiskLogs(limit = 20): Promise<TradingRiskLog[]> {
  const raw = await readTextFile(tradingRiskLogPath, "");
  if (!raw.trim()) {
    return [];
  }

  const logs = raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        const parsedLine = tradingRiskLogSchema.safeParse(JSON.parse(line) as unknown);
        return parsedLine.success ? [parsedLine.data] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
  return logs.slice(0, safeLimit);
}