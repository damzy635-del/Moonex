import { fitConversationContext } from './context-budget.js';
import { providerHealth } from './provider-health.js';

export type ProviderModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  max_output_tokens?: number;
  capabilities?: {
    vision?: boolean;
    reasoning?: boolean;
    search?: boolean;
    tools?: boolean;
    [key: string]: unknown;
  };
  provider?: string;
  provider_name?: string;
  providerName?: string;
  owned_by?: string;
  latency_ms?: number;
  latencyMs?: number;
  quality_score?: number;
  qualityScore?: number;
  [key: string]: unknown;
};

export type MoonexModelProfile = {
  id: string;
  name: string;
  description: string;
  temperature: number;
  maxTokens: number;
  preferredKeywords: string[];
  fallbackIndex: number;
  requiredCapabilities?: Array<'vision' | 'reasoning' | 'search' | 'tools'>;
};

export type AutoRoutingContext = {
  messages?: Array<{
    role?: string;
    content?: unknown;
    files?: Array<{ mimeType?: string; type?: string; name?: string }>;
  }>;
  enableWebSearch?: boolean;
  thinkingLevel?: string;
  contextBudget?: {
    estimatedInputTokens: number;
    truncated: boolean;
    droppedMessages: number;
  };
};

export type MoonexRoutingDecision = {
  profile: MoonexModelProfile;
  confidence: number;
  reason: string;
  mode: 'auto';
};

export const DEFAULT_MOONEX_MODEL_ID = 'moonex-lite-1.5';
export const AUTO_MODEL_ID = 'auto';

