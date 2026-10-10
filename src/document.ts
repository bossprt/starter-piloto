// Classificação de documento (CPF ou CNPJ) pelo tamanho, e validação conforme o tipo.
import { isValidCnpj } from './cnpj.js';
import { isValidCpf } from './cpf.js';

export type DocumentType = 'cpf' | 'cnpj' | 'desconhecido';

export interface DocumentCheck {
  type: DocumentType;
  valid: boolean;
}

/**
 * Detecta o tipo pelo número de caracteres após remover espaços nas pontas e os
 * separadores `.`, `-` e `/`: 11 = CPF, 14 = CNPJ, outro tamanho = desconhecido.
 * Não valida formato nem dígitos verificadores. Entrada que não é string é desconhecida.
 */
export function detectDocumentType(input: unknown): DocumentType {
  if (typeof input !== 'string') return 'desconhecido';
  const length = input.trim().replace(/[./-]/g, '').length;
  if (length === 11) return 'cpf';
  if (length === 14) return 'cnpj';
  return 'desconhecido';
}

/**
 * Detecta o tipo de `input` e valida com o validador correspondente.
 * Tipo desconhecido é sempre inválido. Nunca lança exceção.
 */
export function checkDocument(input: unknown): DocumentCheck {
  const type = detectDocumentType(input);
  if (type === 'cpf') return { type, valid: isValidCpf(input) };
  if (type === 'cnpj') return { type, valid: isValidCnpj(input) };
  return { type, valid: false };
}
