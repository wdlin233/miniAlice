import crypto from "node:crypto";

import {
  paperAccountViewSchema,
  paperOrderCreateInputSchema,
  paperOrderResponseSchema,
  paperTradeSchema,
  type PaperAccountResponse,
  type PaperAccountState,
  type PaperAccountView,
  type PaperOrderCreateInput,
  type PaperOrderResponse,
  type PaperPositionState
} from "@/lib/schemas/paper-trading";
import { fetchMarketSnapshot } from "@/lib/tools/browser";
import { appendPaperTrade, listPaperTrades, readPaperAccountState, writePaperAccountState } from "@/lib/storage/paper-trading";

const PAPER_FEE_RATE = 0.001;
const SECONDARY_REQUEST_TIMEOUT_MS = 2500;

const staticReferencePriceBySymbol: Record<string, number> = {
  BTCUSDT: 68000,
  ETHUSDT: 3200,
  SOLUSDT: 150,
  BNBUSDT: 600,
  XRPUSDT: 0.6
};

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function round(value: number): number {
  return Number(value.toFixed(8));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function extractBaseAsset(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  if (normalized.endsWith("USDT")) {
    return normalized.slice(0, -4);
  }

  if (normalized.endsWith("USD")) {
    return normalized.slice(0, -3);
  }

  return normalized;
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SECONDARY_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "MiniAlice/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSecondaryPrice(symbol: string): Promise<number | null> {
  const base = extractBaseAsset(symbol);

  const okxSymbol = `${base}-USDT`;
  try {
    const payload = (await fetchJsonWithTimeout(
      `https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(okxSymbol)}`
    )) as {
      data?: Array<{ last?: string }>;
    };

    const price = Number(payload.data?.[0]?.last);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  } catch {
    // Try next source.
  }

  try {
    const payload = (await fetchJsonWithTimeout(
      `https://api.coinbase.com/v2/prices/${encodeURIComponent(base)}-USD/spot`
    )) as {
      data?: { amount?: string };
    };

    const price = Number(payload.data?.amount);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  } catch {
    // Try next source.
  }

  return null;
}

async function fetchQuoteMap(symbols: string[]): Promise<{
  prices: Map<string, number>;
  errors: string[];
}> {
  if (symbols.length === 0) {
    return { prices: new Map<string, number>(), errors: [] };
  }

  const snapshot = await fetchMarketSnapshot({ symbols });
  const prices = new Map<string, number>();

  for (const quote of snapshot.quotes) {
    prices.set(normalizeSymbol(quote.symbol), quote.price);
  }

  return {
    prices,
    errors: snapshot.errors
  };
}

function toAccountView(account: PaperAccountState, prices: Map<string, number>): PaperAccountView {
  const positions = account.positions
    .map((position) => {
      const price = prices.get(normalizeSymbol(position.symbol)) ?? position.lastPriceUsd;
      const marketValueUsd = round2(position.quantity * price);
      const unrealizedPnlUsd = round2((price - position.averageEntryPriceUsd) * position.quantity);
      const unrealizedPnlPercent =
        position.averageEntryPriceUsd > 0
          ? round2(((price - position.averageEntryPriceUsd) / position.averageEntryPriceUsd) * 100)
          : 0;

      return {
        symbol: position.symbol,
        quantity: round(position.quantity),
        averageEntryPriceUsd: round2(position.averageEntryPriceUsd),
        lastPriceUsd: round2(price),
        marketValueUsd,
        unrealizedPnlUsd,
        unrealizedPnlPercent,
        updatedAt: position.updatedAt
      };
    })
    .sort((a, b) => b.marketValueUsd - a.marketValueUsd);

  const unrealizedPnlUsd = round2(positions.reduce((sum, item) => sum + item.unrealizedPnlUsd, 0));
  const positionValueUsd = round2(positions.reduce((sum, item) => sum + item.marketValueUsd, 0));
  const equityUsd = round2(account.cashUsd + positionValueUsd);
  const totalPnlUsd = round2(equityUsd - account.initialBalanceUsd);

  return paperAccountViewSchema.parse({
    initialBalanceUsd: round2(account.initialBalanceUsd),
    cashUsd: round2(account.cashUsd),
    equityUsd,
    realizedPnlUsd: round2(account.realizedPnlUsd),
    unrealizedPnlUsd,
    totalPnlUsd,
    feePaidUsd: round2(account.feePaidUsd),
    positions,
    updatedAt: account.updatedAt
  });
}

function findPositionIndex(positions: PaperPositionState[], symbol: string): number {
  const normalized = normalizeSymbol(symbol);
  return positions.findIndex((item) => normalizeSymbol(item.symbol) === normalized);
}

function applyBuy(
  account: PaperAccountState,
  input: PaperOrderCreateInput,
  priceUsd: number,
  createdAt: string
): { updated: PaperAccountState; realizedPnlUsd: number; feeUsd: number; notionalUsd: number } {
  const notionalUsd = round2(input.quantity * priceUsd);
  const feeUsd = round2(notionalUsd * PAPER_FEE_RATE);
  const required = round2(notionalUsd + feeUsd);

  if (account.cashUsd < required) {
    throw new Error(`可用资金不足：需要 ${required.toFixed(2)} USD，可用 ${account.cashUsd.toFixed(2)} USD。`);
  }

  const positions = [...account.positions];
  const index = findPositionIndex(positions, input.symbol);

  if (index === -1) {
    positions.push({
      symbol: input.symbol,
      quantity: round(input.quantity),
      averageEntryPriceUsd: round2(priceUsd),
      lastPriceUsd: round2(priceUsd),
      updatedAt: createdAt
    });
  } else {
    const current = positions[index]!;
    const nextQuantity = round(current.quantity + input.quantity);
    const nextAverage = round2((current.averageEntryPriceUsd * current.quantity + priceUsd * input.quantity) / nextQuantity);

    positions[index] = {
      ...current,
      quantity: nextQuantity,
      averageEntryPriceUsd: nextAverage,
      lastPriceUsd: round2(priceUsd),
      updatedAt: createdAt
    };
  }

  return {
    updated: {
      ...account,
      cashUsd: round2(account.cashUsd - required),
      feePaidUsd: round2(account.feePaidUsd + feeUsd),
      positions,
      updatedAt: createdAt
    },
    realizedPnlUsd: 0,
    feeUsd,
    notionalUsd
  };
}

function applySell(
  account: PaperAccountState,
  input: PaperOrderCreateInput,
  priceUsd: number,
  createdAt: string
): { updated: PaperAccountState; realizedPnlUsd: number; feeUsd: number; notionalUsd: number } {
  const positions = [...account.positions];
  const index = findPositionIndex(positions, input.symbol);

  if (index === -1) {
    throw new Error(`持仓不足：当前没有 ${input.symbol} 可卖仓位。`);
  }

  const current = positions[index]!;
  if (current.quantity < input.quantity) {
    throw new Error(`持仓不足：可卖数量 ${current.quantity.toFixed(8)}，请求卖出 ${input.quantity.toFixed(8)}。`);
  }

  const notionalUsd = round2(input.quantity * priceUsd);
  const feeUsd = round2(notionalUsd * PAPER_FEE_RATE);
  const realizedPnlUsd = round2((priceUsd - current.averageEntryPriceUsd) * input.quantity - feeUsd);

  const nextQuantity = round(current.quantity - input.quantity);
  if (nextQuantity <= 0.00000001) {
    positions.splice(index, 1);
  } else {
    positions[index] = {
      ...current,
      quantity: nextQuantity,
      lastPriceUsd: round2(priceUsd),
      updatedAt: createdAt
    };
  }

  const cashDelta = round2(notionalUsd - feeUsd);

  return {
    updated: {
      ...account,
      cashUsd: round2(account.cashUsd + cashDelta),
      realizedPnlUsd: round2(account.realizedPnlUsd + realizedPnlUsd),
      feePaidUsd: round2(account.feePaidUsd + feeUsd),
      positions,
      updatedAt: createdAt
    },
    realizedPnlUsd,
    feeUsd,
    notionalUsd
  };
}

export async function getPaperTradingSnapshot(limit = 20): Promise<PaperAccountResponse> {
  const account = await readPaperAccountState();
  const symbols = account.positions.map((item) => item.symbol);

  let prices = new Map<string, number>();
  let marketErrors: string[] = [];

  try {
    const quoteResult = await fetchQuoteMap(symbols);
    prices = quoteResult.prices;
    marketErrors = quoteResult.errors;
  } catch (error) {
    marketErrors = [error instanceof Error ? error.message : "行情读取失败"]; 
  }

  const accountView = toAccountView(account, prices);
  const recentTrades = await listPaperTrades(limit);

  return {
    tool: "paper",
    account: accountView,
    recentTrades,
    marketErrors
  };
}

export async function placePaperOrder(input: PaperOrderCreateInput): Promise<PaperOrderResponse> {
  const account = await readPaperAccountState();
  const createdAt = new Date().toISOString();

  const quoteResult = await fetchQuoteMap([input.symbol]);
  const normalized = normalizeSymbol(input.symbol);
  const orderWarnings = [...quoteResult.errors];

  let executionPrice = quoteResult.prices.get(normalized) ?? null;

  if (!executionPrice) {
    const secondaryPrice = await fetchSecondaryPrice(input.symbol);
    if (secondaryPrice) {
      executionPrice = secondaryPrice;
      orderWarnings.push(`主行情源不可用，已切换备用行情源执行 ${input.symbol}。`);
    }
  }

  if (!executionPrice) {
    const storedPrice = account.positions.find((item) => normalizeSymbol(item.symbol) === normalized)?.lastPriceUsd;
    if (storedPrice) {
      executionPrice = storedPrice;
      orderWarnings.push(`实时行情暂不可用，已使用账户内最近价格执行 ${input.symbol}。`);
    }
  }

  if (!executionPrice) {
    const staticPrice = staticReferencePriceBySymbol[normalized];
    if (staticPrice) {
      executionPrice = staticPrice;
      orderWarnings.push(`实时行情暂不可用，已使用参考价格执行 ${input.symbol}。`);
    }
  }

  if (!executionPrice) {
    throw new Error(
      `未获取到 ${input.symbol} 的实时行情，无法下单。${quoteResult.errors.length > 0 ? `详情：${quoteResult.errors.join("; ")}` : ""}`
    );
  }

  const orderResult =
    input.side === "buy"
      ? applyBuy(account, input, executionPrice, createdAt)
      : applySell(account, input, executionPrice, createdAt);

  const nextState = orderResult.updated;
  await writePaperAccountState(nextState);

  const trade = paperTradeSchema.parse({
    id: crypto.randomUUID(),
    symbol: input.symbol,
    side: input.side,
    quantity: round(input.quantity),
    priceUsd: round2(executionPrice),
    notionalUsd: orderResult.notionalUsd,
    feeUsd: orderResult.feeUsd,
    realizedPnlUsd: orderResult.realizedPnlUsd,
    status: "filled",
    createdAt
  });

  await appendPaperTrade(trade);

  const snapshot = await getPaperTradingSnapshot(20);

  return paperOrderResponseSchema.parse({
    tool: "paper",
    trade,
    account: snapshot.account,
    marketErrors: [...orderWarnings, ...snapshot.marketErrors]
  });
}

export async function placePaperOrderFromPayload(payload: unknown): Promise<PaperOrderResponse> {
  const input = paperOrderCreateInputSchema.parse(payload);
  return placePaperOrder(input);
}
