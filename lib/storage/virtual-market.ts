import path from "node:path";

import { referencePriceBySymbol } from "@/lib/market/reference-prices";
import {
  virtualMarketConfigSchema,
  type VirtualMarketConfig
} from "@/lib/schemas/virtual-market";
import { dataPaths, readJsonFile, writeJsonFile } from "@/lib/storage/file-store";

const virtualMarketPath = path.join(dataPaths.config, "virtual-market.json");

const defaultVirtualMarketConfig = virtualMarketConfigSchema.parse({
  symbols: [
    {
      symbol: "BTCUSDT",
      anchorPrice: referencePriceBySymbol.BTCUSDT,
      dailyChangePercent: 2.8,
      dailyRangePercent: 8.8,
      volume24h: 1250000000,
      phaseOffset: 22
    },
    {
      symbol: "ETHUSDT",
      anchorPrice: referencePriceBySymbol.ETHUSDT,
      dailyChangePercent: 1.7,
      dailyRangePercent: 10.4,
      volume24h: 820000000,
      phaseOffset: 75
    },
    {
      symbol: "SOLUSDT",
      anchorPrice: referencePriceBySymbol.SOLUSDT,
      dailyChangePercent: 3.9,
      dailyRangePercent: 15.5,
      volume24h: 460000000,
      phaseOffset: 145
    },
    {
      symbol: "BNBUSDT",
      anchorPrice: referencePriceBySymbol.BNBUSDT,
      dailyChangePercent: 1.2,
      dailyRangePercent: 7.4,
      volume24h: 260000000,
      phaseOffset: 188
    },
    {
      symbol: "XRPUSDT",
      anchorPrice: referencePriceBySymbol.XRPUSDT,
      dailyChangePercent: -1.4,
      dailyRangePercent: 12.8,
      volume24h: 390000000,
      phaseOffset: 236
    },
    {
      symbol: "ADAUSDT",
      anchorPrice: referencePriceBySymbol.ADAUSDT,
      dailyChangePercent: 1.1,
      dailyRangePercent: 11.6,
      volume24h: 240000000,
      phaseOffset: 281
    },
    {
      symbol: "DOGEUSDT",
      anchorPrice: referencePriceBySymbol.DOGEUSDT,
      dailyChangePercent: 2.3,
      dailyRangePercent: 16.8,
      volume24h: 310000000,
      phaseOffset: 329
    }
  ]
});

export async function readVirtualMarketConfig(): Promise<VirtualMarketConfig> {
  const raw = await readJsonFile<unknown>(virtualMarketPath, defaultVirtualMarketConfig);
  const parsed = virtualMarketConfigSchema.safeParse(raw);

  if (parsed.success) {
    return parsed.data;
  }

  await writeJsonFile(virtualMarketPath, defaultVirtualMarketConfig);
  return defaultVirtualMarketConfig;
}

export async function writeVirtualMarketConfig(config: VirtualMarketConfig): Promise<void> {
  const payload = virtualMarketConfigSchema.parse(config);
  await writeJsonFile(virtualMarketPath, payload);
}
