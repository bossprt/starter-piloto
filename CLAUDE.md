@AGENTS.md

# Específico do Claude Code

- Hook `Stop` em `.claude/settings.json` roda `scripts/hooks/stop-validate.mjs` (`npm run validate`).
  Se falhar, o turno continua uma vez para corrigir; na segunda parada não bloqueia de novo.
- Revisão pelo Codex: use o plugin oficial (`/codex:review --base main`) se instalado;
  senão a CLI direta: `codex review --base main` (não interativo). Registre o que ele apontou no PR.
- Graphify: se `graphify-out/graph.json` existir, use `graphify query "<pergunta>"` antes de grep.
