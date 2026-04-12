import { z } from "zod";

export const tradingSideSchema = z.enum(["buy", "sell"]);
export const tradingDecisionSchema = z.enum(["approve", "caution", "reject"]);
export const tradingRuleStatusSchema = z.enum(["pass", "warn", "fail"]);

export const tradingRiskConfigSchema = z.object({
  maxLeverage: z.coerce.number().positive().max(125).default(5),
  warningLeverage: z.coerce.number().positive().max(125).default(4),
  maxNotionalPerTradeUsd: z.coerce.number().positive().default(2000),
  maxRiskPerTradePercent: z.coerce.number().positive().max(100).default(1.5),
  warningRiskPerTradePercent: z.coerce.number().positive().max(100).default(1),
  maxDailyLossPercent: z.coerce.number().nonnegative().max(100).default(3),
  maxTotalExposurePercent: z.coerce.number().positive().max(100).default(35),
  minStopLossPercent: z.coerce.number().positive().max(100).default(0.4),
  policyVersion: z.string().trim().min(1).default("v1")
});

export const tradingRiskRequestSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9/_-]+$/, "symbol contains unsupported characters"),
  side: tradingSideSchema,
  leverage: z.coerce.number().positive().max(125),
  notionalUsd: z.coerce.number().positive(),
  accountEquityUsd: z.coerce.number().positive(),
  stopLossPercent: z.coerce.number().positive().max(100),
  currentExposurePercent: z.coerce.number().nonnegative().max(100).default(0),
  dailyLossPercent: z.coerce.number().nonnegative().max(100).default(0)
});

export const tradingRiskRuleSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: tradingRuleStatusSchema,
  message: z.string()
});

export const tradingRiskMetricsSchema = z.object({
  proposedExposurePercent: z.number(),
  resultingExposurePercent: z.number(),
  riskPerTradePercent: z.number()
});

export const tradingRiskResultSchema = z.object({
  tool: z.literal("trading"),
  decision: tradingDecisionSchema,
  score: z.number().min(0).max(100),
  policyVersion: z.string(),
  metrics: tradingRiskMetricsSchema,
  rules: z.array(tradingRiskRuleSchema),
  recommendations: z.array(z.string())
});

export const tradingRiskConfigResponseSchema = z.object({
  tool: z.literal("trading"),
  config: tradingRiskConfigSchema
});

export type TradingRiskConfig = z.infer<typeof tradingRiskConfigSchema>;
export type TradingRiskRequest = z.infer<typeof tradingRiskRequestSchema>;
export type TradingRiskRule = z.infer<typeof tradingRiskRuleSchema>;
export type TradingRiskResult = z.infer<typeof tradingRiskResultSchema>;
export type TradingSide = z.infer<typeof tradingSideSchema>;