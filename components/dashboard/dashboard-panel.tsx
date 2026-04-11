import { Clock3, FileText, GitCommitHorizontal, WalletCards, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletControls } from "@/components/dashboard/wallet-controls";
import { listSessions } from "@/lib/storage/sessions";
import { listWalletCommits, readStagingDraft } from "@/lib/storage/wallet";

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
  const [sessions, commits, staging] = await Promise.all([
    listSessions(),
    listWalletCommits(),
    readStagingDraft()
  ]);

  const latestCommit = commits[0];

  return (
    <section className="grid gap-4 animate-fade-in-up">
      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle className="text-xl">Dashboard</CardTitle>
          <CardDescription>实时读取 data/ 文件状态（无数据库）。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Session Files"
            value={String(sessions.length)}
            hint="data/sessions/*.jsonl"
            icon={FileText}
          />
          <StatCard
            title="Wallet Commits"
            value={String(commits.length)}
            hint="8 位 hash 快照"
            icon={GitCommitHorizontal}
          />
          <StatCard
            title="Staging Files"
            value={String(staging.files.length)}
            hint={staging.summary ? "已进入 add 阶段" : "当前为空"}
            icon={WalletCards}
          />
          <StatCard
            title="Latest Commit"
            value={latestCommit?.hash ?? "N/A"}
            hint={latestCommit?.createdAt ?? "尚无 commit"}
            icon={Clock3}
          />
        </CardContent>
      </Card>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Wallet Pipeline</CardTitle>
          <CardDescription>add &gt; commit &gt; push</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">add</Badge>
            <span className="text-sm text-muted-foreground">staging.json</span>
            <Badge variant="secondary">commit</Badge>
            <span className="text-sm text-muted-foreground">wallet/commits/*.json</span>
            <Badge className="bg-accent text-accent-foreground hover:bg-accent">push</Badge>
          </div>

          <WalletControls
            initialStagingSummary={staging.summary}
            initialStagingFiles={staging.files}
            initialLatestHash={latestCommit?.hash}
          />
        </CardContent>
      </Card>
    </section>
  );
}