import crypto from "node:crypto";

import {
  paperAccountResponseSchema,
  paperAccountViewSchema,
  paperPendingOrderSchema,
  paperOrderCreateInputSchema,
  paperOrderResponseSchema,
  paperTradeSchema,
  type PaperAccountResponse,
  type PaperAccountState,
  type PaperAccountView,
  type PaperPendingOrder,
  type PaperOrderCreateInput,
  type PaperOrderResponse,
  type PaperPositionState,
  type PaperTrade,
  type PaperTradeTrigger
} from "@/lib/schemas/paper-trading";
import { fetchMarketSnapshot } from "@/lib/tools/browser";
import {
  appendPaperTrade,
  listPaperTrades,
  readPaperAccountState,
  readPaperPendingOrders,
  writePaperAccountState,
  writePaperPendingOrders
} from "@/lib/storage/paper-trading";

const PAPER_FEE_RATE = 0.001;
const SECONDARY_REQUEST_TIMEOUT_MS = 2500;

const staticReferencePriceBySymbol: Record<string, number> = {
  BTCUSDT: 68000,
  ETHUSDT: 3200,
  SOLUSDT: 150,
  BNBUSDT: 600,
  XRPUSDT: 0.6
};

interface QuoteLookupResult {
  prices: Map<string, number>;
  errors: string[];
}

interface SyncState {
  account: PaperAccountState;
  pendingOrders: PaperPendingOrder[];
  prices: Map<string, number>;
  marketErrors: string[];
  events: string[];
}

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

