#!/usr/bin/env node
// `npm run uso`: inventário vivo de uso e cota (docs/regras/gastos.md). Só lê; não consome cota de modelo.
// Sai com código 3 se algum percentual estiver em 70% ou mais (regra de parada).

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUOTA_STOP_PERCENT, currentPercent, lastCodexRateLimits, quotaAlerts, summarizeClaudeStream } from './lib/usage.mjs';

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

// Linha de cota: leitura expirada (janela já reiniciada) vira "não disponível"; mostra o reset.
function quotaRow(name, percent, resetsAt, source) {
  const value = currentPercent(percent, resetsAt);
  const reset = typeof resetsAt === 'number' ? `; reset ${when(resetsAt * 1000)}` : '';
  return { name, percent: value.percent, source: value.expired ? `leitura expirada (janela reiniciada)${reset}` : `${source}${reset}` };
}

const when = (ms) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const rows = [];

// Claude Code: última sessão de agente gravada por scripts/sessao-agente.mjs.
const claudeLog = newestFile(join(ROOT, '.agent-logs'), (name) => name.endsWith('.jsonl'));
const claude = claudeLog ? summarizeClaudeStream(readFileSync(claudeLog.path, 'utf8')) : null;
const claudeSource = claudeLog ? `sessão de ${when(claudeLog.mtimeMs)}` : 'sem sessão em .agent-logs/';
rows.push(quotaRow('Claude Code — janela 5h', claude?.fiveHour ?? null, claude?.fiveHourResetsAt ?? null, claudeSource));
rows.push(quotaRow('Claude Code — 7 dias', claude?.sevenDay ?? null, claude?.sevenDayResetsAt ?? null, claudeSource));

// Codex: última sessão em ~/.codex/sessions (gravada pelo codex-review.mjs ou qualquer uso do Codex).
const codexDir = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions');
const codexLog = newestFile(codexDir, (name) => name.startsWith('rollout-') && name.endsWith('.jsonl'));
const codex = codexLog ? lastCodexRateLimits(readFileSync(codexLog.path, 'utf8')) : null;
const codexSource = codexLog ? `sessão de ${when(codexLog.mtimeMs)}` : 'sem sessão do Codex';
rows.push(quotaRow('Codex — janela 5h', codex?.fiveHour ?? null, codex?.fiveHourResetsAt ?? null, codexSource));
rows.push(quotaRow('Codex — semanal', codex?.weekly ?? null, codex?.weeklyResetsAt ?? null, codexSource));

// GitHub API: limite por hora do token.
const core = gh(['api', 'rate_limit'])?.resources?.core;
rows.push({
  name: 'GitHub API — por hora',
  percent: core ? Math.round((core.used / core.limit) * 1000) / 10 : null,
  source: core ? `${core.used}/${core.limit} requisições` : 'gh indisponível',
});

// GitHub Actions: repositório público com runner padrão é grátis (sem limite de minutos).
// Mede execuções e minutos do mês, e execuções por PR (indicador de "um push por tarefa").
// Com a API em 70% ou mais, não gasta mais requisições (regra de parada).
const apiStopped = core && (core.used / core.limit) * 100 >= QUOTA_STOP_PERCENT;
const repo = apiStopped ? null : gh(['repo', 'view', '--json', 'nameWithOwner']);
let actions = apiStopped ? 'não consultado: API do GitHub em 70% ou mais' : 'gh indisponível';
if (repo) {
  const month = new Date().toISOString().slice(0, 7);
  // Pagina até cobrir total_count (100 por página).
  const list = [];
  let total = null;
  for (let page = 1; total === null || list.length < total; page += 1) {
    const runs = gh(['api', `repos/${repo.nameWithOwner}/actions/runs?per_page=100&page=${page}&created=>=${month}-01`]);
    if (!runs) break;
    total = runs.total_count;
    if ((runs.workflow_runs ?? []).length === 0) break;
    list.push(...runs.workflow_runs);
  }
  if (total !== null) {
    const runs = { total_count: total };
    const minutes = list.reduce((sum, run) => sum + Math.max(0, (Date.parse(run.updated_at) - Date.parse(run.run_started_at ?? run.created_at)) / 60000), 0);
    const perPr = {};
    for (const run of list) for (const pr of run.pull_requests ?? []) perPr[pr.number] = (perPr[pr.number] ?? 0) + 1;
    const multi = Object.entries(perPr).filter(([, count]) => count > 1).map(([number, count]) => `#${number}:${count}`);
    const partial = list.length < total ? ` (parcial: ${list.length} lidas)` : '';
    actions = `${runs.total_count} execuções em ${month}${partial}, ~${minutes.toFixed(1)} min de relógio; PRs com mais de 1 execução: ${multi.join(' ') || 'nenhum'}`;
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
