export type ToolType = "analysis" | "trading" | "browser";
export type SessionRole = "system" | "user" | "assistant" | "tool";
export type WalletStage = "add" | "commit" | "push";

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
}