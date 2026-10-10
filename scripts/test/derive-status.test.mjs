import { describe, expect, it } from 'vitest';
import { deriveProjectStatus, deriveProtection, deriveTaskState, summarizeChecks } from '../lib/derive-status.mjs';

const GREEN = [{ status: 'COMPLETED', conclusion: 'SUCCESS' }];
const RED = [{ status: 'COMPLETED', conclusion: 'FAILURE' }];
const PENDING = [{ status: 'IN_PROGRESS', conclusion: null }];

const ci = { id: 'TASK-001', title: 'CPF', validation: 'ci', depends_on: [] };
const human = { id: 'TASK-003', title: 'CLI', validation: 'ci+humano', depends_on: [] };
const decision = { id: 'TASK-004', title: 'JSON', validation: 'ci+humano', depends_on: [], decisao_pendente: 'formato do JSON de saída' };

function pr(overrides) {
  return {
    number: 1,
    title: 'TASK-001: CPF',
    state: 'OPEN',
    isDraft: false,
    createdAt: '2026-10-10T10:00:00Z',
    mergedAt: null,
    closedAt: null,
    labels: [],
    statusCheckRollup: GREEN,
    headRefName: 'task/001-cpf',
    ...overrides,
  };
}

describe('summarizeChecks', () => {
  it('classifica verdes, vermelhos, pendentes e nenhum', () => {
    expect(summarizeChecks(GREEN)).toBe('verdes');
    expect(summarizeChecks(RED)).toBe('vermelhos');
    expect(summarizeChecks(PENDING)).toBe('pendentes');
    expect(summarizeChecks([])).toBe('nenhum');
    expect(summarizeChecks([{ state: 'SUCCESS' }, { state: 'PENDING' }])).toBe('pendentes');
  });
});

describe('deriveTaskState: um caso por estado', () => {
  it('planejada: nenhum PR', () => {
    expect(deriveTaskState(ci, [], []).state).toBe('planejada');
  });

  it('em andamento: PR em rascunho', () => {
    expect(deriveTaskState(ci, [pr({ isDraft: true })], []).state).toBe('em andamento');
  });

  it('implementada com checks pendentes', () => {
    const result = deriveTaskState(ci, [pr({ statusCheckRollup: PENDING })], []);
    expect(result).toMatchObject({ state: 'implementada', checks: 'pendentes' });
  });

  it('implementada com checks verdes', () => {
    expect(deriveTaskState(ci, [pr({})], [])).toMatchObject({ state: 'implementada', checks: 'verdes' });
  });

  it('implementada com checks vermelhos', () => {
    expect(deriveTaskState(ci, [pr({ statusCheckRollup: RED })], [])).toMatchObject({ state: 'implementada', checks: 'vermelhos' });
  });

  it('integrada: merge sem checks verdes', () => {
    const merged = pr({ state: 'MERGED', mergedAt: '2026-10-10T11:00:00Z', statusCheckRollup: [] });
    expect(deriveTaskState(ci, [merged], []).state).toBe('integrada');
  });

  it('integrada: ci+humano com merge e CI verde mas sem aceite-humano', () => {
    const merged = pr({ title: 'TASK-003: CLI', state: 'MERGED', mergedAt: '2026-10-10T11:00:00Z' });
    const result = deriveTaskState(human, [merged], []);
    expect(result.state).toBe('integrada');
    expect(result.detail).toContain('aceite-humano');
  });

  it('validada: ci com merge e checks verdes', () => {
    const merged = pr({ state: 'MERGED', mergedAt: '2026-10-10T11:00:00Z' });
    expect(deriveTaskState(ci, [merged], []).state).toBe('validada');
  });

  it('validada: ci+humano com merge, checks verdes e aceite-humano', () => {
    const merged = pr({ title: 'TASK-003: CLI', state: 'MERGED', mergedAt: '2026-10-10T11:00:00Z', labels: [{ name: 'aceite-humano' }] });
    expect(deriveTaskState(human, [merged], []).state).toBe('validada');
  });

  it('bloqueada (aguardando decisão): decisao_pendente com pendência aberta', () => {
    const issue = { number: 9, title: 'TASK-004: formato do JSON', state: 'OPEN', body: '' };
    const result = deriveTaskState(decision, [], [issue]);
    expect(result.state).toBe('bloqueada');
    expect(result.label).toBe('bloqueada (aguardando decisão)');
    expect(result.detail).toContain('#9');
  });

  it('bloqueada: decisao_pendente ainda sem pendência aberta', () => {
    expect(deriveTaskState(decision, [], []).label).toBe('bloqueada (aguardando decisão)');
  });

  it('decisão tomada (pendência fechada) libera a tarefa', () => {
    const issue = { number: 9, title: 'TASK-004: formato do JSON', state: 'CLOSED', body: '' };
    expect(deriveTaskState(decision, [], [issue]).state).toBe('planejada');
  });

  it('bloqueada: pendência aberta citando a tarefa no corpo', () => {
    const issue = { number: 7, title: 'Orçamento de correção estourado', state: 'OPEN', body: 'Afeta TASK-001' };
    expect(deriveTaskState(ci, [pr({})], [issue]).state).toBe('bloqueada');
  });

  it('desconhecido: GitHub inacessível', () => {
    expect(deriveTaskState(ci, null, null).state).toBe('desconhecido');
  });
});

