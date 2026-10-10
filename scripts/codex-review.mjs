#!/usr/bin/env node
// Revisão independente pelo Codex, sempre em somente leitura (ADR 0002).
// Uso: node scripts/codex-review.mjs [--base main] [--task TASK-NNN]
// Imprime a resposta final do Codex e a linha "tokens used" para docs/metrics/sessions.md.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const base = arg('--base', 'main');
const task = arg('--task', '');

// Localiza o pacote @openai/codex no prefixo global do npm e roda o bin/codex.js com este node.
// Assim não há shell no meio (aspas e acentos chegam intactos) e não depende do PATH.
function findCodex() {
  const npm = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['prefix', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' });
  const prefix = (npm.stdout ?? '').trim();
  const roots = process.platform === 'win32' ? [prefix] : [join(prefix, 'lib')];
  for (const root of roots) {
    const entry = join(root, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (existsSync(entry)) return entry;
  }
  return null;
}

const codex = findCodex();
if (!codex) {
  console.error('codex-review: Codex CLI não encontrado (npm install -g @openai/codex). Registre "revisão: não realizada".');
  process.exit(2);
}

const prompt = [
  'Você é revisor independente, em somente leitura. Não altere arquivos.',
  `Revise as mudanças da branch atual contra ${base}: rode "git diff ${base}...HEAD" e leia o que precisar.`,
  task ? `A tarefa está em docs/tasks/${task}.md; confira os critérios de aceite.` : '',
  'Avalie: correção (critérios de aceite e casos de borda), segurança, manutenção e conflito com docs/decisions/ e docs/ARCHITECTURE.md.',
  'Liste achados com severidade (alta/média/baixa), arquivo:linha e sugestão. Se não houver defeito real, diga explicitamente.',
].filter(Boolean).join(' ');

// windows.sandbox="unelevated": contorna o bug do sandbox elevado do Codex 0.162.x no Windows
// (os error 32 em node_repl.exe; openai/codex#52501). Somente leitura continua garantido por -s read-only.
const args = [codex, 'exec', '--ephemeral', '-s', 'read-only', '-c', 'windows.sandbox="unelevated"', '-'];
const result = spawnSync(process.execPath, args, { encoding: 'utf8', input: prompt, maxBuffer: 64 * 1024 * 1024 });

// codex exec escreve a resposta final no stdout e o progresso (incluindo "tokens used") no stderr.
const finalAnswer = `${result.stdout ?? ''}`.trim();
const tokens = /tokens used\s*\n\s*([\d.,]+)/.exec(`${result.stderr ?? ''}`)?.[1] ?? 'não disponível';
if (result.status !== 0 || finalAnswer === '') {
  console.error(`codex-review: Codex falhou (código ${result.status}). Registre "revisão: não realizada".`);
  console.error(`${result.stderr ?? ''}`.split('\n').slice(-15).join('\n'));
  process.exit(1);
}
console.log(finalAnswer);
console.log(`\ntokens usados pelo Codex: ${tokens}`);
