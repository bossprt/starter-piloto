# AGENTS.md — roteador

Biblioteca + CLI de validação de CPF e CNPJ em TypeScript (Vitest, ESLint).
Este arquivo é o ponto de partida de qualquer agente. Leia só o que a situação pede.

## Não leia todos os docs

Proibido ler `docs/` inteiro por padrão. Use a tabela "O que ler" abaixo.
Para saber o estado do projeto, rode `npm run status`; não deduza estado lendo arquivos.

## Papéis (ADR 0002)

- **Executor:** Claude Code. Implementa, valida, abre PR e integra quando permitido.
- **Revisor:** Codex, só leitura, via `node scripts/codex-review.mjs`. Nunca escreve, commita ou integra.
- Proibido rodar o Codex com `danger-full-access`.

## Regra de coordenação

Autorizado sem pedir aprovação:
- programar, testar, abrir PRs com "TASK-NNN" no título;
- integrar PR de tarefa com `validation: ci` quando o CI estiver verde
  e a proteção da main estiver confirmada (`npm run status` mostra "protegida").

Depende do dono (nunca faça; registre como pendência):
- login em conta, credenciais, qualquer coisa que gere cobrança nova;
- aplicar a etiqueta `aceite-humano` ou integrar tarefa com `validation: ci+humano`;
- mudar escopo, contratar serviço, publicar produto, decidir campo `decisao_pendente`.

Pendências: nunca pare o trabalho por uma. Abra issue com etiqueta `depende-de-mim`
contendo: o que decidir/fazer, opções, recomendação, o que fica bloqueado,
e a linha `Bloqueia: TASK-NNN, ...` (é o que o `npm run status` lê).
Siga em tudo que não depende dela. Só o dono fecha pendência `depende-de-mim`.

Regras gerais:
- Nunca declare algo como validado. Estado vem de PRs e CI (`npm run status`).
- Sem acesso a GitHub: estado "desconhecido". Nunca presuma aprovado.
- Não invente métricas. Sem dado: "não disponível".
- Máximo 3 ciclos de correção (CI ou revisão) por tarefa. Estourou: pendência e próxima tarefa.
- Scripts em Node (`.mjs`), sem bash.

## Fluxo de tarefa

1. Ler `docs/tasks/TASK-NNN.md` (só a tarefa em execução e o que ela citar).
2. Conferir dependências em `depends_on` com `npm run status`.
   Se a tarefa tem `decisao_pendente`: não implemente; abra pendência e vá para outra.
3. Criar branch `task/NNN-slug` a partir da `main` atualizada (`npm ci` se faltar `node_modules`).
4. Implementar com testes. Código em `src/`, testes em `test/`.
5. Rodar `npm run validate` até passar.
6. Abrir PR com "TASK-NNN" no título; corpo com critérios atendidos e
   seção "Revisão" (resultado da revisão independente ou "revisão: não realizada").
7. Pedir revisão ao Codex: `node scripts/codex-review.mjs --task TASK-NNN` (só leitura; o prompt
   já pede correção, segurança, manutenção e conflito com `docs/decisions/`). Registrar no PR:
   apontado, corrigido, descartado e por quê. Codex falhou: "revisão: não realizada" + causa.
8. Só depois da revisão registrada: se `validation: ci`, CI verde e main protegida, integrar
   (squash) e apagar a branch. Se `validation: ci+humano`: não integrar; abrir pendência
   de aceite humano com instruções de como o dono testa.
9. Registrar a sessão em `docs/metrics/sessions.md`.

## O que ler em cada situação

| Situação | Arquivo |
| --- | --- |
| Executar uma tarefa | `docs/tasks/TASK-NNN.md` |
| Estado do projeto / próxima tarefa | `npm run status` (não leia arquivos para isso) |
| Entender o produto e o fora de escopo | `docs/PRODUCT.md` |
| Restrições técnicas | `docs/ARCHITECTURE.md` |
| Por que a stack é esta | `docs/decisions/0001-stack.md` |
| Papéis executor/revisor, por que o Codex só revisa | `docs/decisions/0002-papeis-executor-revisor.md` |
| Decisão de direção (o que construir, qual ferramenta) | `docs/regras/direcao.md` |
| Escolher ferramenta, biblioteca ou arquitetura | `docs/regras/pesquisa.md` e `docs/regras/ferramentas.md` |
| Projeto passar a ser comercial | `docs/regras/custos.md` |
| Registrar sessão (tokens, cota, ciclos) | `docs/metrics/sessions.md` |
| Mexer nos scripts do starter | `scripts/` (comece por `scripts/validate.mjs`) |

## Comandos

- `npm run validate` — lint, typecheck, testes, checagens de estrutura. Mesmo comando do CI.
- `npm run status` — estado das tarefas, próxima tarefa, proteção da main, pendências.
- `npm test` — só testes.
- `node scripts/codex-review.mjs --task TASK-NNN` — revisão do Codex em somente leitura.

## Convenções

- Tarefas: frontmatter `id, title, depends_on, validation, test_command`; sem status/owner/evidence.
- ADRs: `docs/decisions/NNNN-slug.md`, numeração sequencial.
- Este arquivo tem no máximo 100 linhas (checado pelo validate).
