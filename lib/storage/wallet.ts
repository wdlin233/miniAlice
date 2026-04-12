import crypto from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  walletAddInputSchema,
  walletCommitSchema,
  walletDraftSchema,
  walletHashSchema,
  walletOperationLogSchema
} from "@/lib/schemas/wallet";
import {
  appendJsonl,
  dataPaths,
  ensureDir,
  readJsonFile,
  readTextFile,
  writeJsonFile
} from "@/lib/storage/file-store";
import type { WalletCommit, WalletDraft, WalletOperationLog } from "@/types/domain";

const stagingPath = path.join(dataPaths.wallet, "staging.json");
const commitsPath = dataPaths.walletCommits;
const operationsPath = path.join(dataPaths.wallet, "operations.jsonl");

const emptyDraft: WalletDraft = {
  stage: "add",
  summary: "",
  files: [],
  updatedAt: ""
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown wallet error.";
}

export async function appendWalletOperationLog(entry: WalletOperationLog): Promise<void> {
  const payload = walletOperationLogSchema.parse(entry);
  await appendJsonl(operationsPath, payload);
}

async function appendWalletOperationLogSafe(entry: WalletOperationLog): Promise<void> {
  try {
    await appendWalletOperationLog(entry);
  } catch {
    // Keep wallet operation flow non-blocking even if log write fails.
  }
}

export async function listWalletOperationLogs(limit = 20): Promise<WalletOperationLog[]> {
  const raw = await readTextFile(operationsPath, "");
  if (!raw.trim()) {
    return [];
  }

  const logs = raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        const parsedLine = walletOperationLogSchema.safeParse(JSON.parse(line) as unknown);
        return parsedLine.success ? [parsedLine.data] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
  return logs.slice(0, safeLimit);
}

export async function readStagingDraft(): Promise<WalletDraft> {
  const draft = await readJsonFile<unknown>(stagingPath, emptyDraft);
  return walletDraftSchema.parse(draft);
}

export async function addWalletDraft(summary: string, files: string[]): Promise<WalletDraft> {
  try {
    const input = walletAddInputSchema.parse({ summary, files });

    const draft: WalletDraft = {
      stage: "add",
      summary: input.summary,
      files: input.files,
      updatedAt: new Date().toISOString()
    };

    await writeJsonFile(stagingPath, draft);
    await appendWalletOperationLogSafe({
      action: "add",
      status: "success",
      message: `Staged ${draft.files.length} file(s).`,
      summary: draft.summary,
      filesCount: draft.files.length,
      createdAt: new Date().toISOString()
    });

    return draft;
  } catch (error) {
    await appendWalletOperationLogSafe({
      action: "add",
      status: "error",
      message: getErrorMessage(error),
      summary: typeof summary === "string" ? summary.trim() : undefined,
      filesCount: Array.isArray(files) ? files.length : undefined,
      createdAt: new Date().toISOString()
    });
    throw error;
  }
}

function hashCommit(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 8);
}

async function makeUniqueCommitHash(payload: Omit<WalletCommit, "hash">): Promise<string> {
  const normalized = JSON.stringify(payload);

  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const seed = attempt === 0 ? normalized : `${normalized}:${attempt}`;
    const hash = hashCommit(seed);
    const existing = await readJsonFile<unknown | null>(path.join(commitsPath, `${hash}.json`), null);

    if (!existing) {
      return hash;
    }
  }

  throw new Error("Unable to generate a unique 8-character commit hash.");
}

export async function commitWallet(): Promise<WalletCommit> {
  try {
    const draft = await readStagingDraft();
    if (!draft.summary || draft.files.length === 0) {
      throw new Error("Wallet staging is empty.");
    }

    const baseCommit: Omit<WalletCommit, "hash"> = {
      stage: "commit",
      summary: draft.summary,
      files: draft.files,
      createdAt: new Date().toISOString()
    };
    const hash = await makeUniqueCommitHash(baseCommit);

    const commit = walletCommitSchema.parse({
      ...baseCommit,
      hash,
      stage: "commit"
    });

    await ensureDir(commitsPath);
    await writeJsonFile(path.join(commitsPath, `${hash}.json`), commit);
    await writeJsonFile(stagingPath, emptyDraft);
    await appendWalletOperationLogSafe({
      action: "commit",
      status: "success",
      message: `Created commit ${hash}.`,
      hash,
      summary: commit.summary,
      filesCount: commit.files.length,
      createdAt: new Date().toISOString()
    });

    return commit;
  } catch (error) {
    await appendWalletOperationLogSafe({
      action: "commit",
      status: "error",
      message: getErrorMessage(error),
      createdAt: new Date().toISOString()
    });
    throw error;
  }
}

export async function pushCommit(hash: string): Promise<WalletCommit> {
  try {
    const validatedHash = walletHashSchema.parse(hash.trim());
    const commitPath = path.join(commitsPath, `${validatedHash}.json`);
    const existing = await readJsonFile<unknown | null>(commitPath, null);

    if (!existing) {
      throw new Error(`Commit ${validatedHash} not found.`);
    }

    const parsed = walletCommitSchema.parse(existing);

    const pushed = walletCommitSchema.parse({
      ...parsed,
      stage: "push",
      pushedAt: parsed.pushedAt ?? new Date().toISOString()
    });

    await writeJsonFile(commitPath, pushed);
    await appendWalletOperationLogSafe({
      action: "push",
      status: "success",
      message: `Pushed commit ${validatedHash}.`,
      hash: validatedHash,
      summary: pushed.summary,
      filesCount: pushed.files.length,
      createdAt: new Date().toISOString()
    });

    return pushed;
  } catch (error) {
    const normalizedHash = typeof hash === "string" ? hash.trim() : "";
    const parsedHash = walletHashSchema.safeParse(normalizedHash);

    await appendWalletOperationLogSafe({
      action: "push",
      status: "error",
      message: getErrorMessage(error),
      hash: parsedHash.success ? parsedHash.data : undefined,
      createdAt: new Date().toISOString()
    });
    throw error;
  }
}

export async function listWalletCommits(): Promise<WalletCommit[]> {
  await ensureDir(commitsPath);
  const files = await readdir(commitsPath);
  const commitFiles = files.filter((name) => name.endsWith(".json"));

  const commits = await Promise.all(
    commitFiles.map((name) => readJsonFile<unknown | null>(path.join(commitsPath, name), null))
  );

  return commits
    .flatMap((item) => {
      if (!item) {
        return [];
      }

      const parsed = walletCommitSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}