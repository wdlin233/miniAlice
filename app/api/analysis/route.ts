import { NextResponse } from "next/server";
import type OpenAI from "openai";

import { getOpenAIClient } from "@/lib/openai/client";
import { listPaperTrades, readPaperAccountState } from "@/lib/storage/paper-trading";
import { listTradingOrders } from "@/lib/storage/trading-orders";
import { listTradingWalletPushExecutions } from "@/lib/storage/trading-wallet-link";
import { appendSessionMessage, readSession } from "@/lib/storage/sessions";
import type { SessionMessage } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;
const MAX_CONTEXT_MESSAGES = 24;
const MAX_TRADING_ITEMS = 8;

interface AnalysisRequest {
  sessionId?: string;
  prompt?: string;
}

function toModelMessages(messages: SessionMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map<OpenAI.Chat.Completions.ChatCompletionMessageParam>((message) => {
    if (message.role === "user") {
      return { role: "user", content: message.content };
    }

    if (message.role === "assistant") {
      return { role: "assistant", content: message.content };
    }

    if (message.role === "system") {
      return { role: "system", content: message.content };
    }

    // `tool` 角色不直接传给 chat.completions，转换为 assistant 说明避免上下文丢失。
    return { role: "assistant", content: `[工具输出]\n${message.content}` };
  });
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatQty(value: number): string {
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

async function buildTradingContextMessage(): Promise<SessionMessage | null> {
  try {
    const [orders, executions, paperAccount, paperTrades] = await Promise.all([
      listTradingOrders({ limit: 80 }),
      listTradingWalletPushExecutions(MAX_TRADING_ITEMS),
      readPaperAccountState(),
      listPaperTrades(MAX_TRADING_ITEMS)
    ]);

    const orderById = new Map(orders.map((order) => [order.id, order]));

    const executionLines = executions.map((item) => {
      const relatedOrder = item.orderId ? orderById.get(item.orderId) : undefined;
      const notionalPart = relatedOrder ? ` | notional ${formatUsd(relatedOrder.notionalUsd)}` : "";
      const leveragePart = relatedOrder ? ` | leverage ${relatedOrder.leverage.toFixed(2)}x` : "";

      return `- ${new Date(item.createdAt).toLocaleString()} | ${item.symbol} ${item.side.toUpperCase()} | ${item.status}${notionalPart}${leveragePart} | ${truncate(item.summary.replace(/\s+/g, " "), 120)}`;
    });

    const positionLines = paperAccount.positions
      .slice(0, MAX_TRADING_ITEMS)
      .map((position) =>
        `- ${position.symbol} qty=${formatQty(position.quantity)} avg=${formatUsd(position.averageEntryPriceUsd)} last=${formatUsd(position.lastPriceUsd)}`
      );

    const tradeLines = paperTrades.map(
      (trade) =>
        `- ${new Date(trade.createdAt).toLocaleString()} | ${trade.symbol} ${trade.side.toUpperCase()} ${formatQty(trade.quantity)} @ ${formatUsd(trade.priceUsd)} | ${trade.trigger}`
    );

    if (executionLines.length === 0 && positionLines.length === 0 && tradeLines.length === 0) {
      return null;
    }

    const content = [
      "[系统注入的交易上下文，仅用于提升回答相关性]",
      `账户：cash=${formatUsd(paperAccount.cashUsd)}, realizedPnl=${formatUsd(paperAccount.realizedPnlUsd)}, feePaid=${formatUsd(paperAccount.feePaidUsd)}`,
      positionLines.length > 0 ? "当前模拟盘持仓：" : "当前模拟盘持仓：无",
      ...(positionLines.length > 0 ? positionLines : []),
      executionLines.length > 0 ? "最近策略执行记录：" : "最近策略执行记录：无",
      ...(executionLines.length > 0 ? executionLines : []),
      tradeLines.length > 0 ? "最近模拟盘成交：" : "最近模拟盘成交：无",
      ...(tradeLines.length > 0 ? tradeLines : [])
    ].join("\n");

    return {
      role: "system",
      content,
      createdAt: new Date().toISOString(),
      tool: "trading"
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalysisRequest;
    const sessionId = body.sessionId?.trim();
    const prompt = body.prompt?.trim();

    if (!sessionId || !prompt) {
      return NextResponse.json({ error: "sessionId and prompt are required." }, { status: 400 });
    }

    if (!SESSION_ID_PATTERN.test(sessionId)) {
      return NextResponse.json({ error: "sessionId format is invalid." }, { status: 400 });
    }

    const userMessage: SessionMessage = {
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString()
    };
    await appendSessionMessage(sessionId, userMessage);

    const history = await readSession(sessionId);
    const contextWindow = history.slice(-MAX_CONTEXT_MESSAGES);
    const tradingContextMessage = await buildTradingContextMessage();
    const modelContext = tradingContextMessage ? [tradingContextMessage, ...contextWindow] : contextWindow;

    const client = getOpenAIClient();
    const result = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      messages: toModelMessages(modelContext),
      temperature: 0.4
    });

    const reply = result.choices[0]?.message?.content?.trim() || "No response from model.";

    const assistantMessage: SessionMessage = {
      role: "assistant",
      content: reply,
      createdAt: new Date().toISOString()
    };
    await appendSessionMessage(sessionId, assistantMessage);

    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis route failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}