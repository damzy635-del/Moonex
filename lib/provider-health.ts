export type ProviderHealthOutcome = {
  success: boolean;
  latencyMs?: number;
  retryable?: boolean;
  reason?: string;
};

export type ProviderHealthSnapshot = {
  key: string;
  score: number;
  reliability: number;
  latencyMs: number;
  samples: number;
  consecutiveFailures: number;
  cooldown: boolean;
  cooldownUntil: number;
  lastOutcomeAt: number;
};

type Sample = { success: boolean; latencyMs: number; at: number };
type State = { samples: Sample[]; consecutiveFailures: number; cooldownUntil: number; lastOutcomeAt: number };

const states = new Map<string, State>();
const MAX_SAMPLES = 40;
const TTL_MS = 15 * 60_000;
const BASE_COOLDOWN_MS = 2_000;
const MAX_COOLDOWN_MS = 60_000;

function keyFor(value: unknown): string {
  return String(value || 'unknown').trim().toLowerCase() || 'unknown';
}

function now() { return Date.now(); }

function getState(key: string): State {
  const current = states.get(key);
  if (current) {
    current.samples = current.samples.filter((sample) => now() - sample.at <= TTL_MS);
    return current;
  }
  const created: State = { samples: [], consecutiveFailures: 0, cooldownUntil: 0, lastOutcomeAt: 0 };
  states.set(key, created);
  return created;
}

export function clearProviderHealth(): void {
  states.clear();
}

export function recordProviderOutcome(provider: unknown, outcome: ProviderHealthOutcome): void {
  const key = keyFor(provider);
  const state = getState(key);
  const timestamp = now();
  const latency = Number.isFinite(outcome.latencyMs) ? Math.max(1, Math.floor(outcome.latencyMs!)) : 1_000;
  state.samples.push({ success: !!outcome.success, latencyMs: latency, at: timestamp });
  if (state.samples.length > MAX_SAMPLES) state.samples.splice(0, state.samples.length - MAX_SAMPLES);
  state.lastOutcomeAt = timestamp;

  if (outcome.success) {
    state.consecutiveFailures = 0;
    state.cooldownUntil = 0;
    return;
  }

  state.consecutiveFailures += 1;
  const retryable = outcome.retryable !== false;
  if (retryable) {
    const multiplier = Math.pow(2, Math.max(0, state.consecutiveFailures - 1));
    state.cooldownUntil = Math.min(timestamp + BASE_COOLDOWN_MS * multiplier, timestamp + MAX_COOLDOWN_MS);
  }
}

export function providerHealth(provider: unknown): ProviderHealthSnapshot {
  const key = keyFor(provider);
  const state = getState(key);
  const samples = state.samples;
  if (!samples.length) {
    return { key, score: 50, reliability: 0.5, latencyMs: 0, samples: 0, consecutiveFailures: state.consecutiveFailures, cooldown: state.cooldownUntil > now(), cooldownUntil: state.cooldownUntil, lastOutcomeAt: state.lastOutcomeAt };
  }

  const successes = samples.filter((sample) => sample.success).length;
  const reliability = successes / samples.length;
  const latencyMs = Math.round(samples.reduce((sum, sample) => sum + sample.latencyMs, 0) / samples.length);
  const latencyScore = Math.max(0, Math.min(1, 1 - latencyMs / 10_000));
  const recency = state.lastOutcomeAt ? Math.max(0, 1 - (now() - state.lastOutcomeAt) / TTL_MS) : 0;
  let score = reliability * 65 + latencyScore * 25 + recency * 10;
  if (state.cooldownUntil > now()) score -= 35;

  return {
    key,
    score: Math.max(0, Math.min(100, Number(score.toFixed(2)))),
    reliability,
    latencyMs,
    samples: samples.length,
    consecutiveFailures: state.consecutiveFailures,
    cooldown: state.cooldownUntil > now(),
    cooldownUntil: state.cooldownUntil,
    lastOutcomeAt: state.lastOutcomeAt,
  };
}

export function rankProvidersWithHealth<T extends Record<string, any>>(context: any, providers: T[]): T[] {
  if (!Array.isArray(providers) || !providers.length) return [];
  return providers
    .map((provider, index) => {
      const identity = provider.provider || provider.provider_name || provider.providerName || provider.owned_by || provider.id;
      const health = providerHealth(identity);
      const configuredScore = Number(provider.routingScore || provider.qualityScore || 0);
      const score = configuredScore + health.score + (health.samples === 0 ? 8 : 0) - (health.cooldown ? 50 : 0);
      return { provider, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.provider);
}
