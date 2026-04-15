import {
  sandboxTradingReplayRequestSchema,
  sandboxTradingReplayResultSchema,
  type SandboxTradingReplayRequest,
  type SandboxTradingReplayResult,
  type TradingOrder
} from "@/lib/schemas/trading";
import { listSandboxes, loadSandbox } from "@/lib/sandbox";
import { evaluateTradingRisk } from "@/lib/tools/trading";
import { listTradingOrdersView } from "@/lib/tools/trading-order";

function pickReplayCandidates(
  orders: TradingOrder[],
  request: SandboxTradingReplayRequest,
  playheadTime: string
): TradingOrder[] {
  return orders
    .filter((order) => !!order.riskRequest)
    .filter((order) => order.createdAt <= playheadTime)
    .filter((order) => (request.decision ? order.riskDecision === request.decision : true))
    .slice(0, request.limit);
}

export async function replayTradingRiskValidation(
  input: SandboxTradingReplayRequest
): Promise<SandboxTradingReplayResult> {
  const sandboxList = await listSandboxes();
  if (!sandboxList.includes(input.sandboxId)) {
    throw new Error(`Sandbox ${input.sandboxId} not found.`);
  }

  const sandbox = await loadSandbox(input.sandboxId);
  const playheadTime = sandbox.getPlayheadTime().toISOString();

  const orders = await listTradingOrdersView({ limit: Math.max(input.limit * 4, 80) });
  const candidates = pickReplayCandidates(orders, input, playheadTime);

  const items = await Promise.all(
    candidates.map(async (order) => {
      const replayed = await evaluateTradingRisk(order.riskRequest!, { persistLog: false });

      return {
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        source: order.source,
        originalDecision: order.riskDecision,
        replayedDecision: replayed.decision,
        match: replayed.decision === order.riskDecision,
        originalScore: order.riskScore,
        replayedScore: replayed.score,
        createdAt: order.createdAt
      };
    })
  );

  const matched = items.filter((item) => item.match).length;
  const result = sandboxTradingReplayResultSchema.parse({
    tool: "trading",
    sandboxId: input.sandboxId,
    playheadTime,
    total: items.length,
    matched,
    mismatched: items.length - matched,
    items
  });

  return result;
}

export async function replayTradingRiskValidationFromPayload(
  payload: unknown
): Promise<SandboxTradingReplayResult> {
  const input = sandboxTradingReplayRequestSchema.parse(payload);
  return replayTradingRiskValidation(input);
}
