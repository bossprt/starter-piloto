// Derivação pura do estado do projeto. Nenhuma chamada a git, gh ou disco aqui.
// Entrada: tarefas (frontmatter), histórico de PRs, pendências e proteção da main.
// Evidência vem só do histórico de PRs, nunca de branches.

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
    const humanOk = task.validation !== 'ci+humano' || labels.includes('aceite-humano');
    if (ciOk && humanOk) {
      return { state: 'validada', detail: `PR #${pr.number} integrado, checks verdes${task.validation === 'ci+humano' ? ', aceite-humano' : ''}${history}`, pr: pr.number, attempts };
    }
    const missing = [!ciOk ? `checks ${checks}` : null, !humanOk ? 'sem etiqueta aceite-humano' : null].filter(Boolean).join(', ');
    return { state: 'integrada', detail: `PR #${pr.number} integrado; falta: ${missing}${history}`, pr: pr.number, attempts };
  }

  if (open.length > 0) {
    const pr = open[0];
    if (pr.isDraft) {
      return { state: 'em andamento', detail: `PR #${pr.number} em rascunho${history}`, pr: pr.number, attempts };
    }
    const checks = summarizeChecks(pr.statusCheckRollup);
    return { state: 'implementada', checks, detail: `PR #${pr.number} aberto, checks ${checks}${history}`, pr: pr.number, attempts };
  }

  if (closed.length > 0) {
    return { state: 'planejada', detail: `${closed.length} tentativa(s) fechada(s) sem merge`, attempts };
  }
  return { state: 'planejada', detail: 'nenhum PR', attempts };
}

/**
 * Proteção da main a partir da resposta da API.
 * @param {{ ok: true, data: any } | { ok: false, notProtected?: boolean, error?: string } | null} result
 * @param {string} requiredCheck nome do check exigido
 */
export function deriveProtection(result, requiredCheck) {
  if (!result) return { state: 'desconhecido', detail: 'consulta não realizada' };
  if (!result.ok) {
    if (result.notProtected) return { state: 'desprotegida', detail: 'API: Branch not protected' };
    return { state: 'desconhecido', detail: result.error ?? 'erro na consulta' };
  }
  const data = result.data ?? {};
  const contexts = [
    ...(data.required_status_checks?.contexts ?? []),
    ...((data.required_status_checks?.checks ?? []).map((check) => check.context)),
  ];
  const problems = [];
  if (!data.required_pull_request_reviews) problems.push('PR não obrigatório');
  if (!contexts.includes(requiredCheck)) problems.push(`check "${requiredCheck}" não obrigatório`);
  if (!data.enforce_admins?.enabled) problems.push('não vale para administradores');
  if (problems.length > 0) return { state: 'desprotegida', detail: problems.join('; ') };
  return { state: 'protegida', detail: `PR obrigatório; check "${requiredCheck}" obrigatório; vale para administradores` };
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
