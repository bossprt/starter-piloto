import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { checkAdrNumbering, checkAgents, checkClaude, checkTasks, runStructureChecks } from '../lib/structure-checks.mjs';

const validTask = `---
id: TASK-001
title: CPF
depends_on: []
validation: ci
test_command: npx vitest run
---

corpo
`;

describe('parseFrontmatter', () => {
  it('lê chaves e listas inline', () => {
    const { data } = parseFrontmatter('---\nid: TASK-002\ndepends_on: [TASK-001, TASK-003]\n---\n');
    expect(data).toEqual({ id: 'TASK-002', depends_on: ['TASK-001', 'TASK-003'] });
  });
});

describe('AGENTS.md <= 100 linhas', () => {
  it('passa com 100 linhas', () => {
    expect(checkAgents('x\n'.repeat(100))).toEqual([]);
  });
  it('falha com 101 linhas', () => {
    expect(checkAgents('x\n'.repeat(101))[0]).toContain('101 linhas');
  });
  it('falha se ausente', () => {
    expect(checkAgents(null)).toEqual(['AGENTS.md ausente']);
  });
});

describe('CLAUDE.md começa com @AGENTS.md', () => {
  it('passa', () => {
    expect(checkClaude('@AGENTS.md\n\n# Claude\n')).toEqual([]);
  });
  it('falha', () => {
    expect(checkClaude('# Claude\n@AGENTS.md\n')[0]).toContain('primeira linha');
  });
});

describe('frontmatter das tarefas', () => {
  it('passa com tarefa válida', () => {
    expect(checkTasks([{ file: 'TASK-001.md', content: validTask }])).toEqual([]);
  });
  it('falha sem frontmatter', () => {
    expect(checkTasks([{ file: 'TASK-001.md', content: '# sem frontmatter' }])[0]).toContain('frontmatter ausente');
  });
  it('falha sem campo obrigatório', () => {
    const content = validTask.replace('test_command: npx vitest run\n', '');
    expect(checkTasks([{ file: 'TASK-001.md', content }])).toContain('TASK-001.md: campo obrigatório "test_command" ausente');
  });
  it('falha com campo proibido (status)', () => {
    const content = validTask.replace('validation: ci\n', 'validation: ci\nstatus: feito\n');
    expect(checkTasks([{ file: 'TASK-001.md', content }])[0]).toContain('"status" proibido');
  });
  it('passa com validation ci+revisao', () => {
    const content = validTask.replace('validation: ci', 'validation: ci+revisao');
    expect(checkTasks([{ file: 'TASK-001.md', content }])).toEqual([]);
  });
  it('falha com validation fora da lista', () => {
    const content = validTask.replace('validation: ci', 'validation: manual');
    expect(checkTasks([{ file: 'TASK-001.md', content }])[0]).toContain('validation deve ser');
  });
  it('falha com id diferente do nome do arquivo', () => {
    expect(checkTasks([{ file: 'TASK-002.md', content: validTask }])[0]).toContain('não corresponde');
  });
  it('falha com dependência inexistente', () => {
    const content = validTask.replace('depends_on: []', 'depends_on: [TASK-009]');
    expect(checkTasks([{ file: 'TASK-001.md', content }])[0]).toContain('TASK-009');
  });
  it('falha com nome de arquivo fora do padrão', () => {
    expect(checkTasks([{ file: 'tarefa-1.md', content: validTask }])[0]).toContain('TASK-NNN.md');
  });
});

describe('numeração dos ADRs', () => {
  it('passa com sequência 0001, 0002', () => {
    expect(checkAdrNumbering(['0001-stack.md', '0002-cli.md'])).toEqual([]);
  });
  it('falha com lacuna', () => {
    expect(checkAdrNumbering(['0001-stack.md', '0003-cli.md'])[0]).toContain('esperado 0002');
  });
  it('falha com repetição', () => {
    expect(checkAdrNumbering(['0001-stack.md', '0001-outra.md'])[0]).toContain('esperado 0002');
  });
  it('falha com nome fora do padrão', () => {
    expect(checkAdrNumbering(['stack.md'])[0]).toContain('NNNN-slug.md');
  });
});

describe('runStructureChecks', () => {
  it('agrega erros de todas as regras', () => {
    const errors = runStructureChecks({ agents: null, claude: null, tasks: [], adrs: ['x.md'] });
    expect(errors).toHaveLength(3);
  });
});
