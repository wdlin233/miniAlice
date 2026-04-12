import crypto from "node:crypto";

import {
  tradingRiskRequestSchema,
  tradingRiskResultSchema,
  tradingRuleStatusSchema,
  type TradingRiskConfig,
  type TradingRiskRequest,
  type TradingRiskResult,
  type TradingRiskRule
} from "@/lib/schemas/trading";
import { appendTradingRiskLog } from "@/lib/storage/trading-risk-log";
import { readTradingRiskConfig } from "@/lib/storage/trading-risk";

interface TradingRiskContext {
  request: TradingRiskRequest;
  config: TradingRiskConfig;
  metrics: {
    proposedExposurePercent: number;
    resultingExposurePercent: number;
    riskPerTradePercent: number;
  };
}

type RuleEvaluation = {
  rule: TradingRiskRule;
  recommendation?: string;
};

function round2(value: number): number {
  return Number(value.toFixed(2));
}

async function appendTradingRiskLogSafe(result: TradingRiskResult, request: TradingRiskRequest): Promise<void> {
  try {
    await appendTradingRiskLog({
      id: crypto.randomUUID(),
      symbol: request.symbol,
      side: request.side,
      decision: result.decision,
      score: result.score,
      policyVersion: result.policyVersion,
      summary: `${request.symbol} ${request.side.toUpperCase()} -> ${result.decision.toUpperCase()} (${result.score})`,
      createdAt: new Date().toISOString()
    });
  } catch {
    // Keep risk evaluation flow non-blocking when history write fails.
  }
}

function evaluateRuleSet(context: TradingRiskContext): RuleEvaluation[] {
  const { request, config, metrics } = context;
  const evaluations: RuleEvaluation[] = [];

  const warningLeverage = Math.min(config.warningLeverage, config.maxLeverage);
  const warningRisk = Math.min(config.warningRiskPerTradePercent, config.maxRiskPerTradePercent);

  if (request.leverage > config.maxLeverage) {
    evaluations.push({
      rule: {
        id: "leverage_limit",
        label: "Leverage Limit",
        status: tradingRuleStatusSchema.Enum.fail,
        message: `Leverage ${request.leverage}x exceeds max ${config.maxLeverage}x.`
      },
      recommendation: "降低杠杆，优先控制在策略上限内。"
    });
  } else if (request.leverage >= warningLeverage) {
    evaluations.push({
      rule: {
        id: "leverage_limit",
        label: "Leverage Limit",
        status: tradingRuleStatusSchema.Enum.warn,
        message: `Leverage ${request.leverage}x is near max ${config.maxLeverage}x.`
      },
      recommendation: "当前杠杆接近上限，建议下调或缩小名义仓位。"
    });
  } else {
    evaluations.push({
      rule: {
        id: "leverage_limit",
        label: "Leverage Limit",
        status: tradingRuleStatusSchema.Enum.pass,
        message: `Leverage ${request.leverage}x is within limit.`
      }
    });
  }

  if (request.notionalUsd > config.maxNotionalPerTradeUsd) {
    evaluations.push({
      rule: {
        id: "notional_limit",
        label: "Notional Limit",
        status: tradingRuleStatusSchema.Enum.fail,
        message: `Notional $${round2(request.notionalUsd)} exceeds max $${round2(config.maxNotionalPerTradeUsd)}.`
      },
      recommendation: "拆分下单或减少单笔仓位规模。"
    });
  } else {
    evaluations.push({
      rule: {
        id: "notional_limit",
        label: "Notional Limit",
        status: tradingRuleStatusSchema.Enum.pass,
        message: `Notional $${round2(request.notionalUsd)} is within limit.`
      }
    });
  }

  if (metrics.riskPerTradePercent > config.maxRiskPerTradePercent) {
    evaluations.push({
      rule: {
        id: "risk_per_trade",
        label: "Risk Per Trade",
        status: tradingRuleStatusSchema.Enum.fail,
        message: `Risk ${round2(metrics.riskPerTradePercent)}% exceeds max ${config.maxRiskPerTradePercent}%.`
      },
      recommendation: "扩大止损距离或降低仓位，确保单笔风险在阈值内。"
    });
  } else if (metrics.riskPerTradePercent > warningRisk) {
    evaluations.push({
      rule: {
        id: "risk_per_trade",
        label: "Risk Per Trade",
        status: tradingRuleStatusSchema.Enum.warn,
        message: `Risk ${round2(metrics.riskPerTradePercent)}% is close to max ${config.maxRiskPerTradePercent}%.`
      },
      recommendation: "建议进一步收敛仓位风险，避免波动放大损失。"
    });
  } else {
    evaluations.push({
      rule: {
        id: "risk_per_trade",
        label: "Risk Per Trade",
        status: tradingRuleStatusSchema.Enum.pass,
        message: `Risk ${round2(metrics.riskPerTradePercent)}% is acceptable.`
      }
    });
  }

  if (request.dailyLossPercent > config.maxDailyLossPercent) {
    evaluations.push({
      rule: {
        id: "daily_loss_limit",
        label: "Daily Loss Limit",
        status: tradingRuleStatusSchema.Enum.fail,
        message: `Daily loss ${request.dailyLossPercent}% exceeds max ${config.maxDailyLossPercent}%.`
      },
      recommendation: "触发日损上限，建议暂停新增交易并复盘。"
    });
  } else {
    evaluations.push({
      rule: {
        id: "daily_loss_limit",
        label: "Daily Loss Limit",
        status: tradingRuleStatusSchema.Enum.pass,
        message: `Daily loss ${request.dailyLossPercent}% is within limit.`
      }
    });
  }

  if (metrics.resultingExposurePercent > config.maxTotalExposurePercent) {
    evaluations.push({
      rule: {
        id: "exposure_limit",
        label: "Total Exposure",
        status: tradingRuleStatusSchema.Enum.fail,
        message: `Resulting exposure ${round2(metrics.resultingExposurePercent)}% exceeds max ${config.maxTotalExposurePercent}%.`
      },
      recommendation: "降低新增仓位或减仓后再执行该计划。"
    });
  } else {
    evaluations.push({
      rule: {
        id: "exposure_limit",
        label: "Total Exposure",
        status: tradingRuleStatusSchema.Enum.pass,
        message: `Resulting exposure ${round2(metrics.resultingExposurePercent)}% is within limit.`
      }
    });
  }

  if (request.stopLossPercent < config.minStopLossPercent) {
    evaluations.push({
      rule: {
        id: "stop_loss_discipline",
        label: "Stop-loss Discipline",
        status: tradingRuleStatusSchema.Enum.fail,
        message: `Stop-loss ${request.stopLossPercent}% is below minimum ${config.minStopLossPercent}%.`
      },
      recommendation: "补充有效止损，避免无保护敞口。"
    });
  } else {
    evaluations.push({
      rule: {
        id: "stop_loss_discipline",
        label: "Stop-loss Discipline",
        status: tradingRuleStatusSchema.Enum.pass,
        message: `Stop-loss ${request.stopLossPercent}% passes minimum requirement.`
      }
    });
  }

  return evaluations;
}

