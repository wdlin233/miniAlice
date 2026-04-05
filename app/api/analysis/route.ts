import { NextResponse } from "next/server";

import { getOpenAIClient } from "@/lib/openai/client";
import { appendSessionMessage } from "@/lib/storage/sessions";
import type { SessionMessage } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnalysisRequest {
  sessionId?: string;
  prompt?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalysisRequest;
    const sessionId = body.sessionId?.trim();
    const prompt = body.prompt?.trim();

    if (!sessionId || !prompt) {
      return NextResponse.json({ error: "sessionId and prompt are required." }, { status: 400 });
    }

    const userMessage: SessionMessage = {
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString()
    };
    await appendSessionMessage(sessionId, userMessage);

    const client = getOpenAIClient();
    const result = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: prompt
    });

    const reply = result.output_text?.trim() || "No response from model.";

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