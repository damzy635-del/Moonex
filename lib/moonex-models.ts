export type ProviderModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
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
};

export type AutoRoutingContext = {
  messages?: Array<{ role?: string; content?: unknown; files?: Array<{ mimeType?: string; type?: string }> }>;
  enableWebSearch?: boolean;
  thinkingLevel?: string;
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
  { id: 'moonex-lite-1.5', name: 'Moonex Lite 1.5', description: 'Fast everyday conversations.', temperature: 0.35, maxTokens: 2048, preferredKeywords: ['flash', 'mini', 'lite', 'haiku', 'small'], fallbackIndex: 0 },
  { id: 'moonex-fast-1.5', name: 'Moonex Fast 1.5', description: 'Low-latency answers for quick tasks.', temperature: 0.3, maxTokens: 2048, preferredKeywords: ['flash', 'mini', 'fast', 'haiku', 'small'], fallbackIndex: 1 },
  { id: 'moonex-pro-1.5', name: 'Moonex Pro 1.5', description: 'Balanced quality and speed.', temperature: 0.45, maxTokens: 4096, preferredKeywords: ['pro', 'sonnet', 'gpt-4', '4.1', 'gemini-2.5'], fallbackIndex: 2 },
  { id: 'moonex-pro-max-1.5', name: 'Moonex Pro Max 1.5', description: 'Higher-quality general reasoning.', temperature: 0.4, maxTokens: 8192, preferredKeywords: ['pro', 'sonnet', 'opus', 'gpt-4', 'gemini-2.5'], fallbackIndex: 3 },
  { id: 'moonex-ultra-1.5', name: 'Moonex Ultra 1.5', description: 'Maximum available general capability.', temperature: 0.35, maxTokens: 12288, preferredKeywords: ['opus', 'o3', 'o4', 'reason', 'ultra', 'pro'], fallbackIndex: 4 },
  { id: 'moonex-reasoning-1.5', name: 'Moonex Reasoning 1.5', description: 'Deeper reasoning for difficult problems.', temperature: 0.25, maxTokens: 12288, preferredKeywords: ['reason', 'thinking', 'o3', 'o4', 'r1', 'deepseek-r1'], fallbackIndex: 5 },
  { id: 'moonex-code-1.5', name: 'Moonex Code 1.5', description: 'Optimized for programming and technical work.', temperature: 0.2, maxTokens: 8192, preferredKeywords: ['code', 'coder', 'codestral', 'deepseek-coder', 'qwen'], fallbackIndex: 6 },
  { id: 'moonex-vision-1.5', name: 'Moonex Vision 1.5', description: 'Multimodal tasks and image understanding.', temperature: 0.35, maxTokens: 4096, preferredKeywords: ['vision', 'gemini', 'gpt-4o', 'gpt-4.1', 'claude'], fallbackIndex: 7 },
  { id: 'moonex-research-1.5', name: 'Moonex Research 1.5', description: 'Long-form analysis and research workflows.', temperature: 0.3, maxTokens: 12288, preferredKeywords: ['research', 'sonnet', 'opus', 'gemini', 'gpt-4'], fallbackIndex: 8 },
];

function normalizedProviderId(model: ProviderModel) { return `${model.id} ${model.name || ''}`.toLowerCase(); }

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

