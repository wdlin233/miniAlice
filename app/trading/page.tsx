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
        <p className="mt-2 text-muted-foreground">
          从策略输入到执行验证的全链路视图
        </p>
      </div>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>模拟盘交易</CardTitle>
          <CardDescription>价格优先读取真实行情，支持买入/卖出并实时更新资金与持仓。</CardDescription>
        </CardHeader>
        <CardContent>
          <PaperTradingPanel />
        </CardContent>
      </Card>

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
          <CardTitle>交易工具风控策略</CardTitle>
          <CardDescription>对下单意图执行规则化风险评估（交易工具）</CardDescription>
        </CardHeader>
        <CardContent>
          <RiskControlPanel />
        </CardContent>
      </Card>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>沙箱回放风控验证</CardTitle>
          <CardDescription>在沙箱时间轴下回放交易风控决策一致性</CardDescription>
        </CardHeader>
        <CardContent>
          <SandboxReplayPanel />
        </CardContent>
      </Card>
    </div>
  );
}
