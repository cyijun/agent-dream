#!/usr/bin/env node
// Gate-checking script for agent-dream.
// Determines whether enough time and sessions have elapsed to run consolidation.

const fs = require('fs');
const path = require('path');
const { resolveConfig } = require('./resolve-config');

const HOLDER_STALE_MS = 60 * 60 * 1000;

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function countSessionsTouchedSince(transcriptDir, sinceMs) {
  try {
    const entries = fs.readdirSync(transcriptDir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(transcriptDir, entry.name);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.mtimeMs > sinceMs) {
          count++;
        }
      } catch {
        // ignore unreadable files
      }
    }
    return count;
  } catch {
    return 0;
  }
}

function tryAcquireLock(lockPath) {
  let mtimeMs;
  let holderPid;

  try {
    const stats = fs.statSync(lockPath);
    const raw = fs.readFileSync(lockPath, 'utf8');
    mtimeMs = stats.mtimeMs;
    const parsed = parseInt(raw.trim(), 10);
    holderPid = Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    // ENOENT or unreadable — no prior lock
  }

  if (mtimeMs !== undefined && Date.now() - mtimeMs < HOLDER_STALE_MS) {
    if (holderPid !== undefined && isProcessRunning(holderPid)) {
      return { acquired: false, priorMtime: mtimeMs };
    }
    // Dead PID or unparseable body — reclaim
  }

  // Ensure memory dir exists
  const memDir = path.dirname(lockPath);
  if (!fs.existsSync(memDir)) {
    fs.mkdirSync(memDir, { recursive: true });
  }

  fs.writeFileSync(lockPath, String(process.pid));

  let verify;
  try {
    verify = fs.readFileSync(lockPath, 'utf8');
  } catch {
    return { acquired: false, priorMtime: mtimeMs ?? 0 };
  }

  if (parseInt(verify.trim(), 10) !== process.pid) {
    return { acquired: false, priorMtime: mtimeMs ?? 0 };
  }

  return { acquired: true, priorMtime: mtimeMs ?? 0 };
}

function main() {
  const acquireLock = process.argv.includes('--acquire-lock');

  let cfg;
  try {
    cfg = resolveConfig(process.argv);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const lockPath = path.join(cfg.memoryDir, cfg.lockFileName);

  let lastAt = 0;
  try {
    const stats = fs.statSync(lockPath);
    lastAt = stats.mtimeMs;
  } catch {
    lastAt = 0;
  }

  const hoursSince = (Date.now() - lastAt) / 3600000;
  if (hoursSince < cfg.minHours) {
    console.error(
      `Time gate closed — ${hoursSince.toFixed(1)}h since last consolidation, need ${cfg.minHours}h`
    );
    process.exit(1);
  }

  const sessionCount = countSessionsTouchedSince(cfg.transcriptDir, lastAt);
  if (sessionCount < cfg.minSessions) {
    console.error(
      `Session gate closed — ${sessionCount} sessions since last consolidation, need ${cfg.minSessions}`
    );
    process.exit(1);
  }

  if (acquireLock) {
    const result = tryAcquireLock(lockPath);
    if (!result.acquired) {
      console.error('Lock already held by another live process');
      process.exit(1);
    }
  }

  console.log(
    `Gates open — ${hoursSince.toFixed(1)}h since last, ${sessionCount} sessions touched`
  );
  process.exit(0);
}

main();
