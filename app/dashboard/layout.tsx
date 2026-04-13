import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "投资组合 - MiniAlice",
  description: "文件驱动 AI 交易代理投资组合总览"
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1500px]">
        {children}
      </div>
    </div>
  );
}
