import path from "node:path";

import {
  paperAccountStateSchema,
  paperPendingOrderSchema,
  paperTradeSchema,
  type PaperAccountState,
  type PaperPendingOrder,
  type PaperTrade
} from "@/lib/schemas/paper-trading";
import { appendJsonl, dataPaths, readJsonFile, readTextFile, writeJsonFile } from "@/lib/storage/file-store";

const paperAccountPath = path.join(dataPaths.trading, "paper-account.json");
const paperOrdersPath = path.join(dataPaths.trading, "paper-orders.jsonl");
const paperPendingOrdersPath = path.join(dataPaths.trading, "paper-pending-orders.json");

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

export async function readPaperPendingOrders(): Promise<PaperPendingOrder[]> {
  const raw = await readJsonFile<unknown>(paperPendingOrdersPath, []);
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item) => {
    const parsed = paperPendingOrderSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function writePaperPendingOrders(orders: PaperPendingOrder[]): Promise<void> {
  const payload = orders.map((item) => paperPendingOrderSchema.parse(item));
  await writeJsonFile(paperPendingOrdersPath, payload);
}
