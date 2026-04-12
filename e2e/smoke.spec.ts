import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const tradingOrdersPath = path.join(process.cwd(), "data", "trading", "orders.jsonl");
const tradingRiskEvaluationsPath = path.join(process.cwd(), "data", "trading", "risk-evaluations.jsonl");

async function readTextFileSafe(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

test.describe("MiniAlice E2E Smoke", () => {
  test("dashboard page renders key blocks", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByText("Wallet Pipeline")).toBeVisible();
    await expect(page.getByText("Browser Tool")).toBeVisible();
  });

  test("trading risk config endpoint returns payload", async ({ request }) => {
    const response = await request.get("/api/trading/risk");
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as {
      tool?: string;
      config?: { maxLeverage?: number };
    };

    expect(body.tool).toBe("trading");
    expect(typeof body.config?.maxLeverage).toBe("number");
  });

  test("trading order place and cancel flow", async ({ request }) => {
    const [ordersBaseline, riskBaseline] = await Promise.all([
      readTextFileSafe(tradingOrdersPath),
      readTextFileSafe(tradingRiskEvaluationsPath)
    ]);

    const placeResponse = await request.post("/api/trading/order", {
      data: {
        symbol: "BTCUSDT",
        side: "buy",
        orderType: "market",
        leverage: 2,
        notionalUsd: 400,
        stopLossPercent: 1.2,
        accountEquityUsd: 10000,
        currentExposurePercent: 10,
        dailyLossPercent: 0.6,
        source: "manual"
      }
    });

    try {
      expect(placeResponse.ok()).toBeTruthy();
      const placed = (await placeResponse.json()) as {
        order?: { id?: string; status?: string };
      };

      expect(placed.order?.id).toBeTruthy();

      if (placed.order?.status === "submitted" && placed.order.id) {
        const cancelResponse = await request.post("/api/trading/cancel", {
          data: {
            orderId: placed.order.id,
            reason: "e2e smoke test cancel"
          }
        });

        expect(cancelResponse.ok()).toBeTruthy();
        const canceled = (await cancelResponse.json()) as {
          order?: { status?: string };
        };

        expect(canceled.order?.status).toBe("canceled");
      }
    } finally {
      await Promise.all([
        writeFile(tradingOrdersPath, ordersBaseline, "utf8"),
        writeFile(tradingRiskEvaluationsPath, riskBaseline, "utf8")
      ]);
    }
  });
});