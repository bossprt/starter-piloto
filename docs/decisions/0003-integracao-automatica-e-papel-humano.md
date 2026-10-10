# 0003 — Integração automática de código; humano só em produto, custo e irreversível

- Data: 2026-10-10
- Estado: aceita (decisão de direção do dono do projeto)

## Contexto

A rodada 1 exigiu aceite humano (`ci+humano`) para a TASK-003. O aceite levou o dono a testar
uma CLI que já tinha CI verde e revisão do Codex. A TASK-004 testou o critério `ci+revisao`:
integração automática com CI verde e revisão do Codex sem defeito aberto. Funcionou (PR #15).

## Decisão

1. **Código não exige aceite humano.** O padrão das tarefas passa a ser `validation: ci+revisao`:
   o agente integra quando o CI está verde, a main está protegida e a última revisão do Codex
   não tem defeito aberto.
2. **O humano (dono) só entra em:**
   - escolha de produto ou direção: o que construir, escopo, ferramenta, formato público. Vai como pendência;
   - ação que consome cota ou gera custo além do orçamento combinado (ver `docs/regras/gastos.md`);
   - ação irreversível: apagar dados ou histórico, publicar produto, transferir ou excluir repositório.
3. `ci+humano` continua existindo só para tarefas cuja entrega é, ela mesma, uma decisão de produto.
4. **Arquivos do starter só mudam em PR próprio**, separado do PR de tarefa. São arquivos do starter:
   `AGENTS.md`, `CLAUDE.md`, `docs/regras/`, `docs/decisions/`, `scripts/`, `.github/`, `.claude/`
   e os campos `scripts`, `devDependencies` e `engines` do `package.json`.
   Exceção: o registro de métricas em `docs/metrics/` pode ir no PR da tarefa.
5. **Cada agente assina o que faz:**
   - todo commit termina com o trailer `Agente: <ferramenta> (<modelo>)`;
   - todo PR traz as linhas `Executor:` e `Revisor:` no corpo.

## Consequências

- Menos interrupções do dono. O risco de defeito em código integrado passa a depender do CI e da
  revisão do Codex, que precisa ser verificável (decisão registrada na ADR seguinte).
- Mudanças no processo ficam isoladas e rastreáveis em PRs só de starter.
- A assinatura é declarativa: todos os agentes usam a mesma credencial do GitHub (limitação registrada na ADR seguinte).
