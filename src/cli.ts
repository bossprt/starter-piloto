#!/usr/bin/env node
// CLI `cpf-cnpj`: camada fina sobre a biblioteca. Só formata a saída e define o código de saída.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkDocument } from './index.js';

export interface CliIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export const EXIT_OK = 0;
export const EXIT_INVALID = 1;
export const EXIT_USAGE = 2;

export const USAGE = [
  'Uso: cpf-cnpj <numero> [<numero> ...]',
  '     cpf-cnpj --help',
  '',
  'Valida cada número como CPF (11 caracteres) ou CNPJ (14 caracteres), com ou sem máscara.',
  'Saída: uma linha por número, "<válido|inválido>\\t<cpf|cnpj|desconhecido>\\t<entrada>".',
  'Na entrada, \\, tabulação, quebra de linha e outros caracteres de controle saem como escape.',
  'Código de saída: 0 se todos válidos, 1 se algum inválido, 2 para erro de uso.',
].join('\n');

const ESCAPES: Readonly<Record<string, string>> = { '\\': '\\\\', '\t': '\\t', '\n': '\\n', '\r': '\\r' };

/**
 * Representa a entrada original em uma única linha e um único campo: `\`, tabulação,
 * quebra de linha e outros caracteres de controle viram escapes (`\\`, `\t`, `\n`, `\r`, `\uXXXX`).
 */
export function escapeInput(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\\\u0000-\u001f\u007f]/g, (char) =>
    ESCAPES[char] ?? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/** Executa a CLI com `args` (sem `node` e o script) e devolve o código de saída. */
export function main(args: readonly string[], io: CliIo): number {
  const options = args.filter((arg) => arg.startsWith('-'));
  const unknown = options.find((option) => option !== '--help');
  if (unknown !== undefined) {
    io.stderr(`cpf-cnpj: opção desconhecida: ${unknown}`);
    io.stderr(USAGE);
    return EXIT_USAGE;
  }
  if (options.length > 0) {
    io.stdout(USAGE);
    return EXIT_OK;
  }
  if (args.length === 0) {
    io.stderr('cpf-cnpj: informe ao menos um número');
    io.stderr(USAGE);
    return EXIT_USAGE;
  }

  let allValid = true;
  for (const arg of args) {
    const { type, valid } = checkDocument(arg);
    if (!valid) allValid = false;
    io.stdout(`${valid ? 'válido' : 'inválido'}\t${type}\t${escapeInput(arg)}`);
  }
  return allValid ? EXIT_OK : EXIT_INVALID;
}

function isEntryPoint(): boolean {
  const script = process.argv[1];
  if (script === undefined) return false;
  try {
    return realpathSync(script) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  process.exitCode = main(process.argv.slice(2), {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  });
}
