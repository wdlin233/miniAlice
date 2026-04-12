import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { walletPushInputSchema } from "@/lib/schemas/wallet";
import { pushCommit } from "@/lib/storage/wallet";
import { linkWalletPushExecutionSafe } from "@/lib/tools/wallet-trading-link";

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

  const message = error instanceof Error ? error.message : "Wallet push failed.";

  if (/not found/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  if (/empty|invalid|required/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = walletPushInputSchema.parse(await request.json());
    const commit = await pushCommit(body.hash);
    const trading = await linkWalletPushExecutionSafe(commit);

    return NextResponse.json({ action: "push", commit, trading });
  } catch (error) {
    return responseByError(error);
  }
}