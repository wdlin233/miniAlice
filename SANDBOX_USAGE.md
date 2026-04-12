# Sandbox 功能使用说明

## 功能介绍

Sandbox 功能是 MiniAlice 项目的核心特性之一，它能够：

- **时间隔离**：通过 `playheadTime` 机制创建独立的时间线
- **状态隔离**：在沙箱内进行操作，不影响实时状态
- **回测支持**：基于历史时间点进行分析和模拟
- **完整生命周期**：支持创建、操作、重置和销毁沙箱

## 初始数据准备

### 1. 钱包状态

文件：`data/wallet/staging.json`

```json
{
  "commits": []
}
```

### 2. 示例会话

文件：`data/sessions/test.session.jsonl`

```jsonl
{"role":"user","content":"Hello, how are you?","createdAt":"2026-04-10T00:00:00.000Z"}
{"role":"assistant","content":"I'm doing well, thank you! How can I help you today?","createdAt":"2026-04-10T00:00:01.000Z"}
{"role":"user","content":"I want to know about the weather today","createdAt":"2026-04-10T00:00:02.000Z"}
{"role":"assistant","content":"I'm sorry, I don't have real-time weather information. But I can help you with other questions.","createdAt":"2026-04-10T00:00:03.000Z"}
{"role":"user","content":"Tell me about artificial intelligence","createdAt":"2026-04-10T00:00:04.000Z"}
{"role":"assistant","content":"Artificial intelligence (AI) refers to the development of computer systems that can perform tasks that typically require human intelligence, such as visual perception, speech recognition, decision-making, and language translation.","createdAt":"2026-04-10T00:00:05.000Z"}
```

## 测试完整流程

### 1. 创建沙箱

```bash
curl -X POST http://localhost:3000/api/sandbox?action=create \
  -H "Content-Type: application/json" \
  -d '{}'
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "sandboxId": "sandbox_1234567890_abcdef",
    "playheadTime": "2026-04-11T00:00:00.000Z"
  }
}
```

### 2. 设置历史时间

```bash
curl -X POST http://localhost:3000/api/sandbox?action=setPlayheadTime \
  -H "Content-Type: application/json" \
  -d '{
    "sandboxId": "sandbox_1234567890_abcdef",
    "time": "2026-04-10T00:00:03.000Z"
  }'
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "sandboxId": "sandbox_1234567890_abcdef",
    "playheadTime": "2026-04-10T00:00:03.000Z"
  }
}
```

### 3. 查看沙箱状态

```bash
curl -X POST http://localhost:3000/api/sandbox?action=getState \
  -H "Content-Type: application/json" \
  -d '{
    "sandboxId": "sandbox_1234567890_abcdef"
  }'
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "sandboxId": "sandbox_1234567890_abcdef",
    "playheadTime": "2026-04-10T00:00:03.000Z",
    "walletState": {
      "staging": { "commits": [] },
      "commits": []
    },
    "sessionCount": 1
  }
}
```

### 4. 推进沙箱时间

```bash
curl -X POST http://localhost:3000/api/sandbox?action=advancePlayheadTime \
  -H "Content-Type: application/json" \
  -d '{
    "sandboxId": "sandbox_1234567890_abcdef",
    "delta": 2000
  }'
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "sandboxId": "sandbox_1234567890_abcdef",
    "playheadTime": "2026-04-10T00:00:05.000Z"
  }
}
```

### 5. 重置沙箱

```bash
curl -X POST http://localhost:3000/api/sandbox?action=reset \
  -H "Content-Type: application/json" \
  -d '{
    "sandboxId": "sandbox_1234567890_abcdef"
  }'
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "sandboxId": "sandbox_1234567890_abcdef",
    "playheadTime": "2026-04-11T00:00:00.000Z"
  }
}
```

### 6. 销毁沙箱

```bash
curl -X POST http://localhost:3000/api/sandbox?action=cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "sandboxId": "sandbox_1234567890_abcdef"
  }'
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "sandboxId": "sandbox_1234567890_abcdef",
    "message": "Sandbox cleaned up successfully"
  }
}
```

### 7. 验证实时状态未被污染

- 检查 `data/wallet/staging.json` 文件内容未改变
- 检查 `data/sessions/test.session.jsonl` 文件内容未改变

## 在代码中集成 Sandbox 类

### 1. 创建沙箱实例

```typescript
import { createSandbox } from "@/lib/sandbox";

// 创建新的沙箱实例
const sandbox = await createSandbox();
const sandboxId = sandbox.getSandboxId();
console.log(`Created sandbox with ID: ${sandboxId}`);
```

### 2. 设置沙箱时间

```typescript
// 设置历史时间
const historicalTime = new Date("2026-04-10T00:00:00.000Z");
sandbox.setPlayheadTime(historicalTime);
console.log(`Set playhead time to: ${sandbox.getPlayheadTime().toISOString()}`);
```

### 3. 在沙箱内操作

```typescript
// 获取沙箱内的会话消息
const messages = sandbox.getSessionMessages("test.session");
console.log(`Found ${messages.length} messages in sandbox`);

// 添加沙箱内的会话消息
const newMessage = {
  role: "user",
  content: "What is machine learning?",
  createdAt: sandbox.getPlayheadTime().toISOString()
};
sandbox.addSessionMessage("test.session", newMessage);
console.log("Added new message to sandbox");

// 获取沙箱内的钱包状态
const walletState = sandbox.getWalletState();
console.log("Wallet state in sandbox:", walletState);
```

### 4. 保存和加载沙箱

```typescript
// 保存沙箱状态
await sandbox.saveState();
console.log("Saved sandbox state");

// 加载沙箱实例
import { loadSandbox } from "@/lib/sandbox";
const loadedSandbox = await loadSandbox(sandboxId);
console.log(`Loaded sandbox with ID: ${loadedSandbox.getSandboxId()}`);
```

### 5. 清理沙箱

```typescript
// 清理沙箱
await sandbox.cleanup();
console.log("Cleaned up sandbox");
```

## 验证规范符合性

### 1. 运行 lint 检查

```bash
pnpm lint
```

### 2. 运行类型检查

```bash
pnpm type-check
```

### 3. 验证沙箱操作未修改实时数据

- 沙箱数据存储在 `data/sandbox/[sandboxId]/` 目录下
- 实时数据存储在 `data/wallet/` 和 `data/sessions/` 目录下
- 沙箱操作不会修改实时数据，只会在沙箱目录中操作

## 注意事项

- 沙箱创建时会从实时状态初始化，但后续操作不会影响实时状态
- 沙箱数据会占用磁盘空间，使用完后应及时清理
- 沙箱时间操作应符合逻辑，避免时间混乱
- 沙箱操作需要 OpenAI API 密钥（用于会话压缩功能）