export const MOONEX_MODELS: MoonexModelProfile[] = [
  { id: 'moonex-lite-1.5', name: 'Moonex Lite 1.5', description: 'Fast everyday conversations using cost-efficient production models.', temperature: 0.35, maxTokens: 2048, preferredKeywords: ['gpt-5.6-luna', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'mistral-small-latest', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'], fallbackIndex: 0 },
  { id: 'moonex-fast-1.5', name: 'Moonex Fast 1.5', description: 'Low-latency answers using fast production models.', temperature: 0.3, maxTokens: 2048, preferredKeywords: ['gpt-5.6-luna', 'gemini-3.6-flash', 'gemini-3.5-flash', 'mistral-small-latest', 'openai/gpt-oss-20b'], fallbackIndex: 1 },
  { id: 'moonex-pro-1.5', name: 'Moonex Pro 1.5', description: 'Balanced quality and speed using current frontier-class models.', temperature: 0.45, maxTokens: 4096, preferredKeywords: ['gpt-5.6-terra', 'gemini-3.6-flash', 'gemini-3.7-flash', 'mistral-medium-latest', 'mistral-large-latest', 'openai/gpt-oss-120b'], fallbackIndex: 2 },
  { id: 'moonex-pro-max-1.5', name: 'Moonex Pro Max 1.5', description: 'Higher-quality general reasoning with long-context frontier models.', temperature: 0.4, maxTokens: 8192, preferredKeywords: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gemini-3.1-pro-preview', 'gemini-2.5-pro', 'mistral-medium-latest', 'mistral-large-latest', 'openai/gpt-oss-120b'], fallbackIndex: 3, requiredCapabilities: ['reasoning'] },
  { id: 'moonex-ultra-1.5', name: 'Moonex Ultra 1.5', description: 'Maximum available general capability from the curated provider pool.', temperature: 0.35, maxTokens: 12288, preferredKeywords: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gemini-3.1-pro-preview', 'gemini-3.7-flash', 'mistral-large-latest', 'mistral-medium-latest', 'openai/gpt-oss-120b'], fallbackIndex: 4, requiredCapabilities: ['reasoning'] },
  { id: 'moonex-reasoning-1.5', name: 'Moonex Reasoning 1.5', description: 'Deeper reasoning for difficult problems and technical analysis.', temperature: 0.25, maxTokens: 12288, preferredKeywords: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gemini-3.1-pro-preview', 'gemini-3.7-flash', 'mistral-medium-latest', 'openai/gpt-oss-120b'], fallbackIndex: 5, requiredCapabilities: ['reasoning'] },
  { id: 'moonex-code-1.5', name: 'Moonex Code 1.5', description: 'Optimized for programming, debugging, and technical work.', temperature: 0.2, maxTokens: 8192, preferredKeywords: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gemini-3.7-flash', 'mistral-medium-latest', 'codestral-latest', 'openai/gpt-oss-120b'], fallbackIndex: 6, requiredCapabilities: ['tools'] },
  { id: 'moonex-vision-1.5', name: 'Moonex Vision 1.5', description: 'Multimodal tasks and image understanding.', temperature: 0.35, maxTokens: 4096, preferredKeywords: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'mistral-medium-latest'], fallbackIndex: 7, requiredCapabilities: ['vision'] },
  { id: 'moonex-research-1.5', name: 'Moonex Research 1.5', description: 'Long-form analysis and current-information research using grounded web search.', temperature: 0.3, maxTokens: 12288, preferredKeywords: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'], fallbackIndex: 8, requiredCapabilities: ['search'] },
];

function normalizedProviderId(model: ProviderModel): string {
  return `${model.id} ${model.name || ''}`.toLowerCase();
}

const CURATED_CAPABILITIES: Record<string, RegExp[]> = {
  reasoning: [/^gpt-5\.6-/, /^gemini-3\.1-pro-preview$/, /^gemini-2\.5-pro$/, /^mistral-(medium|large)-latest$/, /^openai\/gpt-oss-120b$/],
  tools: [/^gpt-5\.6-/, /^gemini-3\.7-flash$/, /^mistral-(medium|large)-latest$/, /^codestral-latest$/, /^openai\/gpt-oss-(20b|120b)$/],
  vision: [/^gpt-5\.6-/, /^gemini-(3\.7-flash|3\.6-flash|3\.5-flash|3\.5-flash-lite|3\.1-flash-lite|2\.5-(flash|flash-lite|pro))$/],
  search: [/^gemini-(3\.7-flash|3\.6-flash|2\.5-(flash|pro))$/],
};

function supportsCuratedCapability(provider: ProviderModel, capability: string): boolean {
  const id = String(provider?.id || '').toLowerCase();
  return (CURATED_CAPABILITIES[capability] || []).some((pattern) => pattern.test(id));
}

function supportsRequiredCapabilities(profile: MoonexModelProfile, provider: ProviderModel): boolean {
  const required = profile.requiredCapabilities || [];
  if (!required.length) return true;
  const capabilities = provider.capabilities;
  if (capabilities && typeof capabilities === 'object') return required.every((capability) => capabilities[capability] === true);
  return required.every((capability) => supportsCuratedCapability(provider, capability));
}

export function isMoonexModelId(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === AUTO_MODEL_ID || MOONEX_MODELS.some((model) => model.id === normalized);
}

export function normalizeMoonexModelId(value: unknown, fallback = DEFAULT_MOONEX_MODEL_ID): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return isMoonexModelId(normalized) ? normalized : fallback;
}

function providerIdentity(provider: ProviderModel): string {
  return String(provider.provider || provider.provider_name || provider.providerName || provider.owned_by || provider.id || 'unknown');
}

function qualityScore(profile: MoonexModelProfile, provider: ProviderModel): number {
  const explicit = Number(provider.quality_score ?? provider.qualityScore);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, explicit));
  const id = String(provider.id || '').toLowerCase();
  const haystack = normalizedProviderId(provider);
  let score = 0;
  for (const keyword of profile.preferredKeywords) {
    const normalized = keyword.toLowerCase();
    if (id === normalized) score += 100;
    else if (id.includes(normalized)) score += 55;
    else if (haystack.includes(normalized)) score += 20;
  }
  return Math.min(100, score);
}

function latencyScore(provider: ProviderModel): number {
  const declared = Number(provider.latency_ms ?? provider.latencyMs);
  if (!Number.isFinite(declared) || declared <= 0) return 50;
  return Math.max(0, Math.min(100, 100 - declared / 100));
}

export function rankProviderModels(profile: MoonexModelProfile, providers: ProviderModel[]): ProviderModel[] {
  if (!Array.isArray(providers) || !providers.length) return [];
  const eligible = providers.filter((provider) => supportsRequiredCapabilities(profile, provider));
  const pool = eligible.length ? eligible : (profile.requiredCapabilities?.length ? [] : providers);
  if (!pool.length) return [];

  return pool
    .map((provider, index) => {
      const health = providerHealth(providerIdentity(provider));
      const quality = qualityScore(profile, provider);
      const latency = latencyScore(provider);
      const score = quality * 0.50 + health.score * 0.30 + latency * 0.20;
      return { provider, score, health: health.score, index };
    })
    .sort((a, b) => b.score - a.score || b.health - a.health || a.index - b.index)
    .map(({ provider }) => provider);
}

export function resolveProviderModel(profile: MoonexModelProfile, providers: ProviderModel[]): ProviderModel | null {
  return rankProviderModels(profile, providers)[0] || null;
}

export function findMoonexModel(id: string): MoonexModelProfile {
  const normalized = normalizeMoonexModelId(id);
  return MOONEX_MODELS.find((model) => model.id === normalized) || MOONEX_MODELS[0];
}

function messageText(context: AutoRoutingContext): string {
  return (context.messages || [])
    .filter((message) => message.role !== 'system')
    .map((message) => typeof message.content === 'string' ? message.content : '')
    .join('\n')
    .slice(-12_000)
    .toLowerCase();
}

function hasAttachmentType(context: AutoRoutingContext, type: string): boolean {
  return (context.messages || []).some((message) => (message.files || []).some((file) => file?.type === type));
}

function hasImageAttachment(context: AutoRoutingContext): boolean {
  return (context.messages || []).some((message) => (message.files || []).some((file) => String(file.mimeType || '').toLowerCase().startsWith('image/') || file.type === 'image'));
}

function hasCodeAttachment(context: AutoRoutingContext): boolean {
  return hasAttachmentType(context, 'code') || (context.messages || []).some((message) =>
    (message.files || []).some((file) => /\.(ts|tsx|js|jsx|py|json|md|html|css|sql|sh|txt|csv)$/i.test(String(file.name || '')))
  );
}

function scoreMatches(text: string, patterns: RegExp, points: number): number {
  const matches = text.match(patterns);
  return matches ? Math.min(matches.length, 5) * points : 0;
}

function profileSupportsRequest(profile: MoonexModelProfile, required: Array<'vision' | 'reasoning' | 'search' | 'tools'>): boolean {
  const capabilities = new Set(profile.requiredCapabilities || []);
  return required.every((capability) => capabilities.has(capability));
}

function requiredCapabilitiesForContext(context: AutoRoutingContext): Array<'vision' | 'reasoning' | 'search' | 'tools'> {
  const required: Array<'vision' | 'reasoning' | 'search' | 'tools'> = [];
  if (hasImageAttachment(context)) required.push('vision');
  if (context.enableWebSearch === true) required.push('search');
  if (typeof context.thinkingLevel === 'string' && context.thinkingLevel !== 'none') required.push('reasoning');
  if (hasCodeAttachment(context)) required.push('tools');
  return [...new Set(required)];
}

function ambiguityScore(text: string): number {
  if (!text) return 1;
  const signals = [
    /\b(what|how|why|can|could|should|help|make|create|build|fix|explain|analyze|compare)\b/g,
    /\b(it|this|that|they|them|something|anything|stuff)\b/g,
    /\?+/g,
  ];
  const hits = signals.reduce((sum, pattern) => sum + Math.min(3, text.match(pattern)?.length || 0), 0);
  return Math.min(1, hits / 12);
}

function isSimpleArithmeticOrConversion(text: string, complexity: number): boolean {
  if (complexity >= 0.35) return false;
  if (/\b(prove|proof|theorem|derive|algorithm|optimize|optimization|integral|derivative|matrix|eigen|calculus|complex analysis)\b/.test(text)) return false;

  const arithmeticVerb = /\b(calculate|compute|arithmetic|sum|difference|product|quotient|percentage|percent|add|subtract|multiply|divide|convert)\b/.test(text);
  const questionWrapper = /\b(?:what(?:'s| is)|how much is|how many is|calculate|compute)\b/.test(text);
  const expressionOnly = /^[\d\s()+\-*/%^×÷.,=?]+$/.test(text.trim());

  if (arithmeticVerb || expressionOnly) return true;
  if (!questionWrapper) return false;

  const compact = text
    .replace(/\b(?:what(?:'s| is)|how much is|how many is|calculate|compute)\b/g, ' ')
    .replace(/[?$]/g, ' ')
    .trim();
  return /^[\d\s()+\-*/%^×÷.,=]+$/.test(compact);
}

export function decideMoonexRoute(context: AutoRoutingContext): MoonexRoutingDecision {
  const text = messageText(context);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const complexity = Math.min(1, (text.length / 1800) * 0.55 + (wordCount / 260) * 0.45);
  const ambiguity = ambiguityScore(text);
  const required = requiredCapabilitiesForContext(context);

  if (required.includes('vision')) return { profile: findMoonexModel('moonex-vision-1.5'), confidence: 0.99, reason: 'multimodal input requires vision capability', mode: 'auto' };
  if (required.includes('search')) return { profile: findMoonexModel('moonex-research-1.5'), confidence: 0.99, reason: 'explicit web-search capability requested', mode: 'auto' };
  if (/\b(latest|current|today|yesterday|tomorrow|this week|this month|news|research|sources?|citations?|look up|web search|recent|2026)\b/.test(text)) {
    return { profile: findMoonexModel('moonex-research-1.5'), confidence: 0.95, reason: 'current-information or research intent detected', mode: 'auto' };
  }

  if (isSimpleArithmeticOrConversion(text, complexity)) {
    return { profile: findMoonexModel('moonex-lite-1.5'), confidence: 0.96, reason: 'straightforward arithmetic or conversion task detected', mode: 'auto' };
  }

  const scores = new Map(MOONEX_MODELS.map((model) => [model.id, 0]));
  const code = scoreMatches(text, /\b(write|build|create|implement|refactor|debug|fix|code|coding|program|function|api|react|typescript|javascript|python|sql|authentication|auth|component|app|website|regex|css|html|git|github|bug|error|compile|deploy)\b/g, 5);
  const reasoning = scoreMatches(text, /\b(algorithm|algorithms|prove|proof|derive|architecture|trade-?offs?|analy[sz]e|complex|difficult|deeply|reason|logic|evaluate|critique|compare|optimize|optimization|mathematical)\b/g, 5);
  const creative = scoreMatches(text, /\b(story|poem|creative|brainstorm|character|script|fiction|imagine|slogan|caption|rewrite|draft)\b/g, 4);
  const simple = scoreMatches(text, /\b(what is|define|meaning|translate|summarize|quick|simple|calculate|convert|explain)\b/g, 3);

  scores.set('moonex-code-1.5', code * 2.1);
  scores.set('moonex-reasoning-1.5', reasoning * 2.2);
  scores.set('moonex-ultra-1.5', reasoning + complexity * 8);
  scores.set('moonex-pro-max-1.5', reasoning * 0.8 + complexity * 6);
  scores.set('moonex-pro-1.5', complexity * 7 + creative);
  scores.set('moonex-fast-1.5', simple + (complexity < 0.25 ? 3 : 0));
  scores.set('moonex-lite-1.5', simple * 1.2 + (wordCount <= 24 ? 3 : 0));

  if (context.thinkingLevel === 'high') {
    scores.set('moonex-reasoning-1.5', (scores.get('moonex-reasoning-1.5') || 0) + 8);
    scores.set('moonex-ultra-1.5', (scores.get('moonex-ultra-1.5') || 0) + 5);
  }

  const ranked = [...scores.entries()]
    .map(([id, score]) => ({ id, score, profile: findMoonexModel(id) }))
    .filter((item) => !required.length || profileSupportsRequest(item.profile, required))
    .sort((a, b) => b.score - a.score || a.profile.fallbackIndex - b.profile.fallbackIndex);

  if (!ranked.length) return { profile: findMoonexModel(DEFAULT_MOONEX_MODEL_ID), confidence: 0.5, reason: 'no specialized profile satisfied the detected capabilities', mode: 'auto' };

  const [winner, runner] = ranked;
  const margin = Math.max(0, winner.score - (runner?.score || 0));
  const confidence = Math.max(0.5, Math.min(0.97, 0.54 + margin / 22 + complexity * 0.10 - ambiguity * 0.12));
  const lowConfidence = confidence < 0.68;
  const profile = lowConfidence && complexity < 0.45 && code < 6 && reasoning < 6
    ? findMoonexModel('moonex-pro-1.5')
    : winner.profile;
  const reason = lowConfidence
    ? 'ambiguous prompt; selected balanced profile to avoid over-routing'
    : profile.id === 'moonex-code-1.5' ? 'software or technical intent detected'
    : profile.id === 'moonex-reasoning-1.5' || profile.id === 'moonex-ultra-1.5' || profile.id === 'moonex-pro-max-1.5' ? 'deep reasoning or complex analysis detected'
    : profile.id === 'moonex-pro-1.5' ? 'moderate complexity or creative/general work detected'
    : profile.id === 'moonex-lite-1.5' ? 'short or straightforward task detected'
    : 'fast general task detected';

  return { profile, confidence: Number(confidence.toFixed(2)), reason, mode: 'auto' };
}

export function classifyMoonexTask(context: AutoRoutingContext): MoonexModelProfile {
  return decideMoonexRoute(context).profile;
}

function applyConversationBudget(context: AutoRoutingContext, profile: MoonexModelProfile): void {
  if (!context || !Array.isArray(context.messages) || context.messages.length < 2) return;
  const systemMessages = context.messages.filter((message) => message?.role === 'system');
  const conversation = context.messages.filter((message) => message?.role !== 'system');
  const result = fitConversationContext(conversation, {
    maxInputTokens: 32_000,
    reservedOutputTokens: Math.min(profile.maxTokens || 0, 12_288),
    systemMessages,
  });
  context.messages = result.messages;
  context.contextBudget = {
    estimatedInputTokens: result.estimatedInputTokens,
    truncated: result.truncated,
    droppedMessages: result.droppedMessages,
  };
}

export function resolveMoonexProfile(modelId: string, context: AutoRoutingContext = {}): MoonexModelProfile {
  let profile: MoonexModelProfile;
  if (normalizeMoonexModelId(modelId) === AUTO_MODEL_ID) {
    profile = classifyMoonexTask(context);
  } else {
    const requestedProfile = findMoonexModel(modelId);
    const required = requiredCapabilitiesForContext(context);
    if (!required.length || profileSupportsRequest(requestedProfile, required)) profile = requestedProfile;
    else if (required.includes('vision')) profile = findMoonexModel('moonex-vision-1.5');
    else if (required.includes('search')) profile = findMoonexModel('moonex-research-1.5');
    else if (required.includes('reasoning')) profile = findMoonexModel('moonex-reasoning-1.5');
    else if (required.includes('tools')) profile = findMoonexModel('moonex-code-1.5');
    else profile = requestedProfile;
  }

  applyConversationBudget(context, profile);
  return profile;
}