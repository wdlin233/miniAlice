import {
  browserMarketRequestSchema,
  browserMarketQuoteSchema,
  browserMarketSnapshotSchema,
  browserNewsRequestSchema,
  browserNewsItemSchema,
  browserNewsSnapshotSchema,
  type BrowserMarketRequest,
  type BrowserNewsRequest,
  type BrowserMarketQuote,
  type BrowserNewsItem,
  type BrowserMarketSnapshot,
  type BrowserNewsSnapshot
} from "@/lib/schemas/browser";
import { readBrowserConfig } from "@/lib/storage/browser-config";

interface BinanceTickerResponse {
  symbol?: string;
  lastPrice?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
}

interface CryptoCompareNewsResponse {
  Data?: Array<{
    title?: string;
    url?: string;
    source?: string;
    body?: string;
    published_on?: number;
    source_info?: {
      name?: string;
    };
  }>;
}

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function safeNumber(input: string | undefined): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

async function fetchQuoteBySymbol(symbol: string, marketEndpoint: string): Promise<BrowserMarketQuote> {
  const response = await fetch(`${marketEndpoint}?symbol=${encodeURIComponent(symbol)}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`market endpoint returned ${response.status} for ${symbol}`);
  }

  const payload = (await response.json()) as BinanceTickerResponse;

  return browserMarketQuoteSchema.parse({
    symbol: payload.symbol ?? symbol,
    price: safeNumber(payload.lastPrice),
    changePercent24h: safeNumber(payload.priceChangePercent),
    high24h: safeNumber(payload.highPrice),
    low24h: safeNumber(payload.lowPrice),
    volume24h: safeNumber(payload.volume),
    fetchedAt: new Date().toISOString()
  });
}

export async function fetchMarketSnapshot(input?: BrowserMarketRequest): Promise<BrowserMarketSnapshot> {
  const config = await readBrowserConfig();
  const validatedInput = browserMarketRequestSchema.parse(input ?? {});

  const symbols = (validatedInput.symbols ?? config.defaultSymbols)
    .map((item) => normalizeSymbol(item))
    .filter((item, index, items) => item.length > 0 && items.indexOf(item) === index)
    .slice(0, 10);

  const settled = await Promise.allSettled(
    symbols.map((symbol) => fetchQuoteBySymbol(symbol, config.marketEndpoint))
  );

  const quotes: BrowserMarketQuote[] = [];
  const errors: string[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      quotes.push(result.value);
      return;
    }

    errors.push(`${symbols[index]}: ${result.reason instanceof Error ? result.reason.message : "unknown error"}`);
  });

  return browserMarketSnapshotSchema.parse({
    tool: "browser",
    quotes,
    errors,
    fetchedAt: new Date().toISOString()
  });
}

export async function fetchNewsSnapshot(input?: BrowserNewsRequest): Promise<BrowserNewsSnapshot> {
  const config = await readBrowserConfig();
  const validatedInput = browserNewsRequestSchema.parse(input ?? {});
  const limit = validatedInput.limit ?? config.newsLimit;

  const response = await fetch(config.newsEndpoint, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`news endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as CryptoCompareNewsResponse;
  const rows = Array.isArray(payload.Data) ? payload.Data : [];

  const items: BrowserNewsItem[] = rows
    .slice(0, limit)
    .flatMap((row) => {
      const parsed = browserNewsItemSchema.safeParse({
        title: row.title,
        url: row.url,
        source: row.source_info?.name ?? row.source ?? "Unknown",
        publishedAt: new Date((row.published_on ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        summary: row.body?.slice(0, 180)
      });

      return parsed.success ? [parsed.data] : [];
    });

  return browserNewsSnapshotSchema.parse({
    tool: "browser",
    items,
    fetchedAt: new Date().toISOString()
  });
}