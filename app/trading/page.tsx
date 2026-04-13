import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrentTradingBoard } from "@/components/dashboard/current-trading-board";
import { StrategyStudio } from "@/components/dashboard/strategy-studio";
import { RiskControlPanel } from "@/components/trading/risk-control-panel";
import { SandboxReplayPanel } from "@/components/trading/sandbox-replay-panel";
import { CandlestickChart, WalletCards, GitCommitHorizontal, TrendingUp } from "lucide-react";

export default function TradingPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Trading Management</h1>
        <p className="mt-2 text-muted-foreground">
          从策略输入到执行验证的全链路视图
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
          <CardTitle>策略执行中心</CardTitle>
          <CardDescription>输入策略想法后自动完成记录与执行</CardDescription>
        </CardHeader>
        <CardContent>
          <StrategyStudio />
        </CardContent>
      </Card>

      <CurrentTradingBoard />

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
