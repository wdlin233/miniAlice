# MiniAlice Release Guide

## Scope
本项目采用文件驱动架构，发布前需要保证 API、文件落盘与页面联动均可工作。

## Pre-Release Checklist
1. 安装依赖: `pnpm install`
2. 静态检查: `pnpm lint && pnpm type-check`
3. E2E 冒烟测试:
4. 首次执行（安装浏览器）: `pnpm test:e2e:install`
5. 执行测试: `pnpm test:e2e`
6. 关键 API 手动检查:
7. `POST /api/wallet/add`, `POST /api/wallet/commit`, `POST /api/wallet/push`
8. `POST /api/trading/order`, `POST /api/trading/cancel`, `POST /api/trading/recommendation`
9. `POST /api/sandbox/replay`

## Data Integrity Checklist
1. `data/wallet/operations.jsonl` 有新增操作日志
2. `data/trading/orders.jsonl` 有下单快照
3. `data/trading/recommendations.jsonl` 有推荐日志
4. `data/trading/wallet-push-executions.jsonl` 有 Wallet push 联动记录
5. `data/trading/risk-evaluations.jsonl` 有风控评估记录

## Build & Start
1. 构建: `pnpm build`
2. 启动: `pnpm start`

## Notes
- 目前为课程展示版本，不接入真实交易所。
- 生产环境请通过 CI 注入 `OPENAI_API_KEY` 与 `OPENAI_MODEL`。