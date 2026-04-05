import { NextResponse } from "next/server";

import { pushCommit } from "@/lib/storage/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PushRequest {
  hash?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PushRequest;
    const hash = body.hash?.trim();

    if (!hash) {
      return NextResponse.json({ error: "hash is required." }, { status: 400 });
    }

    const commit = await pushCommit(hash);
    return NextResponse.json({ commit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet push failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}