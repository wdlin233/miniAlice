import { promises as fs } from "node:fs";
import path from "node:path";

const dataRoot = path.join(process.cwd(), "data");

export const dataPaths = {
  root: dataRoot,
  config: path.join(dataRoot, "config"),
  sessions: path.join(dataRoot, "sessions"),
  wallet: path.join(dataRoot, "wallet"),
  walletCommits: path.join(dataRoot, "wallet", "commits"),
  sandbox: path.join(dataRoot, "sandbox"),
  persona: path.join(dataRoot, "persona.md")
};

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readTextFile(filePath: string, fallback: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const raw = await readTextFile(filePath, "");
  if (!raw.trim()) {
    return fallback;
  }
  return JSON.parse(raw) as T;
}

export async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function appendJsonl<T>(filePath: string, value: T): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}