export function rankProviderModels(profile: MoonexModelProfile, providers: ProviderModel[]): ProviderModel[] {
  if (!Array.isArray(providers) || providers.length === 0) return [];
  const keywords = profile.preferredKeywords.map((keyword) => keyword.toLowerCase());
  return providers.map((provider, index) => {
    const id = String(provider.id || '').toLowerCase();
    const haystack = normalizedProviderId(provider);
    let score = 0;
    for (const keyword of keywords) {
      if (id === keyword) score += 100;
      else if (id.includes(keyword)) score += 50;
      else if (haystack.includes(keyword)) score += 20;
    }
    if (index === profile.fallbackIndex) score += 1;
    return { provider, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(({ provider }) => provider);
}

export function resolveProviderModel(profile: MoonexModelProfile, providers: ProviderModel[]): ProviderModel | null {
  return rankProviderModels(profile, providers)[0] || null;
}

export function findMoonexModel(id: string) {
  const normalized = normalizeMoonexModelId(id);
  return MOONEX_MODELS.find((model) => model.id === normalized) || MOONEX_MODELS[0];
}

function messageText(context: AutoRoutingContext): string {
  return (context.messages || []).filter((message) => message.role !== 'system')
    .map((message) => typeof message.content === 'string' ? message.content : '')
    .join('\n').slice(-12_000).toLowerCase();
}

function hasImageAttachment(context: AutoRoutingContext): boolean {
  return (context.messages || []).some((message) => (message.files || []).some((file) =>
    String(file.mimeType || '').toLowerCase().startsWith('image/') || file.type === 'image'));
}

function scoreMatches(text: string, patterns: RegExp, points: number): number {
  const matches = text.match(patterns);
  return matches ? Math.min(matches.length, 4) * points : 0;
}

export function decideMoonexRoute(context: AutoRoutingContext): MoonexRoutingDecision {
  const text = messageText(context);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const complexity = Math.min(1, (text.length / 1800) * 0.55 + (wordCount / 260) * 0.45);

  if (hasImageAttachment(context)) return { profile: findMoonexModel('moonex-vision-1.5'), confidence: 0.99, reason: 'image or multimodal input detected', mode: 'auto' };
  if (context.enableWebSearch || /\b(latest|current|today|yesterday|tomorrow|this week|this month|news|research|sources?|citations?|look up|web search|recent|2026)\b/.test(text)) {
    return { profile: findMoonexModel('moonex-research-1.5'), confidence: 0.97, reason: 'current information or research intent detected', mode: 'auto' };
  }

  const scores = new Map<string, number>(MOONEX_MODELS.map((model) => [model.id, 0]));
  const code = scoreMatches(text, /\b(write|build|create|implement|refactor|debug|fix|code|coding|program|function|api|react|typescript|javascript|python|sql|authentication|auth|component|app|website|regex|css|html|git|github|bug|error|compile|deploy)\b/g, 5);
  const reasoning = scoreMatches(text, /\b(algorithm|algorithms|prove|proof|derive|architecture|trade-?offs?|analy[sz]e|complex|difficult|deeply|reason|logic|evaluate|critique|compare|optimize|optimization|mathematical)\b/g, 5);
  const creative = scoreMatches(text, /\b(story|poem|creative|brainstorm|character|script|lyrics|fiction|imagine|slogan|caption)\b/g, 4);
  const simple = scoreMatches(text, /\b(what is|define|meaning|translate|summarize|quick|simple|calculate|convert|explain)\b/g, 3);

  scores.set('moonex-code-1.5', code * 2);
  scores.set('moonex-reasoning-1.5', reasoning * 2);
  scores.set('moonex-ultra-1.5', reasoning + complexity * 8);
  scores.set('moonex-pro-1.5', complexity * 7 + creative);
  scores.set('moonex-fast-1.5', simple + (complexity < 0.25 ? 3 : 0));
  scores.set('moonex-lite-1.5', simple * 1.2 + (wordCount <= 24 ? 3 : 0));

  if (context.thinkingLevel === 'high') {
    scores.set('moonex-reasoning-1.5', (scores.get('moonex-reasoning-1.5') || 0) + 8);
    scores.set('moonex-ultra-1.5', (scores.get('moonex-ultra-1.5') || 0) + 5);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [winnerId, winnerScore] = ranked[0];
  const runnerScore = ranked[1]?.[1] || 0;
  const confidence = Math.max(0.5, Math.min(0.96, 0.55 + (winnerScore - runnerScore) / 20 + complexity * 0.12));
  const profile = findMoonexModel(winnerId);
  const reason = winnerId === 'moonex-code-1.5' ? 'software or technical intent detected'
    : winnerId === 'moonex-reasoning-1.5' || winnerId === 'moonex-ultra-1.5' ? 'deep reasoning or complex analysis detected'
    : winnerId === 'moonex-pro-1.5' ? 'moderate complexity or creative/general work detected'
    : winnerId === 'moonex-lite-1.5' ? 'short or straightforward task detected'
    : 'fast general task detected';
  return { profile, confidence: Number(confidence.toFixed(2)), reason, mode: 'auto' };
}

export function classifyMoonexTask(context: AutoRoutingContext): MoonexModelProfile { return decideMoonexRoute(context).profile; }

export function resolveMoonexProfile(modelId: string, context: AutoRoutingContext = {}): MoonexModelProfile {
  return normalizeMoonexModelId(modelId) === AUTO_MODEL_ID ? classifyMoonexTask(context) : findMoonexModel(modelId);
}