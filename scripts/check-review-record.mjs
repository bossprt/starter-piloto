#!/usr/bin/env node
// CI (job revisao-registrada): exige registro da revisão do Codex no commit de topo e assinatura
// (trailer Agente:) em todos os commits do PR. Uso: node scripts/check-review-record.mjs --base <sha>

import { spawnSync } from 'node:child_process';
import { unsignedCommits, verifyReviewRecord } from './lib/review-record.mjs';

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout;
}

const index = process.argv.indexOf('--base');
const base = index > -1 ? process.argv[index + 1] : 'origin/main';

const errors = [];
const record = verifyReviewRecord({ message: git(['log', '-1', '--format=%B', 'HEAD']), tree: git(['rev-parse', 'HEAD^{tree}']).trim() });
if (!record.ok) errors.push(`revisão: ${record.reason}`);

const raw = git(['log', '--format=%H%x00%B%x1e', `${base}..HEAD`]);
const commits = raw.split('\x1e').map((chunk) => chunk.trim()).filter(Boolean).map((chunk) => {
  const [sha, message] = chunk.split('\x00');
  return { sha, message };
});
const unsigned = unsignedCommits(commits);
if (unsigned.length > 0) errors.push(`assinatura: commits sem trailer "Agente:": ${unsigned.map((sha) => sha.slice(0, 8)).join(', ')}`);

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  console.error('Rode: node scripts/codex-review.mjs --task TASK-NNN --registrar (ADR 0004).');
  process.exit(1);
}
console.log(`ok: ${record.reason}; ${commits.length} commit(s) assinados`);
