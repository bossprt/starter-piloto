// Checagens de estrutura do starter. Funções puras: recebem conteúdo, devolvem lista de erros.
// A leitura do disco fica em scripts/check-structure.mjs.

import { parseFrontmatter } from './frontmatter.mjs';

export const AGENTS_MAX_LINES = 100;
export const TASK_REQUIRED_KEYS = ['id', 'title', 'depends_on', 'validation', 'test_command'];
export const TASK_FORBIDDEN_KEYS = ['status', 'owner', 'evidence'];
export const TASK_VALIDATIONS = ['ci', 'ci+humano'];

/** Conta linhas como o editor mostra (newline final não cria linha extra). */
export function countLines(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  if (normalized === '') return 0;
  return normalized.replace(/\n$/, '').split('\n').length;
}

/** @param {string | null} agents conteúdo do AGENTS.md ou null se ausente */
export function checkAgents(agents) {
  if (agents === null) return ['AGENTS.md ausente'];
  const lines = countLines(agents);
  return lines > AGENTS_MAX_LINES ? [`AGENTS.md tem ${lines} linhas (máximo ${AGENTS_MAX_LINES})`] : [];
}

/** @param {string | null} claude conteúdo do CLAUDE.md ou null se ausente */
export function checkClaude(claude) {
  if (claude === null) return ['CLAUDE.md ausente'];
  const first = claude.replace(/\r\n/g, '\n').split('\n')[0];
  return first === '@AGENTS.md' ? [] : [`CLAUDE.md: primeira linha deve ser "@AGENTS.md" (encontrado "${first}")`];
}

/**
 * @param {Array<{ file: string, content: string }>} files arquivos de docs/tasks/
 */
export function checkTasks(files) {
  const errors = [];
  const ids = new Set();
  const parsed = [];
  for (const { file, content } of files) {
    const nameMatch = /^(TASK-\d{3})\.md$/.exec(file);
    if (!nameMatch) {
      errors.push(`${file}: nome deve seguir TASK-NNN.md`);
      continue;
    }
    const { data, error } = parseFrontmatter(content);
    if (!data) {
      errors.push(`${file}: ${error}`);
      continue;
    }
    for (const key of TASK_REQUIRED_KEYS) {
      if (!(key in data) || data[key] === '') errors.push(`${file}: campo obrigatório "${key}" ausente`);
    }
    for (const key of TASK_FORBIDDEN_KEYS) {
      if (key in data) errors.push(`${file}: campo "${key}" proibido (estado vem de PRs e CI)`);
    }
    if (data.id !== undefined && data.id !== nameMatch[1]) {
      errors.push(`${file}: id "${data.id}" não corresponde ao nome do arquivo`);
    }
    if (data.validation !== undefined && !TASK_VALIDATIONS.includes(String(data.validation))) {
      errors.push(`${file}: validation deve ser ${TASK_VALIDATIONS.join(' ou ')}`);
    }
    if (data.depends_on !== undefined && !Array.isArray(data.depends_on)) {
      errors.push(`${file}: depends_on deve ser lista, ex.: [] ou [TASK-001]`);
    }
    ids.add(nameMatch[1]);
    parsed.push({ file, data });
  }
  for (const { file, data } of parsed) {
    if (!Array.isArray(data.depends_on)) continue;
    for (const dep of data.depends_on) {
      if (!ids.has(dep)) errors.push(`${file}: depends_on referencia tarefa inexistente "${dep}"`);
    }
  }
  return errors;
}

/** @param {string[]} fileNames nomes dos arquivos em docs/decisions/ */
export function checkAdrNumbering(fileNames) {
  const errors = [];
  const numbers = [];
  for (const name of fileNames) {
    const match = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.exec(name);
    if (!match) {
      errors.push(`docs/decisions/${name}: nome deve seguir NNNN-slug.md`);
      continue;
    }
    numbers.push(Number(match[1]));
  }
  numbers.sort((a, b) => a - b);
  for (let i = 0; i < numbers.length; i += 1) {
    const expected = i + 1;
    if (numbers[i] !== expected) {
      errors.push(`docs/decisions: numeração deve ser sequencial a partir de 0001 sem lacunas nem repetição (esperado ${String(expected).padStart(4, '0')}, encontrado ${String(numbers[i]).padStart(4, '0')})`);
      break;
    }
  }
  return errors;
}

/**
 * @param {{ agents: string | null, claude: string | null, tasks: Array<{file: string, content: string}>, adrs: string[] }} input
 */
export function runStructureChecks(input) {
  return [
    ...checkAgents(input.agents),
    ...checkClaude(input.claude),
    ...checkTasks(input.tasks),
    ...checkAdrNumbering(input.adrs),
  ];
}
