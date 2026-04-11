# Session 自动压缩功能使用说明

## 功能介绍

Session 自动压缩功能是 MiniAlice 项目的核心特性之一，它能够：

- **自动检测**：根据消息条数和 Token 数量双阈值自动触发压缩
- **语义保留**：通过 OpenAI 大模型对历史对话进行压缩，保留核心上下文
- **文件存储**：所有数据均存储在 `data/sessions/` 目录下的 JSONL 文件中

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `messageThreshold` | 20 | 消息条数阈值，超过此值触发压缩 |
| `tokenThreshold` | 4000 | Token 数量阈值，超过此值触发压缩 |

## 使用方法

### 1. 在代码中集成自动压缩检查

在每次追加消息后，系统会自动检查是否需要压缩：

```typescript
import { appendSessionMessage } from "@/lib/storage/sessions";
import type { SessionMessage } from "@/types/domain";

// 追加消息（自动触发压缩检查）
const message: SessionMessage = {
  role: "user",
  content: "Hello, world!",
  createdAt: new Date().toISOString()
};

await appendSessionMessage("sessionId", message);
// 如果消息条数或 Token 数超过阈值，会自动触发压缩
```

### 2. 通过 API 手动触发压缩

#### 手动压缩（忽略阈值）

```bash
curl -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test.session",
    "mode": "manual"
  }'
```

#### 自动检查（根据阈值决定是否压缩）

```bash
curl -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test.session",
    "mode": "auto"
  }'
```

#### 自定义压缩配置

```bash
curl -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test.session",
    "mode": "auto",
    "config": {
      "messageThreshold": 15,
      "tokenThreshold": 3000
    }
  }'
```

## API 响应格式

```json
{
  "compressed": true,
  "originalCount": 25,
  "originalTokens": 1200,
  "compressedTokens": 200,
  "savedTokens": 1000,
  "compressedMessagePreview": "[压缩历史对话]\n用户询问了关于人工智能的多个问题，包括AI的定义、类型、日常应用、伦理问题、负责任的发展、机器学习、神经网络、深度学习、学习方法、自然语言处理和计算机视觉等方面。助手提供了详细的回答。",
  "message": "Session compressed automatically."
}
```

## 测试示例

### 消息条数触发测试

1. 使用 `test.session.jsonl` 文件（包含 25 条消息）
2. 调用 API 自动检查模式
3. 由于消息条数超过 20，应该触发压缩

### Token 数量触发测试

1. 创建一个包含大量内容的会话文件
2. 调用 API 自动检查模式
3. 由于 Token 数量超过 4000，应该触发压缩

## 验证步骤

1. **检查 lint 状态**：运行 `pnpm lint`
2. **检查类型**：运行 `pnpm type-check`
3. **确认文件存储**：所有数据读写均在 `data/` 目录下
4. **测试 API**：使用 curl 命令测试压缩功能

## 注意事项

- 压缩后的消息会以 `system` 角色存储，前缀为 `[压缩历史对话]`
- 压缩过程会调用 OpenAI API，需要设置 `OPENAI_API_KEY` 环境变量
- 压缩后的会话文件会只保留压缩后的消息，原消息会被替换
