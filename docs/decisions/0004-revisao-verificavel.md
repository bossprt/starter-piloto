# 0004 — Revisão do Codex verificável e limitação da credencial compartilhada

- Data: 2026-10-10
- Estado: aceita (decisão de direção do dono; a parte do ruleset é configuração do dono)

## Contexto

Com a ADR 0003, o código integra sem aceite humano quando o CI está verde e a revisão do Codex
não tem defeito aberto. Até aqui, a evidência da revisão era um texto no PR e a etiqueta
`revisao-sem-defeito`, aplicada pelo próprio executor. Nada ligava a revisão à versão do código integrada.

## Decisão

1. `node scripts/codex-review.mjs --registrar`:
   - grava o resultado num **commit vazio no topo da branch**, depois da revisão;
   - os trailers são `Codex-Review: sem-defeito|com-defeito`, `Codex-Review-Tree: <árvore revisada>`,
     `Codex-Review-Base`, `Codex-Thread` (id da sessão em `~/.codex/sessions`) e `Codex-Tokens`;
   - o commit é vazio, então a árvore dele é a revisada. Qualquer commit posterior muda a árvore e invalida o registro.
2. O job de CI **`revisao-registrada`** (`scripts/check-review-record.mjs`) falha se:
   - o commit de topo não tem registro `sem-defeito` para a própria árvore; ou
   - algum commit do PR não tem o trailer `Agente:` (ADR 0003).
3. O `npm run status` só marca um PR aberto como **"integrável"** com CI verde e registro válido.
   Para `ci+revisao`, só mostra "validada" com registro (PRs antigos com a etiqueta aparecem como
   "etiqueta, sem registro verificável").
4. **Ruleset (configuração do dono):** incluir `revisao-registrada` (integração GitHub Actions,
   id 15368) como check obrigatório no ruleset `proteger-main`. Sem isso, o GitHub não bloqueia
   o merge de PR sem registro; só o `npm run status` e o agente respeitam a regra.
   **Aplicado pelo dono em 2026-10-10.** A API confirmou `validate` e `revisao-registrada` em
   `required_status_checks`. Prova no GitHub: o PR #22 (código sem registro) ficou `BLOCKED`;
   antes da mudança, o PR #20 ficava `UNSTABLE` e mergeável. O `npm run status` exige os dois checks
   para mostrar "protegida".

## Limitação: os agentes usam a mesma credencial

- O Claude Code, o Codex e o dono usam o mesmo token do GitHub (`gh` do dono). Para o GitHub,
  todo commit, PR, etiqueta e merge é de `bossprt`. A autoria real só aparece no trailer `Agente:`,
  nos logs locais (`~/.codex/sessions`, transcrições do Claude Code) e nos registros dos PRs.
- O registro é **declarativo**: quem tem o token pode escrever um commit com `Codex-Review: sem-defeito`
  sem que o Codex tenha revisado. O CI garante que o registro existe e cobre a árvore final.
  Não garante que o Codex o produziu.
- A auditoria possível é local. O `Codex-Thread` aponta a sessão do Codex em `~/.codex/sessions`,
  e o dono pode conferir o veredito lá.
- Para resolver de verdade, o revisor precisaria de identidade própria no GitHub: um GitHub App ou
  uma conta separada, com o check publicado por ele. Isso é decisão do dono (serviço/credencial nova).
