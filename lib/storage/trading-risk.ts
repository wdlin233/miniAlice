import path from "node:path";

import { tradingRiskConfigSchema, type TradingRiskConfig } from "@/lib/schemas/trading";
import { dataPaths, readJsonFile, writeJsonFile } from "@/lib/storage/file-store";

const tradingRiskConfigPath = path.join(dataPaths.config, "trading-risk.json");
const defaultTradingRiskConfig = tradingRiskConfigSchema.parse({});

export async function readTradingRiskConfig(): Promise<TradingRiskConfig> {
  const raw = await readJsonFile<unknown>(tradingRiskConfigPath, defaultTradingRiskConfig);
  const parsed = tradingRiskConfigSchema.safeParse(raw);

  if (parsed.success) {
    return parsed.data;
  }

  await writeJsonFile(tradingRiskConfigPath, defaultTradingRiskConfig);
  return defaultTradingRiskConfig;
}