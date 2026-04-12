import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { browserNewsRequestSchema } from "@/lib/schemas/browser";
import { fetchNewsSnapshot } from "@/lib/tools/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid news request.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "Browser news route failed.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const snapshot = await fetchNewsSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body = raw ? JSON.parse(raw) : {};
    const input = browserNewsRequestSchema.parse(body);
    const snapshot = await fetchNewsSnapshot(input);

    return NextResponse.json(snapshot);
  } catch (error) {
    return errorResponse(error);
  }
}