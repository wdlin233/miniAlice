import { NextResponse } from "next/server";

import { addWalletDraft, commitWallet } from "@/lib/storage/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CommitRequest {
  summary?: string;
  files?: string[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CommitRequest;
    const summary = body.summary?.trim() ?? "";
    const files = Array.isArray(body.files)
      ? body.files.map((item) => item.trim()).filter((item) => item.length > 0)
      : [];

    if (!summary || files.length === 0) {
      return NextResponse.json({ error: "summary and files are required." }, { status: 400 });
    }

    await addWalletDraft(summary, files);
    const commit = await commitWallet();

    return NextResponse.json({ commit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet commit failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}