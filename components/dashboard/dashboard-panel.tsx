import { Activity, Clock3, TrendingUp, type LucideIcon } from "lucide-react";

import { BrowserPanel } from "@/components/dashboard/browser-panel";
import { CurrentTradingBoard } from "@/components/dashboard/current-trading-board";
import { StrategyStudio } from "@/components/dashboard/strategy-studio";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listSessions } from "@/lib/storage/sessions";
import { listTradingOrders } from "@/lib/storage/trading-orders";
import { listTradingWalletPushExecutions } from "@/lib/storage/trading-wallet-link";
import { listWalletCommits } from "@/lib/storage/wallet";

interface StatCardProps {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

function StatCard({ title, value, hint, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-2xl border bg-background/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export async function DashboardPanel() {
  const [sessions, commits, orders, executions] = await Promise.all([
    listSessions(),
    listWalletCommits(),
    listTradingOrders({ limit: 120 }),
    listTradingWalletPushExecutions(20)
  ]);

  const activeOrders = orders.filter((order) => order.status === "submitted");
  const totalExposure = activeOrders.reduce((sum, order) => sum + order.notionalUsd, 0);
  const latestExecution = executions[0];

  return (
    <section className="grid gap-4 animate-fade-in-up">
      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle className="text-xl">Portfolio Overview</CardTitle>
          <CardDescription>面向交易行为展示，不暴露底层执行细节。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="AI Sessions"
            value={String(sessions.length)}
            hint="策略讨论与历史上下文"
            icon={Activity}
          />
          <StatCard
            title="Active Orders"
            value={String(activeOrders.length)}
            hint="当前处于 submitted 的订单"
            icon={TrendingUp}
          />
          <StatCard
            title="Portfolio Exposure"
            value={`$${totalExposure.toFixed(2)}`}
            hint="按 notional 汇总的风险敞口"
            icon={TrendingUp}
          />
          <StatCard
            title="Latest Execution"
            value={latestExecution?.symbol ?? "N/A"}
            hint={latestExecution?.createdAt ?? (commits[0]?.createdAt ?? "暂无执行记录")}
            icon={Clock3}
          />
        </CardContent>
      </Card>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Strategy Studio</CardTitle>
          <CardDescription>输入策略想法，系统自动完成策略记录与执行流水。</CardDescription>
        </CardHeader>
        <CardContent>
          <StrategyStudio />
        </CardContent>
      </Card>

      <CurrentTradingBoard />

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Browser Tool</CardTitle>
          <CardDescription>客户端异步抓取行情与资讯，避免阻塞 Dashboard 首屏</CardDescription>
        </CardHeader>
        <CardContent>
          <BrowserPanel initialMarketSnapshot={null} initialNewsSnapshot={null} />
        </CardContent>
      </Card>
    </section>
  );
}