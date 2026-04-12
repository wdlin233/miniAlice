import path from "node:path";

import { tradingWalletPushExecutionSchema, type TradingWalletPushExecution } from "@/lib/schemas/trading";
import { appendJsonl, dataPaths, readTextFile } from "@/lib/storage/file-store";

const tradingWalletLinkPath = path.join(dataPaths.trading, "wallet-push-executions.jsonl");

export async function appendTradingWalletPushExecution(entry: TradingWalletPushExecution): Promise<void> {
  const payload = tradingWalletPushExecutionSchema.parse(entry);
  await appendJsonl(tradingWalletLinkPath, payload);
}

export async function listTradingWalletPushExecutions(limit = 20): Promise<TradingWalletPushExecution[]> {
  const raw = await readTextFile(tradingWalletLinkPath, "");
  if (!raw.trim()) {
    return [];
  }

  const logs = raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        const parsedLine = tradingWalletPushExecutionSchema.safeParse(JSON.parse(line) as unknown);
        return parsedLine.success ? [parsedLine.data] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
  return logs.slice(0, safeLimit);
}