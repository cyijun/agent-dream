# agent-dream

**English** | [中文](README.zh.md)

An agent-agnostic memory consolidation skill. Extracted and generalized from Claude Code's `auto-dream` mechanism, usable in any AI agent environment that supports skills or prompts.

## What This Is

`agent-dream` performs a "dream" — a reflective consolidation pass over an agent's persistent memory directory. It will:

- Review the memory directory (`MEMORY.md`, topic files, daily logs)
- Identify contradictions, duplicates, and stale entries
- Merge new signals into existing topic files
- Keep `MEMORY.md` as a lean index only (not a content dump)
- Return a summary of changes made

## Directory Structure

```
agent-dream/
├── SKILL.md                    # Skill main document (for Claude / other agents to read)
├── README.md                   # This file
├── evals/
│   └── evals.json              # Evaluation test cases
└── scripts/
    ├── resolve-config.js       # Config discovery: CLI args → env → .agent-dream.json
    ├── check-gates.js          # Gate checks before auto-trigger (time + session + lock)
    └── generate-prompt.js      # Generate consolidation prompt for sub-agent
```

## Usage

### As a Skill (Manual Invocation)

In agent environments that support skills (e.g., Claude Code), simply say:

- `/agent-dream`
- `dream`
- `consolidate memories`
- `prune MEMORY.md`

If this is the first invocation without configuration, the skill will guide you to create `.agent-dream.json`.

### As a Host Script (Automatic Trigger)

Any host environment can use `scripts/check-gates.js` to decide whether to run a consolidation round:

```bash
node scripts/check-gates.js --acquire-lock
```

If the exit code is `0`, it means the time gate and session gate are both open, and the lock has been successfully acquired. The host can then invoke the skill or feed the output of `scripts/generate-prompt.js` to a sub-agent:

```bash
node scripts/generate-prompt.js
```

## Configuration Discovery

To avoid hardcoding any agent-specific paths (e.g., `~/.claude/...`), this skill discovers configuration in the following priority order:

1. **CLI arguments**: `--memory-dir <dir> --transcript-dir <dir>`
2. **Environment variables**:
   - `AGENT_DREAM_CONFIG` (points to a JSON config file)
   - `AGENT_DREAM_MEMORY_DIR` + `AGENT_DREAM_TRANSCRIPT_DIR`
3. **`.agent-dream.json` in the working directory**
4. If none are found, **ask the user** and help create `.agent-dream.json`

### `.agent-dream.json` Example

```json
{
  "memoryDir": "/path/to/memory",
  "transcriptDir": "/path/to/transcripts",
  "lockFileName": ".consolidate-lock",
  "minHours": 24,
  "minSessions": 5
}
```

- `memoryDir` — Root directory for memory files (contains `MEMORY.md`)
- `transcriptDir` — Session transcript directory
- `lockFileName` — Lock file name, default `.consolidate-lock`
- `minHours` — Minimum hours since last consolidation, default 24
- `minSessions` — Number of new transcripts required since last consolidation, default 5

## Locks and Gates

`scripts/check-gates.js` implements three gates:

- **Time Gate**: `hoursSinceLastConsolidation >= minHours`
- **Session Gate**: `sessionsTouchedSinceLastConsolidation >= minSessions`
- **Lock Gate**: Atomic lock via PID-written lock file to prevent concurrent consolidation

> The lock file's `mtime` represents `lastConsolidatedAt`; hosts can quickly check using `stat`.

## Four-Phase Consolidation Workflow

Once configured, the skill executes in the following phases:

### Phase 1 — Orient
Browse the memory directory, read `MEMORY.md`, understand existing topic files and recent logs.

### Phase 2 — Gather
Extract new signals worth persisting from daily logs, drifted memories, and transcript search.

### Phase 3 — Consolidate
Write or update new signals into topic files instead of creating near-duplicate files. Convert relative dates to absolute dates, remove falsified old memories.

### Phase 4 — Prune and Index
Update `MEMORY.md` to keep it within **200 lines / 25KB**. Each line should be a short index entry like:

```markdown
- [Title](file.md) — one-line hook
```

## Tool Constraints

Since consolidation often runs unattended in the background, the skill has strict self-imposed restrictions:

- **Read/Grep/Glob** — Unlimited (read-only)
- **Bash** — Read-only commands only (`ls`, `grep`, `cat`, `stat`, `wc`, etc.)
- **Edit / Write** — Only within the configured `memoryDir` and its subdirectories

## Source

This skill is extracted from the `auto-dream` subsystem inside Claude Code (v2.1.88). The original implementation is in `package/restored-src/src/services/autoDream/`.

## License

MIT
