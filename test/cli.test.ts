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
    for (const args of [['--json'], ['-h'], ['52998224725', '--x'], ['--help', '--x']]) {
      const result = run(...args);
      expect(result.code).toBe(EXIT_USAGE);
      expect(result.stdout).toEqual([]);
      expect(result.stderr[0]).toMatch(/opção desconhecida: -/);
    }
  });
});
