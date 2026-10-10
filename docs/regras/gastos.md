# Gastos e cotas

Vale para todo agente, em todo projeto que use este starter. Complementa a ADR 0003: ação que consome
cota ou gera custo além do descrito aqui é decisão do dono (pendência `depende-de-mim`).

## 1. Inventário e medição

- Inventário dos serviços (plano, limite, como medir): `docs/metrics/servicos.md`.
- Uso atual: `npm run uso`. Ele só lê dados locais e a API do GitHub, sem consumir cota de modelo.
  Rode **antes de começar uma tarefa** e antes de cada revisão do Codex.
- Cada sessão registra tokens e cota em `docs/metrics/sessions.md`. Sem dado: "não disponível".

## 2. Parada em 70%

Se qualquer percentual chegar a **70% ou mais** (`npm run uso`, `codex-review.mjs` ou `sessao-agente.mjs`
avisam e o `npm run uso` sai com código 3):
1. pare **aquele tipo de ação**: revisões do Codex, sessões novas do Claude ou chamadas à API do GitHub;
2. abra pendência `depende-de-mim` com o serviço, a janela (5h, semanal, por hora), o percentual,
   o horário de reset e o que fica bloqueado;
3. siga no que não consome o serviço afetado (por exemplo, escrever código e testes locais).

## 3. Um push por tarefa

- Commit local, `npm run validate` local e revisão do Codex com `--registrar` **antes** do push.
  Depois disso, **um** push, que abre o PR e dispara o CI uma vez.
- Push extra só para corrigir falha de CI, e ele conta como ciclo de correção (máximo 3).
- O `npm run uso` lista os PRs com mais de uma execução de CI.

## 4. CI só em PR

Configurado em `.github/workflows/validate.yml`:
- roda só em `pull_request`. A main só recebe PR validado, porque o ruleset exige PR e checks;
- `concurrency` com `cancel-in-progress` cancela execuções antigas do mesmo PR;
- PR que só muda `.md` roda apenas as checagens de estrutura, sem `npm ci`, lint, build nem testes;
- os checks obrigatórios sempre reportam resultado. Não use `paths-ignore` no workflow: o check
  pulado fica pendente e bloqueia o merge.

## 5. Publicação só ao integrar na main

- Hoje nada é publicado (pacote `private`, sem release nem deploy).
- Qualquer workflow futuro de publicação (npm, release, deploy) roda só em `push` para `main`, depois
  do merge. Nunca em `pull_request` nem manualmente pelo agente.
- Publicar produto continua sendo decisão do dono (ADR 0003).

## 6. Sessões e revisões econômicas

- Sessão nova do Claude Code (prova de continuidade, tarefa delegada): use `node scripts/sessao-agente.mjs`.
  Ele isola a configuração global (plugins, skills, MCP, hooks). Medição de 2026-10-10, com a mesma pergunta:
  263.180 tokens de entrada sem isolamento, 20.409 com isolamento (−92%).
- Revisão do Codex: uma por tarefa, antes do push. Cada revisão consome de cerca de 30 mil a 270 mil tokens.
- `--bare` do Claude Code exige chave de API (cobrança separada): não use sem decisão do dono.
