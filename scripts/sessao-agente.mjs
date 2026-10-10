#!/usr/bin/env node
// Abre uma sessão nova do Claude Code, não interativa e sem histórico, isolada da configuração global
// do usuário (plugins, skills, MCP e hooks globais), para não reler ~40 mil tokens de contexto a cada turno.
// Medição (2026-10-10): mesma pergunta da Etapa 6, 263.180 tokens de entrada sem isolamento contra 20.409 com.
// Uso: node scripts/sessao-agente.mjs "<prompt>" [--ferramentas Bash,Read,Edit,Write,Glob,Grep] [--permitir "<regra>"...]
// Grava o stream-json em .agent-logs/ (ignorado pelo git) e imprime tokens, custo e cota do Claude.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quotaAlerts, summarizeClaudeStream } from './lib/usage.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const OPTIONS_WITH_VALUE = ['--ferramentas', '--permitir'];
const prompt = args.find((arg, index) => !arg.startsWith('--') && !OPTIONS_WITH_VALUE.includes(args[index - 1] ?? ''));
if (!prompt) {
  console.error('uso: node scripts/sessao-agente.mjs "<prompt>" [--ferramentas Bash,Read,...] [--permitir "Bash(git:*)" ...]');
  process.exit(2);
}
const toolsIndex = args.indexOf('--ferramentas');
const tools = toolsIndex > -1 ? args[toolsIndex + 1] : 'Bash,Read,Edit,Write,Glob,Grep';
const allow = args.flatMap((arg, index) => (args[index - 1] === '--permitir' ? [arg] : []));

const claudeArgs = [
  '-p', prompt,
  '--no-session-persistence',
  '--output-format', 'stream-json', '--verbose',
  // Isolamento: só configurações do projeto (.claude/), sem MCP e sem skills globais.
  '--setting-sources', 'project,local',
  '--strict-mcp-config',
  '--disable-slash-commands',
  '--tools', tools,
  '--permission-mode', 'acceptEdits',
  ...(allow.length > 0 ? ['--allowedTools', ...allow] : []),
];
const result = spawnSync('claude', claudeArgs, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
if (result.error) {
  console.error(`sessao-agente: não foi possível iniciar o claude: ${result.error.message}`);
  process.exit(2);
}

const dir = join(ROOT, '.agent-logs');
mkdirSync(dir, { recursive: true });
const file = join(dir, `sessao-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
writeFileSync(file, result.stdout ?? '');

const s = summarizeClaudeStream(result.stdout);
const lastResult = `${result.stdout ?? ''}`.split('\n').filter((line) => line.includes('"type":"result"')).pop();
let answer;
try {
  answer = lastResult ? (JSON.parse(lastResult).result ?? '') : '';
} catch {
  answer = '';
}
console.log(answer);
console.log('');
console.log(`log: ${file}`);
console.log(`ferramentas: ${s.tools ?? '?'} · contexto da 1ª chamada: ${s.contextTokens ?? 'não disponível'} tokens · turnos: ${s.turns}`);
console.log(`tokens de entrada: ${s.totalInput} (novos ${s.input}, cache criado ${s.cacheCreation}, cache lido ${s.cacheRead}) · saída: ${s.output}`);
console.log(`custo informado: ${s.costUsd === null ? 'não disponível' : `US$ ${s.costUsd.toFixed(3)}`}`);
console.log(`cota do Claude: 5h ${s.fiveHour ?? 'não disponível'}% · 7 dias ${s.sevenDay ?? 'não disponível'}%`);
process.exitCode = result.status ?? 1;
const alerts = quotaAlerts([{ name: 'Claude 5h', percent: s.fiveHour }, { name: 'Claude 7 dias', percent: s.sevenDay }]);
if (alerts.length > 0) {
  console.log(`PARAR: ${alerts.map((a) => `${a.name} em ${a.percent}%`).join('; ')}. Não abra novas sessões; abra pendência (docs/regras/gastos.md).`);
  process.exitCode = 3;
}
