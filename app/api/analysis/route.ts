import { NextResponse } from "next/server";
import type OpenAI from "openai";

import { getOpenAIClient } from "@/lib/openai/client";
import { appendSessionMessage, readSession } from "@/lib/storage/sessions";
import type { SessionMessage } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;
const MAX_CONTEXT_MESSAGES = 24;

interface AnalysisRequest {
  sessionId?: string;
  prompt?: string;
}

function toModelMessages(messages: SessionMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map<OpenAI.Chat.Completions.ChatCompletionMessageParam>((message) => {
    if (message.role === "user") {
      return { role: "user", content: message.content };
    }

    if (message.role === "assistant") {
      return { role: "assistant", content: message.content };
    }

    if (message.role === "system") {
      return { role: "system", content: message.content };
    }

    // `tool` 角色不直接传给 chat.completions，转换为 assistant 说明避免上下文丢失。
    return { role: "assistant", content: `[工具输出]\n${message.content}` };
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalysisRequest;
    const sessionId = body.sessionId?.trim();
    const prompt = body.prompt?.trim();

    if (!sessionId || !prompt) {
      return NextResponse.json({ error: "sessionId and prompt are required." }, { status: 400 });
    }

    if (!SESSION_ID_PATTERN.test(sessionId)) {
      return NextResponse.json({ error: "sessionId format is invalid." }, { status: 400 });
    }

    const userMessage: SessionMessage = {
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString()
    };
    await appendSessionMessage(sessionId, userMessage);

    const history = await readSession(sessionId);
    const contextWindow = history.slice(-MAX_CONTEXT_MESSAGES);

    const client = getOpenAIClient();
    const result = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      messages: toModelMessages(contextWindow),
      temperature: 0.4
    });

    const reply = result.choices[0]?.message?.content?.trim() || "No response from model.";

    const assistantMessage: SessionMessage = {
      role: "assistant",
      content: reply,
      createdAt: new Date().toISOString()
    };
    await appendSessionMessage(sessionId, assistantMessage);

    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis route failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}