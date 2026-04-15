import { z } from "zod";

import { browserSymbolSchema } from "@/lib/schemas/browser";

export const virtualMarketSymbolSchema = z.object({
  symbol: browserSymbolSchema,
  anchorPrice: z.number().positive(),
  dailyChangePercent: z.number().min(-30).max(30).default(0),
  dailyRangePercent: z.number().min(0.1).max(30).default(3),
  volume24h: z.number().nonnegative().default(0),
  phaseOffset: z.number().min(0).max(360).default(0)
});

export const virtualMarketConfigSchema = z.object({
  symbols: z.array(virtualMarketSymbolSchema).min(1).max(30)
});

export type VirtualMarketSymbol = z.infer<typeof virtualMarketSymbolSchema>;
export type VirtualMarketConfig = z.infer<typeof virtualMarketConfigSchema>;
