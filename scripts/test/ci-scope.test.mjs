import { describe, expect, it } from 'vitest';
import { isDocsOnly } from '../lib/ci-scope.mjs';

describe('isDocsOnly', () => {
  it('true só quando todos os arquivos são .md', () => {
    expect(isDocsOnly(['docs/regras/gastos.md', 'AGENTS.md', ''])).toBe(true);
    expect(isDocsOnly(['README.MD'])).toBe(true);
  });
  it('false com qualquer código, configuração ou workflow', () => {
    expect(isDocsOnly(['docs/a.md', 'src/cli.ts'])).toBe(false);
    expect(isDocsOnly(['.github/workflows/validate.yml'])).toBe(false);
    expect(isDocsOnly(['package.json'])).toBe(false);
  });
  it('false sem arquivos (diff vazio ou indisponível)', () => {
    expect(isDocsOnly([])).toBe(false);
    expect(isDocsOnly([''])).toBe(false);
  });
});
