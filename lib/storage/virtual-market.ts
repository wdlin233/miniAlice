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
      dailyChangePercent: 1.4,
      dailyRangePercent: 3.2,
      volume24h: 1250000000,
      phaseOffset: 22
    },
    {
      symbol: "ETHUSDT",
      anchorPrice: referencePriceBySymbol.ETHUSDT,
      dailyChangePercent: 0.9,
      dailyRangePercent: 3.6,
      volume24h: 820000000,
      phaseOffset: 75
    },
    {
      symbol: "SOLUSDT",
      anchorPrice: referencePriceBySymbol.SOLUSDT,
      dailyChangePercent: 2.1,
      dailyRangePercent: 5.8,
      volume24h: 460000000,
      phaseOffset: 145
    },
    {
      symbol: "BNBUSDT",
      anchorPrice: referencePriceBySymbol.BNBUSDT,
      dailyChangePercent: 0.4,
      dailyRangePercent: 2.5,
      volume24h: 260000000,
      phaseOffset: 188
    },
    {
      symbol: "XRPUSDT",
      anchorPrice: referencePriceBySymbol.XRPUSDT,
      dailyChangePercent: -0.7,
      dailyRangePercent: 4.7,
      volume24h: 390000000,
      phaseOffset: 236
    },
    {
      symbol: "ADAUSDT",
      anchorPrice: referencePriceBySymbol.ADAUSDT,
      dailyChangePercent: 0.6,
      dailyRangePercent: 4.1,
      volume24h: 240000000,
      phaseOffset: 281
    },
    {
      symbol: "DOGEUSDT",
      anchorPrice: referencePriceBySymbol.DOGEUSDT,
      dailyChangePercent: 1.1,
      dailyRangePercent: 6.2,
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
