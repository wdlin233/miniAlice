"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaperAccountResponse, PaperOrderResponse, PaperTradeTrigger } from "@/lib/schemas/paper-trading";
import type { TradingSide } from "@/lib/schemas/trading";

type OrderType = "market" | "limit";

interface ApiError {
  error?: string;
}

interface DemoMarketAdjustResponse {
  ok: boolean;
  symbol: string;
  action: "push" | "pull" | "reset";
  anchorPrice: number;
  quote?: {
    price: number;
  } | null;
}

interface SnapshotState {
  account: PaperAccountResponse["account"];
  pendingOrders: PaperAccountResponse["pendingOrders"];
  recentTrades: PaperAccountResponse["recentTrades"];
  marketErrors: string[];
  events: string[];
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatSignedUsd(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatUsd(Math.abs(value))}`;
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

function orderTypeLabel(orderType: OrderType): string {
  return orderType === "market" ? "市价" : "限价";
}

function triggerLabel(trigger: PaperTradeTrigger): string {
  if (trigger === "manual") {
    return "手动下单";
  }

  if (trigger === "limit") {
    return "限价触发";
  }

  if (trigger === "take_profit") {
    return "止盈触发";
  }

  if (trigger === "stop_loss") {
    return "止损触发";
  }

  return "未知触发";
}

function pnlClass(value: number): string {
  return value >= 0 ? "text-red-600" : "text-emerald-600";
}

function pnlSurfaceClass(): string {
  return "border-border bg-background/70";
}

function statSurfaceClass(kind: "neutral" | "pnl"): string {
  if (kind === "pnl") {
    return pnlSurfaceClass();
  }

  return "border-border bg-background/70";
}

interface MetricCardProps {
  title: string;
  value: string;
  hint: string;
  tone?: "neutral" | "pnl";
  numericValue?: number;
  emphasize?: boolean;
}

function MetricCard({
  title,
  value,
  hint,
  tone = "neutral",
  numericValue = 0,
  emphasize = false
}: MetricCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${statSurfaceClass(tone)}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p
        className={`mt-2 font-semibold ${tone === "pnl" ? pnlClass(numericValue) : ""} ${
          emphasize ? "text-2xl md:text-3xl" : "text-xl"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function PaperTradingPanel() {
  const [snapshot, setSnapshot] = useState<SnapshotState | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<TradingSide>("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [quantity, setQuantity] = useState("0.01");
  const [limitPrice, setLimitPrice] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdjustingDemo, setIsAdjustingDemo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshAccount(options?: { keepNotice?: boolean }) {
    setIsLoading(true);
    if (!options?.keepNotice) {
      setNotice(null);
    }

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
        pendingOrders: data.pendingOrders,
        recentTrades: data.recentTrades,
        marketErrors: data.marketErrors,
        events: data.events
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

    const parsedLimitPrice = Number(limitPrice);
    if (orderType === "limit" && (!Number.isFinite(parsedLimitPrice) || parsedLimitPrice <= 0)) {
      setNotice("限价单必须填写有效的限价价格。");
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
          orderType,
          quantity: parsedQuantity,
          limitPriceUsd: orderType === "limit" ? parsedLimitPrice : undefined,
          takeProfitPriceUsd: Number.isFinite(Number(takeProfitPrice)) && Number(takeProfitPrice) > 0 ? Number(takeProfitPrice) : undefined,
          stopLossPriceUsd: Number.isFinite(Number(stopLossPrice)) && Number(stopLossPrice) > 0 ? Number(stopLossPrice) : undefined
        })
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.error ?? "模拟盘下单失败。");
      }

      const data = (await response.json()) as PaperOrderResponse;
      await refreshAccount({ keepNotice: true });
      setNotice(data.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "下单时发生未知错误。";
      setNotice(`下单失败：${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function adjustDemoBtc(action: DemoMarketAdjustResponse["action"]) {
    setIsAdjustingDemo(true);
    setNotice(null);

    try {
      const response = await fetch("/api/paper/demo-market", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          symbol: "BTCUSDT",
          action,
          percent: 6
        })
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.error ?? "演示行情调整失败。");
      }

      const data = (await response.json()) as DemoMarketAdjustResponse;
      await refreshAccount({ keepNotice: true });
      const latestPrice = data.quote?.price ? `，现价 ${formatUsd(data.quote.price)}` : "";
      const actionLabel =
        action === "push" ? "推高" : action === "pull" ? "压低" : "重置";
      setNotice(`BTC 已${actionLabel}，锚点价 ${formatUsd(data.anchorPrice)}${latestPrice}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "调整演示行情时发生未知错误。";
      setNotice(`演示行情调整失败：${message}`);
    } finally {
      setIsAdjustingDemo(false);
    }
  }

  const account = snapshot?.account;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Badge variant="outline" className="max-w-full break-all border-sky-500 py-1 text-sky-700">
          本页使用本地虚拟行情。
        </Badge>

        <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground/45 transition hover:text-muted-foreground">
          <span className="mr-1 select-none">校准</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] opacity-70 hover:opacity-100"
            disabled={isSubmitting || isLoading || isAdjustingDemo}
            onClick={() => adjustDemoBtc("pull")}
          >
            BTC -
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] opacity-70 hover:opacity-100"
            disabled={isSubmitting || isLoading || isAdjustingDemo}
            onClick={() => adjustDemoBtc("push")}
          >
            BTC +
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] opacity-50 hover:opacity-100"
            disabled={isSubmitting || isLoading || isAdjustingDemo}
            onClick={() => adjustDemoBtc("reset")}
          >
            复位
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Input
          value={symbol}
          onChange={(event) => setSymbol(event.target.value)}
          placeholder="交易对，例如 BTCUSDT"
          disabled={isSubmitting}
        />

        <select
          value={orderType}
          onChange={(event) => setOrderType(event.target.value as OrderType)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          disabled={isSubmitting}
        >
          <option value="market">市价单</option>
          <option value="limit">限价单</option>
        </select>

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

        <Input
          value={limitPrice}
          onChange={(event) => setLimitPrice(event.target.value)}
          placeholder={orderType === "limit" ? "限价（必填）" : "限价（选填）"}
          disabled={isSubmitting || orderType !== "limit"}
        />

        <Input
          value={takeProfitPrice}
          onChange={(event) => setTakeProfitPrice(event.target.value)}
          placeholder="止盈价（选填）"
          disabled={isSubmitting}
        />

        <Input
          value={stopLossPrice}
          onChange={(event) => setStopLossPrice(event.target.value)}
          placeholder="止损价（选填）"
          disabled={isSubmitting}
        />

        <div className="xl:col-span-2 flex gap-2">
          <Button onClick={submitOrder} disabled={isSubmitting || isLoading}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            执行{side === "buy" ? "买入" : "卖出"}
          </Button>

          <Button onClick={() => refreshAccount()} variant="secondary" disabled={isSubmitting || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            刷新价格
          </Button>
        </div>
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

      {snapshot?.events && snapshot.events.length > 0 ? (
        <Badge variant="outline" className="max-w-full break-all py-1 border-blue-500 text-blue-700">
          触发事件：{snapshot.events.join("; ")}
        </Badge>
      ) : null}

      {account ? (
        <>
          <div className="rounded-xl border bg-background/70 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">盈亏总览</p>
                <p className="text-xs text-muted-foreground">累计盈亏包含已实现、未实现与手续费影响。</p>
              </div>
              <Badge variant="outline">更新于 {formatTime(account.updatedAt)}</Badge>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.25fr,1fr,1fr]">
              <MetricCard
                title="累计盈亏"
                value={formatSignedUsd(account.totalPnlUsd)}
                hint="当前权益相对初始资金的净变化。"
                tone="pnl"
                numericValue={account.totalPnlUsd}
                emphasize
              />
              <MetricCard
                title="已实现盈亏"
                value={formatSignedUsd(account.realizedPnlUsd)}
                hint="只统计已经卖出或平仓确认的结果。"
                tone="pnl"
                numericValue={account.realizedPnlUsd}
              />
              <MetricCard
                title="未实现盈亏"
                value={formatSignedUsd(account.unrealizedPnlUsd)}
                hint="持仓按当前价格估值后的浮动盈亏。"
                tone="pnl"
                numericValue={account.unrealizedPnlUsd}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="账户权益" value={formatUsd(account.equityUsd)} hint="现金 + 持仓市值" />
            <MetricCard title="可用资金" value={formatUsd(account.cashUsd)} hint="账户现金余额" />
            <MetricCard title="持仓数量" value={String(account.positions.length)} hint="持仓中的交易对数量" />
            <MetricCard title="累计手续费" value={formatUsd(account.feePaidUsd)} hint="累计成交手续费" />
            <MetricCard title="初始资金" value={formatUsd(account.initialBalanceUsd)} hint="模拟盘起始金额" />
          </div>

          <div className="space-y-2 rounded-lg border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">当前持仓</p>
              <p className="text-xs text-muted-foreground">按最新价格重估</p>
            </div>
            {account.positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无持仓。</p>
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
                        未实现 {formatSignedUsd(position.unrealizedPnlUsd)} ({position.unrealizedPnlPercent >= 0 ? "+" : ""}
                        {position.unrealizedPnlPercent.toFixed(2)}%)
                      </span>
                    </div>
                    <div className="grid gap-2 pt-2 text-xs text-muted-foreground md:grid-cols-3">
                      <p>成本价：{formatUsd(position.averageEntryPriceUsd)}</p>
                      <p>最新价：{formatUsd(position.lastPriceUsd)}</p>
                      <p>持仓市值：{formatUsd(position.marketValueUsd)}</p>
                      <p>{position.takeProfitPriceUsd ? `止盈：${formatUsd(position.takeProfitPriceUsd)}` : "止盈：未设置"}</p>
                      <p>{position.stopLossPriceUsd ? `止损：${formatUsd(position.stopLossPriceUsd)}` : "止损：未设置"}</p>
                      <p>更新时间：{formatTime(position.updatedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">限价挂单</p>
              <p className="text-xs text-muted-foreground">等待价格触发</p>
            </div>
            {snapshot.pendingOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无挂单。</p>
            ) : (
              <div className="space-y-2">
                {snapshot.pendingOrders.map((order) => (
                  <div key={order.id} className="rounded-md border p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{order.symbol}</Badge>
                      <Badge variant="outline">{orderTypeLabel("limit")}</Badge>
                      <Badge variant="outline">{sideLabel(order.side)}</Badge>
                      <Badge variant="outline">数量 {formatQty(order.quantity)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      限价 {formatUsd(order.limitPriceUsd)}
                      {order.takeProfitPriceUsd ? ` | 止盈 ${formatUsd(order.takeProfitPriceUsd)}` : ""}
                      {order.stopLossPriceUsd ? ` | 止损 ${formatUsd(order.stopLossPriceUsd)}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatTime(order.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">最近成交</p>
              <p className="text-xs text-muted-foreground">按时间倒序显示</p>
            </div>
            {snapshot.recentTrades.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无成交记录。</p>
            ) : (
              <div className="space-y-2">
                {snapshot.recentTrades.map((trade) => (
                  <div key={trade.id} className="rounded-md border p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{trade.symbol}</Badge>
                      <Badge variant="outline">{orderTypeLabel(trade.orderType)}</Badge>
                      <Badge variant="outline">{sideLabel(trade.side)}</Badge>
                      <Badge variant="outline">{triggerLabel(trade.trigger)}</Badge>
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
