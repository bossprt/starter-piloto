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
- CNPJ alfanumérico aceito (letras maiúsculas nas 12 primeiras posições).
- Código de saída: `0` se todos válidos; `1` se algum inválido; `2` para erro de uso
  (nenhum argumento ou opção desconhecida, com mensagem em stderr).
- `node dist/cli.js --help` mostra o uso. Com `npm link`, o comando fica disponível como `cpf-cnpj`.

## Desenvolvimento

- Agentes: comece por [AGENTS.md](AGENTS.md).
- Estado do projeto: `npm run status`.
- Validação completa (igual ao CI): `npm run validate`.