async function fetchQuoteMap(symbols: string[]): Promise<QuoteLookupResult> {
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

async function resolveExecutionPrice(
  account: PaperAccountState,
  symbol: string,
  primaryQuote?: QuoteLookupResult
): Promise<{ priceUsd: number; warnings: string[] }> {
  const normalized = normalizeSymbol(symbol);
  const warnings = [...(primaryQuote?.errors ?? [])];

  const priceFromPrimary = primaryQuote?.prices.get(normalized);
  if (priceFromPrimary && Number.isFinite(priceFromPrimary) && priceFromPrimary > 0) {
    return { priceUsd: priceFromPrimary, warnings };
  }

  const secondaryPrice = await fetchSecondaryPrice(symbol);
  if (secondaryPrice && Number.isFinite(secondaryPrice) && secondaryPrice > 0) {
    warnings.push(`主行情源不可用，已切换备用行情源执行 ${symbol}。`);
    return { priceUsd: secondaryPrice, warnings };
  }

  const storedPrice = account.positions.find((item) => normalizeSymbol(item.symbol) === normalized)?.lastPriceUsd;
  if (storedPrice && Number.isFinite(storedPrice) && storedPrice > 0) {
    warnings.push(`实时行情暂不可用，已使用账户内最近价格执行 ${symbol}。`);
    return { priceUsd: storedPrice, warnings };
  }

  const staticPrice = staticReferencePriceBySymbol[normalized];
  if (staticPrice && Number.isFinite(staticPrice) && staticPrice > 0) {
    warnings.push(`实时行情暂不可用，已使用参考价格执行 ${symbol}。`);
    return { priceUsd: staticPrice, warnings };
  }

  throw new Error(
    `未获取到 ${symbol} 的实时行情，无法下单。${warnings.length > 0 ? `详情：${warnings.join("; ")}` : ""}`
  );
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
        takeProfitPriceUsd: position.takeProfitPriceUsd ? round2(position.takeProfitPriceUsd) : undefined,
        stopLossPriceUsd: position.stopLossPriceUsd ? round2(position.stopLossPriceUsd) : undefined,
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
      takeProfitPriceUsd: input.takeProfitPriceUsd ? round2(input.takeProfitPriceUsd) : undefined,
      stopLossPriceUsd: input.stopLossPriceUsd ? round2(input.stopLossPriceUsd) : undefined,
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
      takeProfitPriceUsd: input.takeProfitPriceUsd ? round2(input.takeProfitPriceUsd) : current.takeProfitPriceUsd,
      stopLossPriceUsd: input.stopLossPriceUsd ? round2(input.stopLossPriceUsd) : current.stopLossPriceUsd,
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

function isLimitTriggered(order: PaperPendingOrder, priceUsd: number): boolean {
  if (order.side === "buy") {
    return priceUsd <= order.limitPriceUsd;
  }

  return priceUsd >= order.limitPriceUsd;
}

function buildTradeRecord(params: {
  symbol: string;
  side: PaperOrderCreateInput["side"];
  quantity: number;
  priceUsd: number;
  notionalUsd: number;
  feeUsd: number;
  realizedPnlUsd: number;
  orderType: PaperOrderCreateInput["orderType"];
  trigger: PaperTradeTrigger;
  createdAt: string;
}): PaperTrade {
  return paperTradeSchema.parse({
    id: crypto.randomUUID(),
    symbol: params.symbol,
    side: params.side,
    orderType: params.orderType,
    trigger: params.trigger,
    quantity: round(params.quantity),
    priceUsd: round2(params.priceUsd),
    notionalUsd: round2(params.notionalUsd),
    feeUsd: round2(params.feeUsd),
    realizedPnlUsd: round2(params.realizedPnlUsd),
    status: "filled",
    createdAt: params.createdAt
  });
}

async function syncPaperTradingState(): Promise<SyncState> {
  let account = await readPaperAccountState();
  const pendingOrders = await readPaperPendingOrders();
  const events: string[] = [];
  const syncWarnings: string[] = [];

  const symbolSet = new Set<string>([
    ...account.positions.map((item) => item.symbol),
    ...pendingOrders.filter((item) => item.status === "open").map((item) => item.symbol)
  ]);

  let primaryQuotes: QuoteLookupResult = { prices: new Map<string, number>(), errors: [] };
  try {
    primaryQuotes = await fetchQuoteMap(Array.from(symbolSet));
    syncWarnings.push(...primaryQuotes.errors);
  } catch (error) {
    syncWarnings.push(error instanceof Error ? error.message : "行情读取失败");
  }

  let pendingChanged = false;
  let accountChanged = false;
  const tradesToAppend: PaperTrade[] = [];

  const nextPending = pendingOrders.map((item) => ({ ...item }));

  for (let i = 0; i < nextPending.length; i += 1) {
    const pending = nextPending[i];
    if (!pending) {
      continue;
    }

    if (pending.status !== "open") {
      continue;
    }

    let priceResult: { priceUsd: number; warnings: string[] };
    try {
      priceResult = await resolveExecutionPrice(account, pending.symbol, primaryQuotes);
    } catch {
      continue;
    }

    syncWarnings.push(...priceResult.warnings);

    if (!isLimitTriggered(pending, priceResult.priceUsd)) {
      continue;
    }

    const now = new Date().toISOString();
    const fillInput = paperOrderCreateInputSchema.parse({
      symbol: pending.symbol,
      side: pending.side,
      orderType: "limit",
      quantity: pending.quantity,
      takeProfitPriceUsd: pending.takeProfitPriceUsd,
      stopLossPriceUsd: pending.stopLossPriceUsd
    });

    const orderResult =
      fillInput.side === "buy"
        ? applyBuy(account, fillInput, priceResult.priceUsd, now)
        : applySell(account, fillInput, priceResult.priceUsd, now);

    account = orderResult.updated;
    accountChanged = true;

    nextPending[i] = {
      ...pending,
      status: "filled",
      reason: "limit_triggered",
      filledAt: now,
      updatedAt: now
    };
    pendingChanged = true;

    tradesToAppend.push(
      buildTradeRecord({
        symbol: fillInput.symbol,
        side: fillInput.side,
        quantity: fillInput.quantity,
        priceUsd: priceResult.priceUsd,
        notionalUsd: orderResult.notionalUsd,
        feeUsd: orderResult.feeUsd,
        realizedPnlUsd: orderResult.realizedPnlUsd,
        orderType: "limit",
        trigger: "limit",
        createdAt: now
      })
    );

    events.push(`限价单触发成交：${fillInput.symbol} ${fillInput.side === "buy" ? "买入" : "卖出"} ${fillInput.quantity}`);
  }

  const existingPositions = [...account.positions];
  for (const position of existingPositions) {
    const hasTakeProfit = position.takeProfitPriceUsd !== undefined;
    const hasStopLoss = position.stopLossPriceUsd !== undefined;
    if (!hasTakeProfit && !hasStopLoss) {
      continue;
    }

    let priceResult: { priceUsd: number; warnings: string[] };
    try {
      priceResult = await resolveExecutionPrice(account, position.symbol, primaryQuotes);
    } catch {
      continue;
    }

    syncWarnings.push(...priceResult.warnings);

    const shouldStopLoss = hasStopLoss && priceResult.priceUsd <= (position.stopLossPriceUsd as number);
    const shouldTakeProfit = !shouldStopLoss && hasTakeProfit && priceResult.priceUsd >= (position.takeProfitPriceUsd as number);

    if (!shouldStopLoss && !shouldTakeProfit) {
      continue;
    }

    const now = new Date().toISOString();
    const closeInput = paperOrderCreateInputSchema.parse({
      symbol: position.symbol,
      side: "sell",
      orderType: "market",
      quantity: position.quantity
    });

    const closeResult = applySell(account, closeInput, priceResult.priceUsd, now);
    account = closeResult.updated;
    accountChanged = true;

    const trigger: PaperTradeTrigger = shouldStopLoss ? "stop_loss" : "take_profit";
    tradesToAppend.push(
      buildTradeRecord({
        symbol: closeInput.symbol,
        side: closeInput.side,
        quantity: closeInput.quantity,
        priceUsd: priceResult.priceUsd,
        notionalUsd: closeResult.notionalUsd,
        feeUsd: closeResult.feeUsd,
        realizedPnlUsd: closeResult.realizedPnlUsd,
        orderType: "market",
        trigger,
        createdAt: now
      })
    );

    events.push(
      `${shouldStopLoss ? "止损" : "止盈"}触发：${closeInput.symbol} 自动平仓 ${closeInput.quantity.toFixed(6)}`
    );
  }

  if (accountChanged) {
    await writePaperAccountState(account);
  }

  if (pendingChanged) {
    await writePaperPendingOrders(nextPending);
  }

  for (const trade of tradesToAppend) {
    await appendPaperTrade(trade);
  }

  return {
    account,
    pendingOrders: nextPending,
    prices: primaryQuotes.prices,
    marketErrors: syncWarnings,
    events
  };
}

export async function getPaperTradingSnapshot(limit = 20): Promise<PaperAccountResponse> {
  const synced = await syncPaperTradingState();
  const accountView = toAccountView(synced.account, synced.prices);
  const recentTrades = await listPaperTrades(limit);

  const pendingOrders = synced.pendingOrders
    .filter((item) => item.status === "open")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => paperPendingOrderSchema.parse(item));

  return paperAccountResponseSchema.parse({
    tool: "paper",
    account: accountView,
    pendingOrders,
    recentTrades,
    marketErrors: synced.marketErrors,
    events: synced.events
  });
}

export async function placePaperOrder(input: PaperOrderCreateInput): Promise<PaperOrderResponse> {
  const synced = await syncPaperTradingState();
  let account = synced.account;
  const pendingOrders = synced.pendingOrders;
  const orderWarnings = [...synced.marketErrors];

  let primaryQuote: QuoteLookupResult;
  try {
    primaryQuote = await fetchQuoteMap([input.symbol]);
  } catch (error) {
    primaryQuote = {
      prices: new Map<string, number>(),
      errors: [error instanceof Error ? error.message : "行情读取失败"]
    };
  }

  const priceResult = await resolveExecutionPrice(account, input.symbol, primaryQuote);
  const executionPrice = priceResult.priceUsd;
  orderWarnings.push(...priceResult.warnings);

  if (input.orderType === "limit") {
    const limitPrice = input.limitPriceUsd as number;
    const willFillNow = input.side === "buy" ? executionPrice <= limitPrice : executionPrice >= limitPrice;

    if (!willFillNow) {
      const now = new Date().toISOString();
      const pendingOrder = paperPendingOrderSchema.parse({
        id: crypto.randomUUID(),
        symbol: input.symbol,
        side: input.side,
        quantity: round(input.quantity),
        limitPriceUsd: round2(limitPrice),
        takeProfitPriceUsd: input.takeProfitPriceUsd ? round2(input.takeProfitPriceUsd) : undefined,
        stopLossPriceUsd: input.stopLossPriceUsd ? round2(input.stopLossPriceUsd) : undefined,
        status: "open",
        createdAt: now,
        updatedAt: now
      });

      await writePaperPendingOrders([...pendingOrders, pendingOrder]);
      const snapshot = await getPaperTradingSnapshot(20);

      return paperOrderResponseSchema.parse({
        tool: "paper",
        account: snapshot.account,
        pendingOrder,
        marketErrors: [...orderWarnings, ...snapshot.marketErrors],
        message: `限价单已挂单，等待触发：${input.symbol} ${input.side === "buy" ? "买入" : "卖出"} @ ${limitPrice}`
      });
    }
  }

  const now = new Date().toISOString();
  const orderResult =
    input.side === "buy"
      ? applyBuy(account, input, executionPrice, now)
      : applySell(account, input, executionPrice, now);
  account = orderResult.updated;
  await writePaperAccountState(account);

  const tradeTrigger: PaperTradeTrigger = input.orderType === "limit" ? "limit" : "manual";
  const trade = buildTradeRecord({
    symbol: input.symbol,
    side: input.side,
    quantity: input.quantity,
    priceUsd: executionPrice,
    notionalUsd: orderResult.notionalUsd,
    feeUsd: orderResult.feeUsd,
    realizedPnlUsd: orderResult.realizedPnlUsd,
    orderType: input.orderType,
    trigger: tradeTrigger,
    createdAt: now
  });
  await appendPaperTrade(trade);

  const snapshot = await getPaperTradingSnapshot(20);

  return paperOrderResponseSchema.parse({
    tool: "paper",
    account: snapshot.account,
    trade,
    marketErrors: [...orderWarnings, ...snapshot.marketErrors],
    message:
      input.orderType === "limit"
        ? `限价单已触发成交：${input.symbol} ${input.side === "buy" ? "买入" : "卖出"}`
        : `市价单成交：${input.symbol} ${input.side === "buy" ? "买入" : "卖出"}`
  });
}

export async function placePaperOrderFromPayload(payload: unknown): Promise<PaperOrderResponse> {
  const input = paperOrderCreateInputSchema.parse(payload);
  return placePaperOrder(input);
}
