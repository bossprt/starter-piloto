#!/usr/bin/env node
// `npm run uso`: inventário vivo de uso e cota (docs/regras/gastos.md). Só lê; não consome cota de modelo.
// Sai com código 3 se algum percentual estiver em 70% ou mais (regra de parada).

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lastCodexRateLimits, quotaAlerts, summarizeClaudeStream } from './lib/usage.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function newestFile(dir, filter) {
  if (!existsSync(dir)) return null;
  let best = null;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) stack.push(full);
      else if (filter(name) && (!best || stat.mtimeMs > best.mtimeMs)) best = { path: full, mtimeMs: stat.mtimeMs };
    }
  }
  return best;
}

function gh(args) {
  const result = spawnSync('gh', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

const when = (ms) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const rows = [];

// Claude Code: última sessão de agente gravada por scripts/sessao-agente.mjs.
const claudeLog = newestFile(join(ROOT, '.agent-logs'), (name) => name.endsWith('.jsonl'));
const claude = claudeLog ? summarizeClaudeStream(readFileSync(claudeLog.path, 'utf8')) : null;
const claudeSource = claudeLog ? `sessão de ${when(claudeLog.mtimeMs)}` : 'sem sessão em .agent-logs/';
rows.push({ name: 'Claude Code — janela 5h', percent: claude?.fiveHour ?? null, source: claudeSource });
rows.push({ name: 'Claude Code — 7 dias', percent: claude?.sevenDay ?? null, source: claudeSource });

// Codex: última sessão em ~/.codex/sessions (gravada pelo codex-review.mjs ou qualquer uso do Codex).
const codexDir = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions');
const codexLog = newestFile(codexDir, (name) => name.startsWith('rollout-') && name.endsWith('.jsonl'));
const codex = codexLog ? lastCodexRateLimits(readFileSync(codexLog.path, 'utf8')) : null;
const codexSource = codexLog ? `sessão de ${when(codexLog.mtimeMs)}` : 'sem sessão do Codex';
rows.push({ name: 'Codex — janela 5h', percent: codex?.fiveHour ?? null, source: codexSource });
rows.push({ name: 'Codex — semanal', percent: codex?.weekly ?? null, source: codexSource });

// GitHub API: limite por hora do token.
const core = gh(['api', 'rate_limit'])?.resources?.core;
rows.push({
  name: 'GitHub API — por hora',
  percent: core ? Math.round((core.used / core.limit) * 1000) / 10 : null,
  source: core ? `${core.used}/${core.limit} requisições` : 'gh indisponível',
});

// GitHub Actions: repositório público com runner padrão é grátis (sem limite de minutos).
// Mede execuções e minutos do mês, e execuções por PR (indicador de "um push por tarefa").
const repo = gh(['repo', 'view', '--json', 'nameWithOwner']);
let actions = 'gh indisponível';
if (repo) {
  const month = new Date().toISOString().slice(0, 7);
  const runs = gh(['api', `repos/${repo.nameWithOwner}/actions/runs?per_page=100&created=>=${month}-01`]);
  if (runs) {
    const list = runs.workflow_runs ?? [];
    const minutes = list.reduce((sum, run) => sum + Math.max(0, (Date.parse(run.updated_at) - Date.parse(run.run_started_at ?? run.created_at)) / 60000), 0);
    const perPr = {};
    for (const run of list) for (const pr of run.pull_requests ?? []) perPr[pr.number] = (perPr[pr.number] ?? 0) + 1;
    const multi = Object.entries(perPr).filter(([, count]) => count > 1).map(([number, count]) => `#${number}:${count}`);
    actions = `${runs.total_count} execuções em ${month}, ~${minutes.toFixed(1)} min de relógio; PRs com mais de 1 execução: ${multi.join(' ') || 'nenhum'}`;
  }
}

console.log('Uso e cota (docs/regras/gastos.md) — parar em 70%');
for (const row of rows) {
  const value = row.percent === null ? 'n/d' : `${row.percent}%`;
  console.log(`  ${row.name.padEnd(26)} ${value.padEnd(7)} ${row.source}`);
}
console.log(`  ${'GitHub Actions'.padEnd(26)} grátis  repositório público, runner padrão — ${actions}`);
console.log('  n/d = não disponível. Plano e limite de cada serviço: docs/metrics/servicos.md');

const alerts = quotaAlerts(rows);
if (alerts.length > 0) {
  console.log('');
  console.log(`PARAR: ${alerts.map((a) => `${a.name} em ${a.percent}%`).join('; ')}. Pare esse tipo de ação e abra pendência (depende-de-mim).`);
  process.exitCode = 3;
}
