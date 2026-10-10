#!/usr/bin/env node
// CI: escreve docs=true|false em $GITHUB_OUTPUT conforme o PR mude só documentação.
// Uso: node scripts/ci-escopo.mjs --base <sha> --head <sha>

import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { isDocsOnly } from './lib/ci-scope.mjs';

const value = (name) => process.argv[process.argv.indexOf(name) + 1];
// --no-renames: renomear src/x.ts para x.md aparece como remoção do .ts, não como só documentação.
const diff = spawnSync('git', ['diff', '--name-only', '--no-renames', `${value('--base')}...${value('--head')}`], { encoding: 'utf8' });
if (diff.status !== 0) {
  // Sem diff confiável: roda tudo.
  console.log(`diff indisponível (${diff.stderr.trim()}); rodando validação completa`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'docs=false\n');
  process.exit(0);
}
const docs = isDocsOnly(diff.stdout.split('\n'));
console.log(docs ? 'só documentação: rodando apenas checagens de estrutura' : 'há código ou configuração: validação completa');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `docs=${docs}\n`);
