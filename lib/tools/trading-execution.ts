import {
  tradingExecuteInputSchema,
  tradingExecuteResultSchema,
  type TradingExecuteInput,
  type TradingExecuteResult
} from "@/lib/schemas/trading";
import { addWalletDraft, commitWallet, pushCommit } from "@/lib/storage/wallet";
import { generatePositionRecommendation } from "@/lib/tools/trading-recommendation";
import { linkWalletPushExecutionSafe } from "@/lib/tools/wallet-trading-link";

function inferSymbolFromText(text: string): string {
  const symbolMatch = text.toUpperCase().match(/\b([A-Z]{2,10}(?:USDT|USD|PERP))\b/);
  return symbolMatch?.[1] ?? "BTCUSDT";
}

function inferTrendScore(text: string): number {
  const normalized = text.toLowerCase();

  if (/short|sell|bear|看空/.test(normalized)) {
    return -45;
  }

  if (/long|buy|bull|看多/.test(normalized)) {
    return 45;
  }

  return 20;
}

function inferVolatilityByRiskLevel(level: TradingExecuteInput["riskLevel"]): number {
  if (level === "low") {
    return 2.2;
  }

  if (level === "high") {
    return 6.8;
  }

  return 4.2;
}

function buildSyntheticFiles(symbol: string): string[] {
  const dateTag = new Date().toISOString().slice(0, 10);
  return [`strategies/${symbol}-${dateTag}.md`, `risk/${symbol}-execution.json`];
}

export async function executeTradingStrategy(input: TradingExecuteInput): Promise<TradingExecuteResult> {
  const symbol = input.symbol?.toUpperCase() || inferSymbolFromText(input.strategy);
  const recommendationResult = await generatePositionRecommendation({
    symbol,
    trendScore: inferTrendScore(input.strategy),
    volatilityPercent: inferVolatilityByRiskLevel(input.riskLevel),
    riskLevel: input.riskLevel,
    accountEquityUsd: input.accountEquityUsd,
    currentExposurePercent: input.currentExposurePercent,
    dailyLossPercent: input.dailyLossPercent
  });

  const summary = `${symbol} ${recommendationResult.recommendation.side.toUpperCase()} | ${input.strategy.slice(0, 140)}`;
  const draft = await addWalletDraft(summary, buildSyntheticFiles(symbol));
  const commit = await commitWallet();
  const pushedCommit = await pushCommit(commit.hash);
  const trading = await linkWalletPushExecutionSafe(pushedCommit);

  return tradingExecuteResultSchema.parse({
    tool: "trading",
    summary,
    wallet: {
      draftUpdatedAt: draft.updatedAt,
      commitHash: commit.hash,
      pushStage: pushedCommit.stage
    },
    recommendation: recommendationResult.recommendation,
    execution: trading.execution,
    createdAt: new Date().toISOString()
  });
}

export async function executeTradingStrategyFromPayload(payload: unknown): Promise<TradingExecuteResult> {
  const input = tradingExecuteInputSchema.parse(payload);
  return executeTradingStrategy(input);
}
