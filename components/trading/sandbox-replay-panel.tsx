"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SandboxTradingReplayResult } from "@/lib/schemas/trading";

interface SandboxCreateResponse {
  success: boolean;
  data?: {
    sandboxId: string;
    playheadTime: string;
  };
  error?: string;
}

interface ReplayErrorResponse {
  error?: string;
}

export function SandboxReplayPanel() {
  const [sandboxId, setSandboxId] = useState("");
  const [limit, setLimit] = useState("20");
  const [result, setResult] = useState<SandboxTradingReplayResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);

  async function createSandbox() {
    setIsCreating(true);
    setNotice(null);

    try {
      const response = await fetch("/api/sandbox?action=create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      const data = (await response.json()) as SandboxCreateResponse;
      if (!response.ok || !data.success || !data.data?.sandboxId) {
        throw new Error(data.error ?? "Failed to create sandbox.");
      }

      setSandboxId(data.data.sandboxId);
      setNotice(`Sandbox 已创建：${data.data.sandboxId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sandbox create error.";
      setNotice(`创建失败：${message}`);
    } finally {
      setIsCreating(false);
    }
  }

  async function replayValidation() {
    const normalizedSandboxId = sandboxId.trim();
    if (!normalizedSandboxId) {
      setNotice("请先输入 sandboxId");
      return;
    }

    setIsReplaying(true);
    setNotice(null);

    try {
      const response = await fetch("/api/sandbox/replay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sandboxId: normalizedSandboxId,
          limit: Number(limit)
        })
      });

      if (!response.ok) {
        const error = (await response.json()) as ReplayErrorResponse;
        throw new Error(error.error ?? "Replay failed.");
      }

      const data = (await response.json()) as SandboxTradingReplayResult;
      setResult(data);
      setNotice(`回放完成：匹配 ${data.matched}/${data.total}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown replay error.";
      setNotice(`回放失败：${message}`);
    } finally {
      setIsReplaying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
        回放范围为 <code>data/trading/orders.jsonl</code> 中创建时间早于 playheadTime、且带有{" "}
        <code>riskRequest</code> 的订单。
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input
          value={sandboxId}
          onChange={(event) => setSandboxId(event.target.value)}
          placeholder="sandboxId"
        />
        <Input
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          placeholder="回放条数"
        />
        <div className="flex gap-2">
          <Button onClick={createSandbox} disabled={isCreating} variant="secondary" className="w-full">
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            创建 Sandbox
          </Button>
          <Button onClick={replayValidation} disabled={isReplaying} className="w-full">
            {isReplaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            回放验证
          </Button>
        </div>
      </div>

      {notice ? (
        <Badge variant="outline" className="max-w-full break-all py-1">
          {notice}
        </Badge>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-lg border bg-background/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">sandbox: {result.sandboxId}</Badge>
            <Badge variant="outline">playhead: {new Date(result.playheadTime).toLocaleString()}</Badge>
          </div>

          <div className="text-sm text-muted-foreground">
            Total: {result.total} | Matched: {result.matched} | Mismatched: {result.mismatched}
          </div>

          {result.total === 0 ? (
            <p className="text-xs text-muted-foreground">当前时间点之前没有可回放订单。</p>
          ) : null}

          <div className="space-y-2">
            {result.items.map((item) => (
              <div key={item.orderId} className="rounded-md border p-2">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{item.symbol}</Badge>
                  <Badge variant="outline">{item.side}</Badge>
                  <Badge
                    variant="outline"
                    className={item.match ? "border-emerald-500 text-emerald-600" : "border-destructive text-destructive"}
                  >
                    {item.match ? "match" : "mismatch"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  original: {item.originalDecision}({item.originalScore}) | replayed: {item.replayedDecision}({item.replayedScore})
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
