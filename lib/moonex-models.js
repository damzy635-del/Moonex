export const DEFAULT_MOONEX_MODEL_ID = 'moonex-lite-1.5';
export const AUTO_MODEL_ID = 'auto';

export const MOONEX_MODELS = [
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

function normalizedProviderId(model) {
  return `${model.id} ${model.name || ''}`.toLowerCase();
}

export function isMoonexModelId(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === AUTO_MODEL_ID || MOONEX_MODELS.some((model) => model.id === normalized);
}

export function normalizeMoonexModelId(value, fallback = DEFAULT_MOONEX_MODEL_ID) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return isMoonexModelId(normalized) ? normalized : fallback;
}

export function rankProviderModels(profile, providers) {
  if (!Array.isArray(providers) || !providers.length) return [];
  const keywords = profile.preferredKeywords.map((keyword) => keyword.toLowerCase());
  return providers
    .map((provider, index) => {
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
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ provider }) => provider);
}

export function resolveProviderModel(profile, providers) {
  return rankProviderModels(profile, providers)[0] || null;
}

export function findMoonexModel(id) {
  const normalized = normalizeMoonexModelId(id);
  return MOONEX_MODELS.find((model) => model.id === normalized) || MOONEX_MODELS[0];
}

function messageText(context) {
  return (context.messages || [])
    .filter((message) => message.role !== 'system')
    .map((message) => (typeof message.content === 'string' ? message.content : ''))
    .join('\n')
    .slice(-12000)
    .toLowerCase();
}

function hasAttachmentType(context, type) {
  return (context.messages || []).some((message) =>
    (message.files || []).some((file) => file?.type === type)
  );
}

function hasImageAttachment(context) {
  return (context.messages || []).some((message) =>
    (message.files || []).some((file) =>
      String(file.mimeType || '').toLowerCase().startsWith('image/') || file.type === 'image'
    )
  );
}

function hasCodeAttachment(context) {
  return hasAttachmentType(context, 'code') || (context.messages || []).some((message) =>
    (message.files || []).some((file) =>
      /\.(ts|tsx|js|jsx|py|json|md|html|css|sql|sh|txt|csv)$/i.test(String(file.name || ''))
    )
  );
}

function hasDocumentAttachment(context) {
  return hasAttachmentType(context, 'document') || (context.messages || []).some((message) =>
    (message.files || []).some((file) => {
      const mime = String(file.mimeType || '').toLowerCase();
      return mime === 'application/pdf' || mime.includes('wordprocessingml') || mime.includes('spreadsheetml') || mime.includes('presentationml');
    })
  );
}

export function classifyMoonexTask(context) {
  const text = messageText(context);
  const wordCount = text ? text.split(/\s+/).length : 0;
  const isComplex = wordCount > 220 || text.length > 1400;

  if (hasImageAttachment(context)) return findMoonexModel('moonex-vision-1.5');
  if (context.enableWebSearch || /\b(latest|current|today|this week|news|research|sources?|citations?|look up|web search|recent)\b/.test(text)) {
    return findMoonexModel('moonex-research-1.5');
  }
  if (hasCodeAttachment(context) || /\b(write|build|create|implement|refactor|debug|fix|code|coding|program|function|api|react|typescript|javascript|python|sql|authentication|auth|component|app|website|regex|css|html)\b/.test(text)) {
    return findMoonexModel('moonex-code-1.5');
  }
  if (hasDocumentAttachment(context)) {
    return findMoonexModel('moonex-research-1.5');
  }
  if (context.thinkingLevel === 'high' || /\b(algorithm|algorithms|prove|proof|derive|architecture|trade-?offs?|analy[sz]e|complex|difficult|deeply|step[- ]by[- ]step|reason|logic|evaluate|critique|compare)\b/.test(text)) {
    return findMoonexModel(isComplex || wordCount > 90 ? 'moonex-ultra-1.5' : 'moonex-reasoning-1.5');
  }
  if (/^[\s\d()+*/%=.?x×-]+$/.test(text) || wordCount <= 24) return findMoonexModel('moonex-lite-1.5');
  return findMoonexModel(isComplex ? 'moonex-pro-1.5' : 'moonex-fast-1.5');
}

export function resolveMoonexProfile(modelId, context = {}) {
  return normalizeMoonexModelId(modelId) === AUTO_MODEL_ID
    ? classifyMoonexTask(context)
    : findMoonexModel(modelId);
}