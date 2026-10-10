// Derivação pura do estado do projeto. Nenhuma chamada a git, gh ou disco aqui.
// Entrada: tarefas (frontmatter), histórico de PRs, pendências e proteção da main.
// Evidência vem só do histórico de PRs, nunca de branches.

import { verifyReviewRecord } from './review-record.mjs';

// PRs integrados antes desta data podem usar a etiqueta revisao-sem-defeito no lugar do registro (ADR 0004).
export const REVIEW_RECORD_REQUIRED_SINCE = '2026-10-10T22:00:00Z';

export const TASK_ID_PATTERN = /(?<![\w-])TASK-(\d{3})(?![\w-])/;

/**
 * Resume os checks de um PR.
 * @param {Array<{ status?: string, conclusion?: string | null, state?: string }> | null | undefined} rollup
 * @returns {'verdes' | 'vermelhos' | 'pendentes' | 'nenhum'}
 */
export function summarizeChecks(rollup) {
  if (!rollup || rollup.length === 0) return 'nenhum';
  let pending = false;
  for (const item of rollup) {
    // CheckRun: status + conclusion. StatusContext: state.
    const conclusion = (item.conclusion ?? item.state ?? '').toUpperCase();
    const status = (item.status ?? '').toUpperCase();
    if (['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE'].includes(conclusion)) {
      return 'vermelhos';
    }
    if (conclusion === 'PENDING' || conclusion === 'EXPECTED' || (status !== '' && status !== 'COMPLETED') || conclusion === '') {
      pending = true;
    }
  }
  return pending ? 'pendentes' : 'verdes';
}

/** Extrai o id da tarefa do título do PR. */
export function taskIdFromTitle(title) {
  const match = TASK_ID_PATTERN.exec(title ?? '');
  return match ? `TASK-${match[1]}` : null;
}

/**
 * Tarefas que a pendência bloqueia: as citadas no título ou na linha `Bloqueia: TASK-NNN, ...` do corpo.
 * Menção solta no corpo não bloqueia (ex.: "as TASK-001 a 003 seguem").
 */
export function blockedTasks(issue) {
  const ids = new Set();
  // Identificador completo: não casa TASK-0010 nem TASK-001ABC.
  const taskIds = (text) => String(text ?? '').matchAll(/(?<![\w-])TASK-\d{3}(?![\w-])/g);
  for (const match of taskIds(issue.title)) ids.add(match[0]);
  for (const line of String(issue.body ?? '').split(/\r?\n/)) {
    // Exige os dois-pontos: "Bloqueia:", "**Bloqueia:**" ou "**Bloqueia**:", opcionalmente em item de lista.
    const declared = /^\s*(?:[-*]\s+)?(?:\*\*Bloqueia:\*\*|\*\*Bloqueia\*\*:|Bloqueia:)\s*(.*)$/i.exec(line);
    if (!declared) continue;
    for (const match of taskIds(declared[1])) ids.add(match[0]);
  }
  return ids;
}

function mentions(issue, taskId) {
  return blockedTasks(issue).has(taskId);
}

function byDateDesc(field) {
  return (a, b) => String(b[field] ?? '').localeCompare(String(a[field] ?? ''));
}

/**
 * Deriva o estado de uma tarefa.
 * @param {{ id: string, validation: string, decisao_pendente?: string }} task
 * @param {Array<any> | null} prs histórico completo de PRs; null = GitHub inacessível
 * @param {Array<any> | null} pendencias issues com etiqueta depende-de-mim; null = inacessível
 */
