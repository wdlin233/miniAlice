"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  TradingRiskConfig,
  TradingRiskLog,
  TradingRiskResult,
  TradingSide
} from "@/lib/schemas/trading";

interface TradingRiskConfigResponse {
  tool: "trading";
  config: TradingRiskConfig;
}

interface ErrorResponse {
  error?: string;
}

interface TradingRiskHistoryResponse {
  tool: "trading";
  items: TradingRiskLog[];
}

interface FormState {
  symbol: string;
  side: TradingSide;
  leverage: string;
  notionalUsd: string;
  accountEquityUsd: string;
  stopLossPercent: string;
  currentExposurePercent: string;
  dailyLossPercent: string;
}

const initialFormState: FormState = {
  symbol: "BTCUSDT",
  side: "buy",
  leverage: "3",
  notionalUsd: "1000",
  accountEquityUsd: "10000",
  stopLossPercent: "1.2",
  currentExposurePercent: "10",
  dailyLossPercent: "0.5"
};

function decisionStyle(decision: TradingRiskResult["decision"]) {
  if (decision === "approve") {
    return {
      icon: ShieldCheck,
      className: "border-emerald-500 text-emerald-600"
    };
  }

  if (decision === "caution") {
    return {
      icon: ShieldQuestion,
      className: "border-amber-500 text-amber-600"
    };
  }

  return {
    icon: ShieldAlert,
    className: "border-destructive text-destructive"
  };
}

export function RiskControlPanel() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [config, setConfig] = useState<TradingRiskConfig | null>(null);
  const [result, setResult] = useState<TradingRiskResult | null>(null);
  const [history, setHistory] = useState<TradingRiskLog[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadConfig() {
      try {
        const response = await fetch("/api/trading/risk", {
          method: "GET",
          cache: "no-store"
        });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as TradingRiskConfigResponse;
        if (mounted) {
          setConfig(data.config);
        }
      } catch {
        // Keep panel usable with defaults if config request fails.
      }
    }

    async function loadHistory() {
      try {
        const response = await fetch("/api/trading/risk/history?limit=8", {
          method: "GET",
          cache: "no-store"
        });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as TradingRiskHistoryResponse;
        if (mounted) {
          setHistory(data.items);
        }
      } catch {
        // History is optional and should not block the panel.
      }
    }

    void loadConfig();
    void loadHistory();

    return () => {
      mounted = false;
    };
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function evaluateRisk() {
    setIsLoading(true);
    setNotice(null);

    try {
      const payload = {
        symbol: form.symbol.trim().toUpperCase(),
        side: form.side,
        leverage: Number(form.leverage),
        notionalUsd: Number(form.notionalUsd),
        accountEquityUsd: Number(form.accountEquityUsd),
        stopLossPercent: Number(form.stopLossPercent),
        currentExposurePercent: Number(form.currentExposurePercent),
        dailyLossPercent: Number(form.dailyLossPercent)
      };

      const response = await fetch("/api/trading/risk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new Error(error.error ?? "Trading risk evaluation failed.");
      }

      const data = (await response.json()) as TradingRiskResult;
      setResult(data);
      setNotice(`风险评估完成：${data.decision.toUpperCase()} (score ${data.score})`);

      const historyResponse = await fetch("/api/trading/risk/history?limit=8", {
        method: "GET",
        cache: "no-store"
      });
      if (historyResponse.ok) {
        const historyData = (await historyResponse.json()) as TradingRiskHistoryResponse;
        setHistory(historyData.items);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown risk evaluation error.";
      setNotice(`评估失败：${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  const decisionMeta = result ? decisionStyle(result.decision) : null;
  const DecisionIcon = decisionMeta?.icon;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Input value={form.symbol} onChange={(event) => updateField("symbol", event.target.value)} placeholder="Symbol" />

        <select
          value={form.side}
          onChange={(event) => updateField("side", event.target.value as TradingSide)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>

        <Input value={form.leverage} onChange={(event) => updateField("leverage", event.target.value)} placeholder="Leverage" />
        <Input value={form.notionalUsd} onChange={(event) => updateField("notionalUsd", event.target.value)} placeholder="Notional USD" />
        <Input
          value={form.accountEquityUsd}
          onChange={(event) => updateField("accountEquityUsd", event.target.value)}
          placeholder="Account Equity USD"
        />
        <Input
          value={form.stopLossPercent}
          onChange={(event) => updateField("stopLossPercent", event.target.value)}
          placeholder="Stop-loss %"
        />
        <Input
          value={form.currentExposurePercent}
          onChange={(event) => updateField("currentExposurePercent", event.target.value)}
          placeholder="Current Exposure %"
        />
        <Input
          value={form.dailyLossPercent}
          onChange={(event) => updateField("dailyLossPercent", event.target.value)}
          placeholder="Daily Loss %"
        />
      </div>

      <Button onClick={evaluateRisk} disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        评估风险（Trading Tool）
      </Button>

      {config ? (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Policy: {config.policyVersion}</span>
          <span>Max Lev: {config.maxLeverage}x</span>
          <span>Max Risk/Trade: {config.maxRiskPerTradePercent}%</span>
          <span>Max Daily Loss: {config.maxDailyLossPercent}%</span>
          <span>Max Exposure: {config.maxTotalExposurePercent}%</span>
        </div>
      ) : null}

      {notice ? (
        <Badge variant="outline" className="max-w-full break-all py-1">
          {notice}
        </Badge>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-lg border bg-background/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {DecisionIcon ? <DecisionIcon className="h-4 w-4" /> : null}
            <Badge variant="outline" className={decisionMeta?.className}>
              {result.decision}
            </Badge>
            <span className="text-sm">score: {result.score}</span>
          </div>

          <div className="text-xs text-muted-foreground">
            Proposed Exposure: {result.metrics.proposedExposurePercent}% | Resulting Exposure: {result.metrics.resultingExposurePercent}% | Risk/Trade: {result.metrics.riskPerTradePercent}%
          </div>

          <div className="space-y-2">
            {result.rules.map((rule) => (
              <div key={rule.id} className="rounded-md border p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{rule.label}</span>
                  <Badge variant="outline">{rule.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{rule.message}</p>
              </div>
            ))}
          </div>

          {result.recommendations.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recommendations</p>
              <div className="space-y-1 text-sm">
                {result.recommendations.map((item) => (
                  <p key={item}>- {item}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2 rounded-lg border bg-background/70 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recent Risk Evaluations</p>
        {history.length === 0 ? <p className="text-sm text-muted-foreground">暂无历史评估记录</p> : null}
        {history.map((entry) => (
          <div key={entry.id} className="rounded-md border p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{entry.decision}</Badge>
                <span className="text-sm font-medium">
                  {entry.symbol} {entry.side.toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">score {entry.score}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{entry.summary}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {new Date(entry.createdAt).toLocaleString("zh-CN", { hour12: false })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}