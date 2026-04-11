import { ChatPanel } from "@/components/chat/chat-panel";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";

export default function HomePage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">MiniAlice</h1>
        <p className="mt-2 text-muted-foreground">
          文件驱动的个人 AI 量化交易 Agent
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="animate-fade-in-up">
          <DashboardPanel />
        </div>
        <div className="animate-fade-in-up">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}