#!/usr/bin/env node
// Emits the consolidation prompt text for hosts that want to pipe it to a subagent.

const { resolveConfig } = require('./resolve-config');

const ENTRYPOINT_NAME = 'MEMORY.md';
const MAX_ENTRYPOINT_LINES = 200;

function buildPrompt(memoryRoot, transcriptDir, extra = '') {
  return `# Dream: Memory Consolidation

You are performing a dream — a reflective pass over your memory files. Synthesize what you've learned recently into durable, well-organized memories so that future sessions can orient quickly.

Memory directory: \`${memoryRoot}\`
If the directory does not exist yet, create it before writing any files.

Session transcripts: \`${transcriptDir}\` (large files — grep narrowly, don't read whole files)

---

## Phase 1 — Orient

- \`ls\` the memory directory to see what already exists
- Read \`${ENTRYPOINT_NAME}\` to understand the current index
- Skim existing topic files so you improve them rather than creating duplicates
- If \`logs/\` or \`sessions/\` subdirectories exist, review recent entries there

## Phase 2 — Gather recent signal

Look for new information worth persisting. Sources in rough priority order:

1. **Daily logs** (\`logs/YYYY/MM/YYYY-MM-DD.md\`) if present — these are the append-only stream
2. **Existing memories that drifted** — facts that contradict something you see in the codebase now
3. **Transcript search** — if you need specific context, grep the transcripts for narrow terms:
   \`grep -rn "<narrow term>" ${transcriptDir}/ | tail -50\`

Don't exhaustively read transcripts. Look only for things you already suspect matter.

## Phase 3 — Consolidate

For each thing worth remembering, write or update a memory file at the top level of the memory directory. Use the memory file format and type conventions from your system prompt's auto-memory section — it's the source of truth for what to save, how to structure it, and what NOT to save.

Focus on:
- Merging new signal into existing topic files rather than creating near-duplicates
- Converting relative dates ("yesterday", "last week") to absolute dates so they remain interpretable after time passes
- Deleting contradicted facts — if today's investigation disproves an old memory, fix it at the source

## Phase 4 — Prune and index

Update \`${ENTRYPOINT_NAME}\` so it stays under ${MAX_ENTRYPOINT_LINES} lines AND under ~25KB. It's an **index**, not a dump — each entry should be one line under ~150 characters: \`- [Title](file.md) — one-line hook\`. Never write memory content directly into it.

- Remove pointers to memories that are now stale, wrong, or superseded
- Demote verbose entries: if an index line is over ~200 chars, it's carrying content that belongs in the topic file — shorten the line, move the detail
- Add pointers to newly important memories
- Resolve contradictions — if two files disagree, fix the wrong one

---

Return a brief summary of what you consolidated, updated, or pruned. If nothing changed (memories are already tight), say so.${extra ? `\n\n## Additional context\n\n${extra}` : ''}`;
}

function main() {
  // Accept either --memory-dir / --transcript-dir directly, or let resolveConfig find them
  const rawArgs = process.argv.slice(2);
  const hasDirArgs = rawArgs.includes('--memory-dir') && rawArgs.includes('--transcript-dir');

  let memoryDir;
  let transcriptDir;

  if (hasDirArgs) {
    for (let i = 0; i < rawArgs.length; i++) {
      if (rawArgs[i] === '--memory-dir' && i + 1 < rawArgs.length) {
        memoryDir = rawArgs[i + 1];
      } else if (rawArgs[i] === '--transcript-dir' && i + 1 < rawArgs.length) {
        transcriptDir = rawArgs[i + 1];
      }
    }
  } else {
    try {
      const cfg = resolveConfig(process.argv);
      memoryDir = cfg.memoryDir;
      transcriptDir = cfg.transcriptDir;
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log(buildPrompt(memoryDir, transcriptDir));
}

main();
