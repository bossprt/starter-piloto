---
id: TASK-004
title: Opção --json na CLI
depends_on: [TASK-003]
validation: ci+revisao
test_command: npx vitest run test/cli.test.ts
---

# TASK-004 — Saída `--json`

Acrescentar `--json` à CLI `cpf-cnpj` para saída legível por máquina.
Formato decidido pelo dono na pendência #6 (opção B, campo `valido` sem acento):

```
$ cpf-cnpj --json 529.982.247-25 123
{"valido":false,"total":2,"invalidos":1,"resultados":[{"entrada":"529.982.247-25","tipo":"cpf","valido":true},{"entrada":"123","tipo":"desconhecido","valido":false}]}
```

Validação `ci+revisao`: integração automática com CI verde e revisão do Codex sem defeito aberto.

## Critérios de aceite

- [ ] `--json` emite **um** objeto JSON em uma linha no stdout, com as chaves nesta ordem:
      `valido` (todos válidos), `total`, `invalidos`, `resultados`.
- [ ] `resultados` tem um objeto por argumento, na ordem dos argumentos, com `entrada` (texto original,
      sem o escape da saída de texto: o JSON já escapa), `tipo` (`cpf`, `cnpj` ou `desconhecido`) e `valido`.
- [ ] `--json` pode vir em qualquer posição entre os argumentos.
- [ ] Códigos de saída iguais aos da saída de texto: 0 todos válidos, 1 algum inválido, 2 erro de uso.
- [ ] Erro de uso (sem números, opção desconhecida) continua em texto no stderr e nada no stdout, mesmo com `--json`.
- [ ] `--help` continua mostrando o uso (inclui `--json`) e sai com 0, mesmo junto com `--json`.
- [ ] DV errado e entradas malformadas (incluindo quebra de linha e tabulação) aparecem como `valido: false`
      e o JSON continua válido (`JSON.parse` da saída funciona).
- [ ] Saída de texto sem `--json` continua idêntica à da TASK-003.
- [ ] Testes em `test/cli.test.ts`.
