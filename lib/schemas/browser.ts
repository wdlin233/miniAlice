import { z } from "zod";

export const browserSymbolSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[A-Za-z0-9/_-]+$/, "symbol contains unsupported characters");

export const browserNewsSourceSchema = z.enum(["cryptocompare", "reddit"]);
export const browserMarketDataModeSchema = z.enum(["virtual", "remote"]);

export const browserMarketRequestSchema = z.object({
  symbols: z.array(browserSymbolSchema).min(1).max(10).optional()
});

export const browserNewsRequestSchema = z.object({
  limit: z.number().int().min(1).max(20).optional(),
  source: browserNewsSourceSchema.optional()
});

export const browserRefreshRequestSchema = z.object({
  symbols: z.array(browserSymbolSchema).min(1).max(10).optional(),
  limit: z.number().int().min(1).max(20).optional(),
  source: browserNewsSourceSchema.optional()
});

export const browserConfigSchema = z.object({
  defaultSymbols: z.array(browserSymbolSchema).min(1).max(10).default(["BTCUSDT", "ETHUSDT"]),
  marketDataMode: browserMarketDataModeSchema.default("virtual"),
  newsLimit: z.number().int().min(1).max(20).default(5),
  requestTimeoutMs: z.number().int().min(500).max(15000).default(2500),
  marketCacheTtlMs: z.number().int().min(1000).max(120000).default(2000),
  newsCacheTtlMs: z.number().int().min(1000).max(120000).default(20000),
  combinedCacheTtlMs: z.number().int().min(1000).max(120000).default(2000),
  marketEndpoint: z.string().url().default("https://api.binance.com/api/v3/ticker/24hr"),
  defaultNewsSource: browserNewsSourceSchema.default("cryptocompare"),
  newsEndpoints: z
    .object({
      cryptocompare: z.string().url().default("https://min-api.cryptocompare.com/data/v2/news/?lang=EN"),
      reddit: z.string().url().default("https://www.reddit.com/r/CryptoCurrency/new.json")
    })
    .default({
      cryptocompare: "https://min-api.cryptocompare.com/data/v2/news/?lang=EN",
      reddit: "https://www.reddit.com/r/CryptoCurrency/new.json"
    })
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
  mode: browserMarketDataModeSchema,
  quotes: z.array(browserMarketQuoteSchema),
  errors: z.array(z.string()),
  fetchedAt: z.string()
});

export const browserNewsSnapshotSchema = z.object({
  tool: z.literal("browser"),
  source: browserNewsSourceSchema,
  items: z.array(browserNewsItemSchema),
  errors: z.array(z.string()).default([]),
  fetchedAt: z.string()
});

export const browserCombinedSnapshotSchema = z.object({
  tool: z.literal("browser"),
  market: browserMarketSnapshotSchema,
  news: browserNewsSnapshotSchema,
  refreshedAt: z.string()
});

export type BrowserConfig = z.infer<typeof browserConfigSchema>;
export type BrowserNewsSource = z.infer<typeof browserNewsSourceSchema>;
export type BrowserMarketDataMode = z.infer<typeof browserMarketDataModeSchema>;
export type BrowserMarketRequest = z.infer<typeof browserMarketRequestSchema>;
export type BrowserNewsRequest = z.infer<typeof browserNewsRequestSchema>;
export type BrowserRefreshRequest = z.infer<typeof browserRefreshRequestSchema>;
export type BrowserMarketQuote = z.infer<typeof browserMarketQuoteSchema>;
export type BrowserNewsItem = z.infer<typeof browserNewsItemSchema>;
export type BrowserMarketSnapshot = z.infer<typeof browserMarketSnapshotSchema>;
export type BrowserNewsSnapshot = z.infer<typeof browserNewsSnapshotSchema>;
export type BrowserCombinedSnapshot = z.infer<typeof browserCombinedSnapshotSchema>;