export function deriveTaskState(task, prs, pendencias) {
  if (prs === null) {
    return { state: 'desconhecido', detail: 'GitHub inacessível: sem histórico de PRs', attempts: 0 };
  }
  const own = prs.filter((pr) => taskIdFromTitle(pr.title) === task.id);
  const merged = own.filter((pr) => pr.state === 'MERGED').sort(byDateDesc('mergedAt'));
  const open = own.filter((pr) => pr.state === 'OPEN').sort(byDateDesc('createdAt'));
  const closed = own.filter((pr) => pr.state === 'CLOSED');
  const attempts = own.length;
  const history = attempts > 1 ? ` (${attempts} tentativas; ${closed.length} fechada(s) sem merge)` : '';

  // Bloqueio por pendência só vale enquanto a tarefa não foi integrada.
  if (merged.length === 0) {
    if (pendencias === null && task.decisao_pendente) {
      return { state: 'desconhecido', detail: 'decisão pendente e pendências inacessíveis', attempts };
    }
    const openBlockers = (pendencias ?? []).filter((issue) => issue.state === 'OPEN' && mentions(issue, task.id));
    const closedDecision = (pendencias ?? []).some((issue) => issue.state === 'CLOSED' && mentions(issue, task.id));
    if (task.decisao_pendente && (openBlockers.length > 0 || !closedDecision)) {
      const ref = openBlockers.map((issue) => `#${issue.number}`).join(', ');
      return {
        state: 'bloqueada',
        detail: `aguardando decisão: ${task.decisao_pendente}${ref ? ` (${ref})` : ' (pendência ainda não aberta)'}`,
        label: 'bloqueada (aguardando decisão)',
        attempts,
      };
    }
    if (openBlockers.length > 0) {
      return {
        state: 'bloqueada',
        detail: `pendência aberta: ${openBlockers.map((issue) => `#${issue.number}`).join(', ')}`,
        attempts,
      };
    }
  }

  if (merged.length > 0) {
    const pr = merged[0];
    const checks = summarizeChecks(pr.statusCheckRollup);
    const labels = (pr.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name));
    const ciOk = checks === 'verdes';
    // Evidência extra exigida pelo tipo de validação.
    // ci+humano: etiqueta aceite-humano. ci+revisao: registro verificável no commit de topo (ADR 0004);
    // a etiqueta revisao-sem-defeito só vale para PRs anteriores ao registro (marcada como "sem registro").
    let extraOk = true;
    let extraNote = '';
    if (task.validation === 'ci+humano') {
      extraOk = labels.includes('aceite-humano');
      extraNote = extraOk ? ', aceite-humano' : 'sem etiqueta aceite-humano';
    } else if (task.validation === 'ci+revisao') {
      const record = verifyReviewRecord(pr.reviewHead);
      // A etiqueta só substitui o registro quando não há registro nenhum e o PR é anterior à regra.
      // Registro existente e inválido (com defeito, árvore divergente) nunca é ignorado.
      const legacy = record.verdict === null && labels.includes('revisao-sem-defeito')
        && String(pr.mergedAt ?? '') < REVIEW_RECORD_REQUIRED_SINCE;
      if (record.ok) extraNote = ', revisão registrada';
      else if (legacy) extraNote = ', revisao-sem-defeito (etiqueta, anterior ao registro verificável)';
      else {
        extraOk = false;
        extraNote = `sem revisão registrada (${record.reason})`;
      }
    }
    if (ciOk && extraOk) {
      return { state: 'validada', detail: `PR #${pr.number} integrado, checks verdes${extraNote}${history}`, pr: pr.number, attempts };
    }
    const missing = [!ciOk ? `checks ${checks}` : null, !extraOk ? extraNote : null].filter(Boolean).join(', ');
    return { state: 'integrada', detail: `PR #${pr.number} integrado; falta: ${missing}${history}`, pr: pr.number, attempts };
  }

  if (open.length > 0) {
    const pr = open[0];
    if (pr.isDraft) {
      return { state: 'em andamento', detail: `PR #${pr.number} em rascunho${history}`, pr: pr.number, attempts };
    }
    const checks = summarizeChecks(pr.statusCheckRollup);
    // Integrável = CI verde + registro da revisão do Codex sem defeito na árvore atual (ADR 0004).
    // ci+humano nunca é integrável pelo agente.
    const record = verifyReviewRecord(pr.reviewHead);
    const blockers = [
      checks !== 'verdes' ? `checks ${checks}` : null,
      !record.ok ? record.reason : null,
      task.validation === 'ci+humano' ? 'aguarda aceite humano' : null,
    ].filter(Boolean);
    const integravel = blockers.length === 0;
    const detail = `PR #${pr.number} aberto, checks ${checks}; ${integravel ? 'integrável' : `não integrável: ${blockers.join('; ')}`}${history}`;
    return { state: 'implementada', checks, integravel, detail, pr: pr.number, attempts };
  }

  if (closed.length > 0) {
    return { state: 'planejada', detail: `${closed.length} tentativa(s) fechada(s) sem merge`, attempts };
  }
  return { state: 'planejada', detail: 'nenhum PR', attempts };
}

const REQUIREMENTS = ['pr', 'check'];
const REQUIREMENT_LABEL = { pr: 'PR obrigatório', check: 'check obrigatório' };

/** Requisitos atendidos pela proteção clássica. */
function classicRequirements(data, requiredCheck) {
  const contexts = [
    ...(data.required_status_checks?.contexts ?? []),
    ...((data.required_status_checks?.checks ?? []).map((check) => check.context)),
  ];
  const enforced = data.enforce_admins?.enabled === true;
  const found = {};
  if (data.required_pull_request_reviews) found.pr = { source: 'proteção clássica', enforced };
  if (contexts.includes(requiredCheck)) found.check = { source: 'proteção clássica', enforced };
  return found;
}

/**
 * Um ruleset vale para administradores?
 * Política do starter: **qualquer** bypass_actors invalida a garantia (mesmo bypass só de app),
 * porque a integração automática depende dela. Devolve true, false ou null (não determinado).
 */
function rulesetEnforced(ruleset) {
  if (!ruleset || ruleset.error) return null; // detalhe não obtido
  if (ruleset.enforcement !== 'active') return false;
  // A API omite bypass_actors quando o solicitante não pode vê-los: ausência não é lista vazia.
  if (!Array.isArray(ruleset.bypass_actors)) return null;
  return ruleset.bypass_actors.length === 0;
}

