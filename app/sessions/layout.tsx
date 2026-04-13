import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "会话管理 - MiniAlice",
  description: "文件驱动 AI 交易代理会话管理"
};

export default function SessionsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
