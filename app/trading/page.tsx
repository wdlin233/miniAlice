import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrentTradingBoard } from "@/components/dashboard/current-trading-board";
import { StrategyStudio } from "@/components/dashboard/strategy-studio";
import { PaperTradingPanel } from "@/components/trading/paper-trading-panel";
import { RiskControlPanel } from "@/components/trading/risk-control-panel";
import { SandboxReplayPanel } from "@/components/trading/sandbox-replay-panel";

export default function TradingPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">交易管理</h1>
        <p className="mt-2 text-muted-foreground">策略、模拟盘、风控与回放记录。</p>
      </div>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>模拟盘交易</CardTitle>
          <CardDescription>按本地虚拟行情更新持仓、成交与账户状态。</CardDescription>
        </CardHeader>
        <CardContent>
          <PaperTradingPanel />
        </CardContent>
      </Card>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>策略执行中心</CardTitle>
          <CardDescription>记录策略输入与执行结果。</CardDescription>
        </CardHeader>
        <CardContent>
          <StrategyStudio />
        </CardContent>
      </Card>

      <CurrentTradingBoard />

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>交易工具风控策略</CardTitle>
          <CardDescription>按当前规则评估下单请求。</CardDescription>
        </CardHeader>
        <CardContent>
          <RiskControlPanel />
        </CardContent>
      </Card>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>沙箱回放风控验证</CardTitle>
          <CardDescription>按 sandbox 时间点回放历史风控结果。</CardDescription>
        </CardHeader>
        <CardContent>
          <SandboxReplayPanel />
        </CardContent>
      </Card>
    </div>
  );
}
