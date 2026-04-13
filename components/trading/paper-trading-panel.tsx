"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaperAccountResponse, PaperOrderResponse } from "@/lib/schemas/paper-trading";
import type { TradingSide } from "@/lib/schemas/trading";

interface ApiError {
  error?: string;
}

interface SnapshotState {
  account: PaperAccountResponse["account"];
  recentTrades: PaperAccountResponse["recentTrades"];
  marketErrors: string[];
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatQty(value: number): string {
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    timeZone: "Asia/Shanghai"
  });
}

function sideLabel(side: TradingSide): string {
  return side === "buy" ? "买入" : "卖出";
}

function pnlClass(value: number): string {
  return value >= 0 ? "text-red-600" : "text-emerald-600";
}

export function PaperTradingPanel() {
  const [snapshot, setSnapshot] = useState<SnapshotState | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<TradingSide>("buy");
  const [quantity, setQuantity] = useState("0.01");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshAccount() {
    setIsLoading(true);
    setNotice(null);

    try {
      const response = await fetch("/api/paper/account?limit=20", {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.error ?? "读取模拟盘账户失败。");
      }

      const data = (await response.json()) as PaperAccountResponse;
      setSnapshot({
        account: data.account,
        recentTrades: data.recentTrades,
        marketErrors: data.marketErrors
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取账户时发生未知错误。";
      setNotice(`加载失败：${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshAccount();
  }, []);

  async function submitOrder() {
    if (isSubmitting) {
      return;
    }

    const normalizedSymbol = symbol.trim().toUpperCase();
    const parsedQuantity = Number(quantity);

    if (!normalizedSymbol) {
      setNotice("请输入交易对，例如 BTCUSDT。");
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setNotice("请输入有效数量。数量必须大于 0。");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/paper/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          symbol: normalizedSymbol,
          side,
          quantity: parsedQuantity
        })
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.error ?? "模拟盘下单失败。");
      }

      const data = (await response.json()) as PaperOrderResponse;

      setSnapshot((prev) => ({
        account: data.account,
        recentTrades: [data.trade, ...(prev?.recentTrades ?? [])].slice(0, 20),
        marketErrors: data.marketErrors
      }));

      setNotice(
        `${sideLabel(data.trade.side)} 成功：${data.trade.symbol} x ${formatQty(data.trade.quantity)}，成交价 ${formatUsd(data.trade.priceUsd)}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "下单时发生未知错误。";
      setNotice(`下单失败：${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const account = snapshot?.account;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1.2fr_auto_1fr_auto_auto]">
        <Input
          value={symbol}
          onChange={(event) => setSymbol(event.target.value)}
          placeholder="交易对，例如 BTCUSDT"
          disabled={isSubmitting}
        />

        <select
          value={side}
          onChange={(event) => setSide(event.target.value as TradingSide)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          disabled={isSubmitting}
        >
          <option value="buy">买入</option>
          <option value="sell">卖出</option>
        </select>

        <Input
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="数量，例如 0.01"
          disabled={isSubmitting}
        />

        <Button onClick={submitOrder} disabled={isSubmitting || isLoading}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          执行{side === "buy" ? "买入" : "卖出"}
        </Button>

        <Button onClick={refreshAccount} variant="secondary" disabled={isSubmitting || isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          刷新
        </Button>
      </div>

      {notice ? (
        <Badge variant="outline" className="max-w-full break-all py-1">
          {notice}
        </Badge>
      ) : null}

      {snapshot?.marketErrors && snapshot.marketErrors.length > 0 ? (
        <Badge variant="outline" className="max-w-full break-all py-1 text-amber-700 border-amber-500">
          行情提示：{snapshot.marketErrors.join("; ")}
        </Badge>
      ) : null}

      {account ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">账户权益</p>
              <p className="text-xl font-semibold">{formatUsd(account.equityUsd)}</p>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">可用资金</p>
              <p className="text-xl font-semibold">{formatUsd(account.cashUsd)}</p>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">已实现盈亏</p>
              <p className={`text-xl font-semibold ${pnlClass(account.realizedPnlUsd)}`}>
                {account.realizedPnlUsd >= 0 ? "+" : ""}
                {formatUsd(account.realizedPnlUsd)}
              </p>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">未实现盈亏</p>
              <p className={`text-xl font-semibold ${pnlClass(account.unrealizedPnlUsd)}`}>
                {account.unrealizedPnlUsd >= 0 ? "+" : ""}
                {formatUsd(account.unrealizedPnlUsd)}
              </p>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">累计盈亏</p>
              <p className={`text-xl font-semibold ${pnlClass(account.totalPnlUsd)}`}>
                {account.totalPnlUsd >= 0 ? "+" : ""}
                {formatUsd(account.totalPnlUsd)}
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-background/70 p-4">
            <p className="text-sm font-medium">当前持仓</p>
            {account.positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">当前没有持仓。</p>
            ) : (
              <div className="space-y-2">
                {account.positions.map((position) => (
                  <div key={position.symbol} className="rounded-md border p-3">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{position.symbol}</Badge>
                        <span className="text-sm">数量 {formatQty(position.quantity)}</span>
                      </div>
                      <span className={`text-sm font-medium ${pnlClass(position.unrealizedPnlUsd)}`}>
                        未实现 {position.unrealizedPnlUsd >= 0 ? "+" : ""}
                        {formatUsd(position.unrealizedPnlUsd)} ({position.unrealizedPnlPercent >= 0 ? "+" : ""}
                        {position.unrealizedPnlPercent.toFixed(2)}%)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      成本 {formatUsd(position.averageEntryPriceUsd)} | 最新价 {formatUsd(position.lastPriceUsd)} | 市值 {formatUsd(position.marketValueUsd)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border bg-background/70 p-4">
            <p className="text-sm font-medium">最近成交</p>
            {snapshot.recentTrades.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无成交记录。</p>
            ) : (
              <div className="space-y-2">
                {snapshot.recentTrades.map((trade) => (
                  <div key={trade.id} className="rounded-md border p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{trade.symbol}</Badge>
                      <Badge variant="outline">{sideLabel(trade.side)}</Badge>
                      <Badge variant="outline">{formatQty(trade.quantity)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      成交价 {formatUsd(trade.priceUsd)} | 金额 {formatUsd(trade.notionalUsd)} | 手续费 {formatUsd(trade.feeUsd)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatTime(trade.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载模拟盘账户...
        </div>
      )}
    </div>
  );
}
