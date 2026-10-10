#!/usr/bin/env node
// `npm run validate`: lint, typecheck, testes e checagens de estrutura.
// Roda todas as etapas e falha no fim se alguma falhou.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BIN = (name) => join(ROOT, 'node_modules', name);

const steps = [
  { name: 'lint', args: [BIN('eslint/bin/eslint.js'), '.'] },
  { name: 'typecheck', args: [BIN('typescript/bin/tsc'), '--noEmit'] },
  { name: 'testes', args: [BIN('vitest/vitest.mjs'), 'run'] },
  { name: 'estrutura', args: [join(ROOT, 'scripts', 'check-structure.mjs')] },
];

const failed = [];
for (const step of steps) {
  console.log(`\n== ${step.name}`);
  const result = spawnSync(process.execPath, step.args, { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) failed.push(step.name);
}

console.log('');
if (failed.length > 0) {
  console.error(`validate: FALHOU em ${failed.join(', ')}`);
  process.exit(1);
}
console.log('validate: ok');
