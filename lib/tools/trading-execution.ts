import crypto from "node:crypto";

import { referencePriceBySymbol } from "@/lib/market/reference-prices";
import {
  tradingExecuteInputSchema,
  tradingExecuteResultSchema,
  tradingWalletPushExecutionSchema,
  type TradingOrder,
  type TradingExecuteInput,
  type TradingExecuteResult,
  type TradingWalletPushExecution
} from "@/lib/schemas/trading";
import { addWalletDraft, commitWallet, pushCommit } from "@/lib/storage/wallet";
import { readPaperAccountState } from "@/lib/storage/paper-trading";
import { appendTradingWalletPushExecution } from "@/lib/storage/trading-wallet-link";
import { fetchMarketSnapshot } from "@/lib/tools/browser";
import { generatePositionRecommendation } from "@/lib/tools/trading-recommendation";
import { placePaperOrder } from "@/lib/tools/paper-trading";
import { placeTradingOrder } from "@/lib/tools/trading-order";
import type { WalletCommit } from "@/types/domain";

function inferSymbolFromText(text: string): string {
  const symbolMatch = text.toUpperCase().match(/\b([A-Z]{2,10}(?:USDT|USD|PERP))\b/);
  return symbolMatch?.[1] ?? "BTCUSDT";
}

function inferTrendScore(text: string): number {
  const normalized = text.toLowerCase();

  if (/short|sell|bear|看空/.test(normalized)) {
    return -45;
  }

  if (/long|buy|bull|看多/.test(normalized)) {
    return 45;
  }

  return 20;
}

function inferVolatilityByRiskLevel(level: TradingExecuteInput["riskLevel"]): number {
  if (level === "low") {
    return 2.2;
  }

  if (level === "high") {
    return 6.8;
  }

  return 4.2;
}

function buildSyntheticFiles(symbol: string): string[] {
  const dateTag = new Date().toISOString().slice(0, 10);
  return [`strategies/${symbol}-${dateTag}.md`, `risk/${symbol}-execution.json`];
}

function round(value: number): number {
  return Number(value.toFixed(8));
}

function toExecutionStatus(orderStatus: TradingOrder["status"]): "submitted" | "blocked" {
  return orderStatus === "submitted" ? "submitted" : "blocked";
}

function buildExecutionLog(params: {
  commit: WalletCommit;
  summary: string;
  symbol: string;
  side: TradingOrder["side"];
  status: TradingWalletPushExecution["status"];
  orderId?: string;
  reason?: string;
}): TradingWalletPushExecution {
  return tradingWalletPushExecutionSchema.parse({
    id: crypto.randomUUID(),
    walletCommitHash: params.commit.hash,
    summary: params.summary,
    symbol: params.symbol,
    side: params.side,
    status: params.status,
    orderId: params.orderId,
    reason: params.reason,
    createdAt: new Date().toISOString()
  });
}

async function resolveReferencePrice(symbol: string): Promise<number> {
  const normalizedSymbol = symbol.toUpperCase();

  try {
    const snapshot = await fetchMarketSnapshot({ symbols: [normalizedSymbol] });
    const quote = snapshot.quotes.find((item) => item.symbol.toUpperCase() === normalizedSymbol);

    if (quote && Number.isFinite(quote.price) && quote.price > 0) {
      return quote.price;
    }
  } catch {
    // Fall through to local data fallback.
  }

  const paperAccount = await readPaperAccountState();
  const positionPrice = paperAccount.positions.find((item) => item.symbol.toUpperCase() === normalizedSymbol)?.lastPriceUsd;
  if (positionPrice && Number.isFinite(positionPrice) && positionPrice > 0) {
    return positionPrice;
  }

  return referencePriceBySymbol[normalizedSymbol] ?? 0;
}

async function mirrorSubmittedOrderToPaper(order: TradingOrder): Promise<string | undefined> {
  if (order.status !== "submitted") {
    return "订单未进入 submitted 状态，未同步模拟盘。";
  }

  const referencePrice = await resolveReferencePrice(order.symbol);
  if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
    return `缺少 ${order.symbol} 的参考价格，未同步模拟盘。`;
  }

  const quantity = round(order.notionalUsd / referencePrice);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return `换算数量失败（notional=${order.notionalUsd}, price=${referencePrice}），未同步模拟盘。`;
  }

  try {
    await placePaperOrder({
      symbol: order.symbol,
      side: order.side,
      orderType: "market",
      quantity
    });
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return `模拟盘同步失败：${message}`;
  }
}

export async function executeTradingStrategy(input: TradingExecuteInput): Promise<TradingExecuteResult> {
  const symbol = input.symbol?.toUpperCase() || inferSymbolFromText(input.strategy);
  const recommendationResult = await generatePositionRecommendation({
    symbol,
    trendScore: inferTrendScore(input.strategy),
    volatilityPercent: inferVolatilityByRiskLevel(input.riskLevel),
    riskLevel: input.riskLevel,
    accountEquityUsd: input.accountEquityUsd,
    currentExposurePercent: input.currentExposurePercent,
    dailyLossPercent: input.dailyLossPercent
  });

  const summary = `${symbol} ${recommendationResult.recommendation.side.toUpperCase()} | ${input.strategy.slice(0, 140)}`;
  const draft = await addWalletDraft(summary, buildSyntheticFiles(symbol));
  const commit = await commitWallet();
  const pushedCommit = await pushCommit(commit.hash);

  let execution: TradingWalletPushExecution;

  try {
    const order = await placeTradingOrder({
      symbol: recommendationResult.recommendation.symbol,
      side: recommendationResult.recommendation.side,
      orderType: "market",
      leverage: recommendationResult.recommendation.leverage,
      notionalUsd: recommendationResult.recommendation.notionalUsd,
      stopLossPercent: recommendationResult.recommendation.stopLossPercent,
      accountEquityUsd: input.accountEquityUsd,
      currentExposurePercent: input.currentExposurePercent,
      dailyLossPercent: input.dailyLossPercent,
      source: "wallet_push",
      walletCommitHash: pushedCommit.hash
    });

    const mirrorWarning = await mirrorSubmittedOrderToPaper(order);
    const reason = [order.reason, mirrorWarning].filter(Boolean).join(" | ") || undefined;

    execution = buildExecutionLog({
      commit: pushedCommit,
      summary,
      symbol: order.symbol,
      side: order.side,
      status: toExecutionStatus(order.status),
      orderId: order.id,
      reason
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet push trading linkage failed.";

    execution = buildExecutionLog({
      commit: pushedCommit,
      summary,
      symbol,
      side: recommendationResult.recommendation.side,
      status: "error",
      reason: message
    });
  }

  await appendTradingWalletPushExecution(execution);

  return tradingExecuteResultSchema.parse({
    tool: "trading",
    summary,
    wallet: {
      draftUpdatedAt: draft.updatedAt,
      commitHash: commit.hash,
      pushStage: pushedCommit.stage
    },
    recommendation: recommendationResult.recommendation,
    execution,
    createdAt: new Date().toISOString()
  });
}

export async function executeTradingStrategyFromPayload(payload: unknown): Promise<TradingExecuteResult> {
  const input = tradingExecuteInputSchema.parse(payload);
  return executeTradingStrategy(input);
}
