---
id: TASK-003
title: CLI de validação de CPF e CNPJ
depends_on: [TASK-001, TASK-002]
validation: ci+humano
test_command: npx vitest run test/cli.test.ts
---

# TASK-003 — CLI

CLI `cpf-cnpj` (campo `bin` do `package.json`, fonte em `src/cli.ts`) que valida um ou mais
números passados como argumentos, usando só a biblioteca (`isValidCpf`, `isValidCnpj`).

Uso: `cpf-cnpj <numero> [<numero> ...]` e `cpf-cnpj --help`.

## Critérios de aceite

- [ ] Detecta o tipo pelo número de caracteres após remover a máscara: 11 = CPF, 14 = CNPJ;
      outro tamanho = inválido com tipo "desconhecido".
- [ ] Uma linha por argumento, na ordem: `<válido|inválido>\t<cpf|cnpj|desconhecido>\t<entrada original>`.
- [ ] Código de saída: 0 se todos válidos; 1 se algum inválido; 2 para erro de uso
      (nenhum argumento ou opção desconhecida), com mensagem em stderr.
- [ ] `--help` mostra uso e sai com 0.
- [ ] DV errado e entradas malformadas aparecem como `inválido` (não quebram a CLI).
- [ ] Toda regra de validação fica na biblioteca; a CLI só formata e define o código de saída.
- [ ] Executável com `node dist/cli.js` após `npm run build`, e testado em `test/cli.test.ts`
      chamando a função principal com argumentos e capturando saída e código.
- [ ] README com instruções de uso da CLI.
