import crypto from "node:crypto";

import { tradingWalletPushExecutionSchema, type TradingWalletPushExecution } from "@/lib/schemas/trading";
import { appendTradingWalletPushExecution } from "@/lib/storage/trading-wallet-link";
import { placeTradingOrder } from "@/lib/tools/trading-order";
import { generatePositionRecommendation } from "@/lib/tools/trading-recommendation";
import type { WalletCommit } from "@/types/domain";

function inferSymbol(text: string): string {
  const symbolMatch = text.toUpperCase().match(/\b([A-Z]{2,10}(?:USDT|USD|PERP))\b/);
  return symbolMatch?.[1] ?? "BTCUSDT";
}

function inferRiskLevel(text: string): "low" | "medium" | "high" {
  const normalized = text.toLowerCase();

  if (/high\s*risk|aggressive|激进/.test(normalized)) {
    return "high";
  }

  if (/low\s*risk|conservative|保守/.test(normalized)) {
    return "low";
  }

  return "medium";
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

function inferVolatility(commit: WalletCommit): number {
  const countFactor = Math.min(commit.files.length * 1.2, 8);
  return Number((2 + countFactor).toFixed(2));
}

async function appendExecutionLogSafe(entry: TradingWalletPushExecution): Promise<void> {
  try {
    await appendTradingWalletPushExecution(entry);
  } catch {
    // Keep wallet push response non-blocking when execution log write fails.
  }
}

export async function linkWalletPushExecutionSafe(commit: WalletCommit): Promise<{
  tool: "trading";
  execution: TradingWalletPushExecution;
}> {
  const now = new Date().toISOString();
  const payloadText = `${commit.summary} ${commit.files.join(" ")}`;
  const symbol = inferSymbol(payloadText);

  try {
    const recommendation = await generatePositionRecommendation({
      symbol,
      trendScore: inferTrendScore(payloadText),
      volatilityPercent: inferVolatility(commit),
      riskLevel: inferRiskLevel(payloadText),
      accountEquityUsd: 10000,
      currentExposurePercent: 10,
      dailyLossPercent: 0.5
    });

    const order = await placeTradingOrder({
      symbol: recommendation.recommendation.symbol,
      side: recommendation.recommendation.side,
      orderType: "market",
      leverage: recommendation.recommendation.leverage,
      notionalUsd: recommendation.recommendation.notionalUsd,
      stopLossPercent: recommendation.recommendation.stopLossPercent,
      accountEquityUsd: recommendation.request.accountEquityUsd ?? 10000,
      currentExposurePercent: recommendation.request.currentExposurePercent,
      dailyLossPercent: recommendation.request.dailyLossPercent,
      source: "wallet_push",
      walletCommitHash: commit.hash
    });

    const execution = tradingWalletPushExecutionSchema.parse({
      id: crypto.randomUUID(),
      walletCommitHash: commit.hash,
      summary: commit.summary,
      symbol: order.symbol,
      side: order.side,
      status: order.status === "submitted" ? "submitted" : "blocked",
      orderId: order.id,
      reason: order.reason,
      createdAt: now
    });

    await appendExecutionLogSafe(execution);
    return {
      tool: "trading",
      execution
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet push trading linkage failed.";

    const execution = tradingWalletPushExecutionSchema.parse({
      id: crypto.randomUUID(),
      walletCommitHash: commit.hash,
      summary: commit.summary,
      symbol,
      side: inferTrendScore(payloadText) >= 0 ? "buy" : "sell",
      status: "error",
      reason: message,
      createdAt: now
    });

    await appendExecutionLogSafe(execution);
    return {
      tool: "trading",
      execution
    };
  }
}