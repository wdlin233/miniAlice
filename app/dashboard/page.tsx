import { DashboardPanel } from "@/components/dashboard/dashboard-panel";

export default async function DashboardPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">投资组合</h1>
        <p className="mt-2 text-muted-foreground">
          当前仓位、策略执行与市场信息总览
        </p>
      </div>

      <DashboardPanel />
    </div>
  );
}
