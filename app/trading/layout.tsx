import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Trading - MiniAlice",
  description: "File-driven AI trading agent trading management"
};

export default function TradingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
