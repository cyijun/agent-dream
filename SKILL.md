---
name: agent-dream
description: |
  Perform background memory consolidation on an agent's persistent memory directory.
  Use this skill whenever the user says "dream", "consolidate memories", "memory cleanup",
  "prune MEMORY.md", "run memory consolidation", or asks to organize, merge, or clean up
  their agent memory files. Also use it when a host environment wants to trigger a
  periodic reflective pass over memory logs and topic files.
---

# Agent Dream: Memory Consolidation

This skill performs a **dream** — a reflective pass over the agent's persistent memory files. It synthesizes recently learned information into durable, well-organized memories so that future sessions can orient quickly.

## What this skill does

- Reviews the memory directory (`MEMORY.md`, topic files, daily logs)
- Identifies contradictions, duplicates, and stale entries
- Merges new signal into existing topic files
- Keeps `MEMORY.md` lean as a pure index (not a content dump)
- Returns a brief summary of what changed

## Invocation modes

### Manual (`/agent-dream`)
The user can invoke this skill at any time. If the memory directory has not been configured yet, the skill will guide the user through a one-time setup.

### Host-triggered (automatic)
Host environments can use the bundled script `scripts/check-gates.js` to decide whether enough time and sessions have accumulated. If the script exits `0`, the host may invoke this skill.

## Configuration discovery

Because this skill is **agent-agnostic**, it does not hard-code paths like `~/.claude/...`. Instead, it discovers configuration in the following priority order:

1. **Command-line arguments** passed directly to the script (`--memory-dir`, `--transcript-dir`)
2. **Environment variables** (`AGENT_DREAM_CONFIG` pointing to a JSON file, or `AGENT_DREAM_MEMORY_DIR` + `AGENT_DREAM_TRANSCRIPT_DIR`)
3. **`.agent-dream.json`** in the current working directory
4. If none of the above are found, **ask the user** and help create `.agent-dream.json`

### `.agent-dream.json` format

```json
{
  "memoryDir": "/path/to/memory",
  "transcriptDir": "/path/to/transcripts",
  "lockFileName": ".consolidate-lock",
  "minHours": 24,
  "minSessions": 5
}
```

- `memoryDir` — The root directory where memory files (including `MEMORY.md`) live.
- `transcriptDir` — The directory containing session transcripts or logs to review.
- `lockFileName` — Name of the lock file inside `memoryDir`. Default: `.consolidate-lock`.
- `minHours` — Minimum hours since last consolidation before running again. Default: `24`.
- `minSessions` — Minimum number of transcript files touched since last consolidation. Default: `5`.

## Gates and locking

When invoked automatically, the host should respect two gates:

- **Time gate**: `hoursSinceLastConsolidation >= minHours`
- **Session gate**: `sessionsTouchedSinceLastConsolidation >= minSessions`

The lock file (`<memoryDir>/<lockFileName>`) encodes `lastConsolidatedAt` in its **mtime**. Hosts can check it with a single `stat`.

> You do not need to think about gates when the user manually invokes `/agent-dream`.

## The 4-phase consolidation workflow

Once the memory and transcript directories are known, follow these phases exactly:

### Phase 1 — Orient

- `ls` the memory directory to see what already exists
- Read `MEMORY.md` to understand the current index
- Skim existing topic files so you improve them rather than creating duplicates
- If `logs/` or `sessions/` subdirectories exist, review recent entries there

### Phase 2 — Gather recent signal

Look for new information worth persisting. Sources in rough priority order:

1. **Daily logs** (`logs/YYYY/MM/YYYY-MM-DD.md`) if present — these are the append-only stream
2. **Existing memories that drifted** — facts that contradict something you see in the codebase or logs now
3. **Transcript search** — if you need specific context, grep the transcript directory for narrow terms:
   ```bash
   grep -rn "<narrow term>" /path/to/transcripts/ | tail -50
   ```

Do not exhaustively read large transcript files. Look only for things you already suspect matter.

### Phase 3 — Consolidate

For each thing worth remembering, write or update a memory file at the top level of the memory directory. Follow the memory file format conventions from the current system (frontmatter, types, etc.).

Focus on:
- **Merging** new signal into existing topic files rather than creating near-duplicates
- **Converting relative dates** ("yesterday", "last week") to absolute dates so they remain interpretable after time passes
- **Deleting contradicted facts** — if today's investigation disproves an old memory, fix it at the source

### Phase 4 — Prune and index

Update `MEMORY.md` so it stays under **200 lines** and under **~25KB**. It is an **index**, not a dump — each entry should be one line under ~150 characters:

```markdown
- [Title](file.md) — one-line hook
```

Never write memory content directly into `MEMORY.md`.

- Remove pointers to memories that are now stale, wrong, or superseded
- Demote verbose entries: if an index line is over ~200 chars, move the detail into the topic file
- Add pointers to newly important memories
- Resolve contradictions — if two files disagree, fix the wrong one

---

## Tool constraints

Because this skill often runs in the background or unattended, constrain yourself:

- **Read/Grep/Glob** — unrestricted (inherently read-only)
- **Bash** — **read-only only** (`ls`, `find`, `grep`, `cat`, `stat`, `wc`, `head`, `tail`, and similar). Any command that writes, redirects, or modifies state must be denied.
- **Edit / Write** — **only within the configured `memoryDir` and its subdirectories**.

If you need to create the memory directory because it does not yet exist, you may do so once at the start.

## Output format

Return a brief summary of what you consolidated, updated, or pruned. If nothing changed (memories are already tight), explicitly say so.

Example:
> Consolidated 3 daily logs into `backend_architecture.md` and `deployment_runbook.md`. Pruned `MEMORY.md` from 312 to 142 lines. Removed stale pointer to `old_auth_flow.md`.
