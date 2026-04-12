import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  tradingOrderListResponseSchema,
  tradingOrderResponseSchema,
  tradingOrderSourceSchema,
  tradingOrderStatusSchema
} from "@/lib/schemas/trading";
import { listTradingOrdersView, placeTradingOrderFromPayload } from "@/lib/tools/trading-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseByError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid trading order payload.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : "Trading order route failed.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.floor(limitRaw)) : 20;

    const statusRaw = url.searchParams.get("status");
    const sourceRaw = url.searchParams.get("source");

    const status = statusRaw ? tradingOrderStatusSchema.parse(statusRaw) : undefined;
    const source = sourceRaw ? tradingOrderSourceSchema.parse(sourceRaw) : undefined;

    const items = await listTradingOrdersView({ limit, status, source });
    const payload = tradingOrderListResponseSchema.parse({
      tool: "trading",
      items
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
    const order = await placeTradingOrderFromPayload(body);

    const payload = tradingOrderResponseSchema.parse({
      tool: "trading",
      order
    });

    return NextResponse.json(payload, { status: order.status === "rejected" ? 202 : 200 });
  } catch (error) {
    return responseByError(error);
  }
}