# Produto

comercial: não

## Problema

Sistemas brasileiros recebem CPF e CNPJ digitados à mão, com máscara ou sem, com erros de
digitação. É preciso dizer, sem chamar serviço externo, se o número é estruturalmente válido
(formato e dígitos verificadores). Desde julho de 2026 o CNPJ também pode ser alfanumérico
(IN RFB nº 2.229/2024), o que quebra validadores que aceitam só dígitos.

## Público

- Desenvolvedores TypeScript/JavaScript que precisam validar CPF/CNPJ em código (biblioteca).
- Pessoas e scripts que precisam validar números no terminal (CLI).

Este projeto é também o piloto do starter: serve para provar o fluxo de tarefas, CI e revisão.

## Escopo

- Validar CPF (11 dígitos) e CNPJ (14 caracteres, numérico ou alfanumérico), com ou sem máscara.
- CLI que recebe números e informa válido/inválido com código de saída.

## Fora de escopo

- Consultar situação cadastral na Receita Federal ou qualquer serviço externo.
- Gerar números válidos para teste em produção, ou dados pessoais.
- Outros documentos (RG, CNH, PIS, título de eleitor).
- Publicar o pacote no npm (publicar produto depende do dono).
- Interface web ou API HTTP.

<!-- teste de CI: PR só de documentação (será fechado sem merge) -->
