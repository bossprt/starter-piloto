@AGENTS.md

# Específico do Claude Code

- Hook `Stop` em `.claude/settings.json` roda `scripts/hooks/stop-validate.mjs` (`npm run validate`).
  Se falhar, o turno continua uma vez para corrigir; na segunda parada não bloqueia de novo.
- Revisão pelo Codex: `node scripts/codex-review.mjs --task TASK-NNN --registrar` (somente leitura, ADR 0002/0004).
  Não use o plugin `/codex:*` nem `codex exec` com escrita. Rode em segundo plano se demorar.
- Graphify: se `graphify-out/graph.json` existir, use `graphify query "<pergunta>"` antes de grep.
- Sessão nova não interativa (prova de continuidade, tarefa delegada): `node scripts/sessao-agente.mjs "<prompt>"`.
  Ele isola a configuração global (−92% de tokens na medição de 2026-10-10). Não use `--bare` (exige chave de API).
