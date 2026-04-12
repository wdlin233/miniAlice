# MiniAlice

精简的 Web 版 AI 交易智能体（文件驱动 + Trading-as-Git + Sandbox）。

## 技术栈
- Next.js 15（App Router）
- TypeScript（strict）
- TailwindCSS
- shadcn/ui
- OpenAI SDK
- 纯文件存储（data/）

## 快速启动
```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## 开发检查
```bash
pnpm lint
pnpm type-check
```

## E2E 测试
```bash
pnpm test:e2e:install
pnpm test:e2e
```

更多发布流程与检查项见 [RELEASE.md](RELEASE.md)。

## 声明

本项目为课程大作业，参考并大幅简化了 [OpenAlice](https://github.com/TraderAlice/OpenAlice) 的核心设计理念，包括：

- 文件驱动（File-driven）架构
- Trading-as-Git 交易流程
- Sandbox 时间隔离机制

本项目所有代码均为团队使用 Agent 独立实现，未直接复制任何 OpenAlice 源代码。项目仅用于学习和课程展示，不进行商业发布，也不涉及真实资金交易。