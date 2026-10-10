# AGENTS.md — roteador

Biblioteca + CLI de validação de CPF e CNPJ em TypeScript (Vitest, ESLint).
Ponto de partida de qualquer agente. Leia só o que a situação pede: proibido ler `docs/` inteiro.
Estado do projeto: `npm run status` (não deduza estado lendo arquivos).

## Papéis (ADR 0002)

- **Executor:** Claude Code. Implementa, valida, abre PR e integra quando permitido.
- **Revisor:** Codex, só leitura, via `node scripts/codex-review.mjs`. Nunca escreve, commita ou integra.
- Proibido rodar o Codex com `danger-full-access`.

## Regra de coordenação (ADR 0003)

Autorizado sem pedir aprovação:
- programar, testar, abrir PRs com "TASK-NNN" no título;
- integrar `validation: ci+revisao` (padrão) ou `ci` quando o `npm run status` mostrar o PR como
  "integrável" (CI verde + revisão do Codex registrada sem defeito, ADR 0004) e a main "protegida".

O dono só entra em (registre como pendência, nunca faça):
- escolha de produto ou direção: escopo, formato público, ferramenta/serviço, `decisao_pendente`;
- ação que consome cota ou gera custo além do orçamento (`docs/regras/gastos.md`; se não existir,
  todo gasto ou consumo de cota além do uso normal das tarefas), login, credenciais;
- ação irreversível: apagar dados ou histórico, publicar produto, mexer em repositório/ruleset;
- etiqueta `aceite-humano` e integração de tarefa `ci+humano` (só tarefas que são decisão de produto).

Pendências: nunca pare por uma. Issue com etiqueta `depende-de-mim`: o que decidir, opções,
recomendação, o que fica bloqueado e a linha `Bloqueia: TASK-NNN` (lida pelo `npm run status`;
não use em pendência de aceite humano). Siga no que não depende dela. Só o dono fecha pendência.

Regras gerais:
- Nunca declare algo como validado. Estado vem de PRs e CI. Sem GitHub: "desconhecido".
- Não invente métricas. Sem dado: "não disponível".
- Máximo 3 ciclos de correção (CI ou revisão) por tarefa. Estourou: pendência e próxima tarefa.
- Scripts em Node (`.mjs`), sem bash.
- **Arquivos do starter só mudam em PR próprio** (lista no ADR 0003), nunca no PR de tarefa.
- **Assinatura:** todo commit termina com `Agente: <ferramenta> (<modelo>)`; todo PR traz
  `Executor:` e `Revisor:` no corpo.
- Tarefa só cita comando que já existe, ou diz que a tarefa o cria.

## Fluxo de tarefa

1. Ler `docs/tasks/TASK-NNN.md` (só a tarefa em execução e o que ela citar).
2. Conferir `depends_on` com `npm run status`. Tarefa com `decisao_pendente`: pendência e outra tarefa.
3. Branch `task/NNN-slug` a partir da `main` atualizada (`npm ci` se faltar `node_modules`).
4. Implementar com testes. Código em `src/`, testes em `test/`.
5. Rodar `npm run validate` até passar.
6. Commit (com `Agente:`) e revisão do Codex **antes do push**, em segundo plano (demora minutos):
   `node scripts/codex-review.mjs --task TASK-NNN --registrar`. Com defeito real: corrigir, commitar
   e revisar de novo (o registro só vale no topo). Registrar o descartado e o porquê no PR.
   Codex falhou: "revisão: não realizada" + causa; a tarefa não é integrada automaticamente.
7. Um push, PR com "TASK-NNN" no título; corpo com critérios atendidos, seção "Revisão"
   (apontado, corrigido, descartado) e linhas `Executor:` / `Revisor:`.
8. Integrar (squash, apagar branch) só nas condições da regra de coordenação.
   `ci+humano`: não integrar; pendência de aceite com instruções de teste.
9. Registrar a sessão em `docs/metrics/sessions.md` (pode ir no PR da tarefa).

## O que ler em cada situação

| Situação | Arquivo |
| --- | --- |
| Executar uma tarefa | `docs/tasks/TASK-NNN.md` |
| Estado do projeto / próxima tarefa | `npm run status` (não leia arquivos para isso) |
| Entender o produto e o fora de escopo | `docs/PRODUCT.md` |
| Restrições técnicas | `docs/ARCHITECTURE.md` |
| Por que a stack / papéis / humano / revisão verificável | `docs/decisions/` (0001, 0002, 0003, 0004) |
| Decisão de direção (o que construir, qual ferramenta) | `docs/regras/direcao.md` |
| Escolher ferramenta, biblioteca ou arquitetura | `docs/regras/pesquisa.md` e `docs/regras/ferramentas.md` |
| Projeto passar a ser comercial | `docs/regras/custos.md` |
| Registrar sessão (tokens, cota, ciclos) | `docs/metrics/sessions.md` |
| Mexer nos scripts do starter | `scripts/` (comece por `scripts/validate.mjs`), em PR próprio |

## Comandos

- `npm run validate` — lint, typecheck, build, testes, checagens de estrutura. Mesmo comando do CI.
- `npm run status` — estado das tarefas, próxima tarefa, proteção da main, pendências.
- `node scripts/codex-review.mjs --task TASK-NNN --registrar` — revisão do Codex (só leitura) + registro.

## Convenções

- Tarefas: frontmatter `id, title, depends_on, validation, test_command`; sem status/owner/evidence.
  `validation`: `ci+revisao` (padrão), `ci` ou `ci+humano` (só decisão de produto).
- ADRs: `docs/decisions/NNNN-slug.md`, numeração sequencial.
- Este arquivo tem no máximo 100 linhas (checado pelo validate).
