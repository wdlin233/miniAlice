import { Clock3, FileText, GitCommitHorizontal, WalletCards, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletControls } from "@/components/dashboard/wallet-controls";
import { listSessions } from "@/lib/storage/sessions";
import { listWalletCommits, listWalletOperationLogs, readStagingDraft } from "@/lib/storage/wallet";

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
  const [sessions, commits, staging, operationLogs] = await Promise.all([
    listSessions(),
    listWalletCommits(),
    readStagingDraft(),
    listWalletOperationLogs(8)
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

          <div className="space-y-2 border-t pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recent Operation Logs</p>
            {operationLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无 Wallet 操作日志。</p>
            ) : (
              <div className="space-y-2">
                {operationLogs.map((log, index) => (
                  <div
                    key={`${log.createdAt}-${index}`}
                    className="rounded-lg border bg-background/70 p-3"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{log.action}</Badge>
                      <Badge
                        variant={log.status === "success" ? "secondary" : "outline"}
                        className={log.status === "error" ? "border-destructive text-destructive" : undefined}
                      >
                        {log.status}
                      </Badge>
                      {log.hash ? <span className="text-xs text-muted-foreground">{log.hash}</span> : null}
                    </div>
                    <p className="text-sm">{log.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}