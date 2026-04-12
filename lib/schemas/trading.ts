import { z } from "zod";

export const tradingSideSchema = z.enum(["buy", "sell"]);
export const tradingDecisionSchema = z.enum(["approve", "caution", "reject"]);
export const tradingRuleStatusSchema = z.enum(["pass", "warn", "fail"]);
export const tradingOrderTypeSchema = z.enum(["market", "limit"]);
export const tradingOrderSourceSchema = z.enum(["manual", "wallet_push"]);
export const tradingOrderStatusSchema = z.enum(["submitted", "canceled", "rejected"]);

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

export const tradingRiskLogSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  side: tradingSideSchema,
  decision: tradingDecisionSchema,
  score: z.number().min(0).max(100),
  policyVersion: z.string(),
  summary: z.string(),
  createdAt: z.string().datetime()
});

export const tradingRiskHistoryResponseSchema = z.object({
  tool: z.literal("trading"),
  items: z.array(tradingRiskLogSchema)
});

export const tradingOrderCreateInputSchema = z
  .object({
    symbol: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .regex(/^[A-Za-z0-9/_-]+$/, "symbol contains unsupported characters"),
    side: tradingSideSchema,
    orderType: tradingOrderTypeSchema.default("market"),
    leverage: z.coerce.number().positive().max(125).default(1),
    notionalUsd: z.coerce.number().positive(),
    limitPrice: z.coerce.number().positive().optional(),
    stopLossPercent: z.coerce.number().positive().max(100).default(1),
    accountEquityUsd: z.coerce.number().positive(),
    currentExposurePercent: z.coerce.number().nonnegative().max(100).default(0),
    dailyLossPercent: z.coerce.number().nonnegative().max(100).default(0),
    source: tradingOrderSourceSchema.default("manual"),
    walletCommitHash: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{8}$/i, "walletCommitHash must be an 8-character SHA-256 prefix")
      .optional()
  })
  .superRefine((value, context) => {
    if (value.orderType === "limit" && value.limitPrice === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "limitPrice is required when orderType is limit",
        path: ["limitPrice"]
      });
    }
  });

export const tradingOrderSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  side: tradingSideSchema,
  orderType: tradingOrderTypeSchema,
  leverage: z.number().positive(),
  notionalUsd: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  stopLossPercent: z.number().positive().max(100),
  status: tradingOrderStatusSchema,
  source: tradingOrderSourceSchema,
  walletCommitHash: z.string().optional(),
  riskDecision: tradingDecisionSchema,
  riskScore: z.number().min(0).max(100),
  riskRequest: tradingRiskRequestSchema.optional(),
  reason: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  canceledAt: z.string().datetime().optional()
});

export const tradingOrderCancelInputSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(1).max(200).optional()
});

export const tradingOrderListResponseSchema = z.object({
  tool: z.literal("trading"),
  items: z.array(tradingOrderSchema)
});

export const tradingOrderResponseSchema = z.object({
  tool: z.literal("trading"),
  order: tradingOrderSchema
});

export type TradingRiskConfig = z.infer<typeof tradingRiskConfigSchema>;
export type TradingRiskRequest = z.infer<typeof tradingRiskRequestSchema>;
export type TradingRiskRule = z.infer<typeof tradingRiskRuleSchema>;
export type TradingRiskResult = z.infer<typeof tradingRiskResultSchema>;
export type TradingSide = z.infer<typeof tradingSideSchema>;
export type TradingRiskLog = z.infer<typeof tradingRiskLogSchema>;
export type TradingOrderCreateInput = z.infer<typeof tradingOrderCreateInputSchema>;
export type TradingOrder = z.infer<typeof tradingOrderSchema>;
export type TradingOrderCancelInput = z.infer<typeof tradingOrderCancelInputSchema>;
export type TradingOrderStatus = z.infer<typeof tradingOrderStatusSchema>;
export type TradingOrderSource = z.infer<typeof tradingOrderSourceSchema>;