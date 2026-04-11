import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dashboard - MiniAlice",
  description: "File-driven AI trading agent dashboard"
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
