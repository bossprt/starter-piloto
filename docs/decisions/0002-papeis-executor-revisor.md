# 0002 — Papéis: Claude Code executa, Codex revisa em somente leitura

- Data: 2026-10-10
- Estado: aceita (decisão de direção do dono do projeto)

## Contexto

A rodada 1 testou o handoff de execução para o Codex (Etapa 7: "Leia o AGENTS.md e execute a TASK-002").
Resultado do experimento, registrado em `docs/metrics/sessions.md` e no PR #10:
- Com o sandbox `elevated` do Codex CLI 0.162.1 no Windows, nenhum comando de shell roda
  (`helper_unknown_error: setup refresh had errors`; os error 32 em `node_repl.exe`; bug aberto
  em openai/codex#52501 e relatos relacionados). Pendência #5.
- Com `windows.sandbox="unelevated"` o shell volta. Mesmo assim, `workspace-write` protege `.git` por desenho,
  e o `git push` falha (o helper de credencial roda via `sh`, que aborta com o token restrito).
- O Codex só concluiu a TASK-002 com contornos: um clone com `--separate-git-dir`, o push feito pela
  API Git Data do GitHub, um wrapper `NODE_OPTIONS` para o `gh` e o Vitest com `--pool threads`.
  Também integrou o próprio PR antes da revisão de papéis invertidos e fechou uma pendência do dono.

## Opções consideradas

| Opção | Custo / risco |
| --- | --- |
| Codex executa com `--sandbox danger-full-access` | Sem isolamento do agente. **Não autorizado pelo dono.** |
| Codex executa com contornos de ambiente (acima) | Frágil, específico desta máquina, fora do que o repositório documenta |
| **Claude Code executa; Codex revisa em somente leitura** | Usa as duas assinaturas que o dono já paga; revisão não precisa de escrita, git push nem rede além da API do modelo |
| Sem revisão cruzada | Perde a revisão independente (os achados reais da rodada 1 vieram dela: PRs #8 e #9) |

## Decisão

- **Executor:** sempre o Claude Code. Ele implementa, roda `npm run validate`, abre o PR e integra
  quando a regra do AGENTS.md permite.
- **Revisor:** o Codex, sempre em **somente leitura** (`-s read-only`), via `node scripts/codex-review.mjs`.
  Ele aponta problemas e não altera arquivos, não faz commit, push ou merge, nem mexe em issues.
- **Proibido:** `danger-full-access`.
- **Único contorno de ambiente mantido:** `-c windows.sandbox="unelevated"` no script de revisão, porque
  sem ele nem a leitura funciona no Windows com o Codex 0.162.x. Remover quando o bug for corrigido.
- Removidos os contornos que só serviam para o Codex executar: `http.sslBackend=openssl` local,
  o clone com gitdir separado e o push pela API Git Data.

## Consequências

- A Etapa 7 (handoff para o Codex) fica registrada como experimento, não como requisito do starter.
- A prova de continuidade passa a ser uma sessão nova do Claude Code, sem histórico, que lê o AGENTS.md.
- Se o Codex falhar, o PR registra "revisão: não realizada" com a causa. Isso não bloqueia o fluxo.
