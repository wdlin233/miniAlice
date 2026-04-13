"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TradingExecuteResult, TradingRiskLevel } from "@/lib/schemas/trading";

interface StrategyStudioError {
  error?: string;
}

const riskLevelOptions: Array<{ value: TradingRiskLevel; label: string }> = [
  { value: "low", label: "低风险" },
  { value: "medium", label: "中风险" },
  { value: "high", label: "高风险" }
];

function sideLabel(side: TradingExecuteResult["recommendation"]["side"]): string {
  return side === "buy" ? "买入" : "卖出";
}

function executionStatusLabel(status: TradingExecuteResult["execution"]["status"]): string {
  if (status === "submitted") {
    return "已提交";
  }

  if (status === "blocked") {
    return "已拦截";
  }

  if (status === "error") {
    return "异常";
  }

  return status;
}

export function StrategyStudio() {
  const router = useRouter();

  const [strategy, setStrategy] = useState("");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [riskLevel, setRiskLevel] = useState<TradingRiskLevel>("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<TradingExecuteResult | null>(null);

  async function executeStrategy() {
    const trimmed = strategy.trim();
    if (!trimmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/trading/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          strategy: trimmed,
          symbol: symbol.trim().toUpperCase() || undefined,
          riskLevel
        })
      });

      if (!response.ok) {
        const errorData = (await response.json()) as StrategyStudioError;
        throw new Error(errorData.error ?? "策略执行失败。请稍后再试。");
      }

      const data = (await response.json()) as TradingExecuteResult;
      setResult(data);
      setNotice("策略已执行：系统已自动完成记录与交易流水。请查看下方执行结果。\n");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "策略执行出现未知错误。";
      setNotice(`执行失败：${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input
          value={symbol}
          onChange={(event) => setSymbol(event.target.value)}
          placeholder="交易对，例如 BTCUSDT"
          disabled={isSubmitting}
        />

        <select
          value={riskLevel}
          onChange={(event) => setRiskLevel(event.target.value as TradingRiskLevel)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          disabled={isSubmitting}
        >
          {riskLevelOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <Textarea
        value={strategy}
        onChange={(event) => setStrategy(event.target.value)}
        placeholder="输入你的策略想法，例如：在 BTC 回调到关键支撑后分批做多，单笔风险控制在 1% 内。"
        className="min-h-[110px]"
        disabled={isSubmitting}
      />

      <Button onClick={executeStrategy} disabled={isSubmitting || strategy.trim().length < 8}>
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        一键执行策略
      </Button>

      {notice ? (
        <Badge variant="outline" className="max-w-full whitespace-pre-wrap py-1">
          {notice}
        </Badge>
      ) : null}

      {result ? (
        <div className="space-y-2 rounded-lg border bg-background/70 p-4">
          <p className="text-sm font-medium">执行摘要</p>
          <p className="text-sm text-muted-foreground">{result.summary}</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>方向：{sideLabel(result.recommendation.side)}</span>
            <span>杠杆：{result.recommendation.leverage}x</span>
            <span>名义金额：${result.recommendation.notionalUsd.toFixed(2)}</span>
            <span>执行状态：{executionStatusLabel(result.execution.status)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
