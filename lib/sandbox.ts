import { promises as fs } from "node:fs";
import path from "node:path";


import { dataPaths, ensureDir, readJsonFile, writeJsonFile } from "@/lib/storage/file-store";
import { readSession } from "@/lib/storage/sessions";
import { readStagingDraft, listWalletCommits } from "@/lib/storage/wallet";
import type { SessionMessage, WalletDraft, WalletCommit } from "@/types/domain";

// Type definitions
export interface SandboxConfig {
  sandboxId: string;
  playheadTime: string;
  createdAt: string;
  lastModified: string;
}

export interface SandboxSnapshot {
  sandboxId: string;
  playheadTime: string;
  timestamp: string;
  wallet: {
    staging: unknown;
    commits: unknown[];
  };
  sessions: Record<string, unknown[]>;
}

export interface SandboxState {
  playheadTime: string;
  wallet: {
    staging: unknown;
    commits: unknown[];
  };
  sessions: Record<string, unknown[]>;
}

// 生成唯一的 sandboxId
function generateSandboxId(): string {
  return `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Sandbox 类
export class Sandbox {
  private sandboxId: string;
  private playheadTime: Date;
  private state: SandboxState;
  private sandboxPath: string;

  constructor(sandboxId?: string) {
    this.sandboxId = sandboxId || generateSandboxId();
    this.playheadTime = new Date();
    this.state = {
      playheadTime: this.playheadTime.toISOString(),
      wallet: {
        staging: undefined,
        commits: [],
      },
      sessions: {},
    };
    this.sandboxPath = path.join(dataPaths.sandbox, this.sandboxId);
  }

  // 获取 sandboxId
  getSandboxId(): string {
    return this.sandboxId;
  }

  // 获取当前沙箱时间
  getPlayheadTime(): Date {
    return this.playheadTime;
  }

  // 设置沙箱时间
  setPlayheadTime(time: Date): void {
    this.playheadTime = time;
    this.state.playheadTime = time.toISOString();
  }

  // 推进沙箱时间（单位：毫秒）
  advancePlayheadTime(delta: number): void {
    const newTime = new Date(this.playheadTime.getTime() + delta);
    this.setPlayheadTime(newTime);
  }

  // 回滚沙箱时间
  rollbackPlayheadTime(time: Date): void {
    if (time.getTime() <= this.playheadTime.getTime()) {
      this.setPlayheadTime(time);
    } else {
      throw new Error("Cannot rollback to a future time");
    }
  }

  // 重置沙箱到初始状态
  reset(): void {
    this.playheadTime = new Date();
    this.state = {
      playheadTime: this.playheadTime.toISOString(),
      wallet: {
        staging: undefined,
        commits: [],
      },
      sessions: {},
    };
  }

  // 创建沙箱快照
  async createSnapshot(): Promise<SandboxSnapshot> {
    const snapshot: SandboxSnapshot = {
      sandboxId: this.sandboxId,
      playheadTime: this.playheadTime.toISOString(),
      timestamp: new Date().toISOString(),
      wallet: this.state.wallet,
      sessions: this.state.sessions,
    };

    const snapshotPath = path.join(this.sandboxPath, `snapshot_${Date.now()}.json`);
    await ensureDir(path.dirname(snapshotPath));
    await writeJsonFile(snapshotPath, snapshot);

    return snapshot;
  }

  // 加载沙箱快照
  async loadSnapshot(snapshotPath: string): Promise<void> {
    const snapshot = await readJsonFile<SandboxSnapshot>(snapshotPath, {
      sandboxId: this.sandboxId,
      playheadTime: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      wallet: { staging: undefined, commits: [] },
      sessions: {},
    });

    this.playheadTime = new Date(snapshot.playheadTime);
    this.state = {
      playheadTime: snapshot.playheadTime,
      wallet: snapshot.wallet,
      sessions: snapshot.sessions,
    };
  }

  // 从实时状态创建沙箱
  async initializeFromRealState(): Promise<void> {
    // 初始化沙箱目录
    await ensureDir(this.sandboxPath);

    // 复制钱包状态
    const realStaging = await readStagingDraft();
    const realCommits = await listWalletCommits();

    this.state.wallet = {
      staging: realStaging,
      commits: realCommits,
    };

    // 复制会话状态（过滤到当前沙箱时间之前的消息）
    const sessionsDir = dataPaths.sessions;
    const sessionFiles = await fs.readdir(sessionsDir);

    for (const file of sessionFiles) {
      if (file.endsWith(".jsonl")) {
        const sessionId = file.replace(".jsonl", "");
        const realMessages = await readSession(sessionId);
        
        // 过滤到沙箱时间之前的消息
        const filteredMessages = realMessages.filter((msg) => {
          return new Date(msg.createdAt) <= this.playheadTime;
        });

        this.state.sessions[sessionId] = filteredMessages;
      }
    }

    // 保存沙箱配置
    await this.saveConfig();
  }

  // 保存沙箱配置
  private async saveConfig(): Promise<void> {
    const config: SandboxConfig = {
      sandboxId: this.sandboxId,
      playheadTime: this.playheadTime.toISOString(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    const configPath = path.join(this.sandboxPath, "config.json");
    await ensureDir(path.dirname(configPath));
    await writeJsonFile(configPath, config);
  }

  // 加载沙箱配置
  async loadConfig(): Promise<void> {
    const configPath = path.join(this.sandboxPath, "config.json");
    const config = await readJsonFile<SandboxConfig>(configPath, {
      sandboxId: this.sandboxId,
      playheadTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    });

    this.playheadTime = new Date(config.playheadTime);
  }

  // 获取沙箱内的会话消息
  getSessionMessages(sessionId: string): SessionMessage[] {
    return (this.state.sessions[sessionId] as SessionMessage[]) || [];
  }

  // 添加沙箱内的会话消息
  addSessionMessage(sessionId: string, message: SessionMessage): void {
    // 确保消息时间不超过沙箱时间
    const messageTime = new Date(message.createdAt);
    if (messageTime > this.playheadTime) {
      throw new Error("Message time cannot be in the future of sandbox playhead time");
    }

    if (!this.state.sessions[sessionId]) {
      this.state.sessions[sessionId] = [];
    }

    this.state.sessions[sessionId].push(message as unknown);
  }

  // 获取沙箱内的钱包状态
  getWalletState(): { staging: WalletDraft | undefined; commits: WalletCommit[] } {
    return this.state.wallet as { staging: WalletDraft | undefined; commits: WalletCommit[] };
  }

  // 更新沙箱内的钱包状态
  updateWalletState(staging?: WalletDraft, commits?: WalletCommit[]): void {
    if (staging) {
      this.state.wallet.staging = staging as unknown;
    }

    if (commits) {
      this.state.wallet.commits = commits as unknown as unknown[];
    }
  }

  // 保存沙箱状态
  async saveState(): Promise<void> {
    const statePath = path.join(this.sandboxPath, "state.json");
    await ensureDir(path.dirname(statePath));
    await writeJsonFile(statePath, this.state);
    await this.saveConfig();
  }

  // 加载沙箱状态
  async loadState(): Promise<void> {
    const statePath = path.join(this.sandboxPath, "state.json");
    const state = await readJsonFile<SandboxState>(statePath, this.state);

    this.state = state;
    this.playheadTime = new Date(state.playheadTime);
  }

  // 获取会话数量
  getSessionCount(): number {
    return Object.keys(this.state.sessions).length;
  }

  // 清理沙箱数据
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.sandboxPath, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  }
}

// 创建新的沙箱实例
export async function createSandbox(sandboxId?: string): Promise<Sandbox> {
  const sandbox = new Sandbox(sandboxId);
  await sandbox.initializeFromRealState();
  await sandbox.saveState();
  return sandbox;
}

// 加载现有沙箱实例
export async function loadSandbox(sandboxId: string): Promise<Sandbox> {
  const sandbox = new Sandbox(sandboxId);
  await sandbox.loadConfig();
  await sandbox.loadState();
  return sandbox;
}

// 列出所有沙箱
export async function listSandboxes(): Promise<string[]> {
  await ensureDir(dataPaths.sandbox);
  const files = await fs.readdir(dataPaths.sandbox);
  return files.filter((name) => {
    return name.startsWith("sandbox_");
  });
}
