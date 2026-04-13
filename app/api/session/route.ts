import { NextResponse } from "next/server";

import { compressSession, readSession, shouldCompress, estimateTokens, calculateTotalTokens } from "@/lib/storage/sessions";
import type { CompressionConfig } from "@/lib/storage/sessions";

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;

interface SessionCompressRequest {
  sessionId: string;
  mode?: "manual" | "auto";
  config?: CompressionConfig;
}

interface CompressResponse {
  compressed: boolean;
  originalCount?: number;
  originalTokens?: number;
  compressedTokens?: number;
  savedTokens?: number;
  compressedMessagePreview?: string;
  message?: string;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId")?.trim();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    if (!SESSION_ID_PATTERN.test(sessionId)) {
      return NextResponse.json({ error: "sessionId format is invalid." }, { status: 400 });
    }

    const messages = await readSession(sessionId);
    return NextResponse.json({ sessionId, messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session read route failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SessionCompressRequest;
    const sessionId = body.sessionId?.trim();
    const mode = body.mode || "auto";
    const config = body.config || {};

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    if (!SESSION_ID_PATTERN.test(sessionId)) {
      return NextResponse.json({ error: "sessionId format is invalid." }, { status: 400 });
    }

    // 读取会话消息
    const messages = await readSession(sessionId);
    
    let response: CompressResponse;

    if (mode === "manual") {
      // 手动触发压缩
      const result = await compressSession(sessionId, config);
      
      response = {
        compressed: true,
        originalCount: result.originalCount,
        originalTokens: calculateTotalTokens(messages),
        compressedTokens: estimateTokens(result.compressedMessage.content),
        savedTokens: result.savedTokens,
        compressedMessagePreview: result.compressedMessage.content.substring(0, 100) + "...",
        message: "Session compressed successfully."
      };
    } else {
      // 自动检查触发
      const shouldCompressResult = shouldCompress(messages, config);
      
      if (shouldCompressResult) {
        const result = await compressSession(sessionId, config);
        
        response = {
          compressed: true,
          originalCount: result.originalCount,
          originalTokens: calculateTotalTokens(messages),
          compressedTokens: estimateTokens(result.compressedMessage.content),
          savedTokens: result.savedTokens,
          compressedMessagePreview: result.compressedMessage.content.substring(0, 100) + "...",
          message: "Session compressed automatically."
        };
      } else {
        response = {
          compressed: false,
          originalCount: messages.length,
          originalTokens: calculateTotalTokens(messages),
          message: "Session does not need compression."
        };
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session compression route failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
