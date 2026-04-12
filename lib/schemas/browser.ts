import { z } from "zod";

export const browserSymbolSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[A-Za-z0-9/_-]+$/, "symbol contains unsupported characters");

export const browserMarketRequestSchema = z.object({
  symbols: z.array(browserSymbolSchema).min(1).max(10).optional()
});

export const browserNewsRequestSchema = z.object({
  limit: z.number().int().min(1).max(20).optional()
});

export const browserConfigSchema = z.object({
  defaultSymbols: z.array(browserSymbolSchema).min(1).max(10).default(["BTCUSDT", "ETHUSDT"]),
  newsLimit: z.number().int().min(1).max(20).default(5),
  marketEndpoint: z.string().url().default("https://api.binance.com/api/v3/ticker/24hr"),
  newsEndpoint: z.string().url().default("https://min-api.cryptocompare.com/data/v2/news/?lang=EN")
});

export const browserMarketQuoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  changePercent24h: z.number(),
  high24h: z.number(),
  low24h: z.number(),
  volume24h: z.number(),
  fetchedAt: z.string()
});

export const browserNewsItemSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  source: z.string(),
  publishedAt: z.string(),
  summary: z.string().optional()
});

export const browserMarketSnapshotSchema = z.object({
  tool: z.literal("browser"),
  quotes: z.array(browserMarketQuoteSchema),
  errors: z.array(z.string()),
  fetchedAt: z.string()
});

export const browserNewsSnapshotSchema = z.object({
  tool: z.literal("browser"),
  items: z.array(browserNewsItemSchema),
  fetchedAt: z.string()
});

export type BrowserConfig = z.infer<typeof browserConfigSchema>;
export type BrowserMarketRequest = z.infer<typeof browserMarketRequestSchema>;
export type BrowserNewsRequest = z.infer<typeof browserNewsRequestSchema>;
export type BrowserMarketQuote = z.infer<typeof browserMarketQuoteSchema>;
export type BrowserNewsItem = z.infer<typeof browserNewsItemSchema>;
export type BrowserMarketSnapshot = z.infer<typeof browserMarketSnapshotSchema>;
export type BrowserNewsSnapshot = z.infer<typeof browserNewsSnapshotSchema>;