"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

const seedMessages: ChatMessage[] = [
  {
    role: "assistant",
    content: "你好，我是 MiniAlice。输入交易问题后，我会调用 /api/analysis 并写入 data/sessions。"
  }
];

export function ChatPanel() {
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || isLoading) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setDraft("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sessionId, prompt })
      });

      const data = (await response.json()) as { reply?: string; error?: string };
      const reply =
        response.ok && data.reply
          ? data.reply
          : data.error ?? "分析失败，请检查 OPENAI_API_KEY 或服务端日志。";

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setMessages((prev) => [...prev, { role: "assistant", content: `请求异常: ${message}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="flex min-h-[520px] flex-col border-0 bg-card/90 shadow-sm backdrop-blur">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl">Chat</CardTitle>
          <Badge variant="secondary">{sessionId}</Badge>
        </div>
        <CardDescription>Session 将以 JSONL 追加写入 data/sessions</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <div className="h-[320px] space-y-3 overflow-y-auto pr-1">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={[
                "rounded-2xl px-4 py-3 text-sm leading-6",
                message.role === "user"
                  ? "ml-auto max-w-[88%] bg-primary text-primary-foreground"
                  : "max-w-[92%] border bg-background/80"
              ].join(" ")}
            >
              <p className="mb-1 text-[11px] uppercase tracking-[0.2em] opacity-70">{message.role}</p>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter>
        <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="例如：基于 BTC 4H 趋势，给我低杠杆分批建仓计划。"
            className="min-h-[96px] resize-none bg-background/70"
          />
          <Button type="submit" disabled={!draft.trim() || isLoading} className="self-end">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            发送到 Analysis
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}