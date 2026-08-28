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

/**
 * Moonex is the product layer. Provider model IDs are deliberately kept out
 * of the public catalog and are resolved at request time from /models.
 */
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

function normalizedProviderId(model: ProviderModel) {
  return `${model.id} ${model.name || ''}`.toLowerCase();
}

/** Pick a provider model using capabilities/name hints, then a stable index fallback. */
export function resolveProviderModel(profile: MoonexModelProfile, providers: ProviderModel[]): ProviderModel | null {
  if (!providers.length) return null;
  const match = providers.find((provider) => {
    const haystack = normalizedProviderId(provider);
    return profile.preferredKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  });
  return match || providers[Math.min(profile.fallbackIndex, providers.length - 1)];
}

export function findMoonexModel(id: string) {
  return MOONEX_MODELS.find((model) => model.id === id) || MOONEX_MODELS[0];
}
