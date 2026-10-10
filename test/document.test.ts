import { describe, expect, it } from 'vitest';
import { checkDocument, detectDocumentType } from '../src/index.js';

describe('detectDocumentType', () => {
  it('usa o tamanho após remover espaços nas pontas e separadores', () => {
    expect(detectDocumentType('52998224725')).toBe('cpf');
    expect(detectDocumentType(' 529.982.247-25 ')).toBe('cpf');
    expect(detectDocumentType('11.222.333/0001-81')).toBe('cnpj');
    expect(detectDocumentType('12ABC34501DE35')).toBe('cnpj');
    expect(detectDocumentType('123')).toBe('desconhecido');
    expect(detectDocumentType('')).toBe('desconhecido');
  });

  it('entrada que não é string é desconhecida', () => {
    for (const input of [undefined, null, 52998224725, {}, []]) {
      expect(detectDocumentType(input)).toBe('desconhecido');
    }
  });
});

describe('checkDocument', () => {
  it('valida pelo tipo detectado', () => {
    expect(checkDocument('529.982.247-25')).toEqual({ type: 'cpf', valid: true });
    expect(checkDocument('52998224724')).toEqual({ type: 'cpf', valid: false });
    expect(checkDocument('11222333000181')).toEqual({ type: 'cnpj', valid: true });
    expect(checkDocument('1234')).toEqual({ type: 'desconhecido', valid: false });
  });
});
