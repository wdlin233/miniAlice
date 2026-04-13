import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { tradingExecuteResultSchema } from "@/lib/schemas/trading";
import { executeTradingStrategyFromPayload } from "@/lib/tools/trading-execution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseByError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid strategy execution payload.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : "Trading execute route failed.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body = raw ? JSON.parse(raw) : {};
    const result = await executeTradingStrategyFromPayload(body);
    const payload = tradingExecuteResultSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    return responseByError(error);
  }
}