const RANK = { true: 2, null: 1, false: 0 };

/** Requisitos atendidos pelas regras efetivas (rulesets) da branch. */
function rulesetRequirements(rules, rulesets, requiredCheck) {
  const found = {};
  for (const rule of rules) {
    const ruleset = rulesets[rule.ruleset_id];
    const enforced = rulesetEnforced(ruleset);
    const source = `ruleset "${ruleset?.name ?? rule.ruleset_id}"`;
    let key = null;
    if (rule.type === 'pull_request') key = 'pr';
    if (rule.type === 'required_status_checks'
      && (rule.parameters?.required_status_checks ?? []).some((check) => check.context === requiredCheck)) key = 'check';
    if (key && (!found[key] || RANK[String(enforced)] > RANK[String(found[key].enforced)])) found[key] = { source, enforced };
  }
  return found;
}

/**
 * Proteção da main combinando os dois formatos do GitHub.
 * Protegida = PR obrigatório e check obrigatório, ambos sem bypass para administradores,
 * vindos da proteção clássica (enforce_admins) ou de ruleset ativo sem bypass_actors.
 * @param {{
 *   classic: { ok: true, data: any } | { ok: false, notProtected?: boolean, error?: string } | null,
 *   rules?: { ok: true, data: any[], rulesets: Record<string, any> } | { ok: false, error?: string } | null,
 * } | null} input
 * @param {string} requiredCheck nome do check exigido
 */
export function deriveProtection(input, requiredCheck) {
  const classic = input?.classic ?? null;
  const rules = input?.rules ?? null;
  const classicKnown = Boolean(classic) && (classic.ok || classic.notProtected === true);
  const rulesKnown = Boolean(rules) && rules.ok;
  if (!classicKnown && !rulesKnown) {
    const errors = [classic?.error, rules?.error].filter(Boolean).join('; ');
    return { state: 'desconhecido', detail: errors || 'consulta não realizada' };
  }

  const fromClassic = classic?.ok ? classicRequirements(classic.data ?? {}, requiredCheck) : {};
  const fromRules = rulesKnown ? rulesetRequirements(rules.data ?? [], rules.rulesets ?? {}, requiredCheck) : {};
  const sources = [];
  const problems = [];
  const undetermined = [];
  for (const key of REQUIREMENTS) {
    const options = [fromClassic[key], fromRules[key]].filter(Boolean);
    const best = options.find((option) => option.enforced === true)
      ?? options.find((option) => option.enforced === null)
      ?? options[0];
    if (!best) problems.push(`${REQUIREMENT_LABEL[key]} ausente`);
    else if (best.enforced === null) undetermined.push(`${REQUIREMENT_LABEL[key]} (${best.source}): bypass não determinado`);
    else if (!best.enforced) problems.push(`${REQUIREMENT_LABEL[key]} (${best.source}) tem bypass ou não está ativo`);
    else sources.push(`${REQUIREMENT_LABEL[key]} via ${best.source}`);
  }

  if (problems.length === 0 && undetermined.length === 0) {
    return { state: 'protegida', detail: `${sources.join('; ')}; check "${requiredCheck}"; sem bypass (vale para administradores)` };
  }
  // Uma das fontes falhou: o que falta pode estar nela.
  if (!classicKnown || !rulesKnown) {
    const failed = !classicKnown ? `proteção clássica: ${classic?.error ?? 'não consultada'}` : `rulesets: ${rules?.error ?? 'não consultados'}`;
    return { state: 'desconhecido', detail: [...problems, ...undetermined, failed].join('; ') };
  }
  if (problems.length === 0) return { state: 'desconhecido', detail: undetermined.join('; ') };
  return { state: 'desprotegida', detail: [...problems, ...undetermined].join('; ') };
}

/**
 * Estado completo do projeto.
 * @param {{ tasks: any[], prs: any[] | null, pendencias: any[] | null, protection: any, requiredCheck: string }} input
 */
export function deriveProjectStatus(input) {
  const tasks = [...input.tasks].sort((a, b) => a.id.localeCompare(b.id));
  const states = tasks.map((task) => ({ id: task.id, title: task.title, depends_on: task.depends_on ?? [], ...deriveTaskState(task, input.prs, input.pendencias) }));
  const done = new Set(states.filter((s) => s.state === 'integrada' || s.state === 'validada').map((s) => s.id));
  const next = states.find((s) => s.state === 'planejada' && s.depends_on.every((dep) => done.has(dep))) ?? null;
  const pendencias = input.pendencias === null
    ? null
    : input.pendencias.filter((issue) => issue.state === 'OPEN').map((issue) => ({ number: issue.number, title: issue.title }));
  return {
    tasks: states,
    next: next ? next.id : null,
    protection: deriveProtection(input.protection, input.requiredCheck),
    pendencias,
  };
}
