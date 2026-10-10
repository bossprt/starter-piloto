#!/usr/bin/env node
// Revisão independente pelo Codex, sempre em somente leitura (ADR 0002), com registro verificável (ADR 0004).
// Uso: node scripts/codex-review.mjs [--base main] [--task TASK-NNN] [--registrar]
// Sem --registrar: só imprime a revisão. Com --registrar: grava o resultado num commit vazio no topo da
// branch (trailers Codex-Review e Codex-Review-Tree), que o CI (revisao-registrada) e o npm run status verificam.
// Sempre imprime tokens e a cota do Codex (janela de 5h e semanal), para docs/metrics/sessions.md e gastos.md.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildRecordMessage, parseVerdict } from './lib/review-record.mjs';
import { QUOTA_STOP_PERCENT, lastCodexRateLimits } from './lib/usage.mjs';

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const base = arg('--base', 'main');
const task = arg('--task', '');
const register = process.argv.includes('--registrar');

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

if (register && git(['status', '--porcelain']) !== '') {
  console.error('codex-review: há mudanças não commitadas. Faça commit antes de revisar com --registrar.');
  process.exit(2);
}

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
const codexVersion = spawnSync(process.execPath, [codex, '--version'], { encoding: 'utf8' }).stdout.trim() || 'Codex CLI';

const head = git(['rev-parse', 'HEAD']);
const tree = git(['rev-parse', 'HEAD^{tree}']);
const baseSha = git(['rev-parse', base]);

const prompt = [
  'Você é revisor independente, em somente leitura. Não altere arquivos.',
  `Revise as mudanças da branch atual contra ${base}: rode "git diff ${base}...HEAD" e leia o que precisar.`,
  task ? `A tarefa está em docs/tasks/${task}.md; confira os critérios de aceite.` : '',
  'Avalie: correção (critérios de aceite e casos de borda), segurança, manutenção e conflito com docs/decisions/ e docs/ARCHITECTURE.md.',
  'Liste achados com severidade (alta/média/baixa), arquivo:linha e sugestão. Se não houver defeito real, diga explicitamente.',
  'Termine com uma única linha, exatamente "VEREDITO: sem-defeito" ou "VEREDITO: com-defeito".',
].filter(Boolean).join(' ');

// windows.sandbox="unelevated": contorna o bug do sandbox elevado do Codex 0.162.x no Windows
// (os error 32 em node_repl.exe; openai/codex#52501). Somente leitura continua garantido por -s read-only.
// Sem --ephemeral: a sessão fica em ~/.codex/sessions, de onde se lê a cota (rate_limits) e se audita a revisão.
const args = [codex, 'exec', '--json', '-s', 'read-only', '-c', 'windows.sandbox="unelevated"', '-'];
const result = spawnSync(process.execPath, args, { encoding: 'utf8', input: prompt, maxBuffer: 64 * 1024 * 1024 });

let threadId = null;
let answer = '';
let usage = null;
for (const line of `${result.stdout ?? ''}`.split('\n')) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    continue;
  }
  if (event.type === 'thread.started') threadId = event.thread_id;
  if (event.type === 'item.completed' && event.item?.type === 'agent_message') answer = event.item.text;
  if (event.type === 'turn.completed') usage = event.usage;
}

if (result.status !== 0 || answer.trim() === '') {
  console.error(`codex-review: Codex falhou (código ${result.status}). Registre "revisão: não realizada".`);
  console.error(`${result.stderr ?? ''}`.split('\n').slice(-15).join('\n'));
  process.exit(1);
}

const tokens = usage ? usage.input_tokens + usage.output_tokens : null;

// Cota do Codex: último rate_limits do arquivo da sessão (~/.codex/sessions/AAAA/MM/DD/rollout-*-<thread>.jsonl).
function readRateLimits(id) {
  const root = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions');
  if (!id || !existsSync(root)) return null;
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (name.endsWith(`${id}.jsonl`)) return lastCodexRateLimits(readFileSync(full, 'utf8'));
    }
  }
  return null;
}
const limits = readRateLimits(threadId);

const verdict = parseVerdict(answer);
console.log(answer.trim());
console.log('');
console.log(`veredito: ${verdict ?? 'não informado pelo Codex'}`);
console.log(`tokens usados pelo Codex: ${tokens ?? 'não disponível'}${usage ? ` (entrada ${usage.input_tokens}, cache ${usage.cached_input_tokens}, saída ${usage.output_tokens})` : ''}`);
if (limits) {
  console.log(`cota do Codex: 5h ${limits.fiveHour ?? '?'}% · semanal ${limits.weekly ?? '?'}%`);
  if ((limits.fiveHour ?? 0) >= QUOTA_STOP_PERCENT || (limits.weekly ?? 0) >= QUOTA_STOP_PERCENT) {
    console.log('ATENÇÃO: cota do Codex em 70% ou mais. Pare revisões novas e abra pendência (docs/regras/gastos.md).');
  }
} else {
  console.log('cota do Codex: não disponível');
}

if (register) {
  if (!verdict) {
    console.error('codex-review: sem linha VEREDITO na resposta; nada registrado. Rode de novo.');
    process.exit(1);
  }
  // A revisão roda em segundo plano: confere de novo que nada mudou desde o início.
  if (git(['rev-parse', 'HEAD']) !== head || git(['rev-parse', base]) !== baseSha || git(['status', '--porcelain']) !== '') {
    console.error('codex-review: HEAD, base ou árvore de trabalho mudaram durante a revisão; nada registrado. Rode de novo.');
    process.exit(1);
  }
  // Commit explicitamente vazio: mesma árvore revisada, pai = HEAD revisado. Nada do índice entra.
  const message = buildRecordMessage({ verdict, tree, base: baseSha, tokens, threadId, summary: answer, codexVersion });
  const created = spawnSync('git', ['commit-tree', tree, '-p', head, '-F', '-'], { encoding: 'utf8', input: message });
  if (created.status !== 0) {
    console.error(`codex-review: falha ao registrar: ${created.stderr}`);
    process.exit(1);
  }
  // update-ref com valor antigo: falha se HEAD andou entre a conferência e a gravação.
  git(['update-ref', '-m', 'codex-review: registro', 'HEAD', created.stdout.trim(), head]);
  console.log(`registro gravado: ${git(['rev-parse', '--short', 'HEAD'])} (Codex-Review: ${verdict})`);
}
process.exitCode = verdict === 'sem-defeito' ? 0 : 3;
