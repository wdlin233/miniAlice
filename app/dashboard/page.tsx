import { DashboardPanel } from "@/components/dashboard/dashboard-panel";

export default async function DashboardPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          实时读取 data/ 文件状态（无数据库）
        </p>
      </div>

      <DashboardPanel />
    </div>
  );
}
