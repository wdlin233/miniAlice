import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { tradingOrderResponseSchema } from "@/lib/schemas/trading";
import { cancelTradingOrderFromPayload } from "@/lib/tools/trading-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseByError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid trading cancel payload.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "Trading cancel route failed.";

  if (/not found/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  if (/already been canceled|cannot be canceled/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body = raw ? JSON.parse(raw) : {};
    const order = await cancelTradingOrderFromPayload(body);

    const payload = tradingOrderResponseSchema.parse({
      tool: "trading",
      order
    });

    return NextResponse.json(payload);
  } catch (error) {
    return responseByError(error);
  }
}