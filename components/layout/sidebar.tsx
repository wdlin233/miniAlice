import {
  BrainCircuit,
  CandlestickChart,
  Compass,
  FolderKanban,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ToolItem {
  name: "analysis" | "trading" | "browser";
  description: string;
  icon: LucideIcon;
}

const toolItems: ToolItem[] = [
  { name: "analysis", description: "策略分析与解释", icon: BrainCircuit },
  { name: "trading", description: "交易动作与风控", icon: CandlestickChart },
  { name: "browser", description: "行情与资讯读取", icon: Compass }
];

const moduleItems = ["Dashboard", "Session JSONL", "Wallet Commits", "Sandbox Playhead", "Risk Guard"];

export function Sidebar() {
  return (
    <aside className="animate-fade-in-up">
      <Card className="h-full border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight">MiniAlice</CardTitle>
          <CardDescription>File Driven · Trading-as-Git · Sandbox</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-xl border bg-secondary/40 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current Stage</p>
            <p className="mt-2 text-sm font-medium">Week 1 - Bootstrap</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">Sidebar</Badge>
              <Badge variant="secondary">Chat</Badge>
              <Badge variant="secondary">Dashboard</Badge>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tools</p>
            <ul className="space-y-2">
              {toolItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.name} className="rounded-xl border bg-background/70 px-3 py-2">
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Modules</p>
            <ul className="space-y-2">
              {moduleItems.map((item, idx) => (
                <li key={item} className="flex items-center gap-2 rounded-xl border bg-background/70 px-3 py-2">
                  {idx % 2 === 0 ? (
                    <FolderKanban className="h-4 w-4 text-accent" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}