import { describe, expect, it } from 'vitest';
import { currentPercent, lastCodexRateLimits, quotaAlerts, summarizeClaudeStream } from '../lib/usage.mjs';

const stream = [
  JSON.stringify({ type: 'system', subtype: 'init', tools: ['Bash', 'Read'] }),
  JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 2, cache_creation_input_tokens: 5635, cache_read_input_tokens: 4330 } } }),
  JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.11 }, seven_day: { utilization: 0.03 } } } }),
  JSON.stringify({ type: 'result', usage: { input_tokens: 4, cache_creation_input_tokens: 6110, cache_read_input_tokens: 14295, output_tokens: 783 }, total_cost_usd: 0.05, num_turns: 2 }),
  'linha que não é JSON',
  JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.13 }, seven_day: { utilization: 0.03 } } } }),
  JSON.stringify({ type: 'result', usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 100, output_tokens: 10 }, total_cost_usd: 0.07, num_turns: 1 }),
].join('\n');

describe('summarizeClaudeStream', () => {
  it('soma os results, usa o último custo e a última cota', () => {
    const s = summarizeClaudeStream(stream);
    expect(s).toMatchObject({ input: 5, cacheCreation: 6110, cacheRead: 14395, output: 793, turns: 3, costUsd: 0.07, tools: 2, contextTokens: 9967, fiveHour: 13, sevenDay: 3 });
    expect(s.totalInput).toBe(5 + 6110 + 14395);
  });
  it('sem dados: zeros e nulos, sem lançar', () => {
    expect(summarizeClaudeStream('')).toMatchObject({ totalInput: 0, fiveHour: null, costUsd: null });
  });
});

describe('lastCodexRateLimits', () => {
  it('lê o último rate_limits do rollout', () => {
    const rollout = [
      JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', rate_limits: { primary: { used_percent: 1 }, secondary: { used_percent: 0 } } } }),
      JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', rate_limits: { primary: { used_percent: 21 }, secondary: { used_percent: 3 } } } }),
    ].join('\n');
    expect(lastCodexRateLimits(rollout)).toMatchObject({ fiveHour: 21, weekly: 3 });
    expect(lastCodexRateLimits('nada')).toBeNull();
  });
});

describe('quotaAlerts (regra dos 70%)', () => {
  it('alerta em 70% ou mais e ignora não disponível', () => {
    const alerts = quotaAlerts([{ name: 'a', percent: 69.9 }, { name: 'b', percent: 70 }, { name: 'c', percent: null }, { name: 'd', percent: 95 }]);
    expect(alerts.map((a) => a.name)).toEqual(['b', 'd']);
  });
});

describe('currentPercent (reset da janela)', () => {
  const now = Date.parse('2026-10-10T22:00:00Z');
  it('leitura antes do reset vale', () => {
    expect(currentPercent(90, now / 1000 + 600, now)).toEqual({ percent: 90, expired: false });
  });
  it('leitura depois do reset expira e não bloqueia', () => {
    expect(currentPercent(90, now / 1000 - 1, now)).toEqual({ percent: null, expired: true });
    expect(quotaAlerts([{ name: 'x', percent: currentPercent(90, now / 1000 - 1, now).percent }])).toEqual([]);
  });
  it('sem reset conhecido mantém o valor; sem valor é não disponível', () => {
    expect(currentPercent(50, null, now)).toEqual({ percent: 50, expired: false });
    expect(currentPercent(null, 1, now)).toEqual({ percent: null, expired: false });
  });
  it('lê os horários de reset do Claude e do Codex', () => {
    const claude = summarizeClaudeStream(JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.2, resetsAt: 111 }, seven_day: { utilization: 0.04, resetsAt: 222 } } } }));
    expect(claude).toMatchObject({ fiveHourResetsAt: 111, sevenDayResetsAt: 222 });
    const codex = lastCodexRateLimits(JSON.stringify({ payload: { rate_limits: { primary: { used_percent: 5, resets_at: 333 }, secondary: { used_percent: 1, resets_at: 444 } } } }));
    expect(codex).toEqual({ fiveHour: 5, weekly: 1, fiveHourResetsAt: 333, weeklyResetsAt: 444 });
  });
});
