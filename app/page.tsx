import { ChatPanel } from "@/components/chat/chat-panel";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { Sidebar } from "@/components/layout/sidebar";

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <div className="grid gap-4 lg:grid-rows-[auto_1fr]">
          <DashboardPanel />
          <ChatPanel />
        </div>
      </div>
    </main>
  );
}