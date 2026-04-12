import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { browserMarketRequestSchema } from "@/lib/schemas/browser";
import { fetchMarketSnapshot } from "@/lib/tools/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid market request.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "Browser market route failed.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function parseGetInput(request: Request) {
  const url = new URL(request.url);
  const symbols = url.searchParams.get("symbols");

  const rawInput = {
    symbols: symbols
      ? symbols
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : undefined
  };

  return browserMarketRequestSchema.parse(rawInput);
}

export async function GET(request: Request) {
  try {
    const input = parseGetInput(request);
    const snapshot = await fetchMarketSnapshot(input);
    return NextResponse.json(snapshot);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body = raw ? JSON.parse(raw) : {};
    const input = browserMarketRequestSchema.parse(body);
    const snapshot = await fetchMarketSnapshot(input);

    return NextResponse.json(snapshot);
  } catch (error) {
    return errorResponse(error);
  }
}