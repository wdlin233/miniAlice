import { NextResponse } from "next/server";

import { tradingRiskHistoryResponseSchema } from "@/lib/schemas/trading";
import { listTradingRiskLogs } from "@/lib/storage/trading-risk-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.floor(limitRaw)) : 10;

    const items = await listTradingRiskLogs(limit);
    const payload = tradingRiskHistoryResponseSchema.parse({
      tool: "trading",
      items
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read trading risk history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}