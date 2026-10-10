// Escopo do CI (docs/regras/gastos.md): PR que só muda documentação (.md) não precisa de npm ci,
// lint, typecheck, build nem testes; roda só as checagens de estrutura (que leem os .md).

/** @param {string[]} files caminhos alterados no PR */
export function isDocsOnly(files) {
  const changed = files.map((file) => file.trim()).filter(Boolean);
  return changed.length > 0 && changed.every((file) => file.toLowerCase().endsWith('.md'));
}
