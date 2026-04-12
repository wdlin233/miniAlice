import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskControlPanel } from "@/components/trading/risk-control-panel";
import { SandboxReplayPanel } from "@/components/trading/sandbox-replay-panel";
import { CandlestickChart, WalletCards, GitCommitHorizontal, TrendingUp } from "lucide-react";

export default function TradingPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Trading Management</h1>
        <p className="mt-2 text-muted-foreground">
          交易流程管理与风控策略
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Wallet Balance</CardTitle>
            <CardDescription>当前钱包余额</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold">$10,000.00</p>
                <p className="mt-1 text-xs text-green-500">+2.5% today</p>
              </div>
              <WalletCards className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Active Positions</CardTitle>
            <CardDescription>活跃持仓</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold">5</p>
                <p className="mt-1 text-xs text-muted-foreground">BTC, ETH, SOL, ADA, DOGE</p>
              </div>
              <CandlestickChart className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">今日交易</CardTitle>
            <CardDescription>今日交易次数</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold">12</p>
                <p className="mt-1 text-xs text-muted-foreground">7 买 5 卖</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">今日收益</CardTitle>
            <CardDescription>今日盈亏</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-green-500">+$250.00</p>
                <p className="mt-1 text-xs text-muted-foreground">+2.5%</p>
              </div>
              <GitCommitHorizontal className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>交易流程</CardTitle>
          <CardDescription>add &gt; commit &gt; push</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">add</Badge>
              <span className="text-sm text-muted-foreground">staging.json</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">commit</Badge>
              <span className="text-sm text-muted-foreground">wallet/commits/*.json</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-accent text-accent-foreground">push</Badge>
              <span className="text-sm text-muted-foreground">执行交易</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button className="w-full">添加交易</Button>
            <Button variant="secondary" className="w-full">提交交易</Button>
            <Button variant="accent" className="w-full">执行交易</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>Trading Tool 风险控制策略</CardTitle>
          <CardDescription>对下单意图执行规则化风险评估（tool=trading）</CardDescription>
        </CardHeader>
        <CardContent>
          <RiskControlPanel />
        </CardContent>
      </Card>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>Sandbox 回放风控验证</CardTitle>
          <CardDescription>在 sandbox playheadTime 下回放 Trading 风控决策一致性</CardDescription>
        </CardHeader>
        <CardContent>
          <SandboxReplayPanel />
        </CardContent>
      </Card>
    </div>
  );
}
