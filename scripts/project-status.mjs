#!/usr/bin/env node
// Estado do projeto derivado de PRs, CI, pendências e proteção da main.
// Uso: node scripts/project-status.mjs [--json]
// Esta camada só coleta dados (disco e gh). A derivação fica em lib/derive-status.mjs.

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import { deriveProjectStatus } from './lib/derive-status.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const REQUIRED_CHECK = 'validate';

function gh(args) {
  const result = spawnSync('gh', args, { cwd: ROOT, encoding: 'utf8', shell: false });
  if (result.error) return { ok: false, error: result.error.message };
  if (result.status !== 0) return { ok: false, error: (result.stderr || result.stdout || '').trim() };
  return { ok: true, stdout: result.stdout };
}

function ghJson(args) {
  const result = gh(args);
  if (!result.ok) return result;
  try {
    return { ok: true, data: JSON.parse(result.stdout) };
  } catch (error) {
    return { ok: false, error: `JSON inválido do gh: ${error.message}` };
  }
}

function loadTasks() {
  const dir = join(ROOT, 'docs', 'tasks');
  return readdirSync(dir)
    .filter((file) => /^TASK-\d{3}\.md$/.test(file))
    .map((file) => parseFrontmatter(readFileSync(join(dir, file), 'utf8')).data)
    .filter(Boolean);
}

function collect() {
  const repo = ghJson(['repo', 'view', '--json', 'nameWithOwner']);
  if (!repo.ok) {
    const error = `repositório inacessível: ${repo.error}`;
    return { prs: null, pendencias: null, protection: { classic: { ok: false, error }, rules: { ok: false, error } } };
  }
  const name = repo.data.nameWithOwner;

  const prsResult = ghJson([
    'pr', 'list', '--state', 'all', '--limit', '500',
    '--json', 'number,title,state,isDraft,createdAt,mergedAt,closedAt,labels,statusCheckRollup,headRefName,headRefOid',
  ]);
  if (prsResult.ok) attachReviewHeads(name, prsResult.data);
  const issuesResult = ghJson([
    'issue', 'list', '--state', 'all', '--label', 'depende-de-mim', '--limit', '500',
    '--json', 'number,title,state,body',
  ]);
  return {
    prs: prsResult.ok ? prsResult.data : null,
    pendencias: issuesResult.ok ? issuesResult.data : null,
    protection: { classic: collectClassic(name), rules: collectRules(name) },
  };
}

// Commit de topo (mensagem e árvore) dos PRs de tarefa abertos ou integrados, para verificar o registro
// da revisão do Codex (ADR 0004). Só PRs com TASK-NNN no título.
function attachReviewHeads(name, prs) {
  for (const pr of prs) {
    if (!/TASK-\d{3}/.test(pr.title) || pr.state === 'CLOSED' || !pr.headRefOid) continue;
    const commit = ghJson(['api', `repos/${name}/commits/${pr.headRefOid}`]);
    if (commit.ok) pr.reviewHead = { message: commit.data.commit.message, tree: commit.data.commit.tree.sha };
  }
}

// Proteção clássica: GET /repos/{owner}/{repo}/branches/main/protection.
function collectClassic(name) {
  const raw = gh(['api', `repos/${name}/branches/main/protection`]);
  if (raw.ok) return { ok: true, data: JSON.parse(raw.stdout) };
  if (/Branch not protected/i.test(raw.error)) return { ok: false, notProtected: true };
  return { ok: false, error: raw.error };
}

// Rulesets: regras efetivas da branch + detalhe de cada ruleset (bypass_actors, enforcement).
function collectRules(name) {
  const rules = ghJson(['api', `repos/${name}/rules/branches/main`]);
  if (!rules.ok) return { ok: false, error: rules.error };
  const rulesets = {};
  for (const id of new Set(rules.data.map((rule) => rule.ruleset_id))) {
    const detail = ghJson(['api', `repos/${name}/rulesets/${id}`]);
    rulesets[id] = detail.ok ? detail.data : { error: detail.error };
  }
  return { ok: true, data: rules.data, rulesets };
}

function render(status) {
  const lines = ['Tarefas:'];
  for (const task of status.tasks) {
    lines.push(`  ${task.id}  ${(task.label ?? task.state).padEnd(31)} ${task.title}`);
    lines.push(`            ${task.detail}`);
  }
  lines.push('', `Próxima tarefa: ${status.next ?? 'nenhuma disponível'}`);
  lines.push(`Proteção da main: ${status.protection.state} (${status.protection.detail})`);
  if (status.pendencias === null) {
    lines.push('Pendências abertas: desconhecido (GitHub inacessível)');
  } else if (status.pendencias.length === 0) {
    lines.push('Pendências abertas: nenhuma');
  } else {
    lines.push('Pendências abertas:');
    for (const issue of status.pendencias) lines.push(`  #${issue.number} ${issue.title}`);
  }
  return lines.join('\n');
}

const status = deriveProjectStatus({ tasks: loadTasks(), ...collect(), requiredCheck: REQUIRED_CHECK });
console.log(process.argv.includes('--json') ? JSON.stringify(status, null, 2) : render(status));
