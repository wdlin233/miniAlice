import crypto from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  walletAddInputSchema,
  walletCommitSchema,
  walletDraftSchema,
  walletHashSchema
} from "@/lib/schemas/wallet";
import { dataPaths, ensureDir, readJsonFile, writeJsonFile } from "@/lib/storage/file-store";
import type { WalletCommit, WalletDraft } from "@/types/domain";

const stagingPath = path.join(dataPaths.wallet, "staging.json");
const commitsPath = dataPaths.walletCommits;

const emptyDraft: WalletDraft = {
  stage: "add",
  summary: "",
  files: [],
  updatedAt: ""
};

export async function readStagingDraft(): Promise<WalletDraft> {
  const draft = await readJsonFile<unknown>(stagingPath, emptyDraft);
  return walletDraftSchema.parse(draft);
}

export async function addWalletDraft(summary: string, files: string[]): Promise<WalletDraft> {
  const input = walletAddInputSchema.parse({ summary, files });

  const draft: WalletDraft = {
    stage: "add",
    summary: input.summary,
    files: input.files,
    updatedAt: new Date().toISOString()
  };

  await writeJsonFile(stagingPath, draft);
  return draft;
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

  return commit;
}

export async function pushCommit(hash: string): Promise<WalletCommit> {
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
  return pushed;
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