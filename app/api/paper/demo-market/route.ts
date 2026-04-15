import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { referencePriceBySymbol } from "@/lib/market/reference-prices";
import { clearBrowserCaches, fetchMarketSnapshot } from "@/lib/tools/browser";
import {
  readVirtualMarketConfig,
  writeVirtualMarketConfig
} from "@/lib/storage/virtual-market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const demoMarketAdjustSchema = z.object({
  symbol: z.string().trim().min(1).default("BTCUSDT"),
  action: z.enum(["push", "pull", "reset"]),
  percent: z.coerce.number().positive().max(30).default(6)
});

function responseByError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid demo market payload.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : "Demo market route failed.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body = raw ? JSON.parse(raw) : {};
    const input = demoMarketAdjustSchema.parse(body);
    const symbol = input.symbol.trim().toUpperCase();

    const config = await readVirtualMarketConfig();
    const entry = config.symbols.find((item) => item.symbol.toUpperCase() === symbol);

    if (!entry) {
      return NextResponse.json({ error: `Virtual market symbol ${symbol} not found.` }, { status: 404 });
    }

    const baseReference = referencePriceBySymbol[symbol] ?? entry.anchorPrice;
    if (input.action === "reset") {
      entry.anchorPrice = baseReference;
    } else {
      const multiplier = input.action === "push" ? 1 + input.percent / 100 : 1 - input.percent / 100;
      entry.anchorPrice = Number((entry.anchorPrice * multiplier).toFixed(4));
    }

    await writeVirtualMarketConfig(config);
    clearBrowserCaches();

    const snapshot = await fetchMarketSnapshot({ symbols: [symbol] });
    const quote = snapshot.quotes[0] ?? null;

    return NextResponse.json({
      ok: true,
      symbol,
      action: input.action,
      anchorPrice: entry.anchorPrice,
      quote
    });
  } catch (error) {
    return responseByError(error);
  }
}
