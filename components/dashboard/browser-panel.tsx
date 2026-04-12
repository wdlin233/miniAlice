"use client";

import { useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  BrowserCombinedSnapshot,
  BrowserMarketSnapshot,
  BrowserNewsSnapshot,
  BrowserNewsSource
} from "@/lib/schemas/browser";

interface BrowserPanelProps {
  initialMarketSnapshot: BrowserMarketSnapshot | null;
  initialNewsSnapshot: BrowserNewsSnapshot | null;
}

interface BrowserRefreshError {
  error?: string;
}

const newsSourceOptions: Array<{ value: BrowserNewsSource; label: string }> = [
  { value: "cryptocompare", label: "CryptoCompare" },
  { value: "reddit", label: "Reddit /r/CryptoCurrency" }
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown refresh error.";
}

export function BrowserPanel({ initialMarketSnapshot, initialNewsSnapshot }: BrowserPanelProps) {
  const [marketSnapshot, setMarketSnapshot] = useState<BrowserMarketSnapshot | null>(initialMarketSnapshot);
  const [newsSnapshot, setNewsSnapshot] = useState<BrowserNewsSnapshot | null>(initialNewsSnapshot);
  const [newsSource, setNewsSource] = useState<BrowserNewsSource>(initialNewsSnapshot?.source ?? "cryptocompare");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshBrowserSnapshot() {
    setIsRefreshing(true);
    setNotice(null);

    try {
      const response = await fetch("/api/browser/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ source: newsSource, limit: 4 })
      });

      if (!response.ok) {
        const errorData = (await response.json()) as BrowserRefreshError;
        throw new Error(errorData.error ?? "Browser refresh failed.");
      }

      const data = (await response.json()) as BrowserCombinedSnapshot;
      setMarketSnapshot(data.market);
      setNewsSnapshot(data.news);
      setNotice(`Browser 已刷新：${new Date(data.refreshedAt).toLocaleTimeString()}`);
    } catch (error) {
      setNotice(`刷新失败：${getErrorMessage(error)}`);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={newsSource}
          onChange={(event) => setNewsSource(event.target.value as BrowserNewsSource)}
          className="h-10 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
          disabled={isRefreshing}
        >
          {newsSourceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <Button onClick={refreshBrowserSnapshot} disabled={isRefreshing} variant="secondary">
          {isRefreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          手动刷新
        </Button>
      </div>

      {notice ? (
        <Badge variant="outline" className="max-w-full break-all py-1">
          {notice}
        </Badge>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Market Snapshot</p>
          {marketSnapshot && marketSnapshot.quotes.length > 0 ? (
            <div className="space-y-2">
              {marketSnapshot.quotes.map((quote) => (
                <div key={quote.symbol} className="rounded-lg border bg-background/70 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Badge variant="outline">{quote.symbol}</Badge>
                    <span
                      className={`text-xs font-semibold ${quote.changePercent24h >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {quote.changePercent24h.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-sm">Price: {quote.price.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    H/L: {quote.high24h.toFixed(2)} / {quote.low24h.toFixed(2)}
                  </p>
                </div>
              ))}
              {marketSnapshot.errors.length > 0 ? (
                <p className="text-xs text-muted-foreground">部分行情源失败：{marketSnapshot.errors.join("; ")}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无可用行情数据。</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            News Feed ({newsSnapshot?.source ?? newsSource})
          </p>
          {newsSnapshot && newsSnapshot.items.length > 0 ? (
            <div className="space-y-2">
              {newsSnapshot.items.map((item) => (
                <a
                  key={`${item.url}-${item.publishedAt}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border bg-background/70 p-3 transition hover:bg-background"
                >
                  <p className="text-sm font-medium leading-5">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.source} · {new Date(item.publishedAt).toLocaleString()}
                  </p>
                </a>
              ))}
              {newsSnapshot.errors.length > 0 ? (
                <p className="text-xs text-muted-foreground">资讯源提示：{newsSnapshot.errors.join("; ")}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无可用资讯数据。</p>
          )}
        </div>
      </div>
    </div>
  );
}