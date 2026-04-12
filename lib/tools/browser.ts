import {
  browserCombinedSnapshotSchema,
  browserRefreshRequestSchema,
  browserMarketRequestSchema,
  browserMarketQuoteSchema,
  browserMarketSnapshotSchema,
  browserNewsSourceSchema,
  browserNewsRequestSchema,
  browserNewsItemSchema,
  browserNewsSnapshotSchema,
  type BrowserCombinedSnapshot,
  type BrowserNewsSource,
  type BrowserRefreshRequest,
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

interface RedditNewsResponse {
  data?: {
    children?: Array<{
      data?: {
        title?: string;
        url_overridden_by_dest?: string;
        permalink?: string;
        selftext?: string;
        created_utc?: number;
        subreddit_name_prefixed?: string;
      };
    }>;
  };
}

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function safeNumber(input: string | undefined): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
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

async function fetchCryptoCompareNews(endpoint: string, limit: number): Promise<BrowserNewsItem[]> {
  const response = await fetch(endpoint, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`news endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as CryptoCompareNewsResponse;
  const rows = Array.isArray(payload.Data) ? payload.Data : [];

  return rows
    .slice(0, limit)
    .flatMap((row) => {
      const parsed = browserNewsItemSchema.safeParse({
        title: row.title,
        url: row.url,
        source: row.source_info?.name ?? row.source ?? "CryptoCompare",
        publishedAt: new Date((row.published_on ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        summary: row.body?.slice(0, 180)
      });

      return parsed.success ? [parsed.data] : [];
    });
}

async function fetchRedditNews(endpoint: string, limit: number): Promise<BrowserNewsItem[]> {
  const url = new URL(endpoint);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      "User-Agent": "MiniAlice/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`reddit endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as RedditNewsResponse;
  const rows = Array.isArray(payload.data?.children) ? payload.data.children : [];

  return rows
    .slice(0, limit)
    .flatMap((row) => {
      const post = row.data;
      const parsed = browserNewsItemSchema.safeParse({
        title: post?.title,
        url: post?.url_overridden_by_dest ?? (post?.permalink ? `https://www.reddit.com${post.permalink}` : undefined),
        source: post?.subreddit_name_prefixed ?? "Reddit",
        publishedAt: new Date((post?.created_utc ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        summary: post?.selftext?.slice(0, 180)
      });

      return parsed.success ? [parsed.data] : [];
    });
}

export async function fetchNewsSnapshot(input?: BrowserNewsRequest): Promise<BrowserNewsSnapshot> {
  const config = await readBrowserConfig();
  const validatedInput = browserNewsRequestSchema.parse(input ?? {});
  const limit = validatedInput.limit ?? config.newsLimit;

  const source: BrowserNewsSource = validatedInput.source ?? config.defaultNewsSource;
  const endpoint = config.newsEndpoints[source];
  const errors: string[] = [];

  if (!endpoint) {
    return browserNewsSnapshotSchema.parse({
      tool: "browser",
      source,
      items: [],
      errors: [`Missing endpoint configuration for ${source}.`],
      fetchedAt: new Date().toISOString()
    });
  }

  let items: BrowserNewsItem[] = [];

  try {
    const parsedSource = browserNewsSourceSchema.parse(source);
    if (parsedSource === "reddit") {
      items = await fetchRedditNews(endpoint, limit);
    } else {
      items = await fetchCryptoCompareNews(endpoint, limit);
    }
  } catch (error) {
    errors.push(getErrorMessage(error));
  }

  return browserNewsSnapshotSchema.parse({
    tool: "browser",
    source,
    items,
    errors,
    fetchedAt: new Date().toISOString()
  });
}

export async function fetchBrowserSnapshot(input?: BrowserRefreshRequest): Promise<BrowserCombinedSnapshot> {
  const validatedInput = browserRefreshRequestSchema.parse(input ?? {});

  const [market, news] = await Promise.all([
    fetchMarketSnapshot({ symbols: validatedInput.symbols }),
    fetchNewsSnapshot({ source: validatedInput.source, limit: validatedInput.limit })
  ]);

  return browserCombinedSnapshotSchema.parse({
    tool: "browser",
    market,
    news,
    refreshedAt: new Date().toISOString()
  });
}