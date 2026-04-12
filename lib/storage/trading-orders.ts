import path from "node:path";

import {
  tradingOrderSchema,
  type TradingOrder,
  type TradingOrderSource,
  type TradingOrderStatus
} from "@/lib/schemas/trading";
import { appendJsonl, dataPaths, readTextFile } from "@/lib/storage/file-store";

const tradingOrdersPath = path.join(dataPaths.trading, "orders.jsonl");

export async function appendTradingOrderSnapshot(order: TradingOrder): Promise<void> {
  const payload = tradingOrderSchema.parse(order);
  await appendJsonl(tradingOrdersPath, payload);
}

function parseTradingOrderSnapshots(raw: string): TradingOrder[] {
  if (!raw.trim()) {
    return [];
  }

  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        const parsedLine = tradingOrderSchema.safeParse(JSON.parse(line) as unknown);
        return parsedLine.success ? [parsedLine.data] : [];
      } catch {
        return [];
      }
    });
}

function toLatestOrders(snapshots: TradingOrder[]): TradingOrder[] {
  const latestById = new Map<string, TradingOrder>();

  for (const order of snapshots) {
    const current = latestById.get(order.id);
    if (!current || order.updatedAt > current.updatedAt) {
      latestById.set(order.id, order);
    }
  }

  return Array.from(latestById.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listTradingOrders(options?: {
  limit?: number;
  status?: TradingOrderStatus;
  source?: TradingOrderSource;
}): Promise<TradingOrder[]> {
  const raw = await readTextFile(tradingOrdersPath, "");
  const snapshots = parseTradingOrderSnapshots(raw);
  const latest = toLatestOrders(snapshots);

  const status = options?.status;
  const source = options?.source;

  const filtered = latest.filter((order) => {
    if (status && order.status !== status) {
      return false;
    }

    if (source && order.source !== source) {
      return false;
    }

    return true;
  });

  const safeLimit = Number.isFinite(options?.limit)
    ? Math.max(1, Math.floor(options?.limit ?? 20))
    : 20;

  return filtered.slice(0, safeLimit);
}

export async function findTradingOrderById(orderId: string): Promise<TradingOrder | null> {
  const raw = await readTextFile(tradingOrdersPath, "");
  const snapshots = parseTradingOrderSnapshots(raw);
  const latest = toLatestOrders(snapshots);

  return latest.find((order) => order.id === orderId) ?? null;
}