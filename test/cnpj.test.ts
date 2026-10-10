import { describe, expect, it } from 'vitest';
import { isValidCnpj } from '../src/index.js';

describe('isValidCnpj', () => {
  it.each(['11222333000181', '11.222.333/0001-81', '12ABC34501DE35', '12.ABC.345/01DE-35'])('aceita CNPJ válido: %s', (input) => {
    expect(isValidCnpj(input)).toBe(true);
    expect(isValidCnpj(` \t${input}\n `)).toBe(true);
  });

  it.each([
    '11222333000191', '11222333000182', '12ABC34501DE45', '12ABC34501DE36',
    '11.222.333/0001-91', '11.222.333/0001-82', '12.ABC.345/01DE-45', '12.ABC.345/01DE-36',
    '12ABC34501DE3A', '12ABC34501DEA5', '12abc34501de35', '12.abc.345/01de-35',
    '1122233300018', '112223330001810', '', '   ',
    '11.222.333/000181', '112.22.333/0001-81', '11 222 333 0001 81',
    '11222333000@81', '12ÁBC34501DE35', '112223330001８1', '11222333000181\n1',
  ])('rejeita CNPJ inválido: %s', (input) => {
    expect(isValidCnpj(input)).toBe(false);
  });

  it('rejeita todos os dígitos repetidos, sem e com máscara', () => {
    for (let digit = 0; digit <= 9; digit += 1) {
      const d = String(digit);
      expect(isValidCnpj(d.repeat(14))).toBe(false);
      expect(isValidCnpj(`${d.repeat(2)}.${d.repeat(3)}.${d.repeat(3)}/${d.repeat(4)}-${d.repeat(2)}`)).toBe(false);
    }
  });

  it('rejeita entradas que não são string sem lançar exceção', () => {
    for (const input of [undefined, null, 11222333000181, {}, [], true, Symbol('cnpj'), () => '11222333000181']) {
      expect(() => isValidCnpj(input)).not.toThrow();
      expect(isValidCnpj(input)).toBe(false);
    }
  });
});
