import { describe, expect, it } from 'vitest';
import { blockedTasks, deriveProjectStatus, deriveProtection, deriveTaskState, summarizeChecks } from '../lib/derive-status.mjs';

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

  it('bloqueada: pendência aberta com linha Bloqueia: no corpo', () => {
    const issue = { number: 7, title: 'Orçamento de correção estourado', state: 'OPEN', body: 'Contexto.\n\nBloqueia: TASK-001, TASK-002' };
    expect(deriveTaskState(ci, [pr({})], [issue]).state).toBe('bloqueada');
  });

  it('desconhecido: GitHub inacessível', () => {
    expect(deriveTaskState(ci, null, null).state).toBe('desconhecido');
  });
});

describe('blockedTasks', () => {
  it('menção solta no corpo não bloqueia', () => {
    const issue = { number: 6, title: 'TASK-004: decidir formato', state: 'OPEN', body: 'As TASK-001 a 003 seguem. Na revisão da TASK-001 também.' };
    expect([...blockedTasks(issue)]).toEqual(['TASK-004']);
    expect(deriveTaskState(ci, [pr({})], [issue]).state).toBe('implementada');
  });

  it('aceita a linha Bloqueia em negrito ou em item de lista', () => {
    expect([...blockedTasks({ title: 'x', body: '**Bloqueia:** TASK-002, TASK-003' })]).toEqual(['TASK-002', 'TASK-003']);
    expect([...blockedTasks({ title: 'x', body: '- Bloqueia: TASK-002' })]).toEqual(['TASK-002']);
    expect([...blockedTasks({ title: 'x', body: '**Bloqueia**: TASK-003' })]).toEqual(['TASK-003']);
  });

  it('não bloqueia sem os dois-pontos (texto comum)', () => {
    expect([...blockedTasks({ title: 'x', body: 'Bloqueiaremos TASK-001 depois' })]).toEqual([]);
    expect([...blockedTasks({ title: 'x', body: 'Bloqueia apenas como exemplo TASK-001' })]).toEqual([]);
  });

  it('não extrai identificador parcial', () => {
    expect([...blockedTasks({ title: 'TASK-0010 e TASK-001ABC', body: 'Bloqueia: TASK-0020, XTASK-003' })]).toEqual([]);
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

  it('ignora PR com identificador parcial no título (TASK-0010)', () => {
    const other = pr({ title: 'TASK-0010: outra', state: 'MERGED', mergedAt: '2026-10-10T11:00:00Z' });
    expect(deriveTaskState(ci, [other], []).state).toBe('planejada');
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
  const notProtected = { ok: false, notProtected: true };
  const noRules = { ok: true, data: [], rulesets: {} };
  // Formato real devolvido por GET /repos/{o}/{r}/rules/branches/main.
  const rulesetRules = [
    { type: 'deletion', ruleset_id: 24854218 },
    { type: 'pull_request', parameters: { required_approving_review_count: 0 }, ruleset_id: 24854218 },
    { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'validate', integration_id: 15368 }] }, ruleset_id: 24854218 },
  ];
  const activeRuleset = { 24854218: { name: 'proteger-main', enforcement: 'active', bypass_actors: [] } };

  describe('proteção clássica', () => {
    it('protegida quando PR, check e administradores estão configurados', () => {
      expect(deriveProtection({ classic: { ok: true, data: full }, rules: noRules }, 'validate').state).toBe('protegida');
    });

    it('desprotegida quando falta enforce_admins', () => {
      const data = { ...full, enforce_admins: { enabled: false } };
      const result = deriveProtection({ classic: { ok: true, data }, rules: noRules }, 'validate');
      expect(result.state).toBe('desprotegida');
      expect(result.detail).toMatch(/administradores|bypass/);
    });
  });

  describe('rulesets', () => {
    it('protegida com ruleset ativo sem bypass, mesmo com a clássica dizendo "Branch not protected"', () => {
      const result = deriveProtection({ classic: notProtected, rules: { ok: true, data: rulesetRules, rulesets: activeRuleset } }, 'validate');
      expect(result.state).toBe('protegida');
      expect(result.detail).toContain('ruleset "proteger-main"');
    });

    it('desprotegida quando o ruleset tem bypass_actors (não vale para administradores)', () => {
      const rulesets = { 24854218: { ...activeRuleset[24854218], bypass_actors: [{ actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' }] } };
      const result = deriveProtection({ classic: notProtected, rules: { ok: true, data: rulesetRules, rulesets } }, 'validate');
      expect(result.state).toBe('desprotegida');
      expect(result.detail).toMatch(/administradores|bypass/);
    });

    it('desprotegida quando o ruleset não exige o check', () => {
      const data = rulesetRules.filter((rule) => rule.type !== 'required_status_checks');
      const result = deriveProtection({ classic: notProtected, rules: { ok: true, data, rulesets: activeRuleset } }, 'validate');
      expect(result.state).toBe('desprotegida');
      expect(result.detail).toContain('check obrigatório ausente');
    });

    it('desprotegida quando o ruleset exige outro check', () => {
      const data = rulesetRules.map((rule) => (rule.type === 'required_status_checks'
        ? { ...rule, parameters: { required_status_checks: [{ context: 'outro' }] } } : rule));
      expect(deriveProtection({ classic: notProtected, rules: { ok: true, data, rulesets: activeRuleset } }, 'validate').state).toBe('desprotegida');
    });

    it('desconhecido quando o detalhe do ruleset falha (403/404/500)', () => {
      const rulesets = { 24854218: { error: 'HTTP 403' } };
      const result = deriveProtection({ classic: notProtected, rules: { ok: true, data: rulesetRules, rulesets } }, 'validate');
      expect(result.state).toBe('desconhecido');
      expect(result.detail).toContain('bypass não determinado');
    });

    it('desconhecido quando a API omite bypass_actors (sem permissão para vê-los)', () => {
      const rulesets = { 24854218: { name: 'proteger-main', enforcement: 'active' } };
      expect(deriveProtection({ classic: notProtected, rules: { ok: true, data: rulesetRules, rulesets } }, 'validate').state).toBe('desconhecido');
    });

    it('política estrita: bypass só de app também invalida', () => {
      const rulesets = { 24854218: { ...activeRuleset[24854218], bypass_actors: [{ actor_type: 'Integration', actor_id: 1, bypass_mode: 'always' }] } };
      expect(deriveProtection({ classic: notProtected, rules: { ok: true, data: rulesetRules, rulesets } }, 'validate').state).toBe('desprotegida');
    });

    it('desprotegida quando o ruleset está só em avaliação (evaluate)', () => {
      const rulesets = { 24854218: { ...activeRuleset[24854218], enforcement: 'evaluate' } };
      expect(deriveProtection({ classic: notProtected, rules: { ok: true, data: rulesetRules, rulesets } }, 'validate').state).toBe('desprotegida');
    });

    it('detalhe faltante não importa quando outra fonte já garante tudo', () => {
      const rulesets = { 24854218: { error: 'HTTP 403' } };
      expect(deriveProtection({ classic: { ok: true, data: full }, rules: { ok: true, data: rulesetRules, rulesets } }, 'validate').state).toBe('protegida');
    });

    it('requisito ausente decide desprotegida mesmo com outro indeterminado', () => {
      const rulesets = { 24854218: { error: 'HTTP 403' } };
      const data = rulesetRules.filter((rule) => rule.type !== 'required_status_checks');
      expect(deriveProtection({ classic: notProtected, rules: { ok: true, data, rulesets } }, 'validate').state).toBe('desprotegida');
    });

    it('combina formatos: PR pela clássica e check pelo ruleset', () => {
      const classicPrOnly = { ...full, required_status_checks: null };
      const data = rulesetRules.filter((rule) => rule.type !== 'pull_request');
      const result = deriveProtection({ classic: { ok: true, data: classicPrOnly }, rules: { ok: true, data, rulesets: activeRuleset } }, 'validate');
      expect(result.state).toBe('protegida');
    });
  });

  describe('falhas de consulta', () => {
    it('desprotegida quando nenhuma das duas APIs mostra proteção', () => {
      expect(deriveProtection({ classic: notProtected, rules: noRules }, 'validate').state).toBe('desprotegida');
    });

    it('desconhecido quando as duas consultas falham', () => {
      expect(deriveProtection({ classic: { ok: false, error: 'HTTP 403' }, rules: { ok: false, error: 'HTTP 403' } }, 'validate').state).toBe('desconhecido');
      expect(deriveProtection(null, 'validate').state).toBe('desconhecido');
    });

    it('desconhecido quando a clássica diz "não protegida" mas a consulta de rulesets falha', () => {
      const result = deriveProtection({ classic: notProtected, rules: { ok: false, error: 'HTTP 500' } }, 'validate');
      expect(result.state).toBe('desconhecido');
      expect(result.detail).toContain('rulesets: HTTP 500');
    });

    it('protegida pela clássica mesmo se a consulta de rulesets falhar', () => {
      expect(deriveProtection({ classic: { ok: true, data: full }, rules: { ok: false, error: 'HTTP 500' } }, 'validate').state).toBe('protegida');
    });
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
    const status = deriveProjectStatus({ tasks: [ci], prs: null, pendencias: null, protection: { classic: { ok: false, error: 'offline' }, rules: { ok: false, error: 'offline' } }, requiredCheck: 'validate' });
    expect(status.tasks[0].state).toBe('desconhecido');
    expect(status.pendencias).toBeNull();
    expect(status.protection.state).toBe('desconhecido');
    expect(status.next).toBeNull();
  });
});
