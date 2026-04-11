import { NextResponse } from "next/server";

import { commitWallet } from "@/lib/storage/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseByError(error: unknown) {
  const message = error instanceof Error ? error.message : "Wallet commit failed.";

  if (/empty|invalid|required/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST() {
  try {
    const commit = await commitWallet();
    return NextResponse.json({ action: "commit", commit });
  } catch (error) {
    return responseByError(error);
  }
}