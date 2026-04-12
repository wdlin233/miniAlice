# AGENT.md - MiniAlice 项目 Agent 开发规范

## 项目目标
做一个精简的 Web 版 AI 交易智能体，核心体现「文件驱动 + Trading-as-Git + Sandbox」。
首期目标是完成可运行骨架：Sidebar + Chat + Dashboard + Wallet API。

## 技术约束（必须遵守）
- 全栈 Next.js 15 + TypeScript
- 纯文件存储（data/ 目录），禁止使用数据库
- 所有 AI 调用必须通过 OpenAI SDK
- 代码风格：ESLint + Prettier + 严格类型
- UI 基础：TailwindCSS + shadcn/ui

## 核心概念（借鉴 OpenAlice）

### Session
- 存储格式：JSONL
- 生命周期：创建 -> 追加 -> 自动压缩（按消息条数 / token 阈值触发）
- 每条记录最少字段：role、content、createdAt、tool(可选)

### Sandbox
- 核心字段：playheadTime
- 所有分析和回测必须运行在 sandbox 时间线上，不直接污染实时状态

### Wallet（Trading-as-Git）
- 三阶段流水：add -> commit（8 位 hash）-> push
- add：写入 `data/wallet/staging.json`
- commit：生成 `data/wallet/commits/<hash>.json`
- push：更新 commit 状态为 push（可扩展到执行层）

### Tools（全部显式声明）
- analysis：分析、总结、解释
- trading：下单、撤单、仓位建议
- browser：行情抓取、资讯抓取、网页读取

## 文件结构（必须严格遵守）
data/
├── config/
├── sessions/
├── wallet/
│   └── commits/
└── persona.md

## 开发流程
1. 任何新功能先在 AGENT.md 写 Tasks
2. 让 Codex 生成代码时，必须附上本文件
3. 提交前必须通过 `pnpm lint` 和 `pnpm type-check`
4. AI 能力改动必须显式标注使用了哪个 Tool（analysis/trading/browser）

## 验收标准（Definition of Done）
- [ ] lint/type-check 全通过
- [ ] data/ 有最小可运行样例
- [ ] Session/Wallet API 可写入文件
- [ ] Dashboard 可读取并展示关键状态

## 当前 Tasks（每周更新）
- [ ] Week 1: 项目初始化 + AGENT.md + 基础 Dashboard
- [ ] Week 1: Chat 面板 + /api/analysis + Session JSONL 落盘
- [ ] Week 1: Wallet add/commit/push API 骨架
- [ ] Week 1: Dashboard 接入 Wallet add/commit/push 操作面板
- [ ] Week 1: Dashboard 展示 Wallet add/commit/push 操作结果日志
- [ ] Week 2: Session 自动压缩策略
- [ ] Week 2: Sandbox playheadTime 时间隔离
- [ ] Week 3: Browser Tool 接入行情与资讯
- [ ] Week 3: Browser Tool 行情/资讯 API + Dashboard 展示
- [ ] Week 3: Browser Tool 资讯来源切换 + 手动刷新 API
- [ ] Week 3: Trading Tool 风险控制策略
- [ ] Week 4: E2E 测试 + 发布文档