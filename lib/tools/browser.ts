import path from "node:path";

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
import { dataPaths, readJsonFile } from "@/lib/storage/file-store";
import { readBrowserConfig } from "@/lib/storage/browser-config";

interface BinanceTickerResponse {
  symbol?: string;
  lastPrice?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
}

interface OkxTickerResponse {
  data?: Array<{
    instId?: string;
    last?: string;
    open24h?: string;
    high24h?: string;
    low24h?: string;
    vol24h?: string;
    volCcy24h?: string;
  }>;
}

interface CoinbaseSpotResponse {
  data?: {
    amount?: string;
  };
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

interface QuoteFetchResult {
  quote: BrowserMarketQuote;
  warnings: string[];
}

interface LocalPaperAccountLike {
  positions?: Array<{
    symbol?: string;
    lastPriceUsd?: number;
  }>;
}

const marketCache = new Map<string, CacheEntry<BrowserMarketSnapshot>>();
const newsCache = new Map<string, CacheEntry<BrowserNewsSnapshot>>();
const combinedCache = new Map<string, CacheEntry<BrowserCombinedSnapshot>>();

const paperAccountPath = path.join(dataPaths.trading, "paper-account.json");
const staticReferencePriceBySymbol: Record<string, number> = {
  BTCUSDT: 68000,
  ETHUSDT: 3200,
  SOLUSDT: 150,
  BNBUSDT: 600,
  XRPUSDT: 0.6
};

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function extractBaseAsset(symbol: string): string {
  const normalized = normalizeSymbol(symbol);

  if (normalized.endsWith("USDT")) {
    return normalized.slice(0, -4);
  }

  if (normalized.endsWith("USD")) {
    return normalized.slice(0, -3);
  }

  return normalized;
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

async function fetchQuoteByPrimaryEndpoint(
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
    throw new Error(`primary endpoint returned ${response.status} for ${symbol}`);
  }

  const payload = (await response.json()) as BinanceTickerResponse;
  const price = safeNumber(payload.lastPrice);

  if (price <= 0) {
    throw new Error(`primary endpoint returned invalid price for ${symbol}`);
  }

  return browserMarketQuoteSchema.parse({
    symbol: payload.symbol ?? symbol,
    price,
    changePercent24h: safeNumber(payload.priceChangePercent),
    high24h: safeNumber(payload.highPrice),
    low24h: safeNumber(payload.lowPrice),
    volume24h: safeNumber(payload.volume),
    fetchedAt: new Date().toISOString()
  });
}

async function fetchQuoteFromOkx(symbol: string, requestTimeoutMs: number): Promise<BrowserMarketQuote> {
  const base = extractBaseAsset(symbol);
  const instId = `${base}-USDT`;

  const response = await fetchWithTimeout(
    `https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`,
    requestTimeoutMs,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        "User-Agent": "MiniAlice/1.0"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`okx endpoint returned ${response.status} for ${symbol}`);
  }

  const payload = (await response.json()) as OkxTickerResponse;
  const ticker = payload.data?.[0];
  const price = safeNumber(ticker?.last);
  if (price <= 0) {
    throw new Error(`okx endpoint returned invalid price for ${symbol}`);
  }

  const open24h = safeNumber(ticker?.open24h);
  const changePercent24h = open24h > 0 ? Number((((price - open24h) / open24h) * 100).toFixed(4)) : 0;
  const high24h = safeNumber(ticker?.high24h) || price;
  const low24h = safeNumber(ticker?.low24h) || price;
  const volume24h = safeNumber(ticker?.volCcy24h) || safeNumber(ticker?.vol24h);

  return browserMarketQuoteSchema.parse({
    symbol: normalizeSymbol(ticker?.instId ?? symbol).replace(/USDT$/, "USDT"),
    price,
    changePercent24h,
    high24h,
    low24h,
    volume24h,
    fetchedAt: new Date().toISOString()
  });
}

