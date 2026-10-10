import { describe, expect, it } from 'vitest';
import { buildRecordMessage, parseTrailers, parseVerdict, unsignedCommits, verifyReviewRecord } from '../lib/review-record.mjs';
import { deriveTaskState } from '../lib/derive-status.mjs';

const TREE = 'a'.repeat(40);
const record = (verdict, tree = TREE) => buildRecordMessage({ verdict, tree, base: 'b'.repeat(40), tokens: 123, threadId: 't-1', summary: 'Sem defeito.\nVEREDITO: sem-defeito', codexVersion: 'codex-cli 0.162.1' });

describe('parseVerdict', () => {
  it('lê a última linha VEREDITO', () => {
    expect(parseVerdict('achado X\nVEREDITO: com-defeito')).toBe('com-defeito');
    expect(parseVerdict('VEREDITO: com-defeito\n...\nVEREDITO: sem-defeito')).toBe('sem-defeito');
    expect(parseVerdict('sem linha de veredito')).toBeNull();
  });
});

describe('verifyReviewRecord', () => {
  it('ok: registro sem-defeito para a árvore do commit de topo', () => {
    expect(verifyReviewRecord({ message: record('sem-defeito'), tree: TREE }).ok).toBe(true);
  });
  it('falha: commit de topo sem registro', () => {
    const result = verifyReviewRecord({ message: 'feat: x\n\nAgente: Claude Code', tree: TREE });
    expect(result).toMatchObject({ ok: false, verdict: null });
  });
  it('falha: árvore mudou depois da revisão (trailer copiado num commit de código)', () => {
    const result = verifyReviewRecord({ message: record('sem-defeito'), tree: 'c'.repeat(40) });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('árvore');
  });
  it('falha: revisão com defeito aberto', () => {
    expect(verifyReviewRecord({ message: record('com-defeito'), tree: TREE })).toMatchObject({ ok: false, verdict: 'com-defeito' });
  });
  it('falha: veredito inválido ou commit indisponível', () => {
    expect(verifyReviewRecord({ message: `x\n\nCodex-Review: talvez\nCodex-Review-Tree: ${TREE}`, tree: TREE }).ok).toBe(false);
    expect(verifyReviewRecord(undefined).ok).toBe(false);
  });
});

describe('assinatura', () => {
  it('parseTrailers lê o último parágrafo', () => {
    expect(parseTrailers('t\n\ncorpo\n\nAgente: Claude Code (claude-opus-5-5)\nCo-Authored-By: X')).toMatchObject({ Agente: 'Claude Code (claude-opus-5-5)' });
  });
  it('unsignedCommits lista commits sem Agente:', () => {
    const commits = [{ sha: '1', message: 'a\n\nAgente: Claude Code' }, { sha: '2', message: 'b' }];
    expect(unsignedCommits(commits)).toEqual(['2']);
  });
});

describe('integrável (project-status)', () => {
  const task = { id: 'TASK-005', title: 'x', validation: 'ci+revisao', depends_on: [] };
  const base = { number: 20, title: 'TASK-005: x', state: 'OPEN', isDraft: false, createdAt: '2026-10-10T10:00:00Z', labels: [], statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }] };

  it('integrável com CI verde e registro sem defeito', () => {
    const result = deriveTaskState(task, [{ ...base, reviewHead: { message: record('sem-defeito'), tree: TREE } }], []);
    expect(result).toMatchObject({ state: 'implementada', integravel: true });
  });
  it('não integrável sem registro, mesmo com CI verde', () => {
    const result = deriveTaskState(task, [{ ...base }], []);
    expect(result.integravel).toBe(false);
    expect(result.detail).toContain('não integrável');
  });
  it('não integrável com CI vermelho, mesmo com registro', () => {
    const red = { ...base, statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'FAILURE' }], reviewHead: { message: record('sem-defeito'), tree: TREE } };
    expect(deriveTaskState(task, [red], []).integravel).toBe(false);
  });
  it('ci+humano nunca é integrável pelo agente', () => {
    const humano = { ...task, validation: 'ci+humano' };
    expect(deriveTaskState(humano, [{ ...base, reviewHead: { message: record('sem-defeito'), tree: TREE } }], []).integravel).toBe(false);
  });
  it('etiqueta não substitui registro existente com defeito', () => {
    const merged = { ...base, state: 'MERGED', mergedAt: '2026-10-10T11:00:00Z', labels: [{ name: 'revisao-sem-defeito' }], reviewHead: { message: record('com-defeito'), tree: TREE } };
    expect(deriveTaskState(task, [merged], []).state).toBe('integrada');
  });
  it('etiqueta sem registro só vale para PR integrado antes da regra', () => {
    const before = { ...base, state: 'MERGED', mergedAt: '2026-10-10T21:46:29Z', labels: [{ name: 'revisao-sem-defeito' }], reviewHead: { message: 'feat: x', tree: TREE } };
    const after = { ...before, mergedAt: '2026-10-11T09:00:00Z' };
    expect(deriveTaskState(task, [before], []).state).toBe('validada');
    expect(deriveTaskState(task, [after], []).state).toBe('integrada');
  });
  it('validada (ci+revisao) quando integrado com registro verificável', () => {
    const merged = { ...base, state: 'MERGED', mergedAt: '2026-10-10T11:00:00Z', reviewHead: { message: record('sem-defeito'), tree: TREE } };
    const result = deriveTaskState(task, [merged], []);
    expect(result.state).toBe('validada');
    expect(result.detail).toContain('revisão registrada');
  });
});
