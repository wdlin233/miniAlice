import Link from "next/link";
import { Activity, ArrowRight, Clock3, TrendingUp, type LucideIcon } from "lucide-react";

import { BrowserPanel } from "@/components/dashboard/browser-panel";
import { Button } from "@/components/ui/button";
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
          <CardTitle className="text-xl">投资组合总览</CardTitle>
          <CardDescription>面向交易行为展示，不暴露底层执行细节。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="AI 会话数"
            value={String(sessions.length)}
            hint="策略讨论与历史上下文"
            icon={Activity}
          />
          <StatCard
            title="活跃订单"
            value={String(activeOrders.length)}
            hint="当前处于已提交状态的订单"
            icon={TrendingUp}
          />
          <StatCard
            title="组合敞口"
            value={`$${totalExposure.toFixed(2)}`}
            hint="按 notional 汇总的风险敞口"
            icon={TrendingUp}
          />
          <StatCard
            title="最新执行"
            value={latestExecution?.symbol ?? "暂无"}
            hint={latestExecution?.createdAt ?? (commits[0]?.createdAt ?? "暂无执行记录")}
            icon={Clock3}
          />
        </CardContent>
      </Card>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">执行入口</CardTitle>
          <CardDescription>策略执行与交易看板已集中到交易管理页，投资组合页仅保留总览视角。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/trading">
              进入交易管理
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/chat">进入智能对话</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">市场浏览器</CardTitle>
          <CardDescription>客户端异步读取虚拟行情与资讯，避免阻塞首页首屏</CardDescription>
        </CardHeader>
        <CardContent>
          <BrowserPanel initialMarketSnapshot={null} initialNewsSnapshot={null} />
        </CardContent>
      </Card>
    </section>
  );
}
