import path from "node:path";

import { tradingRecommendationLogSchema, type TradingRecommendationLog } from "@/lib/schemas/trading";
import { appendJsonl, dataPaths, readTextFile } from "@/lib/storage/file-store";

const tradingRecommendationsPath = path.join(dataPaths.trading, "recommendations.jsonl");

export async function appendTradingRecommendationLog(entry: TradingRecommendationLog): Promise<void> {
  const payload = tradingRecommendationLogSchema.parse(entry);
  await appendJsonl(tradingRecommendationsPath, payload);
}

export async function listTradingRecommendationLogs(limit = 20): Promise<TradingRecommendationLog[]> {
  const raw = await readTextFile(tradingRecommendationsPath, "");
  if (!raw.trim()) {
    return [];
  }

  const logs = raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        const parsedLine = tradingRecommendationLogSchema.safeParse(JSON.parse(line) as unknown);
        return parsedLine.success ? [parsedLine.data] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
  return logs.slice(0, safeLimit);
}