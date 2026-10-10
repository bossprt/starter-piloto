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
  if (!repo.ok) return { prs: null, pendencias: null, protection: { ok: false, error: `repositório inacessível: ${repo.error}` } };
  const name = repo.data.nameWithOwner;

  const prsResult = ghJson([
    'pr', 'list', '--state', 'all', '--limit', '500',
    '--json', 'number,title,state,isDraft,createdAt,mergedAt,closedAt,labels,statusCheckRollup,headRefName',
  ]);
  const issuesResult = ghJson([
    'issue', 'list', '--state', 'all', '--label', 'depende-de-mim', '--limit', '500',
    '--json', 'number,title,state,body',
  ]);
  const protectionRaw = gh(['api', `repos/${name}/branches/main/protection`]);
  let protection;
  if (protectionRaw.ok) {
    protection = { ok: true, data: JSON.parse(protectionRaw.stdout) };
  } else if (/Branch not protected/i.test(protectionRaw.error)) {
    protection = { ok: false, notProtected: true };
  } else {
    protection = { ok: false, error: protectionRaw.error };
  }
  return {
    prs: prsResult.ok ? prsResult.data : null,
    pendencias: issuesResult.ok ? issuesResult.data : null,
    protection,
  };
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
