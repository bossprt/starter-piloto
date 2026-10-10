#!/usr/bin/env node
// Hook Stop do Claude Code: roda `npm run validate` ao fim do trabalho.
// Sem laço: se o Claude já está continuando por causa deste hook (stop_hook_active), não bloqueia de novo.
// Sem travar: validate tem tempo-limite próprio; falha de infraestrutura nunca bloqueia.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const TIMEOUT_MS = 240_000;

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  input = {};
}

if (input.stop_hook_active === true) process.exit(0);

const result = spawnSync(process.execPath, [join(ROOT, 'scripts', 'validate.mjs')], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: TIMEOUT_MS,
});

if (result.error) {
  // Tempo esgotado ou falha ao iniciar: avisa, não bloqueia.
  console.log(JSON.stringify({ systemMessage: `hook validate não concluiu: ${result.error.message}` }));
  process.exit(0);
}
if (result.status === 0) process.exit(0);

const tail = `${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-25).join('\n');
console.log(JSON.stringify({
  decision: 'block',
  reason: `npm run validate falhou. Corrija antes de encerrar ou registre o motivo.\n${tail}`,
}));
process.exit(0);
