import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "智能对话 - MiniAlice",
  description: "文件驱动 AI 交易代理对话界面"
};

import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">智能对话</h1>
        <p className="mt-2 text-muted-foreground">
          会话将以 JSONL 形式追加写入 data/sessions
        </p>
      </div>
      
      <div className="animate-fade-in-up">
        <ChatPanel />
      </div>
    </div>
  );
}
