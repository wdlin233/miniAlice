import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sessions - MiniAlice",
  description: "File-driven AI trading agent session management"
};

export default function SessionsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
