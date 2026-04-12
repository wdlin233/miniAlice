import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { dataPaths, ensureDir, readTextFile } from "@/lib/storage/file-store";
import { getOpenAIClient } from "@/lib/openai/client";
import type { SessionMessage } from "@/types/domain";

// Zod Schema 定义
const SessionMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  createdAt: z.string(),
  tool: z.enum(["analysis", "trading", "browser"]).optional(),
});

const CompressionConfigSchema = z.object({
  messageThreshold: z.number().default(20),
  tokenThreshold: z.number().default(4000),
});

export type CompressionConfig = z.infer<typeof CompressionConfigSchema>;
export interface CompressionResult {
  compressedMessage: SessionMessage;
  originalCount: number;
  savedTokens: number;
}

// 估算 token 数量的简单函数
export function estimateTokens(text: string): number {
  // 简单估算：1 个 token 约等于 4 个字符
  return Math.ceil(text.length / 4);
}

// 计算会话的总 token 数
export function calculateTotalTokens(messages: SessionMessage[]): number {
  return messages.reduce((total, message) => {
    return total + estimateTokens(message.content);
  }, 0);
}

// 检查是否需要压缩
export function shouldCompress(messages: SessionMessage[], config?: z.input<typeof CompressionConfigSchema>): boolean {
  const validatedConfig = CompressionConfigSchema.parse(config);
  const messageCount = messages.length;
  const totalTokens = calculateTotalTokens(messages);
  
  return messageCount > validatedConfig.messageThreshold || totalTokens > validatedConfig.tokenThreshold;
}

// 语义保留压缩函数
export async function compressSessionMessages(
  messages: SessionMessage[]
): Promise<SessionMessage> {
  const openai = getOpenAIClient();
  
  // 准备压缩提示
  const prompt = `请压缩以下对话历史，保留核心上下文和对话逻辑：\n\n${messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n")}`;
  
  // 调用 OpenAI API 进行压缩
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "你是一个对话压缩助手，需要将长对话压缩为简洁的摘要，保留核心信息和上下文。",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
  });
  
  const compressedContent = response.choices[0]?.message?.content || "";
  
  // 创建压缩后的消息
  return {
    role: "system",
    content: `[压缩历史对话]\n${compressedContent}`,
    createdAt: new Date().toISOString(),
    tool: "analysis",
  };
}

// 执行 Session 压缩
export async function compressSession(
  sessionId: string,
  config?: z.input<typeof CompressionConfigSchema>
): Promise<CompressionResult> {
  const validatedConfig = CompressionConfigSchema.parse(config);
  const filePath = path.join(dataPaths.sessions, `${sessionId}.jsonl`);
  
  // 读取会话消息
  const raw = await readTextFile(filePath, "");
  const messages = raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        const message = JSON.parse(line);
        return SessionMessageSchema.parse(message);
      } catch {
        return [];
      }
    });
  
  // 检查是否需要压缩
  if (!shouldCompress(messages, validatedConfig)) {
    throw new Error("Session 不需要压缩");
  }
  
  // 压缩消息
  const compressedMessage = await compressSessionMessages(messages);
  
  // 计算压缩前后的 token 数
  const originalTokens = calculateTotalTokens(messages);
  const compressedTokens = estimateTokens(compressedMessage.content);
  const savedTokens = originalTokens - compressedTokens;
  
  // 重写文件，只保留压缩后的消息
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(compressedMessage)}\n`, "utf8");
  
  return {
    compressedMessage,
    originalCount: messages.length,
    savedTokens,
  };
}

// 读取 Session 文件
async function readSessionFile(sessionId: string): Promise<SessionMessage[]> {
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
        const message = JSON.parse(line);
        return SessionMessageSchema.parse(message);
      } catch {
        return [];
      }
    });
}

// 追加消息到 Session 文件
async function appendToSessionFile(
  sessionId: string,
  message: SessionMessage
): Promise<void> {
  const validatedMessage = SessionMessageSchema.parse(message);
  const filePath = path.join(dataPaths.sessions, `${sessionId}.jsonl`);
  
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(validatedMessage)}\n`, "utf8");
  
  // 检查是否需要压缩
  const messages = await readSessionFile(sessionId);
  if (shouldCompress(messages)) {
    await compressSession(sessionId);
  }
}

// 列出所有 Session 文件
async function listSessionFiles(): Promise<string[]> {
  await ensureDir(dataPaths.sessions);
  const files = await fs.readdir(dataPaths.sessions);
  return files.filter((name) => name.endsWith(".jsonl")).sort((a, b) => a.localeCompare(b));
}

// 公开 API
export async function appendSessionMessage(sessionId: string, message: SessionMessage): Promise<void> {
  await appendToSessionFile(sessionId, message);
}

export async function readSession(sessionId: string): Promise<SessionMessage[]> {
  return await readSessionFile(sessionId);
}

export async function listSessions(): Promise<string[]> {
  return await listSessionFiles();
}