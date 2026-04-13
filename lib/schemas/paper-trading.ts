import { z } from "zod";

import { tradingSideSchema, tradingSymbolSchema } from "@/lib/schemas/trading";

export const paperOrderTypeSchema = z.enum(["market", "limit"]);
export const paperTradeTriggerSchema = z.enum(["manual", "limit", "take_profit", "stop_loss"]);
export const paperTradeStatusSchema = z.enum(["filled"]);
export const paperPendingOrderStatusSchema = z.enum(["open", "filled", "canceled"]);

export const paperPositionStateSchema = z.object({
  symbol: tradingSymbolSchema,
  quantity: z.number().positive(),
  averageEntryPriceUsd: z.number().positive(),
  lastPriceUsd: z.number().positive(),
  takeProfitPriceUsd: z.number().positive().optional(),
  stopLossPriceUsd: z.number().positive().optional(),
  updatedAt: z.string().datetime()
});

export const paperAccountStateSchema = z.object({
  initialBalanceUsd: z.number().positive().default(10000),
  cashUsd: z.number().nonnegative().default(10000),
  realizedPnlUsd: z.number().default(0),
  feePaidUsd: z.number().nonnegative().default(0),
  positions: z.array(paperPositionStateSchema).default([]),
  updatedAt: z.string().datetime()
});

export const paperOrderCreateInputSchema = z
  .object({
    symbol: tradingSymbolSchema,
    side: tradingSideSchema,
    orderType: paperOrderTypeSchema.default("market"),
    quantity: z.coerce.number().positive().max(1000000),
    limitPriceUsd: z.coerce.number().positive().optional(),
    takeProfitPriceUsd: z.coerce.number().positive().optional(),
    stopLossPriceUsd: z.coerce.number().positive().optional()
  })
  .superRefine((value, context) => {
    if (value.orderType === "limit" && value.limitPriceUsd === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["limitPriceUsd"],
        message: "limitPriceUsd is required when orderType is limit"
      });
    }
  });

export const paperPendingOrderSchema = z.object({
  id: z.string().uuid(),
  symbol: tradingSymbolSchema,
  side: tradingSideSchema,
  quantity: z.number().positive(),
  limitPriceUsd: z.number().positive(),
  takeProfitPriceUsd: z.number().positive().optional(),
  stopLossPriceUsd: z.number().positive().optional(),
  status: paperPendingOrderStatusSchema,
  reason: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  filledAt: z.string().datetime().optional(),
  canceledAt: z.string().datetime().optional()
});

export const paperTradeSchema = z.object({
  id: z.string().uuid(),
  symbol: tradingSymbolSchema,
  side: tradingSideSchema,
  orderType: paperOrderTypeSchema,
  trigger: paperTradeTriggerSchema,
  quantity: z.number().positive(),
  priceUsd: z.number().positive(),
  notionalUsd: z.number().positive(),
  feeUsd: z.number().nonnegative(),
  realizedPnlUsd: z.number(),
  status: paperTradeStatusSchema,
  createdAt: z.string().datetime()
});

export const paperPositionViewSchema = z.object({
  symbol: tradingSymbolSchema,
  quantity: z.number().positive(),
  averageEntryPriceUsd: z.number().positive(),
  lastPriceUsd: z.number().positive(),
  takeProfitPriceUsd: z.number().positive().optional(),
  stopLossPriceUsd: z.number().positive().optional(),
  marketValueUsd: z.number().nonnegative(),
  unrealizedPnlUsd: z.number(),
  unrealizedPnlPercent: z.number(),
  updatedAt: z.string().datetime()
});

export const paperAccountViewSchema = z.object({
  initialBalanceUsd: z.number().positive(),
  cashUsd: z.number().nonnegative(),
  equityUsd: z.number(),
  realizedPnlUsd: z.number(),
  unrealizedPnlUsd: z.number(),
  totalPnlUsd: z.number(),
  feePaidUsd: z.number().nonnegative(),
  positions: z.array(paperPositionViewSchema),
  updatedAt: z.string().datetime()
});

export const paperAccountResponseSchema = z.object({
  tool: z.literal("paper"),
  account: paperAccountViewSchema,
  pendingOrders: z.array(paperPendingOrderSchema),
  recentTrades: z.array(paperTradeSchema),
  marketErrors: z.array(z.string()),
  events: z.array(z.string()).default([])
});

export const paperOrderResponseSchema = z.object({
  tool: z.literal("paper"),
  account: paperAccountViewSchema,
  trade: paperTradeSchema.optional(),
  pendingOrder: paperPendingOrderSchema.optional(),
  marketErrors: z.array(z.string()),
  message: z.string()
});

export type PaperOrderCreateInput = z.infer<typeof paperOrderCreateInputSchema>;
export type PaperTrade = z.infer<typeof paperTradeSchema>;
export type PaperTradeStatus = z.infer<typeof paperTradeStatusSchema>;
export type PaperTradeTrigger = z.infer<typeof paperTradeTriggerSchema>;
export type PaperOrderType = z.infer<typeof paperOrderTypeSchema>;
export type PaperAccountState = z.infer<typeof paperAccountStateSchema>;
export type PaperPositionState = z.infer<typeof paperPositionStateSchema>;
export type PaperPositionView = z.infer<typeof paperPositionViewSchema>;
export type PaperPendingOrder = z.infer<typeof paperPendingOrderSchema>;
export type PaperPendingOrderStatus = z.infer<typeof paperPendingOrderStatusSchema>;
export type PaperAccountView = z.infer<typeof paperAccountViewSchema>;
export type PaperAccountResponse = z.infer<typeof paperAccountResponseSchema>;
export type PaperOrderResponse = z.infer<typeof paperOrderResponseSchema>;
