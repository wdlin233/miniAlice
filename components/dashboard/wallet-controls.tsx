"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UploadCloud, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type WalletAction = "add" | "commit" | "push";

interface WalletControlsProps {
  initialStagingSummary: string;
  initialStagingFiles: string[];
  initialLatestHash?: string;
}

interface WalletResponse {
  action?: WalletAction;
  error?: string;
  commit?: {
    hash: string;
    stage: "commit" | "push";
  };
  draft?: {
    files: string[];
  };
}

function parseFiles(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function WalletControls({
  initialStagingSummary,
  initialStagingFiles,
  initialLatestHash
}: WalletControlsProps) {
  const router = useRouter();

  const [summary, setSummary] = useState(initialStagingSummary);
  const [filesText, setFilesText] = useState(initialStagingFiles.join("\n"));
  const [hash, setHash] = useState(initialLatestHash ?? "");
  const [loadingAction, setLoadingAction] = useState<WalletAction | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function requestWallet(action: WalletAction, payload?: Record<string, unknown>) {
    const response = await fetch(`/api/wallet/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: payload ? JSON.stringify(payload) : undefined
    });

    const data = (await response.json()) as WalletResponse;
    if (!response.ok) {
      throw new Error(data.error ?? `${action} failed.`);
    }

    return data;
  }

  async function onAdd() {
    setLoadingAction("add");
    setNotice(null);

    try {
      const files = parseFiles(filesText);
      const data = await requestWallet("add", { summary, files });
      setNotice({ tone: "ok", text: `Add 成功，已暂存 ${data.draft?.files.length ?? files.length} 个文件。` });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Add failed.";
      setNotice({ tone: "error", text: message });
    } finally {
      setLoadingAction(null);
    }
  }

  async function onCommit() {
    setLoadingAction("commit");
    setNotice(null);

    try {
      const data = await requestWallet("commit");
      if (data.commit?.hash) {
        setHash(data.commit.hash);
      }
      setNotice({
        tone: "ok",
        text: `Commit 成功，hash: ${data.commit?.hash ?? "unknown"}`
      });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Commit failed.";
      setNotice({ tone: "error", text: message });
    } finally {
      setLoadingAction(null);
    }
  }

  async function onPush() {
    setLoadingAction("push");
    setNotice(null);

    try {
      const data = await requestWallet("push", { hash });
      setNotice({
        tone: "ok",
        text: `Push 成功，已更新 ${data.commit?.hash ?? hash}。`
      });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push failed.";
      setNotice({ tone: "error", text: message });
    } finally {
      setLoadingAction(null);
    }
  }

  const isLoading = loadingAction !== null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Add</p>
        <Input
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="例如：rebalance btc exposure"
          disabled={isLoading}
        />
        <Textarea
          value={filesText}
          onChange={(event) => setFilesText(event.target.value)}
          placeholder={"每行一个文件路径，例如:\norders/btc-2026-04-11.json\nrisk/limits.json"}
          className="min-h-[92px]"
          disabled={isLoading}
        />
        <Button onClick={onAdd} disabled={isLoading} className="w-full sm:w-auto">
          {loadingAction === "add" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <WalletCards className="mr-2 h-4 w-4" />
          )}
          执行 Add
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onCommit} disabled={isLoading} variant="secondary">
          {loadingAction === "commit" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          执行 Commit
        </Button>

        <Input
          value={hash}
          onChange={(event) => setHash(event.target.value)}
          placeholder="8 位 hash"
          className="max-w-[180px]"
          disabled={isLoading}
        />

        <Button onClick={onPush} disabled={isLoading} variant="accent">
          {loadingAction === "push" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="mr-2 h-4 w-4" />
          )}
          执行 Push
        </Button>
      </div>

      {notice ? (
        <Badge variant={notice.tone === "ok" ? "secondary" : "outline"} className="max-w-full break-all py-1">
          {notice.text}
        </Badge>
      ) : null}
    </div>
  );
}