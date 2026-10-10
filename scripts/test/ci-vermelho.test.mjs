import { expect, it } from 'vitest';

// Quebrado de propósito: prova de que o CI falha e bloqueia o merge.
it('falha de propósito', () => {
  expect(1 + 1).toBe(3);
});
