import path from "node:path";

import {
  paperAccountStateSchema,
  paperTradeSchema,
  type PaperAccountState,
  type PaperTrade
} from "@/lib/schemas/paper-trading";
import { appendJsonl, dataPaths, readJsonFile, readTextFile, writeJsonFile } from "@/lib/storage/file-store";

const paperAccountPath = path.join(dataPaths.trading, "paper-account.json");
const paperOrdersPath = path.join(dataPaths.trading, "paper-orders.jsonl");

function buildDefaultAccountState(): PaperAccountState {
  const now = new Date().toISOString();
  return paperAccountStateSchema.parse({
    initialBalanceUsd: 10000,
    cashUsd: 10000,
    realizedPnlUsd: 0,
    feePaidUsd: 0,
    positions: [],
    updatedAt: now
  });
}

export async function readPaperAccountState(): Promise<PaperAccountState> {
  const fallback = buildDefaultAccountState();
  const raw = await readJsonFile<unknown>(paperAccountPath, fallback);
  return paperAccountStateSchema.parse(raw);
}

export async function writePaperAccountState(account: PaperAccountState): Promise<void> {
  const payload = paperAccountStateSchema.parse(account);
  await writeJsonFile(paperAccountPath, payload);
}

export async function appendPaperTrade(trade: PaperTrade): Promise<void> {
  const payload = paperTradeSchema.parse(trade);
  await appendJsonl(paperOrdersPath, payload);
}

export async function listPaperTrades(limit = 30): Promise<PaperTrade[]> {
  const raw = await readTextFile(paperOrdersPath, "");
  if (!raw.trim()) {
    return [];
  }

  const parsed = raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        const maybe = paperTradeSchema.safeParse(JSON.parse(line) as unknown);
        return maybe.success ? [maybe.data] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 30;
  return parsed.slice(0, safeLimit);
}
