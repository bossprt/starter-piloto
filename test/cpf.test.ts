import { describe, expect, it } from 'vitest';
import { isValidCpf } from '../src/index.js';

describe('isValidCpf', () => {
  it('aceita CPF válido sem e com máscara', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('11144477735')).toBe(true);
  });

  it('ignora espaços no início e no fim', () => {
    expect(isValidCpf('  529.982.247-25 ')).toBe(true);
    expect(isValidCpf('\t52998224725\n')).toBe(true);
  });

  it('rejeita primeiro dígito verificador errado', () => {
    expect(isValidCpf('52998224735')).toBe(false);
  });

  it('rejeita segundo dígito verificador errado', () => {
    expect(isValidCpf('52998224724')).toBe(false);
  });

  it('rejeita todas as sequências de dígito repetido', () => {
    for (let d = 0; d <= 9; d += 1) {
      expect(isValidCpf(String(d).repeat(11))).toBe(false);
      expect(isValidCpf(`${String(d).repeat(3)}.${String(d).repeat(3)}.${String(d).repeat(3)}-${String(d).repeat(2)}`)).toBe(false);
    }
  });

  it('rejeita tamanho errado', () => {
    expect(isValidCpf('5299822472')).toBe(false);
    expect(isValidCpf('529982247250')).toBe(false);
    expect(isValidCpf('')).toBe(false);
    expect(isValidCpf('   ')).toBe(false);
  });

  it('rejeita entradas malformadas', () => {
    expect(isValidCpf('5299822472A')).toBe(false);
    expect(isValidCpf('529.982.24725')).toBe(false);
    expect(isValidCpf('5299.82.247-25')).toBe(false);
    expect(isValidCpf('529 982 247 25')).toBe(false);
    expect(isValidCpf('529_982_247_25')).toBe(false);
    expect(isValidCpf('529.982.247-2５')).toBe(false);
    expect(isValidCpf('529.982.247-25\n1')).toBe(false);
  });

  it('rejeita entradas que não são string sem lançar exceção', () => {
    for (const value of [undefined, null, 52998224725, {}, [], true, Symbol('cpf')]) {
      expect(() => isValidCpf(value)).not.toThrow();
      expect(isValidCpf(value)).toBe(false);
    }
  });
});
