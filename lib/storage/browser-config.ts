import path from "node:path";

import { browserConfigSchema, type BrowserConfig } from "@/lib/schemas/browser";
import { dataPaths, readJsonFile, writeJsonFile } from "@/lib/storage/file-store";

const browserConfigPath = path.join(dataPaths.config, "browser.json");
const defaultBrowserConfig = browserConfigSchema.parse({});

export async function readBrowserConfig(): Promise<BrowserConfig> {
  const raw = await readJsonFile<unknown>(browserConfigPath, defaultBrowserConfig);
  const parsed = browserConfigSchema.safeParse(raw);

  if (parsed.success) {
    return parsed.data;
  }

  await writeJsonFile(browserConfigPath, defaultBrowserConfig);
  return defaultBrowserConfig;
}