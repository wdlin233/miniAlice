import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, FileText, MessageSquare } from "lucide-react";
import { listSessions } from "@/lib/storage/sessions";

export default async function SessionsPage() {
  const sessions = await listSessions();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">会话管理</h1>
        <p className="mt-2 text-muted-foreground">
          会话文件管理与历史记录
        </p>
      </div>

      <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>会话列表</CardTitle>
          <CardDescription>data/sessions/*.jsonl</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无会话</h3>
              <p className="text-muted-foreground mb-6">开始与 MiniAlice 对话，将会创建新的会话文件</p>
              <Button asChild>
                <a href="/chat">开始对话</a>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const sessionName = session.replace(".jsonl", "");
                const numericStamp = Number(sessionName.replace("session-", ""));
                const formattedDate = Number.isFinite(numericStamp)
                  ? new Date(numericStamp).toLocaleString()
                  : "未知创建时间";

                return (
                  <div key={session} className="flex items-center justify-between rounded-lg border p-4 transition-all hover:shadow-sm">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{sessionName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formattedDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/chat?sessionId=${encodeURIComponent(sessionName)}`}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          恢复对话
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
