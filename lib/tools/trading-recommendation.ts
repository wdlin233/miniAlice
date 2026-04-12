import crypto from "node:crypto";

import {
  tradingPositionRecommendationSchema,
  tradingRecommendationRequestSchema,
  tradingRecommendationResultSchema,
  type TradingRecommendationRequest,
  type TradingRecommendationResult,
  type TradingRiskLevel,
  type TradingSide,
  type TradingStrategyConfig
} from "@/lib/schemas/trading";
import { appendTradingRecommendationLog } from "@/lib/storage/trading-recommendations";
import { readTradingStrategyConfig } from "@/lib/storage/trading-strategy";
import { evaluateTradingRisk } from "@/lib/tools/trading";

const exposureByRiskLevel: Record<TradingRiskLevel, number> = {
  low: 0.06,
  medium: 0.1,
  high: 0.16
};

const leverageCapByRiskLevel: Record<TradingRiskLevel, number> = {
  low: 2,
  medium: 3,
  high: 5
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeRequest(
  input: TradingRecommendationRequest,
  config: TradingStrategyConfig
): TradingRecommendationRequest {
  return {
    ...input,
    accountEquityUsd: input.accountEquityUsd ?? config.defaultAccountEquityUsd
  };
}

function deriveRecommendation(
  request: TradingRecommendationRequest,
  config: TradingStrategyConfig
): {
  side: TradingSide;
  leverage: number;
  notionalUsd: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  confidence: number;
  rationale: string[];
} {
  const trendStrength = Math.abs(request.trendScore);
  const side: TradingSide = request.trendScore >= 0 ? "buy" : "sell";

  const volatilityPenalty = clamp(request.volatilityPercent / 12, 0, 2.5);
  const leverageCap = Math.min(
    leverageCapByRiskLevel[request.riskLevel],
    config.maxRecommendedLeverage
  );
  const leverage = clamp(round2(leverageCap - volatilityPenalty), 1, config.maxRecommendedLeverage);

  const exposureRatio = exposureByRiskLevel[request.riskLevel] * (1 - clamp(request.volatilityPercent, 0, 80) / 200);
  const accountEquityUsd = request.accountEquityUsd ?? config.defaultAccountEquityUsd;
  const rawNotional = accountEquityUsd * exposureRatio;
  const notionalUsd = clamp(round2(rawNotional), config.minNotionalUsd, config.maxNotionalUsd);

  const stopLossPercent = round2(Math.max(config.baseStopLossPercent, request.volatilityPercent * 0.35));
  const takeProfitPercent = round2(stopLossPercent * config.rewardRiskRatio);

  const confidence = round2(
    clamp(trendStrength * 0.7 + (100 - request.volatilityPercent) * 0.3, 0, 100)
  );

  const rationale = [
    `Trend score ${request.trendScore} => ${side.toUpperCase()} bias.`,
    `Volatility ${request.volatilityPercent}% adjusts leverage to ${leverage}x.`,
    `Risk level ${request.riskLevel} maps notional to $${notionalUsd}.`
  ];

  return {
    side,
    leverage,
    notionalUsd,
    stopLossPercent,
    takeProfitPercent,
    confidence,
    rationale
  };
}

async function appendRecommendationLogSafe(result: TradingRecommendationResult): Promise<void> {
  try {
    await appendTradingRecommendationLog({
      id: crypto.randomUUID(),
      symbol: result.recommendation.symbol,
      side: result.recommendation.side,
      riskLevel: result.recommendation.riskLevel,
      confidence: result.recommendation.confidence,
      notionalUsd: result.recommendation.notionalUsd,
      leverage: result.recommendation.leverage,
      riskDecision: result.risk.decision,
      riskScore: result.risk.score,
      summary: `${result.recommendation.symbol} ${result.recommendation.side.toUpperCase()} lev ${result.recommendation.leverage}x` +
        ` => risk ${result.risk.decision.toUpperCase()}(${result.risk.score})`,
      createdAt: result.createdAt
    });
  } catch {
    // Keep recommendation flow non-blocking if log persistence fails.
  }
}

export async function generatePositionRecommendation(
  input: TradingRecommendationRequest
): Promise<TradingRecommendationResult> {
  const config = await readTradingStrategyConfig();
  const request = normalizeRequest(input, config);
  const derived = deriveRecommendation(request, config);

  const recommendation = tradingPositionRecommendationSchema.parse({
    symbol: request.symbol,
    side: derived.side,
    leverage: derived.leverage,
    notionalUsd: derived.notionalUsd,
    stopLossPercent: derived.stopLossPercent,
    takeProfitPercent: derived.takeProfitPercent,
    confidence: derived.confidence,
    riskLevel: request.riskLevel
  });

  const risk = await evaluateTradingRisk({
    symbol: recommendation.symbol,
    side: recommendation.side,
    leverage: recommendation.leverage,
    notionalUsd: recommendation.notionalUsd,
    accountEquityUsd: request.accountEquityUsd ?? config.defaultAccountEquityUsd,
    stopLossPercent: recommendation.stopLossPercent,
    currentExposurePercent: request.currentExposurePercent,
    dailyLossPercent: request.dailyLossPercent
  });

  const result = tradingRecommendationResultSchema.parse({
    tool: "trading",
    policyVersion: config.policyVersion,
    request,
    recommendation,
    risk,
    rationale: derived.rationale,
    createdAt: new Date().toISOString()
  });

  await appendRecommendationLogSafe(result);
  return result;
}

export async function generatePositionRecommendationFromPayload(
  payload: unknown
): Promise<TradingRecommendationResult> {
  const input = tradingRecommendationRequestSchema.parse(payload);
  return generatePositionRecommendation(input);
}