import crypto from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";

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
  return readJsonFile<WalletDraft>(stagingPath, emptyDraft);
}

export async function addWalletDraft(summary: string, files: string[]): Promise<WalletDraft> {
  const draft: WalletDraft = {
    stage: "add",
    summary,
    files,
    updatedAt: new Date().toISOString()
  };

  await writeJsonFile(stagingPath, draft);
  return draft;
}

function hashCommit(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 8);
}

export async function commitWallet(): Promise<WalletCommit> {
  const draft = await readStagingDraft();
  if (!draft.summary || draft.files.length === 0) {
    throw new Error("Wallet staging is empty.");
  }

  const createdAt = new Date().toISOString();
  const hash = hashCommit(`${createdAt}:${draft.summary}:${draft.files.join(",")}`);

  const commit: WalletCommit = {
    hash,
    stage: "commit",
    summary: draft.summary,
    files: draft.files,
    createdAt
  };

  await ensureDir(commitsPath);
  await writeJsonFile(path.join(commitsPath, `${hash}.json`), commit);
  await writeJsonFile(stagingPath, emptyDraft);

  return commit;
}

export async function pushCommit(hash: string): Promise<WalletCommit> {
  const commitPath = path.join(commitsPath, `${hash}.json`);
  const existing = await readJsonFile<WalletCommit | null>(commitPath, null);

  if (!existing) {
    throw new Error(`Commit ${hash} not found.`);
  }

  const pushed: WalletCommit = {
    ...existing,
    stage: "push"
  };

  await writeJsonFile(commitPath, pushed);
  return pushed;
}

export async function listWalletCommits(): Promise<WalletCommit[]> {
  await ensureDir(commitsPath);
  const files = await readdir(commitsPath);
  const commitFiles = files.filter((name) => name.endsWith(".json"));

  const commits = await Promise.all(
    commitFiles.map((name) => readJsonFile<WalletCommit | null>(path.join(commitsPath, name), null))
  );

  return commits
    .filter((item): item is WalletCommit => Boolean(item))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}