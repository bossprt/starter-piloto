import { describe, expect, it } from 'vitest';
import { lastCodexRateLimits, quotaAlerts, summarizeClaudeStream } from '../lib/usage.mjs';

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
    expect(lastCodexRateLimits(rollout)).toEqual({ fiveHour: 21, weekly: 3 });
    expect(lastCodexRateLimits('nada')).toBeNull();
  });
});

describe('quotaAlerts (regra dos 70%)', () => {
  it('alerta em 70% ou mais e ignora não disponível', () => {
    const alerts = quotaAlerts([{ name: 'a', percent: 69.9 }, { name: 'b', percent: 70 }, { name: 'c', percent: null }, { name: 'd', percent: 95 }]);
    expect(alerts.map((a) => a.name)).toEqual(['b', 'd']);
  });
});
