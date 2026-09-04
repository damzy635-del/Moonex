import { fitConversationContext } from './context-budget.js';

export const DEFAULT_MOONEX_MODEL_ID = 'moonex-lite-1.5';
export const AUTO_MODEL_ID = 'auto';

export const MOONEX_MODELS = [
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

function normalizedProviderId(model) {
  return `${model.id} ${model.name || ''}`.toLowerCase();
}

const CURATED_CAPABILITIES = {
  reasoning: [/^gpt-5\.6-/, /^gemini-3\.1-pro-preview$/, /^gemini-2\.5-pro$/, /^mistral-(medium|large)-latest$/, /^openai\/gpt-oss-120b$/],
  tools: [/^gpt-5\.6-/, /^gemini-3\.7-flash$/, /^mistral-(medium|large)-latest$/, /^codestral-latest$/, /^openai\/gpt-oss-(20b|120b)$/],
  vision: [/^gpt-5\.6-/, /^gemini-(3\.7-flash|3\.6-flash|3\.5-flash|3\.5-flash-lite|3\.1-flash-lite|2\.5-(flash|flash-lite|pro))$/],
  search: [/^gemini-(3\.7-flash|3\.6-flash|2\.5-(flash|pro))$/],
};

function supportsCuratedCapability(provider, capability) {
  const id = String(provider?.id || '').toLowerCase();
  return (CURATED_CAPABILITIES[capability] || []).some((pattern) => pattern.test(id));
}

function supportsRequiredCapabilities(profile, provider) {
  const required = profile.requiredCapabilities || [];
  if (!required.length) return true;
  const capabilities = provider.capabilities;
  if (capabilities && typeof capabilities === 'object') {
    return required.every((capability) => capabilities[capability] === true);
  }
  return required.every((capability) => supportsCuratedCapability(provider, capability));
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
  const eligible = providers.filter((provider) => supportsRequiredCapabilities(profile, provider));
  const pool = eligible.length ? eligible : (profile.requiredCapabilities?.length ? [] : providers);
  if (!pool.length) return [];
  const keywords = profile.preferredKeywords.map((keyword) => keyword.toLowerCase());
  return pool
    .map((provider, index) => {
      const id = String(provider.id || '').toLowerCase();
      const haystack = normalizedProviderId(provider);
      let score = 0;
      for (const keyword of keywords) {
        if (id === keyword) score += 100;
        else if (id.includes(keyword)) score += 50;
        else if (haystack.includes(keyword)) score += 20;
      }
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
  return (context.messages || []).filter((message) => message.role !== 'system').map((message) => typeof message.content === 'string' ? message.content : '').join('\n').slice(-12_000).toLowerCase();
}

function hasAttachmentType(context, type) {
  return (context.messages || []).some((message) => (message.files || []).some((file) => file?.type === type));
}

function hasImageAttachment(context) {
  return (context.messages || []).some((message) => (message.files || []).some((file) => String(file.mimeType || '').toLowerCase().startsWith('image/') || file.type === 'image'));
}

function hasCodeAttachment(context) {
  return hasAttachmentType(context, 'code') || (context.messages || []).some((message) =>
    (message.files || []).some((file) => /\.(ts|tsx|js|jsx|py|json|md|html|css|sql|sh|txt|csv)$/i.test(String(file.name || '')))
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

function scoreMatches(text, patterns, points) {
  const matches = text.match(patterns);
  return matches ? Math.min(matches.length, 4) * points : 0;
}

function requiredCapabilitiesForContext(context) {
  const required = [];
  if (hasImageAttachment(context)) required.push('vision');
  if (context.enableWebSearch === true) required.push('search');
  if (typeof context.thinkingLevel === 'string' && context.thinkingLevel !== 'none') required.push('reasoning');
  if (hasCodeAttachment(context)) required.push('tools');
  return [...new Set(required)];
}

function profileSupportsRequest(profile, required) {
  const capabilities = new Set(profile.requiredCapabilities || []);
  return required.every((capability) => capabilities.has(capability));
}

export function decideMoonexRoute(context) {
  const text = messageText(context);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const complexity = Math.min(1, (text.length / 1800) * 0.55 + (wordCount / 260) * 0.45);

  if (hasImageAttachment(context)) return { profile: findMoonexModel('moonex-vision-1.5'), confidence: 0.99, reason: 'image or multimodal input detected', mode: 'auto' };
  if (context.enableWebSearch || /\b(latest|current|today|yesterday|tomorrow|this week|this month|news|research|sources?|citations?|look up|web search|recent|2026)\b/.test(text)) {
    return { profile: findMoonexModel('moonex-research-1.5'), confidence: 0.97, reason: 'current information or research intent detected', mode: 'auto' };
  }

  const scores = new Map(MOONEX_MODELS.map((model) => [model.id, 0]));
  const code = scoreMatches(text, /\b(write|build|create|implement|refactor|debug|fix|code|coding|program|function|api|react|typescript|javascript|python|sql|authentication|auth|component|app|website|regex|css|html|git|github|bug|error|compile|deploy)\b/g, 5);
  const reasoning = scoreMatches(text, /\b(algorithm|algorithms|prove|proof|derive|architecture|trade-?offs?|analy[sz]e|complex|difficult|deeply|reason|logic|evaluate|critique|compare|optimize|optimization|mathematical)\b/g, 5);
  const creative = scoreMatches(text, /\b(story|poem|creative|brainstorm|character|script|fiction|imagine|slogan|caption)\b/g, 4);
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

export function classifyMoonexTask(context) {
  return decideMoonexRoute(context).profile;
}

function applyConversationBudget(context, profile) {
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

export function resolveMoonexProfile(modelId, context = {}) {
  let profile;
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