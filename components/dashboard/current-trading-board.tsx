import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPaperTrades, readPaperAccountState } from "@/lib/storage/paper-trading";
import { listTradingWalletPushExecutions } from "@/lib/storage/trading-wallet-link";

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatQty(value: number): string {
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function executionStatusLabel(status: string): string {
  if (status === "submitted") {
    return "已提交";
  }

  if (status === "blocked") {
    return "已拦截";
  }

  if (status === "failed") {
    return "失败";
  }

  if (status === "canceled") {
    return "已取消";
  }

  return status;
}

function triggerLabel(trigger: string): string {
  if (trigger === "manual") {
    return "手动";
  }

  if (trigger === "limit") {
    return "限价触发";
  }

  if (trigger === "take_profit") {
    return "止盈触发";
  }

  if (trigger === "stop_loss") {
    return "止损触发";
  }

  return trigger;
}

function pnlClass(value: number): string {
  return value >= 0 ? "text-red-600" : "text-emerald-600";
}

function sideLabel(side: string): string {
  if (side === "long") {
    return "做多";
  }

  if (side === "short") {
    return "做空";
  }

  if (side === "buy") {
    return "买入";
  }

  if (side === "sell") {
    return "卖出";
  }

  return side;
}

export async function CurrentTradingBoard() {
  const [account, recentTrades, executions] = await Promise.all([
    readPaperAccountState(),
    listPaperTrades(10),
    listTradingWalletPushExecutions(10)
  ]);

  const positions = account.positions
    .map((item) => {
      const marketValueUsd = item.quantity * item.lastPriceUsd;
      const unrealizedPnlUsd = (item.lastPriceUsd - item.averageEntryPriceUsd) * item.quantity;

      return {
        ...item,
        marketValueUsd,
        unrealizedPnlUsd
      };
    })
    .sort((a, b) => b.marketValueUsd - a.marketValueUsd);

  const positionValueUsd = positions.reduce((sum, row) => sum + row.marketValueUsd, 0);
  const equityUsd = account.cashUsd + positionValueUsd;
  const totalPnlUsd = equityUsd - account.initialBalanceUsd;

  return (
    <Card className="border-0 bg-card/90 shadow-sm backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">当前交易看板</CardTitle>
        <CardDescription>与模拟盘同一账本，展示持仓与策略执行事件</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">活跃交易对：{positions.length}</Badge>
          <Badge variant="outline">持仓市值：{formatUsd(positionValueUsd)}</Badge>
          <Badge variant="outline">账户权益：{formatUsd(equityUsd)}</Badge>
          <Badge variant="outline">总盈亏：{formatUsd(totalPnlUsd)}</Badge>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">交易对</th>
                <th className="px-3 py-2 text-left">数量</th>
                <th className="px-3 py-2 text-left">成本价</th>
                <th className="px-3 py-2 text-left">最新价</th>
                <th className="px-3 py-2 text-left">持仓市值</th>
                <th className="px-3 py-2 text-left">未实现盈亏</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                    暂无模拟盘持仓。
                  </td>
                </tr>
              ) : (
                positions.map((row) => (
                  <tr key={row.symbol} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-medium">{row.symbol}</td>
                    <td className="px-3 py-2">{formatQty(row.quantity)}</td>
                    <td className="px-3 py-2">{formatUsd(row.averageEntryPriceUsd)}</td>
                    <td className="px-3 py-2">{formatUsd(row.lastPriceUsd)}</td>
                    <td className="px-3 py-2">{formatUsd(row.marketValueUsd)}</td>
                    <td className={`px-3 py-2 ${pnlClass(row.unrealizedPnlUsd)}`}>
                      {row.unrealizedPnlUsd >= 0 ? "+" : ""}
                      {formatUsd(row.unrealizedPnlUsd)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">最近模拟盘成交</p>

          {recentTrades.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无模拟盘成交记录。</p>
          ) : (
            <div className="space-y-2">
              {recentTrades.map((trade) => (
                <div key={trade.id} className="rounded-lg border bg-background/70 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{trade.symbol}</Badge>
                    <Badge variant="outline">{sideLabel(trade.side)}</Badge>
                    <Badge variant="outline">{triggerLabel(trade.trigger)}</Badge>
                    <Badge variant="outline">数量 {formatQty(trade.quantity)}</Badge>
                  </div>

                  <p className="text-sm">
                    成交价 {formatUsd(trade.priceUsd)} | 成交额 {formatUsd(trade.notionalUsd)} | 手续费 {formatUsd(trade.feeUsd)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(trade.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">最近策略执行</p>

          {executions.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无交易执行记录。</p>
          ) : (
            <div className="space-y-2">
              {executions.map((item) => (
                <div key={item.id} className="rounded-lg border bg-background/70 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.symbol}</Badge>
                    <Badge variant="outline">{sideLabel(item.side)}</Badge>
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
                      {executionStatusLabel(item.status)}
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
