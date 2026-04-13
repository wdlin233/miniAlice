import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "智能对话 - MiniAlice",
  description: "文件驱动 AI 交易代理对话界面"
};

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1500px]">
        {children}
      </div>
    </div>
  );
}
