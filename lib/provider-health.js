const DEFAULT_LATENCY_MS = 1_500;
const MIN_HEALTH = 0.05;
const MAX_HEALTH = 0.99;
const FAILURE_COOLDOWN_MS = 30_000;
const EWMA_ALPHA = 0.25;

const state = globalThis.__moonexProviderHealth || new Map();
globalThis.__moonexProviderHealth = state;

function entry(id) {
  const key = String(id || '').trim().toLowerCase();
  if (!key) return null;
  let value = state.get(key);
  if (!value) {
    value = { successes: 0, failures: 0, latencyMs: DEFAULT_LATENCY_MS, lastFailureAt: 0 };
    state.set(key, value);
  }
  return value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function providerHealth(id) {
  const value = entry(id);
  if (!value) return { score: 0.7, latencyMs: DEFAULT_LATENCY_MS, cooldown: false, successes: 0, failures: 0 };
  const total = value.successes + value.failures;
  const successRate = total ? (value.successes + 2) / (total + 3) : 0.7;
  const latencyScore = 1 / (1 + Math.max(0, value.latencyMs - 250) / 1_500);
  const cooldown = value.lastFailureAt > 0 && Date.now() - value.lastFailureAt < FAILURE_COOLDOWN_MS;
  const score = clamp(successRate * 0.7 + latencyScore * 0.3, MIN_HEALTH, MAX_HEALTH);
  return { score, latencyMs: value.latencyMs, cooldown, successes: value.successes, failures: value.failures };
}

export function recordProviderOutcome(id, outcome = {}) {
  const value = entry(id);
  if (!value) return;
  const latencyMs = Number(outcome.latencyMs);
  if (Number.isFinite(latencyMs) && latencyMs >= 0) {
    value.latencyMs = value.latencyMs * (1 - EWMA_ALPHA) + latencyMs * EWMA_ALPHA;
  }
  if (outcome.success === true) {
    value.successes += 1;
    value.lastFailureAt = 0;
  } else {
    value.failures += 1;
    value.lastFailureAt = Date.now();
  }
  if (value.successes + value.failures > 100) {
    value.successes = Math.ceil(value.successes * 0.6);
    value.failures = Math.ceil(value.failures * 0.6);
  }
}

export function rankProvidersWithHealth(profile, rankedProviders) {
  if (!Array.isArray(rankedProviders) || !rankedProviders.length) return [];
  const total = rankedProviders.length;
  return rankedProviders
    .map((provider, index) => {
      const health = providerHealth(provider?.id);
      // Existing rankProviderModels supplies profile quality/capability relevance.
      // Health then adds live reliability and latency without changing profile constraints.
      const quality = total === 1 ? 1 : 1 - index / (total - 1);
      const latency = health.latencyMs > 0 ? 1 / (1 + Math.max(0, health.latencyMs - 250) / 1_500) : 1;
      const score = quality * 0.45 + health.score * 0.35 + latency * 0.20;
      return { provider, score, cooldown: health.cooldown, index };
    })
    .sort((a, b) => {
      if (a.cooldown !== b.cooldown) return a.cooldown ? 1 : -1;
      return b.score - a.score || a.index - b.index;
    })
    .map(({ provider }) => provider);
}

export function clearProviderHealth() {
  state.clear();
}
