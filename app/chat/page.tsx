import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat - MiniAlice",
  description: "File-driven AI trading agent chat interface"
};

import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Chat</h1>
        <p className="mt-2 text-muted-foreground">
          Session 将以 JSONL 追加写入 data/sessions
        </p>
      </div>
      
      <div className="animate-fade-in-up">
        <ChatPanel />
      </div>
    </div>
  );
}
