// Validação estrutural de CNPJ numérico e alfanumérico (módulo 11).
const UNMASKED = /^[A-Z0-9]{12}\d{2}$/;
const MASKED = /^[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-\d{2}$/;

function checkDigit(characters: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = characters.length - 1; i >= 0; i -= 1) {
    sum += (characters.charCodeAt(i) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/**
 * Indica se `input` é um CNPJ estruturalmente válido, numérico ou alfanumérico.
 * Aceita máscara oficial e espaços nas pontas; letras devem ser maiúsculas.
 * Entradas inválidas ou que não sejam string devolvem `false`.
 */
export function isValidCnpj(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (!UNMASKED.test(trimmed) && !MASKED.test(trimmed)) return false;

  const characters = trimmed.replace(/[./-]/g, '');
  if (/^(.)\1{13}$/.test(characters)) return false;

  const first = checkDigit(characters.slice(0, 12));
  const second = checkDigit(characters.slice(0, 12) + String(first));
  return characters.slice(12) === `${first}${second}`;
}
