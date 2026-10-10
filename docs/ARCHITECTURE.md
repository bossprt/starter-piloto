# Arquitetura — decisões e restrições

- TypeScript estrito, ESM, Node >= 22.13. Stack registrada em `docs/decisions/0001-stack.md`.
- Biblioteca sem dependências de runtime. Dependências só de desenvolvimento.
- Funções de validação puras e síncronas: sem I/O, sem rede, sem estado global.
- Validadores nunca lançam exceção por entrada malformada; devolvem `false`.
  Entrada que não é string também devolve `false`.
- Máscara aceita: apenas os separadores oficiais (`.`, `-`, `/`) nas posições oficiais
  ou ausência total de máscara. Outros caracteres tornam a entrada inválida.
- CNPJ: aceita letras maiúsculas A–Z nas 12 primeiras posições (IN RFB 2.229/2024);
  os 2 dígitos verificadores são sempre numéricos. Minúsculas: ver critério da TASK-002.
- CLI é uma camada fina sobre a biblioteca: toda regra de validação mora na biblioteca.
- Scripts do starter em Node `.mjs`, sem bash; lógica pura separada de chamadas a git/gh/disco.
- Estado de tarefas é derivado de PRs e CI (`scripts/project-status.mjs`); nunca escrito em arquivo.
- `npm run validate` é o mesmo comando local, no hook do Claude Code e no CI.
- Proteção da main: aceita proteção clássica ou ruleset; "protegida" exige PR e check `validate`
  sem bypass. Qualquer `bypass_actors` invalida (política estrita); bypass não determinado = "desconhecido".
