import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  tradingRecommendationOverviewResponseSchema,
  tradingRecommendationResultSchema
} from "@/lib/schemas/trading";
import { listTradingRecommendationLogs } from "@/lib/storage/trading-recommendations";
import { readTradingStrategyConfig } from "@/lib/storage/trading-strategy";
import { generatePositionRecommendationFromPayload } from "@/lib/tools/trading-recommendation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseByError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid trading recommendation payload.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : "Trading recommendation route failed.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const [config, recent] = await Promise.all([
      readTradingStrategyConfig(),
      listTradingRecommendationLogs(8)
    ]);

    const payload = tradingRecommendationOverviewResponseSchema.parse({
      tool: "trading",
      config,
      recent
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
    const result = await generatePositionRecommendationFromPayload(body);
    const payload = tradingRecommendationResultSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    return responseByError(error);
  }
}