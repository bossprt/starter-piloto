#!/usr/bin/env node
// Lê o disco e aplica as checagens puras de lib/structure-checks.mjs.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStructureChecks } from './lib/structure-checks.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function read(path) {
  const full = join(ROOT, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
}

function list(dir) {
  const full = join(ROOT, dir);
  return existsSync(full) ? readdirSync(full).filter((file) => file.endsWith('.md')) : [];
}

const errors = runStructureChecks({
  agents: read('AGENTS.md'),
  claude: read('CLAUDE.md'),
  tasks: list('docs/tasks').map((file) => ({ file, content: read(join('docs/tasks', file)) ?? '' })),
  adrs: list('docs/decisions'),
});

if (errors.length > 0) {
  console.error('Checagens de estrutura falharam:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log('Checagens de estrutura: ok');
