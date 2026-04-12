import crypto from "node:crypto";

import {
  tradingOrderCancelInputSchema,
  tradingOrderCreateInputSchema,
  tradingOrderSchema,
  type TradingOrder,
  type TradingOrderCancelInput,
  type TradingOrderCreateInput,
  type TradingRiskRequest
} from "@/lib/schemas/trading";
import { appendTradingOrderSnapshot, findTradingOrderById, listTradingOrders } from "@/lib/storage/trading-orders";
import { evaluateTradingRisk } from "@/lib/tools/trading";

function toRiskRequest(input: TradingOrderCreateInput): TradingRiskRequest {
  return {
    symbol: input.symbol,
    side: input.side,
    leverage: input.leverage,
    notionalUsd: input.notionalUsd,
    accountEquityUsd: input.accountEquityUsd,
    stopLossPercent: input.stopLossPercent,
    currentExposurePercent: input.currentExposurePercent,
    dailyLossPercent: input.dailyLossPercent
  };
}

export async function placeTradingOrder(input: TradingOrderCreateInput): Promise<TradingOrder> {
  const riskRequest = toRiskRequest(input);
  const riskResult = await evaluateTradingRisk(riskRequest);
  const now = new Date().toISOString();

  const order = tradingOrderSchema.parse({
    id: crypto.randomUUID(),
    symbol: input.symbol,
    side: input.side,
    orderType: input.orderType,
    leverage: input.leverage,
    notionalUsd: input.notionalUsd,
    limitPrice: input.limitPrice,
    stopLossPercent: input.stopLossPercent,
    status: riskResult.decision === "reject" ? "rejected" : "submitted",
    source: input.source,
    walletCommitHash: input.walletCommitHash,
    riskDecision: riskResult.decision,
    riskScore: riskResult.score,
    riskRequest,
    reason: riskResult.decision === "reject" ? "Blocked by trading risk policy." : undefined,
    createdAt: now,
    updatedAt: now
  });

  await appendTradingOrderSnapshot(order);
  return order;
}

export async function placeTradingOrderFromPayload(payload: unknown): Promise<TradingOrder> {
  const input = tradingOrderCreateInputSchema.parse(payload);
  return placeTradingOrder(input);
}

export async function cancelTradingOrder(input: TradingOrderCancelInput): Promise<TradingOrder> {
  const existing = await findTradingOrderById(input.orderId);
  if (!existing) {
    throw new Error(`Order ${input.orderId} not found.`);
  }

  if (existing.status === "canceled") {
    throw new Error(`Order ${input.orderId} has already been canceled.`);
  }

  if (existing.status === "rejected") {
    throw new Error(`Order ${input.orderId} was rejected and cannot be canceled.`);
  }

  const now = new Date().toISOString();
  const canceled = tradingOrderSchema.parse({
    ...existing,
    status: "canceled",
    reason: input.reason ?? "Canceled by trading API.",
    canceledAt: now,
    updatedAt: now
  });

  await appendTradingOrderSnapshot(canceled);
  return canceled;
}

export async function cancelTradingOrderFromPayload(payload: unknown): Promise<TradingOrder> {
  const input = tradingOrderCancelInputSchema.parse(payload);
  return cancelTradingOrder(input);
}

export async function listTradingOrdersView(options?: {
  limit?: number;
  status?: TradingOrder["status"];
  source?: TradingOrder["source"];
}): Promise<TradingOrder[]> {
  return listTradingOrders(options);
}