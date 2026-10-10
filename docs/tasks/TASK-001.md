---
id: TASK-001
title: Validação de CPF na biblioteca
depends_on: []
validation: ci
test_command: npx vitest run test/cpf.test.ts
---

# TASK-001 — Validação de CPF

Implementar `isValidCpf(input: unknown): boolean` em `src/cpf.ts`, exportada por `src/index.ts`.

## Critérios de aceite

- [ ] Aceita CPF válido sem máscara (`52998224725`) e com máscara oficial (`529.982.247-25`).
- [ ] Ignora espaços no início e no fim.
- [ ] Rejeita CPF com o **primeiro** dígito verificador errado (`52998224735`).
- [ ] Rejeita CPF com o **segundo** dígito verificador errado (`52998224724`).
- [ ] Rejeita sequências de um só dígito repetido (`00000000000` a `99999999999`), mesmo com DV "matematicamente" válido.
- [ ] Rejeita tamanho errado: 10 e 12 dígitos, string vazia.
- [ ] Rejeita entradas malformadas: letras (`5299822472A`), máscara parcial ou fora de posição
      (`529.982.24725`, `5299.82.247-25`), outros separadores (`529 982 247 25`, `529_982_247_25`).
- [ ] Rejeita entradas que não são string (`undefined`, `null`, número, objeto) sem lançar exceção.
- [ ] Nenhuma dependência de runtime; função pura.
- [ ] Testes em `test/cpf.test.ts` cobrindo todos os itens acima.
