---
id: TASK-002
title: Validação de CNPJ (numérico e alfanumérico) na biblioteca
depends_on: [TASK-001]
validation: ci
test_command: npx vitest run test/cnpj.test.ts
---

# TASK-002 — Validação de CNPJ

Implementar `isValidCnpj(input: unknown): boolean` em `src/cnpj.ts`, exportada por `src/index.ts`.
Seguir o padrão de `src/cpf.ts` (TASK-001) e as restrições de `docs/ARCHITECTURE.md`.

Regra (IN RFB nº 2.229/2024): 14 caracteres; os 12 primeiros são dígitos ou letras maiúsculas
A–Z; os 2 últimos (DV) são dígitos. DV por módulo 11 com pesos de 2 a 9 da direita para a
esquerda; cada caractere vale `código ASCII − 48` (dígitos mantêm o valor; `A` = 17 ... `Z` = 42).
Resto < 2 dá DV 0; senão DV = 11 − resto.

## Critérios de aceite

- [ ] Aceita CNPJ numérico válido sem e com máscara (`11222333000181`, `11.222.333/0001-81`).
- [ ] Aceita CNPJ alfanumérico válido sem e com máscara (`12ABC34501DE35`, `12.ABC.345/01DE-35`).
- [ ] Ignora espaços no início e no fim.
- [ ] Rejeita **primeiro** DV errado (`11222333000191`) e **segundo** DV errado (`11222333000182`),
      inclusive no alfanumérico (`12ABC34501DE45`, `12ABC34501DE36`).
- [ ] Rejeita letra em posição de DV (`12ABC34501DE3A`).
- [ ] Rejeita letras minúsculas (`12abc34501de35`): o formato oficial é maiúsculo.
- [ ] Rejeita sequências de um só caractere repetido (`00000000000000`, `11111111111111`).
- [ ] Rejeita tamanho errado (13 e 15 caracteres, string vazia).
- [ ] Rejeita malformados: máscara parcial ou fora de posição (`11.222.333/000181`),
      outros caracteres (`11 222 333 0001 81`, `11222333000@81`, `12ÁBC34501DE35`).
- [ ] Rejeita entradas que não são string sem lançar exceção.
- [ ] Testes em `test/cnpj.test.ts` cobrindo todos os itens acima.
