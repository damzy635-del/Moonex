import {
  type MoonexModelProfile,
  type ProviderModel,
  rankProviderModels,
} from './moonex-models.js';
import { providerHealth, rankProvidersWithHealth } from './provider-health.js';

export type RoutingCandidate = ProviderModel & {
  routingScore?: number;
  qualityScore?: number;
  latencyScore?: number;
  healthScore?: number;
};

export type IntelligentRouteDecision = {
  candidates: RoutingCandidate[];
  confidence: number;
  reason: string;
  selected: RoutingCandidate | null;
};

function identity(provider: ProviderModel): string {
  return String(provider.provider || provider.provider_name || provider.providerName || provider.owned_by || provider.id || 'unknown');
}

function capabilityValue(provider: ProviderModel, capability: string): boolean {
  const value = provider.capabilities?.[capability];
  return value === true;
}

function keywordQuality(profile: MoonexModelProfile, provider: ProviderModel): number {
  const id = String(provider.id || '').toLowerCase();
  const haystack = `${id} ${String(provider.name || '').toLowerCase()}`;
  let score = 0;
  for (const keyword of profile.preferredKeywords) {
    const normalized = keyword.toLowerCase();
    if (id === normalized) score += 100;
    else if (id.includes(normalized)) score += 60;
    else if (haystack.includes(normalized)) score += 25;
  }
  return Math.min(100, score);
}

function latencyScore(provider: ProviderModel): number {
  const declared = Number(provider.latency_ms ?? provider.latencyMs ?? provider.avg_latency_ms ?? provider.avgLatencyMs);
  if (!Number.isFinite(declared) || declared <= 0) return 50;
  return Math.max(0, Math.min(100, 100 - declared / 100));
}

function qualityScore(profile: MoonexModelProfile, provider: ProviderModel): number {
  const explicit = Number(provider.quality_score ?? provider.qualityScore ?? provider.quality);
  const keyword = keywordQuality(profile, provider);
  if (Number.isFinite(explicit)) return Math.max(keyword, Math.min(100, explicit));
  return keyword;
}

function requiredCapabilities(profile: MoonexModelProfile, context: any): string[] {
  const required = new Set<string>(profile.requiredCapabilities || []);
  if (context?.enableWebSearch) required.add('search');
  if (context?.thinkingLevel && context.thinkingLevel !== 'none') required.add('reasoning');
  const messages = Array.isArray(context?.messages) ? context.messages : [];
  if (messages.some((message: any) => Array.isArray(message?.files) && message.files.some((file: any) => String(file?.mimeType || '').startsWith('image/') || file?.type === 'image'))) required.add('vision');
  if (messages.some((message: any) => Array.isArray(message?.files) && message.files.some((file: any) => file?.type === 'code'))) required.add('tools');
  return [...required];
}

function supports(provider: ProviderModel, required: string[]): boolean {
  if (!required.length) return true;
  if (!provider.capabilities) return true;
  return required.every((capability) => provider.capabilities?.[capability] === true);
}

export function routeProviders(profile: MoonexModelProfile, providers: ProviderModel[], context: any = {}): IntelligentRouteDecision {
  if (!providers.length) return { candidates: [], confidence: 0, reason: 'no provider models available', selected: null };

  const required = requiredCapabilities(profile, context);
  const rankedBase = rankProviderModels(profile, providers);
  const eligible = rankedBase.filter((provider) => supports(provider, required));
  const pool = eligible.length ? eligible : rankedBase.filter((provider) => supports(provider, profile.requiredCapabilities || []));
  if (!pool.length) return { candidates: [], confidence: 0, reason: `no compatible provider for required capabilities: ${required.join(', ')}`, selected: null };

  const scored = pool.map((provider, index) => {
    const health = providerHealth(identity(provider));
    const quality = qualityScore(profile, provider);
    const latency = latencyScore(provider);
    const healthScore = health.score;
    const score = quality * 0.45 + healthScore * 0.35 + latency * 0.20;
    return { provider, score, quality, latency, healthScore, index };
  });

  scored.sort((a, b) => b.score - a.score || b.healthScore - a.healthScore || a.index - b.index);
  const adaptive = rankProvidersWithHealth(context, scored.map((item) => ({ ...item.provider, routingScore: item.score })));
  const adaptiveOrder = new Map(adaptive.map((provider, index) => [provider.id, index]));
  scored.sort((a, b) => (adaptiveOrder.get(a.provider.id) ?? 999) - (adaptiveOrder.get(b.provider.id) ?? 999));

  const candidates = scored.map((item) => Object.assign({}, item.provider, {
    routingScore: Number(item.score.toFixed(2)),
    qualityScore: Number(item.quality.toFixed(2)),
    latencyScore: Number(item.latency.toFixed(2)),
    healthScore: Number(item.healthScore.toFixed(2)),
  }));
  const best = candidates[0] || null;
  const second = candidates[1];
  const gap = best && second ? Math.max(0, (best.routingScore || 0) - (second.routingScore || 0)) : 30;
  const confidence = Number(Math.max(0.5, Math.min(0.99, 0.55 + gap / 100)).toFixed(2));
  const reason = `capability=${required.length ? required.join('+') : 'general'}; quality=${Math.round(best?.qualityScore || 0)}; health=${Math.round(best?.healthScore || 0)}; latency=${Math.round(best?.latencyScore || 0)}`;

  return { candidates, confidence, reason, selected: best };
}
