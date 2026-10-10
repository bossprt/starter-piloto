import { describe, expect, it } from 'vitest';
import { EXIT_INVALID, EXIT_OK, EXIT_USAGE, main, USAGE } from '../src/cli.js';

function run(...args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = main(args, { stdout: (line) => stdout.push(line), stderr: (line) => stderr.push(line) });
  return { code, stdout, stderr };
}

describe('cpf-cnpj', () => {
  it('valida CPF e CNPJ, com e sem máscara, e sai com 0 se todos válidos', () => {
    const result = run('52998224725', '529.982.247-25', '11.222.333/0001-81', '12ABC34501DE35');
    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout).toEqual([
      'válido\tcpf\t52998224725',
      'válido\tcpf\t529.982.247-25',
      'válido\tcnpj\t11.222.333/0001-81',
      'válido\tcnpj\t12ABC34501DE35',
    ]);
    expect(result.stderr).toEqual([]);
  });

  it('mantém a ordem dos argumentos e sai com 1 se algum inválido', () => {
    const result = run('11222333000181', '52998224724', '52998224725');
    expect(result.code).toBe(EXIT_INVALID);
    expect(result.stdout).toEqual([
      'válido\tcnpj\t11222333000181',
      'inválido\tcpf\t52998224724',
      'válido\tcpf\t52998224725',
    ]);
  });

  it('marca DV errado como inválido com o tipo detectado', () => {
    expect(run('529.982.247-35').stdout).toEqual(['inválido\tcpf\t529.982.247-35']);
    expect(run('11.222.333/0001-82').stdout).toEqual(['inválido\tcnpj\t11.222.333/0001-82']);
  });

  it('detecta tipo pelo tamanho sem máscara; outro tamanho é desconhecido', () => {
    const result = run('123', '1234567890123', '', '529.982.247-2');
    expect(result.code).toBe(EXIT_INVALID);
    expect(result.stdout).toEqual([
      'inválido\tdesconhecido\t123',
      'inválido\tdesconhecido\t1234567890123',
      'inválido\tdesconhecido\t',
      'inválido\tdesconhecido\t529.982.247-2',
    ]);
  });

  it('trata entradas malformadas como inválidas sem quebrar', () => {
    const result = run('5299822472a', '529 982 247 25', '11.222.333/0001-8X', '12abc34501de35');
    expect(result.code).toBe(EXIT_INVALID);
    expect(result.stdout).toEqual([
      'inválido\tcpf\t5299822472a',
      'inválido\tcnpj\t529 982 247 25',
      'inválido\tcnpj\t11.222.333/0001-8X',
      'inválido\tcnpj\t12abc34501de35',
    ]);
  });

  it('escapa caracteres de controle e barra invertida da entrada para manter uma linha e três campos', () => {
    const result = run('52998224725\n', 'a\tb', 'x\r\\y', '\u0001');
    expect(result.stdout).toEqual([
      'válido\tcpf\t52998224725\\n',
      'inválido\tdesconhecido\ta\\tb',
      'inválido\tdesconhecido\tx\\r\\\\y',
      'inválido\tdesconhecido\t\\u0001',
    ]);
    for (const line of result.stdout) {
      expect(line).not.toMatch(/[\r\n]/);
      expect(line.split('\t')).toHaveLength(3);
    }
  });

  it('--help mostra uso em stdout e sai com 0', () => {
    const result = run('--help');
    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout).toEqual([USAGE]);
    expect(result.stderr).toEqual([]);
  });

  it('sem argumentos é erro de uso: código 2 e mensagem em stderr', () => {
    const result = run();
    expect(result.code).toBe(EXIT_USAGE);
    expect(result.stdout).toEqual([]);
    expect(result.stderr[0]).toContain('informe ao menos um número');
  });

  it('opção desconhecida é erro de uso, mesmo junto com --help', () => {
    for (const args of [['-h'], ['52998224725', '--x'], ['--help', '--x']]) {
      const result = run(...args);
      expect(result.code).toBe(EXIT_USAGE);
      expect(result.stdout).toEqual([]);
      expect(result.stderr[0]).toMatch(/opção desconhecida: -/);
    }
  });
});

describe('cpf-cnpj --json', () => {
  it('emite o formato da pendência #6 (opção B): um objeto, uma linha, chaves na ordem', () => {
    const result = run('--json', '529.982.247-25', '123');
    expect(result.code).toBe(EXIT_INVALID);
    expect(result.stderr).toEqual([]);
    expect(result.stdout).toEqual([
      '{"valido":false,"total":2,"invalidos":1,"resultados":[{"entrada":"529.982.247-25","tipo":"cpf","valido":true},{"entrada":"123","tipo":"desconhecido","valido":false}]}',
    ]);
  });

  it('todos válidos: valido true, invalidos 0, código 0; --json em qualquer posição', () => {
    const result = run('52998224725', '--json', '12.ABC.345/01DE-35');
    expect(result.code).toBe(EXIT_OK);
    expect(JSON.parse(result.stdout[0] ?? '')).toEqual({
      valido: true,
      total: 2,
      invalidos: 0,
      resultados: [
        { entrada: '52998224725', tipo: 'cpf', valido: true },
        { entrada: '12.ABC.345/01DE-35', tipo: 'cnpj', valido: true },
      ],
    });
  });

  it('DV errado e malformados viram valido false, na ordem, com JSON parseável', () => {
    const inputs = ['52998224724', '11222333000182', '12abc34501de35', '529.982.247-25\n1', 'a\tb', 'x\\y', ''];
    const result = run('--json', ...inputs);
    expect(result.code).toBe(EXIT_INVALID);
    expect(result.stdout).toHaveLength(1);
    const report = JSON.parse(result.stdout[0] ?? '') as { total: number; invalidos: number; resultados: { entrada: string; valido: boolean }[] };
    expect(report.total).toBe(inputs.length);
    expect(report.invalidos).toBe(inputs.length);
    expect(report.resultados.map((r) => r.entrada)).toEqual(inputs);
    expect(report.resultados.every((r) => r.valido === false)).toBe(true);
  });

  it('erro de uso continua em texto no stderr, nada no stdout, código 2', () => {
    for (const args of [['--json'], ['--json', '--xml', '52998224725']]) {
      const result = run(...args);
      expect(result.code).toBe(EXIT_USAGE);
      expect(result.stdout).toEqual([]);
      expect(result.stderr[0]).toMatch(/^cpf-cnpj: /);
    }
  });

  it('--help junto com --json mostra o uso (que cita --json) e sai com 0', () => {
    const result = run('--json', '--help');
    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout).toEqual([USAGE]);
    expect(USAGE).toContain('--json');
  });

  it('sem --json a saída de texto não muda', () => {
    expect(run('529.982.247-25', '123').stdout).toEqual(['válido\tcpf\t529.982.247-25', 'inválido\tdesconhecido\t123']);
  });
});
