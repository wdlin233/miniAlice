import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  sandboxTradingReplayRequestSchema,
  sandboxTradingReplayResultSchema
} from "@/lib/schemas/trading";
import { replayTradingRiskValidationFromPayload } from "@/lib/tools/sandbox-trading-replay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseByError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid sandbox replay payload.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : "Sandbox replay route failed.";

  if (/not found/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const payload = {
      sandboxId: url.searchParams.get("sandboxId") ?? "",
      limit: url.searchParams.get("limit") ?? "20",
      decision: url.searchParams.get("decision") ?? undefined
    };

    const input = sandboxTradingReplayRequestSchema.parse(payload);
    const result = await replayTradingRiskValidationFromPayload(input);
    const response = sandboxTradingReplayResultSchema.parse(result);

    return NextResponse.json(response);
  } catch (error) {
    return responseByError(error);
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body = raw ? JSON.parse(raw) : {};
    const result = await replayTradingRiskValidationFromPayload(body);
    const response = sandboxTradingReplayResultSchema.parse(result);

    return NextResponse.json(response);
  } catch (error) {
    return responseByError(error);
  }
}