---
id: TASK-004
title: Opção --json na CLI
depends_on: [TASK-003]
validation: ci+humano
test_command: npx vitest run test/cli-json.test.ts
decisao_pendente: formato do JSON de saída
---

# TASK-004 — Saída `--json`

Acrescentar `--json` à CLI para saída legível por máquina.

**Bloqueada:** o formato do JSON de saída é decisão do dono (`decisao_pendente`).
Não implementar antes de a pendência correspondente ser decidida e este campo atualizado.

## Critérios de aceite (completar após a decisão)

- [ ] `--json` emite o formato decidido na pendência, para todos os argumentos.
- [ ] Códigos de saída iguais aos da saída de texto (0, 1, 2).
- [ ] DV errado e entradas malformadas aparecem como inválidas no JSON, sem quebrar a CLI.
- [ ] Saída de texto sem `--json` continua idêntica à da TASK-003.
