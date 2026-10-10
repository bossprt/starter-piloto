# Serviços: plano, limite e como medir

Pesquisa feita em 2026-10-10. Uso atual: `npm run uso`. Regra: `docs/regras/gastos.md`.
Os campos marcados "dono informa" não aparecem em nenhuma fonte acessível ao agente: não estime.

| Serviço | Plano | Limite | Como medir o uso | Fonte |
| --- | --- | --- | --- | --- |
| Claude Code (executor) | Assinatura do dono; plano: não disponível (dono informa). Excedente desativado (`overageStatus: rejected`, `org_level_disabled`) | Janelas de 5h e de 7 dias, em %; sem limite mensal em tokens publicado | Evento `rate_limit_event` (`unifiedWindows.five_hour` / `seven_day`) no `claude -p --output-format stream-json`, gravado por `scripts/sessao-agente.mjs` em `.agent-logs/`; no modo interativo, `rate_limits` na statusline ou `/usage` | code.claude.com/docs/en/statusline (campos `rate_limits.five_hour.used_percentage` e `seven_day`) |
| Codex CLI (revisor) | ChatGPT do dono; plano: não disponível (dono informa). Sem créditos extras (`has_credits: false`) | Janela de 5h e semanal, em % | `rate_limits.primary` / `secondary.used_percent` no arquivo da sessão em `~/.codex/sessions/…/rollout-*.jsonl`; tokens no evento `turn.completed` do `codex exec --json`; na sessão interativa, `/status`; na web, chatgpt.com/codex/settings/usage | Arquivos de sessão locais; guias públicos sobre `/status` |
| GitHub Actions | Conta pessoal; plano: não confirmado (dono informa) | **Grátis e sem limite de minutos** em repositório público com runner padrão | Execuções e minutos do mês via `GET /repos/{owner}/{repo}/actions/runs` (`npm run uso`) | docs.github.com: billing/concepts/product-billing/github-actions |
| GitHub API (token do `gh`) | Token OAuth do dono | 5.000 requisições por hora | `GET /rate_limit` (`npm run uso`) | docs.github.com: REST rate limits |
| GitHub (faturamento geral) | — | — | `GET /users/{username}/settings/billing/usage` exige o escopo `user` no token, que o token atual não tem (decisão do dono) | docs.github.com: rest/billing/usage |
| npm registry | Público, grátis | Sem cota relevante para este uso | — | — |
