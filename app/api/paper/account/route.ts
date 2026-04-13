import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { paperAccountResponseSchema } from "@/lib/schemas/paper-trading";
import { getPaperTradingSnapshot } from "@/lib/tools/paper-trading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseByError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid paper account request.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "Paper account route failed.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.floor(limitRaw)) : 20;

    const payload = paperAccountResponseSchema.parse(await getPaperTradingSnapshot(limit));
    return NextResponse.json(payload);
  } catch (error) {
    return responseByError(error);
  }
}
