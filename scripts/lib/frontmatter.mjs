// Parser mínimo de frontmatter YAML (subconjunto: `chave: valor` e listas inline `[a, b]`).
// Sem dependências, para que os scripts rodem antes do `npm install`.

/**
 * @param {string} text conteúdo do arquivo markdown
 * @returns {{ data: Record<string, string | string[]> | null, body: string, error?: string }}
 */
export function parseFrontmatter(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { data: null, body: normalized, error: 'frontmatter ausente (o arquivo deve começar com ---)' };
  }
  const end = normalized.indexOf('\n---', 4);
  if (end === -1) {
    return { data: null, body: normalized, error: 'frontmatter sem fechamento ---' };
  }
  const raw = normalized.slice(4, end);
  const body = normalized.slice(end + 4).replace(/^\n/, '');
  /** @type {Record<string, string | string[]>} */
  const data = {};
  for (const [index, line] of raw.split('\n').entries()) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!match) {
      return { data: null, body, error: `linha ${index + 2} do frontmatter inválida: "${line}"` };
    }
    const key = match[1];
    const value = (match[2] ?? '').trim();
    data[key] = parseValue(value);
  }
  return { data, body };
}

/** @param {string} value */
function parseValue(value) {
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((item) => unquote(item.trim()));
  }
  return unquote(value);
}

/** @param {string} value */
function unquote(value) {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1);
  }
  return value;
}
