// Validação estrutural de CPF: formato e dígitos verificadores (módulo 11).

const UNMASKED = /^\d{11}$/;
const MASKED = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

function checkDigit(digits: readonly number[], firstWeight: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    sum += (digits[i] ?? 0) * (firstWeight - i);
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/**
 * Indica se `input` é um CPF estruturalmente válido.
 * Aceita 11 dígitos sem máscara ou no formato `000.000.000-00`; ignora espaços nas pontas.
 * Nunca lança exceção: qualquer entrada inválida ou que não seja string devolve `false`.
 */
export function isValidCpf(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (!UNMASKED.test(trimmed) && !MASKED.test(trimmed)) return false;

  const digits = trimmed.replace(/\D/g, '').split('').map(Number);
  if (digits.every((digit) => digit === digits[0])) return false;

  const first = checkDigit(digits.slice(0, 9), 10);
  const second = checkDigit(digits.slice(0, 10), 11);
  return digits[9] === first && digits[10] === second;
}
