import { readdir } from "node:fs/promises";
import path from "node:path";

import { appendJsonl, dataPaths, ensureDir, readTextFile } from "@/lib/storage/file-store";
import type { SessionMessage } from "@/types/domain";

export async function appendSessionMessage(sessionId: string, message: SessionMessage): Promise<void> {
  const filePath = path.join(dataPaths.sessions, `${sessionId}.jsonl`);
  await appendJsonl(filePath, message);
}

export async function readSession(sessionId: string): Promise<SessionMessage[]> {
  const filePath = path.join(dataPaths.sessions, `${sessionId}.jsonl`);
  const raw = await readTextFile(filePath, "");

  if (!raw.trim()) {
    return [];
  }

  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as SessionMessage];
      } catch {
        return [];
      }
    });
}

export async function listSessions(): Promise<string[]> {
  await ensureDir(dataPaths.sessions);
  const files = await readdir(dataPaths.sessions);
  return files.filter((name) => name.endsWith(".jsonl")).sort((a, b) => a.localeCompare(b));
}