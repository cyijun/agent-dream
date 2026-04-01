#!/usr/bin/env node
// Resolves agent-dream configuration from CLI args, env vars, or .agent-dream.json
// Pure Node.js — no Claude Code-specific dependencies.

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--memory-dir' && i + 1 < argv.length) {
      args.memoryDir = argv[++i];
    } else if (key === '--transcript-dir' && i + 1 < argv.length) {
      args.transcriptDir = argv[++i];
    } else if (key === '--config' && i + 1 < argv.length) {
      args.configPath = argv[++i];
    }
  }
  return args;
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveConfig(argv) {
  const args = parseArgs(argv);

  // 1. Explicit --config file
  if (args.configPath) {
    const cfg = readJsonSafe(args.configPath);
    if (!cfg) {
      throw new Error(`Failed to read config file: ${args.configPath}`);
    }
    return normalizeConfig(cfg);
  }

  // 2. CLI args override
  if (args.memoryDir || args.transcriptDir) {
    return normalizeConfig({
      memoryDir: args.memoryDir,
      transcriptDir: args.transcriptDir,
    });
  }

  // 3. AGENT_DREAM_CONFIG env var points to a JSON file
  const envConfigPath = process.env.AGENT_DREAM_CONFIG;
  if (envConfigPath) {
    const cfg = readJsonSafe(envConfigPath);
    if (!cfg) {
      throw new Error(`Failed to read AGENT_DREAM_CONFIG file: ${envConfigPath}`);
    }
    return normalizeConfig(cfg);
  }

  // 4. AGENT_DREAM_MEMORY_DIR / AGENT_DREAM_TRANSCRIPT_DIR env vars
  if (process.env.AGENT_DREAM_MEMORY_DIR || process.env.AGENT_DREAM_TRANSCRIPT_DIR) {
    return normalizeConfig({
      memoryDir: process.env.AGENT_DREAM_MEMORY_DIR,
      transcriptDir: process.env.AGENT_DREAM_TRANSCRIPT_DIR,
    });
  }

  // 5. .agent-dream.json in current working directory
  const cwConfigPath = path.join(process.cwd(), '.agent-dream.json');
  const cwCfg = readJsonSafe(cwConfigPath);
  if (cwCfg) {
    return normalizeConfig(cwCfg);
  }

  throw new Error(
    'No agent-dream configuration found.\n' +
      'Please provide one of:\n' +
      '  --config <path>\n' +
      '  --memory-dir <dir> --transcript-dir <dir>\n' +
      '  AGENT_DREAM_CONFIG=<path>\n' +
      '  AGENT_DREAM_MEMORY_DIR and AGENT_DREAM_TRANSCRIPT_DIR env vars\n' +
      '  Or create a .agent-dream.json in the current working directory.'
  );
}

function normalizeConfig(cfg) {
  const memoryDir = cfg.memoryDir;
  const transcriptDir = cfg.transcriptDir;

  if (!memoryDir) {
    throw new Error('Configuration missing "memoryDir"');
  }
  if (!transcriptDir) {
    throw new Error('Configuration missing "transcriptDir"');
  }

  return {
    memoryDir: path.resolve(memoryDir),
    transcriptDir: path.resolve(transcriptDir),
    lockFileName: cfg.lockFileName || '.consolidate-lock',
    minHours: typeof cfg.minHours === 'number' ? cfg.minHours : 24,
    minSessions: typeof cfg.minSessions === 'number' ? cfg.minSessions : 5,
  };
}

module.exports = { resolveConfig, parseArgs, readJsonSafe };

if (require.main === module) {
  try {
    const cfg = resolveConfig(process.argv);
    console.log(JSON.stringify(cfg, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
