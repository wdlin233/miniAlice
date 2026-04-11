import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { walletAddInputSchema } from "@/lib/schemas/wallet";
import { addWalletDraft } from "@/lib/storage/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseByError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "Wallet add failed.";

  if (/empty|invalid|required/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = walletAddInputSchema.parse(await request.json());
    const draft = await addWalletDraft(body.summary, body.files);

    return NextResponse.json({ action: "add", draft });
  } catch (error) {
    return responseByError(error);
  }
}