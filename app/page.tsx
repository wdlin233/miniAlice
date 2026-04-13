import { ChatPanel } from "@/components/chat/chat-panel";
import { CurrentTradingBoard } from "@/components/dashboard/current-trading-board";
import { StrategyStudio } from "@/components/dashboard/strategy-studio";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">MiniAlice Strategy Hub</h1>
        <p className="mt-2 text-muted-foreground">
          先和 AI 讨论策略，再直接查看当前交易看板。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="animate-fade-in-up">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Chat</p>
            <ChatPanel />
          </div>
        </div>

        <div className="space-y-4 animate-fade-in-up">
          <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">一键策略执行</CardTitle>
              <CardDescription>输入策略想法，系统自动执行并记录交易流水。</CardDescription>
            </CardHeader>
            <CardContent>
              <StrategyStudio />
            </CardContent>
          </Card>

          <CurrentTradingBoard />
        </div>
      </div>
    </div>
  );
}