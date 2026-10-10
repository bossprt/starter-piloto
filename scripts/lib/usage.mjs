// Leitura de uso e cota dos serviços (docs/regras/gastos.md). Funções puras sobre texto já lido.

export const QUOTA_STOP_PERCENT = 70;

/**
 * Resume uma sessão do Claude Code gravada em stream-json (claude -p --output-format stream-json).
 * Soma os eventos `result` (uma sessão pode ter mais de um) e pega o último `rate_limit_event`.
 */
export function summarizeClaudeStream(text) {
  const summary = { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, turns: 0, costUsd: null, contextTokens: null, tools: null, fiveHour: null, sevenDay: null };
  for (const line of String(text ?? '').split('\n')) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'system' && event.subtype === 'init' && summary.tools === null) summary.tools = event.tools?.length ?? null;
    if (event.type === 'assistant' && summary.contextTokens === null && event.message?.usage) {
      const u = event.message.usage;
      summary.contextTokens = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    }
    if (event.type === 'result' && event.usage) {
      summary.input += event.usage.input_tokens ?? 0;
      summary.cacheCreation += event.usage.cache_creation_input_tokens ?? 0;
      summary.cacheRead += event.usage.cache_read_input_tokens ?? 0;
      summary.output += event.usage.output_tokens ?? 0;
      summary.turns += event.num_turns ?? 0;
      // total_cost_usd é acumulado na sessão: vale o último.
      if (typeof event.total_cost_usd === 'number') summary.costUsd = event.total_cost_usd;
    }
    if (event.type === 'rate_limit_event') {
      const windows = event.rate_limit_info?.unifiedWindows ?? {};
      if (windows.five_hour) summary.fiveHour = Math.round(windows.five_hour.utilization * 1000) / 10;
      if (windows.seven_day) summary.sevenDay = Math.round(windows.seven_day.utilization * 1000) / 10;
    }
  }
  summary.totalInput = summary.input + summary.cacheCreation + summary.cacheRead;
  return summary;
}

/** Último `rate_limits` de um arquivo de sessão do Codex (~/.codex/sessions/.../rollout-*.jsonl). */
export function lastCodexRateLimits(text) {
  let last = null;
  for (const line of String(text ?? '').split('\n')) {
    if (!line.includes('"rate_limits"')) continue;
    try {
      const event = JSON.parse(line);
      const limits = findKey(event, 'rate_limits');
      if (limits?.primary) last = limits;
    } catch {
      // linha incompleta: ignora
    }
  }
  if (!last) return null;
  return { fiveHour: last.primary?.used_percent ?? null, weekly: last.secondary?.used_percent ?? null };
}

function findKey(value, key) {
  if (!value || typeof value !== 'object') return null;
  if (key in value) return value[key];
  for (const child of Object.values(value)) {
    const found = findKey(child, key);
    if (found) return found;
  }
  return null;
}

/** Percentuais em 70% ou mais (regra de parada). Ignora valores não disponíveis. */
export function quotaAlerts(entries) {
  return entries.filter((entry) => typeof entry.percent === 'number' && entry.percent >= QUOTA_STOP_PERCENT);
}
