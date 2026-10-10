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

// Arquivos do mais novo para o mais antigo.
function filesNewestFirst(dir, filter) {
  if (!existsSync(dir)) return [];
  const found = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) stack.push(full);
      else if (filter(name)) found.push({ path: full, mtimeMs: stat.mtimeMs });
    }
  }
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

// Leitura de cota mais recente disponível: uma sessão nova sem dados de cota não esconde a anterior.
// Limita a 50 arquivos para não varrer histórico inteiro.
function newestReading(dir, filter, parse, hasReading) {
  for (const file of filesNewestFirst(dir, filter).slice(0, 50)) {
    const reading = parse(readFileSync(file.path, 'utf8'));
    if (reading && hasReading(reading)) return { file, reading };
  }
  return null;
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
const claudeFound = newestReading(join(ROOT, '.agent-logs'), (name) => name.endsWith('.jsonl'), summarizeClaudeStream, (r) => r.fiveHour !== null || r.sevenDay !== null);
const claude = claudeFound?.reading ?? null;
const claudeSource = claudeFound ? `sessão de ${when(claudeFound.file.mtimeMs)}` : 'sem leitura em .agent-logs/';
rows.push(quotaRow('Claude Code — janela 5h', claude?.fiveHour ?? null, claude?.fiveHourResetsAt ?? null, claudeSource));
rows.push(quotaRow('Claude Code — 7 dias', claude?.sevenDay ?? null, claude?.sevenDayResetsAt ?? null, claudeSource));

// Codex: última sessão em ~/.codex/sessions (gravada pelo codex-review.mjs ou qualquer uso do Codex).
const codexDir = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions');
const codexFound = newestReading(codexDir, (name) => name.startsWith('rollout-') && name.endsWith('.jsonl'), lastCodexRateLimits, () => true);
const codex = codexFound?.reading ?? null;
const codexSource = codexFound ? `sessão de ${when(codexFound.file.mtimeMs)}` : 'sem leitura do Codex';
rows.push(quotaRow('Codex — janela 5h', codex?.fiveHour ?? null, codex?.fiveHourResetsAt ?? null, codexSource));
rows.push(quotaRow('Codex — semanal', codex?.weekly ?? null, codex?.weeklyResetsAt ?? null, codexSource));

// GitHub API: limite por hora do token.
// GET /rate_limit não conta no limite da API; é reconsultado a cada página de execuções.
const readCore = () => gh(['api', 'rate_limit'])?.resources?.core ?? null;
const apiPercent = (c) => (c ? Math.round((c.used / c.limit) * 1000) / 10 : null);
let core = readCore();

// GitHub Actions: repositório público com runner padrão é grátis (sem limite de minutos).
// Mede execuções e minutos do mês, e execuções por PR (indicador de "um push por tarefa").
// Com a API em 70% ou mais, não gasta mais requisições (regra de parada).
let apiStopped = (apiPercent(core) ?? 0) >= QUOTA_STOP_PERCENT;
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
    core = readCore() ?? core;
    if ((apiPercent(core) ?? 0) >= QUOTA_STOP_PERCENT) {
      apiStopped = true;
      break;
    }
  }
  if (total !== null) {
    const runs = { total_count: total };
    const minutes = list.reduce((sum, run) => sum + Math.max(0, (Date.parse(run.updated_at) - Date.parse(run.run_started_at ?? run.created_at)) / 60000), 0);
    const perPr = {};
    for (const run of list) for (const pr of run.pull_requests ?? []) perPr[pr.number] = (perPr[pr.number] ?? 0) + 1;
    const multi = Object.entries(perPr).filter(([, count]) => count > 1).map(([number, count]) => `#${number}:${count}`);
    const partial = list.length < total ? ` (parcial: ${list.length} lidas${apiStopped ? '; parado: API em 70%' : ''})` : '';
    actions = `${runs.total_count} execuções em ${month}${partial}, ~${minutes.toFixed(1)} min de relógio; PRs com mais de 1 execução: ${multi.join(' ') || 'nenhum'}`;
  }
}

rows.push({ name: 'GitHub API — por hora', percent: apiPercent(core), source: core ? `${core.used}/${core.limit} requisições` : 'gh indisponível' });

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
