# starter-piloto

Biblioteca + CLI de validação de CPF e CNPJ (TypeScript), usada como piloto de um starter
de projeto com tarefas, CI e revisão cruzada entre agentes.

## CLI `cpf-cnpj`

```sh
npm ci
npm run build
node dist/cli.js 529.982.247-25 11222333000181 123
```

Saída (uma linha por número, na ordem, separada por tabulação):

```text
válido	cpf	529.982.247-25
válido	cnpj	11222333000181
inválido	desconhecido	123
```

- Tipo detectado pelo tamanho após remover a máscara (`.`, `-`, `/`): 11 = CPF, 14 = CNPJ.
- A entrada original sai como foi passada, exceto `\`, tabulação, quebra de linha e outros
  caracteres de controle, que saem como escape (`\\`, `\t`, `\n`, `\r`, `\uXXXX`).
- CNPJ alfanumérico aceito (letras maiúsculas nas 12 primeiras posições).
- Código de saída: `0` se todos válidos; `1` se algum inválido; `2` para erro de uso
  (nenhum argumento ou opção desconhecida, com mensagem em stderr).
- `--json` (em qualquer posição) troca a saída por um objeto JSON em uma linha, com os mesmos códigos de saída:

  ```text
  $ node dist/cli.js --json 529.982.247-25 123
  {"valido":false,"total":2,"invalidos":1,"resultados":[{"entrada":"529.982.247-25","tipo":"cpf","valido":true},{"entrada":"123","tipo":"desconhecido","valido":false}]}
  ```

  Erros de uso continuam em texto no stderr, sem nada no stdout.
- `node dist/cli.js --help` mostra o uso. Com `npm link`, o comando fica disponível como `cpf-cnpj`.

## Desenvolvimento

- Agentes: comece por [AGENTS.md](AGENTS.md).
- Estado do projeto: `npm run status`.
- Validação completa (igual ao CI): `npm run validate`.
