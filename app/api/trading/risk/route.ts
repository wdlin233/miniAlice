import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { tradingRiskConfigResponseSchema } from "@/lib/schemas/trading";
import { readTradingRiskConfig } from "@/lib/storage/trading-risk";
import { evaluateTradingRiskFromPayload } from "@/lib/tools/trading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseByError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid trading risk request.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : "Trading risk route failed.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const config = await readTradingRiskConfig();
    const payload = tradingRiskConfigResponseSchema.parse({
      tool: "trading",
      config
    });

    return NextResponse.json(payload);
  } catch (error) {
    return responseByError(error);
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body = raw ? JSON.parse(raw) : {};
    const result = await evaluateTradingRiskFromPayload(body);

    return NextResponse.json(result);
  } catch (error) {
    return responseByError(error);
  }
}