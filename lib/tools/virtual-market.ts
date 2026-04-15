import {
  browserMarketQuoteSchema,
  browserMarketSnapshotSchema,
  type BrowserMarketQuote,
  type BrowserMarketSnapshot
} from "@/lib/schemas/browser";
import { type VirtualMarketSymbol } from "@/lib/schemas/virtual-market";
import { referencePriceBySymbol } from "@/lib/market/reference-prices";
import { readVirtualMarketConfig } from "@/lib/storage/virtual-market";

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function createFallbackTemplate(symbol: string): VirtualMarketSymbol | null {
  const normalized = normalizeSymbol(symbol);
  const anchorPrice = referencePriceBySymbol[normalized];

  if (!anchorPrice) {
    return null;
  }

  return {
    symbol: normalized,
    anchorPrice,
    dailyChangePercent: 0,
    dailyRangePercent: 2.4,
    volume24h: 0,
    phaseOffset: 0
  };
}

function buildVirtualQuote(entry: VirtualMarketSymbol, now: Date): BrowserMarketQuote {
  const normalized = normalizeSymbol(entry.symbol);
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const dayIndex = Math.floor(now.getTime() / 86400000);
  const phase = ((entry.phaseOffset + dayIndex * 17) * Math.PI) / 180;

  const waveA = Math.sin(minutes / 17 + phase);
  const waveB = Math.cos(minutes / 43 + phase / 2);
  const waveC = Math.sin((minutes + dayIndex * 13) / 91 + phase / 3);

  const currentPercent =
    entry.dailyChangePercent * 0.45 +
    entry.dailyRangePercent * 0.22 * waveA +
    entry.dailyRangePercent * 0.12 * waveB +
    entry.dailyRangePercent * 0.08 * waveC;

  const rawPrice = entry.anchorPrice * (1 + currentPercent / 100);
  const price = round(Math.max(entry.anchorPrice * 0.15, rawPrice));
  const highPercent = Math.max(entry.dailyChangePercent, currentPercent) + entry.dailyRangePercent * 0.55;
  const lowPercent = Math.min(entry.dailyChangePercent, currentPercent) - entry.dailyRangePercent * 0.55;
  const high24h = round(Math.max(price, entry.anchorPrice * (1 + highPercent / 100)));
  const low24h = round(Math.max(0.0001, Math.min(price, entry.anchorPrice * (1 + lowPercent / 100))));
  const volumeBase = entry.volume24h > 0 ? entry.volume24h : entry.anchorPrice * 10000;
  const volume24h = round(Math.max(0, volumeBase * (0.82 + 0.12 * waveA + 0.06 * waveB)), 2);

  return browserMarketQuoteSchema.parse({
    symbol: normalized,
    price,
    changePercent24h: round(((price - entry.anchorPrice) / entry.anchorPrice) * 100),
    high24h,
    low24h,
    volume24h,
    fetchedAt: now.toISOString()
  });
}

export async function buildVirtualMarketSnapshot(symbols: string[]): Promise<BrowserMarketSnapshot> {
  const now = new Date();
  const config = await readVirtualMarketConfig();
  const templateBySymbol = new Map(
    config.symbols.map((item) => [normalizeSymbol(item.symbol), { ...item, symbol: normalizeSymbol(item.symbol) }])
  );

  const quotes: BrowserMarketQuote[] = [];
  const errors: string[] = [];

  for (const symbol of symbols) {
    const normalized = normalizeSymbol(symbol);
    const template = templateBySymbol.get(normalized) ?? createFallbackTemplate(normalized);

    if (!template) {
      errors.push(`${normalized}: missing virtual market template.`);
      continue;
    }

    if (!templateBySymbol.has(normalized)) {
      errors.push(`${normalized}: using built-in virtual reference price.`);
    }

    quotes.push(buildVirtualQuote(template, now));
  }

  return browserMarketSnapshotSchema.parse({
    tool: "browser",
    mode: "virtual",
    quotes,
    errors,
    fetchedAt: now.toISOString()
  });
}
