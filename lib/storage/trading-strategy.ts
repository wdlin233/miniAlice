import path from "node:path";

import { tradingStrategyConfigSchema, type TradingStrategyConfig } from "@/lib/schemas/trading";
import { dataPaths, readJsonFile, writeJsonFile } from "@/lib/storage/file-store";

const tradingStrategyConfigPath = path.join(dataPaths.config, "trading-strategy.json");
const defaultTradingStrategyConfig = tradingStrategyConfigSchema.parse({});

export async function readTradingStrategyConfig(): Promise<TradingStrategyConfig> {
  const raw = await readJsonFile<unknown>(tradingStrategyConfigPath, defaultTradingStrategyConfig);
  const parsed = tradingStrategyConfigSchema.safeParse(raw);

  if (parsed.success) {
    return parsed.data;
  }

  await writeJsonFile(tradingStrategyConfigPath, defaultTradingStrategyConfig);
  return defaultTradingStrategyConfig;
}