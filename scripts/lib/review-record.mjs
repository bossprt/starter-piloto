// Registro verificável da revisão do Codex (ADR 0004). Funções puras.
// O registro é um commit vazio no topo do PR, com trailers:
//   Codex-Review: sem-defeito | com-defeito
//   Codex-Review-Tree: <sha da árvore revisada>
// Como o commit é vazio, a árvore dele é a árvore revisada. Qualquer commit depois invalida o registro.

export const VERDICTS = ['sem-defeito', 'com-defeito'];

/** Lê trailers `Chave: valor` do último parágrafo da mensagem de commit. */
export function parseTrailers(message) {
  const paragraphs = String(message ?? '').replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);
  const last = paragraphs[paragraphs.length - 1] ?? '';
  const trailers = {};
  for (const line of last.split('\n')) {
    const match = /^([A-Za-z][\w-]*):\s*(.+)$/.exec(line.trim());
    if (match) trailers[match[1]] = match[2].trim();
  }
  return trailers;
}

/** Extrai o veredito da resposta do Codex: a última linha `VEREDITO: sem-defeito|com-defeito`. */
export function parseVerdict(answer) {
  const matches = [...String(answer ?? '').matchAll(/^\s*VEREDITO:\s*(sem-defeito|com-defeito)\s*$/gim)];
  return matches.length > 0 ? matches[matches.length - 1][1].toLowerCase() : null;
}

/** Mensagem do commit de registro. */
export function buildRecordMessage({ verdict, tree, base, tokens, threadId, summary, codexVersion }) {
  const title = `revisao: Codex ${verdict === 'sem-defeito' ? 'sem defeito' : 'com defeito'} (árvore ${tree.slice(0, 12)})`;
  const body = String(summary ?? '').trim().split('\n').slice(0, 40).join('\n');
  return [
    title,
    '',
    body,
    '',
    `Codex-Review: ${verdict}`,
    `Codex-Review-Tree: ${tree}`,
    `Codex-Review-Base: ${base}`,
    `Codex-Thread: ${threadId ?? 'não disponível'}`,
    `Codex-Tokens: ${tokens ?? 'não disponível'}`,
    `Agente: Claude Code via scripts/codex-review.mjs (revisor: ${codexVersion ?? 'Codex CLI'}, somente leitura)`,
  ].join('\n');
}

/**
 * Verifica o registro no commit de topo do PR.
 * @param {{ message: string, tree: string }} head commit de topo (mensagem e sha da árvore)
 * @returns {{ ok: boolean, verdict: string | null, reason: string }}
 */
export function verifyReviewRecord(head) {
  if (!head || !head.message) return { ok: false, verdict: null, reason: 'commit de topo não disponível' };
  const trailers = parseTrailers(head.message);
  const verdict = trailers['Codex-Review'] ?? null;
  if (!verdict) return { ok: false, verdict: null, reason: 'commit de topo sem registro de revisão (Codex-Review)' };
  if (!VERDICTS.includes(verdict)) return { ok: false, verdict, reason: `veredito inválido: ${verdict}` };
  if (trailers['Codex-Review-Tree'] !== head.tree) {
    return { ok: false, verdict, reason: 'registro não corresponde à árvore do commit de topo (houve mudança depois da revisão?)' };
  }
  if (verdict !== 'sem-defeito') return { ok: false, verdict, reason: 'revisão registrou defeito aberto' };
  return { ok: true, verdict, reason: 'revisão do Codex sem defeito registrada para a árvore atual' };
}

/** Commits sem o trailer `Agente:` (assinatura obrigatória, ADR 0003). */
export function unsignedCommits(commits) {
  return commits.filter((commit) => !parseTrailers(commit.message).Agente).map((commit) => commit.sha);
}
