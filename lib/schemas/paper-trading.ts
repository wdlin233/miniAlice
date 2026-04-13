import { z } from "zod";

import { tradingSideSchema, tradingSymbolSchema } from "@/lib/schemas/trading";

export const paperPositionStateSchema = z.object({
  symbol: tradingSymbolSchema,
  quantity: z.number().positive(),
  averageEntryPriceUsd: z.number().positive(),
  lastPriceUsd: z.number().positive(),
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

export const paperOrderCreateInputSchema = z.object({
  symbol: tradingSymbolSchema,
  side: tradingSideSchema,
  quantity: z.coerce.number().positive().max(1000000)
});

export const paperTradeStatusSchema = z.enum(["filled"]);

export const paperTradeSchema = z.object({
  id: z.string().uuid(),
  symbol: tradingSymbolSchema,
  side: tradingSideSchema,
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
  recentTrades: z.array(paperTradeSchema),
  marketErrors: z.array(z.string())
});

export const paperOrderResponseSchema = z.object({
  tool: z.literal("paper"),
  trade: paperTradeSchema,
  account: paperAccountViewSchema,
  marketErrors: z.array(z.string())
});

export type PaperOrderCreateInput = z.infer<typeof paperOrderCreateInputSchema>;
export type PaperTrade = z.infer<typeof paperTradeSchema>;
export type PaperTradeStatus = z.infer<typeof paperTradeStatusSchema>;
export type PaperAccountState = z.infer<typeof paperAccountStateSchema>;
export type PaperPositionState = z.infer<typeof paperPositionStateSchema>;
export type PaperPositionView = z.infer<typeof paperPositionViewSchema>;
export type PaperAccountView = z.infer<typeof paperAccountViewSchema>;
export type PaperAccountResponse = z.infer<typeof paperAccountResponseSchema>;
export type PaperOrderResponse = z.infer<typeof paperOrderResponseSchema>;
