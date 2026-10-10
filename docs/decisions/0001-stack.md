# 0001 — Stack: TypeScript 6, Vitest, ESLint (typescript-eslint), núcleo próprio

- Data: 2026-10-10
- Estado: aceita (stack definida pelo dono no pedido; esta ADR registra a comparação exigida
  por `docs/regras/pesquisa.md` e `docs/regras/ferramentas.md`)

## Contexto

Biblioteca + CLI de validação de CPF e CNPJ. O dono definiu TypeScript, Vitest e ESLint.
As regras do projeto exigem pesquisa datada e comparação de pelo menos 3 opções, incluindo
o que o dono já paga, e comparação com construir. Esta ADR é o primeiro teste dessas regras.

O que o dono já paga e é aplicável: assinaturas de Claude Code e Codex (usadas para
desenvolver e revisar, não em runtime) e GitHub (conta pessoal, Actions em repositório
público). Nenhuma ferramenta paga do dono substitui biblioteca, test runner ou linter.

## Pesquisa (2026-10-10)

Fontes: `npm view <pacote> version time.modified license peerDependencies`,
`https://api.npmjs.org/downloads/point/last-week/<pacote>`, README no registry npm,
busca web sobre CNPJ alfanumérico (gov.br/receitafederal, PDF "CNPJ alfanumérico — perguntas
e respostas"; docs.cnpj.ws/blog/cnpj-alfanumerico; valorfinal.com.br/guia/cnpj-alfanumerico-digito-verificador).

Achado que afeta a escolha: desde julho de 2026 a Receita emite CNPJ alfanumérico
(IN RFB nº 2.229/2024). DV continua módulo 11; cada caractere vale `código ASCII − 48`.

### Núcleo de validação: usar biblioteca ou construir

| Opção | Versão / atualização | Uso (downloads/semana) | Licença | CNPJ alfanumérico no README | Custo |
| --- | --- | --- | --- | --- | --- |
| `cpf-cnpj-validator` | 2.1.2 / 2026-05-22 | 174.058 | MIT | sim | R$ 0; dependência de terceiro |
| `@brazilian-utils/brazilian-utils` | 2.5.0 / 2026-10-09 | 25.854 | MIT | não encontrado | R$ 0; não cobre alfanumérico |
| `validation-br` | 2.0.0 / 2026-09-14 | 8.556 | MIT | sim | R$ 0; dependência de terceiro |
| Construir (núcleo próprio) | — | — | MIT | a implementar | R$ 0; ~2 tarefas de desenvolvimento e manutenção própria |

Decisão: **construir**. Motivos: o pedido do dono é construir a biblioteca (e o projeto é piloto
do starter, cujo objetivo é exercitar o fluxo); algoritmo pequeno e estável; zero dependência
de runtime. Se o objetivo fosse só validar em outro produto, a recomendação seria
`cpf-cnpj-validator` (mais usado, cobre alfanumérico). Comparação feita, não refeita a cada tarefa.

### Linguagem: TypeScript 7 ou 6

| Opção | Situação em 2026-10-10 | Custo |
| --- | --- | --- |
| TypeScript 7.0.2 (compilador nativo) | publicado hoje; `typescript-eslint` 8.71.1 exige `typescript >=4.8.4 <6.1.0` | R$ 0; lint tipado quebra |
| TypeScript 6.0.3 | compatível com `typescript-eslint` 8.71.1 | R$ 0 |
| JavaScript + JSDoc com `tsc --checkJs` | sem build, tipagem mais fraca | R$ 0 |

Decisão: **TypeScript ~6.0.3**. Revisar quando `typescript-eslint` aceitar TS 7.

### Testes

| Opção | Versão / atualização | Downloads/semana | Custo |
| --- | --- | --- | --- |
| Vitest | 5.0.3 / 2026-09-30 | 123.007.750 | R$ 0 |
| Jest | 30.5.2 / 2026-09-18 | 46.281.030 | R$ 0; ESM+TS exige configuração extra |
| `node:test` (embutido no Node 22) | — | — | R$ 0; TS exige loader ou type stripping |

Decisão: **Vitest** (pedido do dono; roda TS e ESM sem configuração; também roda os testes `.mjs` dos scripts).

### Lint

| Opção | Versão / atualização | Downloads/semana | Custo |
| --- | --- | --- | --- |
| ESLint 10 + typescript-eslint 8 | 10.12.0 / 2026-10-02; 8.71.1 / 2026-10-09 | 161.610.242; 91.301.518 | R$ 0 |
| Biome | 2.5.15 / 2026-09-30 | 17.656.680 | R$ 0; um binário para lint e formatação, menos regras de TS tipado |
| Só `tsc --noEmit` | — | — | R$ 0; não pega problemas de estilo/uso |

Decisão: **ESLint + typescript-eslint** (pedido do dono; ecossistema maior).

## Consequências

- `typescript` fixado em `~6.0.3`; atualizar para 7 é uma nova decisão (nova ADR).
- CNPJ alfanumérico entra nos critérios da TASK-002 por ser a regra oficial vigente.
- Sem dependências de runtime: CLI e biblioteca rodam só com Node.
