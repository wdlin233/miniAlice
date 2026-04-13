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

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;
}

const marketCache = new Map<string, CacheEntry<BrowserMarketSnapshot>>();
const newsCache = new Map<string, CacheEntry<BrowserNewsSnapshot>>();
const combinedCache = new Map<string, CacheEntry<BrowserCombinedSnapshot>>();

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

function setCache<T>(
  target: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
): void {
  const now = Date.now();
  const safeTtl = Math.max(1000, ttlMs);

  target.set(key, {
    value,
    expiresAt: now + safeTtl,
    staleUntil: now + safeTtl * 3
  });
}

function getCacheFresh<T>(target: Map<string, CacheEntry<T>>, key: string): T | null {
  const cached = target.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt > Date.now()) {
    return cached.value;
  }

  return null;
}

function getCacheStale<T>(target: Map<string, CacheEntry<T>>, key: string): T | null {
  const cached = target.get(key);
  if (!cached) {
    return null;
  }

  if (cached.staleUntil > Date.now()) {
    return cached.value;
  }

  target.delete(key);
  return null;
}

async function fetchWithTimeout(
  url: string,
  requestTimeoutMs: number,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`request timeout after ${requestTimeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchQuoteBySymbol(
  symbol: string,
  marketEndpoint: string,
  requestTimeoutMs: number
): Promise<BrowserMarketQuote> {
  const response = await fetchWithTimeout(
    `${marketEndpoint}?symbol=${encodeURIComponent(symbol)}`,
    requestTimeoutMs,
    {
    method: "GET",
    cache: "no-store"
    }
  );

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

  const cacheKey = `market:${config.marketEndpoint}:${symbols.join(",")}`;
  const cached = getCacheFresh(marketCache, cacheKey);
  if (cached) {
    return cached;
  }

  const settled = await Promise.allSettled(
    symbols.map((symbol) =>
      fetchQuoteBySymbol(symbol, config.marketEndpoint, config.requestTimeoutMs)
    )
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

  const snapshot = browserMarketSnapshotSchema.parse({
    tool: "browser",
    quotes,
    errors,
    fetchedAt: new Date().toISOString()
  });

  if (snapshot.quotes.length === 0) {
    const stale = getCacheStale(marketCache, cacheKey);
    if (stale) {
      return browserMarketSnapshotSchema.parse({
        ...stale,
        errors: [...stale.errors, ...snapshot.errors]
      });
    }
  }

  setCache(marketCache, cacheKey, snapshot, config.marketCacheTtlMs);
  return snapshot;
}

async function fetchCryptoCompareNews(
  endpoint: string,
  limit: number,
  requestTimeoutMs: number
): Promise<BrowserNewsItem[]> {
  const response = await fetchWithTimeout(endpoint, requestTimeoutMs, {
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

async function fetchRedditNews(
  endpoint: string,
  limit: number,
  requestTimeoutMs: number
): Promise<BrowserNewsItem[]> {
  const url = new URL(endpoint);
  url.searchParams.set("limit", String(limit));

  const response = await fetchWithTimeout(url.toString(), requestTimeoutMs, {
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
  const cacheKey = `news:${source}:${limit}:${endpoint}`;

  const cached = getCacheFresh(newsCache, cacheKey);
  if (cached) {
    return cached;
  }

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
      items = await fetchRedditNews(endpoint, limit, config.requestTimeoutMs);
    } else {
      items = await fetchCryptoCompareNews(endpoint, limit, config.requestTimeoutMs);
    }
  } catch (error) {
    errors.push(getErrorMessage(error));
  }

  const snapshot = browserNewsSnapshotSchema.parse({
    tool: "browser",
    source,
    items,
    errors,
    fetchedAt: new Date().toISOString()
  });

  if (snapshot.items.length === 0) {
    const stale = getCacheStale(newsCache, cacheKey);
    if (stale) {
      return browserNewsSnapshotSchema.parse({
        ...stale,
        errors: [...stale.errors, ...snapshot.errors]
      });
    }
  }

  setCache(newsCache, cacheKey, snapshot, config.newsCacheTtlMs);
  return snapshot;
}

export async function fetchBrowserSnapshot(input?: BrowserRefreshRequest): Promise<BrowserCombinedSnapshot> {
  const validatedInput = browserRefreshRequestSchema.parse(input ?? {});

  const config = await readBrowserConfig();
  const normalizedSymbols = validatedInput.symbols
    ?.map((item) => normalizeSymbol(item))
    .filter((item, index, items) => item.length > 0 && items.indexOf(item) === index)
    .slice(0, 10);
  const source = validatedInput.source ?? config.defaultNewsSource;
  const limit = validatedInput.limit ?? config.newsLimit;

  const combinedKey = `combined:${(normalizedSymbols ?? config.defaultSymbols).join(",")}:${source}:${limit}`;
  const cached = getCacheFresh(combinedCache, combinedKey);
  if (cached) {
    return cached;
  }

  const [market, news] = await Promise.all([
    fetchMarketSnapshot({ symbols: validatedInput.symbols }),
    fetchNewsSnapshot({ source: validatedInput.source, limit: validatedInput.limit })
  ]);

  const snapshot = browserCombinedSnapshotSchema.parse({
    tool: "browser",
    market,
    news,
    refreshedAt: new Date().toISOString()
  });

  setCache(combinedCache, combinedKey, snapshot, config.combinedCacheTtlMs);
  return snapshot;
}