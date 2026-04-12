export type ToolType = "analysis" | "trading" | "browser";
export type SessionRole = "system" | "user" | "assistant" | "tool";
export type WalletStage = "add" | "commit" | "push";
export type WalletOperationStatus = "success" | "error";

export interface SessionMessage {
  role: SessionRole;
  content: string;
  createdAt: string;
  tool?: ToolType;
}

export interface WalletDraft {
  stage: "add";
  summary: string;
  files: string[];
  updatedAt: string;
}

export interface WalletCommit {
  hash: string;
  stage: "commit" | "push";
  summary: string;
  files: string[];
  createdAt: string;
  pushedAt?: string;
}

export interface WalletOperationLog {
  action: WalletStage;
  status: WalletOperationStatus;
  message: string;
  createdAt: string;
  hash?: string;
  summary?: string;
  filesCount?: number;
}