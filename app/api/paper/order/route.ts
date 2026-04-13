import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { paperOrderResponseSchema } from "@/lib/schemas/paper-trading";
import { placePaperOrderFromPayload } from "@/lib/tools/paper-trading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseByError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid paper order payload.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : "Paper order route failed.";

  if (/insufficient|不足|未获取到|cannot|invalid|持仓/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body = raw ? JSON.parse(raw) : {};
    const result = await placePaperOrderFromPayload(body);

    const payload = paperOrderResponseSchema.parse(result);
    return NextResponse.json(payload);
  } catch (error) {
    return responseByError(error);
  }
}