describe('deriveTaskState: histórico de PRs', () => {
  it('branch apagada após merge continua validada (evidência vem do PR, não da branch)', () => {
    const merged = pr({ state: 'MERGED', mergedAt: '2026-10-10T11:00:00Z', headRefName: undefined });
    expect(deriveTaskState(ci, [merged], []).state).toBe('validada');
  });

  it('PR fechado sem merge não conta como implementada', () => {
    const closed = pr({ state: 'CLOSED', closedAt: '2026-10-10T11:00:00Z' });
    const result = deriveTaskState(ci, [closed], []);
    expect(result.state).toBe('planejada');
    expect(result.detail).toContain('fechada(s) sem merge');
  });

  it('duas tentativas: primeira fechada, segunda integrada', () => {
    const first = pr({ number: 1, state: 'CLOSED', closedAt: '2026-10-10T10:30:00Z', statusCheckRollup: RED });
    const second = pr({ number: 2, state: 'MERGED', createdAt: '2026-10-10T10:40:00Z', mergedAt: '2026-10-10T11:00:00Z' });
    const result = deriveTaskState(ci, [first, second], []);
    expect(result).toMatchObject({ state: 'validada', pr: 2, attempts: 2 });
    expect(result.detail).toContain('2 tentativas');
  });

  it('PR reaberto conta pelo estado atual (aberto)', () => {
    const reopened = pr({ state: 'OPEN', closedAt: null, statusCheckRollup: PENDING });
    expect(deriveTaskState(ci, [reopened], []).state).toBe('implementada');
  });

  it('ignora PRs sem TASK-NNN no título', () => {
    const other = pr({ title: 'teste: CI vermelho', state: 'MERGED', mergedAt: '2026-10-10T11:00:00Z' });
    expect(deriveTaskState(ci, [other], []).state).toBe('planejada');
  });
});

describe('deriveProtection', () => {
  const full = {
    required_status_checks: { strict: false, contexts: ['validate'], checks: [{ context: 'validate', app_id: 15368 }] },
    required_pull_request_reviews: { required_approving_review_count: 0 },
    enforce_admins: { enabled: true },
  };

  it('protegida quando PR, check e administradores estão configurados', () => {
    expect(deriveProtection({ ok: true, data: full }, 'validate').state).toBe('protegida');
  });

  it('desprotegida quando falta enforce_admins', () => {
    const data = { ...full, enforce_admins: { enabled: false } };
    expect(deriveProtection({ ok: true, data }, 'validate').state).toBe('desprotegida');
  });

  it('desprotegida quando a API diz que não há proteção', () => {
    expect(deriveProtection({ ok: false, notProtected: true }, 'validate').state).toBe('desprotegida');
  });

  it('desconhecido quando a consulta falha', () => {
    expect(deriveProtection({ ok: false, error: 'HTTP 403' }, 'validate').state).toBe('desconhecido');
    expect(deriveProtection(null, 'validate').state).toBe('desconhecido');
  });
});

describe('deriveProjectStatus', () => {
  it('aponta a próxima tarefa respeitando dependências', () => {
    const tasks = [ci, { id: 'TASK-002', title: 'CNPJ', validation: 'ci', depends_on: ['TASK-001'] }];
    const merged = pr({ state: 'MERGED', mergedAt: '2026-10-10T11:00:00Z' });
    const status = deriveProjectStatus({ tasks, prs: [merged], pendencias: [], protection: null, requiredCheck: 'validate' });
    expect(status.next).toBe('TASK-002');
  });

  it('GitHub inacessível: tudo desconhecido, pendências desconhecidas', () => {
    const status = deriveProjectStatus({ tasks: [ci], prs: null, pendencias: null, protection: { ok: false, error: 'offline' }, requiredCheck: 'validate' });
    expect(status.tasks[0].state).toBe('desconhecido');
    expect(status.pendencias).toBeNull();
    expect(status.protection.state).toBe('desconhecido');
    expect(status.next).toBeNull();
  });
});