async function fetchQuoteFromCoinbase(symbol: string, requestTimeoutMs: number): Promise<BrowserMarketQuote> {
  const base = extractBaseAsset(symbol);
  const pair = `${base}-USD`;

  const response = await fetchWithTimeout(
    `https://api.coinbase.com/v2/prices/${encodeURIComponent(pair)}/spot`,
    requestTimeoutMs,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        "User-Agent": "MiniAlice/1.0"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`coinbase endpoint returned ${response.status} for ${symbol}`);
  }

  const payload = (await response.json()) as CoinbaseSpotResponse;
  const price = safeNumber(payload.data?.amount);
  if (price <= 0) {
    throw new Error(`coinbase endpoint returned invalid price for ${symbol}`);
  }

  return browserMarketQuoteSchema.parse({
    symbol,
    price,
    changePercent24h: 0,
    high24h: price,
    low24h: price,
    volume24h: 0,
    fetchedAt: new Date().toISOString()
  });
}

async function fetchQuoteBySymbol(
  symbol: string,
  marketEndpoint: string,
  requestTimeoutMs: number
): Promise<QuoteFetchResult> {
  const warnings: string[] = [];

  try {
    const quote = await fetchQuoteByPrimaryEndpoint(symbol, marketEndpoint, requestTimeoutMs);
    return { quote, warnings };
  } catch (error) {
    warnings.push(`${symbol}: primary source failed (${getErrorMessage(error)})`);
  }

  try {
    const quote = await fetchQuoteFromOkx(symbol, requestTimeoutMs);
    warnings.push(`${symbol}: switched to OKX fallback.`);
    return { quote, warnings };
  } catch (error) {
    warnings.push(`${symbol}: okx fallback failed (${getErrorMessage(error)})`);
  }

  try {
    const quote = await fetchQuoteFromCoinbase(symbol, requestTimeoutMs);
    warnings.push(`${symbol}: switched to Coinbase fallback (24h change unavailable).`);
    return { quote, warnings };
  } catch (error) {
    warnings.push(`${symbol}: coinbase fallback failed (${getErrorMessage(error)})`);
  }

  throw new Error(warnings.join(" | "));
}

async function readLocalPriceMap(): Promise<Map<string, number>> {
  const raw = await readJsonFile<LocalPaperAccountLike>(paperAccountPath, {});
  const map = new Map<string, number>();

  for (const position of raw.positions ?? []) {
    if (!position || typeof position.symbol !== "string") {
      continue;
    }

    const price = Number(position.lastPriceUsd);
    if (Number.isFinite(price) && price > 0) {
      map.set(normalizeSymbol(position.symbol), price);
    }
  }

  return map;
}

async function buildLocalFallbackQuotes(symbols: string[]): Promise<BrowserMarketQuote[]> {
  const localPriceMap = await readLocalPriceMap();

  return symbols.flatMap((symbol) => {
    const normalized = normalizeSymbol(symbol);
    const price = localPriceMap.get(normalized) ?? staticReferencePriceBySymbol[normalized] ?? 0;

    if (!Number.isFinite(price) || price <= 0) {
      return [];
    }

    const parsed = browserMarketQuoteSchema.safeParse({
      symbol: normalized,
      price,
      changePercent24h: 0,
      high24h: price,
      low24h: price,
      volume24h: 0,
      fetchedAt: new Date().toISOString()
    });

    return parsed.success ? [parsed.data] : [];
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
      quotes.push(result.value.quote);
      errors.push(...result.value.warnings);
      return;
    }

    errors.push(`${symbols[index]}: ${result.reason instanceof Error ? result.reason.message : "unknown error"}`);
  });

  if (quotes.length === 0) {
    const stale = getCacheStale(marketCache, cacheKey);
    if (stale) {
      return browserMarketSnapshotSchema.parse({
        ...stale,
        errors: [...stale.errors, ...errors]
      });
    }

    const localFallbackQuotes = await buildLocalFallbackQuotes(symbols);
    if (localFallbackQuotes.length > 0) {
      quotes.push(...localFallbackQuotes);
      errors.push("All remote market sources timed out. Using local fallback prices (not real-time).");
    }
  }

  const snapshot = browserMarketSnapshotSchema.parse({
    tool: "browser",
    quotes,
    errors,
    fetchedAt: new Date().toISOString()
  });

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