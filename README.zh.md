# agent-dream

[English](README.md) | **中文**

一个与 Agent 无关的内存整理（Memory Consolidation）Skill。从 Claude Code 的 `auto-dream` 机制中提取并泛化而来，可用于任何支持 Skill 或 prompts 的 AI Agent 环境。

## 这是什么

`agent-dream` 执行一次"做梦"——对 Agent 的持久化记忆目录进行一轮反射式整理。它会：

- 审阅记忆目录（`MEMORY.md`、topic 文件、daily logs）
- 识别矛盾、重复和过时的条目
- 将新信号合并到已有的 topic 文件中
- 保持 `MEMORY.md` 精简为纯索引（而非内容堆 dump）
- 返回一份变更摘要

## 目录结构

```
agent-dream/
├── SKILL.md                    # Skill 主文档（供 Claude / 其他 Agent 读取）
├── README.md                   # 本文件
├── evals/
│   └── evals.json              # 评估用例
└── scripts/
    ├── resolve-config.js       # 配置发现：CLI args → env → .agent-dream.json
    ├── check-gates.js          # 自动触发前的门控检查（时间门 + 会话门 + 锁）
    └── generate-prompt.js      # 为子 Agent 生成 consolidation prompt
```

## 用法

### 作为 Skill（手动调用）

在支持 Skill 的 Agent 环境中（如 Claude Code），直接说：

- `/agent-dream`
- `dream`
- `consolidate memories`
- `prune MEMORY.md`

如果这是第一次调用且没有配置，Skill 会引导用户创建 `.agent-dream.json`。

### 作为主机脚本（自动触发）

任何宿主环境都可以用 `scripts/check-gates.js` 来决定是否该运行一轮 consolidation：

```bash
node scripts/check-gates.js --acquire-lock
```

如果退出码为 `0`，表示时间门和会话门都已打开，且成功获取了锁。此时宿主可以调用 Skill 或把 `scripts/generate-prompt.js` 的输出喂给一个子 Agent：

```bash
node scripts/generate-prompt.js
```

## 配置发现

为了不硬编码任何特定 Agent 的路径（例如 `~/.claude/...`），本 Skill 按以下优先级发现配置：

1. **CLI 参数**：`--memory-dir <dir> --transcript-dir <dir>`
2. **环境变量**：
   - `AGENT_DREAM_CONFIG`（指向一个 JSON 配置文件）
   - `AGENT_DREAM_MEMORY_DIR` + `AGENT_DREAM_TRANSCRIPT_DIR`
3. **工作目录下的 `.agent-dream.json`**
4. 如果都没有找到，**询问用户**并帮助创建 `.agent-dream.json`

### `.agent-dream.json` 示例

```json
{
  "memoryDir": "/path/to/memory",
  "transcriptDir": "/path/to/transcripts",
  "lockFileName": ".consolidate-lock",
  "minHours": 24,
  "minSessions": 5
}
```

- `memoryDir` — 记忆文件根目录（包含 `MEMORY.md`）
- `transcriptDir` — 会话 transcript 目录
- `lockFileName` — 锁文件名，默认 `.consolidate-lock`
- `minHours` — 距上次 consolidation 的最短间隔，默认 24
- `minSessions` — 自上次 consolidation 以来需新增的 transcript 数量，默认 5

## 锁与门控

`scripts/check-gates.js` 实现了三道门：

- **时间门**：`hoursSinceLastConsolidation >= minHours`
- **会话门**：`sessionsTouchedSinceLastConsolidation >= minSessions`
- **锁门**：通过 PID 写入锁文件实现原子锁，防止多个进程并发 consolidation

> 锁文件的 `mtime` 即代表 `lastConsolidatedAt`，宿主可用 `stat` 快速检查。

## 四阶段整理工作流

一旦配置就绪，Skill 会按以下阶段执行：

### Phase 1 — Orient（定位）
浏览记忆目录，读取 `MEMORY.md`，了解现有 topic 文件和近期日志。

### Phase 2 — Gather（收集）
从 daily logs、drifted memories、transcript search 中提取值得持久化的新信号。

### Phase 3 — Consolidate（合并）
将新信号写入或更新到 topic 文件中，而不是创建近似重复的文件。把相对日期转为绝对日期，删除被证伪的旧记忆。

### Phase 4 — Prune and Index（剪枝与索引）
更新 `MEMORY.md`，使其保持在 **200 行 / 25KB** 以内。每行应是一个简短的索引条目，形如：

```markdown
- [Title](file.md) — one-line hook
```

## 工具约束

由于 consolidation 常在后台无人值守运行，Skill 对自身有严格限制：

- **Read/Grep/Glob** — 无限制（只读）
- **Bash** — 仅限只读命令（`ls`、`grep`、`cat`、`stat`、`wc` 等）
- **Edit / Write** — 仅可在配置的 `memoryDir` 及其子目录内写入

## 来源

本 Skill 提取自 Claude Code（v2.1.88）内部的 `auto-dream` 子系统。原始实现包含在 `package/restored-src/src/services/autoDream/` 中。

## License

MIT