export async function evaluateTradingRisk(input: TradingRiskRequest): Promise<TradingRiskResult> {
  const config = await readTradingRiskConfig();

  const proposedExposurePercent = round2((input.notionalUsd / input.accountEquityUsd) * 100);
  const resultingExposurePercent = round2(input.currentExposurePercent + proposedExposurePercent);
  const riskPerTradePercent = round2(proposedExposurePercent * (input.stopLossPercent / 100));

  const context: TradingRiskContext = {
    request: input,
    config,
    metrics: {
      proposedExposurePercent,
      resultingExposurePercent,
      riskPerTradePercent
    }
  };

  const ruleEvaluations = evaluateRuleSet(context);
  const rules = ruleEvaluations.map((item) => item.rule);

  const failCount = rules.filter((rule) => rule.status === tradingRuleStatusSchema.Enum.fail).length;
  const warnCount = rules.filter((rule) => rule.status === tradingRuleStatusSchema.Enum.warn).length;

  const decision = failCount > 0 ? "reject" : warnCount > 0 ? "caution" : "approve";
  const score = Math.max(0, 100 - failCount * 22 - warnCount * 7);

  const recommendations = Array.from(
    new Set(ruleEvaluations.flatMap((item) => (item.recommendation ? [item.recommendation] : [])))
  );

  const result = tradingRiskResultSchema.parse({
    tool: "trading",
    decision,
    score,
    policyVersion: config.policyVersion,
    metrics: {
      proposedExposurePercent,
      resultingExposurePercent,
      riskPerTradePercent
    },
    rules,
    recommendations
  });

  await appendTradingRiskLogSafe(result, input);
  return result;
}

export async function evaluateTradingRiskFromPayload(payload: unknown): Promise<TradingRiskResult> {
  const request = tradingRiskRequestSchema.parse(payload);
  return evaluateTradingRisk(request);
}