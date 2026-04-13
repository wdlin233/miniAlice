import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listTradingOrders } from "@/lib/storage/trading-orders";
import { listTradingWalletPushExecutions } from "@/lib/storage/trading-wallet-link";

interface PositionRow {
  symbol: string;
  orders: number;
  exposureUsd: number;
  averageLeverage: number;
  lastRiskDecision: string;
  source: string;
}

function toPositionRows(rawOrders: Awaited<ReturnType<typeof listTradingOrders>>): PositionRow[] {
  const liveOrders = rawOrders.filter((order) => order.status === "submitted");
  const groups = new Map<string, PositionRow>();

  for (const order of liveOrders) {
    const existing = groups.get(order.symbol);
    if (!existing) {
      groups.set(order.symbol, {
        symbol: order.symbol,
        orders: 1,
        exposureUsd: order.notionalUsd,
        averageLeverage: order.leverage,
        lastRiskDecision: order.riskDecision,
        source: order.source
      });
      continue;
    }

    const nextOrders = existing.orders + 1;
    groups.set(order.symbol, {
      ...existing,
      orders: nextOrders,
      exposureUsd: existing.exposureUsd + order.notionalUsd,
      averageLeverage: (existing.averageLeverage * existing.orders + order.leverage) / nextOrders,
      lastRiskDecision: order.riskDecision,
      source: order.source
    });
  }

  return Array.from(groups.values()).sort((a, b) => b.exposureUsd - a.exposureUsd);
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export async function CurrentTradingBoard() {
  const [orders, executions] = await Promise.all([
    listTradingOrders({ limit: 80 }),
    listTradingWalletPushExecutions(10)
  ]);

  const positions = toPositionRows(orders);
  const totalExposure = positions.reduce((sum, row) => sum + row.exposureUsd, 0);

  return (
    <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">当前交易看板</CardTitle>
        <CardDescription>聚合展示当前仓位与最近执行事件</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Active Symbols: {positions.length}</Badge>
          <Badge variant="outline">Open Orders: {orders.filter((order) => order.status === "submitted").length}</Badge>
          <Badge variant="outline">Exposure: {formatUsd(totalExposure)}</Badge>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-left">Orders</th>
                <th className="px-3 py-2 text-left">Exposure</th>
                <th className="px-3 py-2 text-left">Avg Leverage</th>
                <th className="px-3 py-2 text-left">Risk</th>
                <th className="px-3 py-2 text-left">Source</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                    暂无活跃持仓。
                  </td>
                </tr>
              ) : (
                positions.map((row) => (
                  <tr key={row.symbol} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-medium">{row.symbol}</td>
                    <td className="px-3 py-2">{row.orders}</td>
                    <td className="px-3 py-2">{formatUsd(row.exposureUsd)}</td>
                    <td className="px-3 py-2">{row.averageLeverage.toFixed(2)}x</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          row.lastRiskDecision === "approve"
                            ? "text-emerald-600"
                            : row.lastRiskDecision === "caution"
                              ? "text-amber-600"
                              : "text-destructive"
                        }
                      >
                        {row.lastRiskDecision}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recent Trades</p>

          {executions.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无交易执行记录。</p>
          ) : (
            <div className="space-y-2">
              {executions.map((item) => (
                <div key={item.id} className="rounded-lg border bg-background/70 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.symbol}</Badge>
                    <Badge variant="outline">{item.side.toUpperCase()}</Badge>
                    <Badge
                      variant="outline"
                      className={
                        item.status === "submitted"
                          ? "border-emerald-500 text-emerald-600"
                          : item.status === "blocked"
                            ? "border-amber-500 text-amber-600"
                            : "border-destructive text-destructive"
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>

                  <p className="text-sm">{item.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()} {item.reason ? `| ${item.reason}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
