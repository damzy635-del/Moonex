import {
  normalizeMoonexModelId,
  rankProviderModels,
  resolveMoonexProfile,
} from '../lib/moonex-models.js';
import {
  baseUrl,
  apiKey,
  liveProviders,
  completeNonStreaming,
  createRateLimiter,
  errorText,
  MAX_PROVIDER_ATTEMPTS,
} from '../lib/myai-gateway.js';

export const config = { maxDuration: 300 };

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const rateLimit = createRateLimiter(RATE_LIMIT, RATE_WINDOW_MS);

const RESEARCH_PROFILE_ID = 'moonex-research-1.5';

function scopeGuidance(searchScope: string): string {
  if (searchScope === 'academic') return 'Focus on peer-reviewed research, arXiv preprints, nature/science publications, and empirical STEM studies.';
  if (searchScope === 'tech') return 'Focus on open-source repositories, engineering documentation, RFCs, GitHub discussions, and architecture whitepapers.';
  if (searchScope === 'finance') return 'Focus on SEC regulatory filings, market quarterly analyses, earnings transcripts, and economic indicators.';
  return 'Perform comprehensive, multi-domain search across authoritative global sources.';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed. Use POST /api/research.' }); return; }

  const limit = rateLimit(req);
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    res.status(429).json({ error: 'Too many research requests. Please retry later.', retryAfter: limit.retryAfter });
    return;
  }

  const base = baseUrl();
  const token = apiKey();
  if (!base || !token) { res.status(500).json({ error: 'Moonex AI backend is not configured. Set MYAI_API_URL and MYAI_API_KEY in Vercel.' }); return; }

  const { topic, focusAreas = [], searchScope = 'general', model } = req.body || {};
  if (!topic || !String(topic).trim()) { res.status(400).json({ error: 'Topic is required for research.' }); return; }

  let providers: any[] = [];
  try { providers = await liveProviders(base, token); } catch (error) { console.warn('Moonex model catalog lookup failed:', error); }
  if (!providers.length) { res.status(503).json({ error: 'No usable AI model is available from the configured Moonex backend.', code: 'MODEL_CATALOG_UNAVAILABLE' }); return; }

  const requested = normalizeMoonexModelId(model || RESEARCH_PROFILE_ID);
  const profile = resolveMoonexProfile(requested, { messages: [{ role: 'user', content: String(topic) }], enableWebSearch: true });
  const rankedProviders = rankProviderModels(profile, providers);
  if (!rankedProviders.length) { res.status(503).json({ error: `No provider model is available for ${profile.name}.`, code: 'NO_MATCHING_PROVIDER_MODEL', moonexModel: profile.id }); return; }

  const researchProviderIds = new Set([
    'gemini-3.8-flash',
    'gpt-5-search-api',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview',
  ]);

  const currentResearchProviders = rankedProviders.filter((provider: any) =>
    provider?.configured !== false &&
    researchProviderIds.has(String(provider?.id || '').toLowerCase())
  );

  // Keep provider fallback explicit: Google can be healthy at credential level
  // but still quota-limited, so ranking must not be allowed to consume the
  // entire research candidate budget before OpenAI web search is tried.
  const hasOpenAI = providers.some((provider: any) =>
    provider?.configured !== false &&
    String(provider?.provider || provider?.provider_name || provider?.providerName || provider?.owned_by || '').toLowerCase() === 'openai'
  );
  const hasOpenAISearch = currentResearchProviders.some((provider: any) =>
    String(provider?.id || '').toLowerCase() === 'gpt-5-search-api'
  );

  if (hasOpenAI && !hasOpenAISearch) {
    currentResearchProviders.push({
      id: 'gpt-5-search-api',
      provider: 'openai',
      configured: true,
      capabilities: { search: true },
    });
  }

  const uniqueResearchProviders = currentResearchProviders.filter((provider: any, index: number, list: any[]) =>
    index === list.findIndex((candidate: any) => String(candidate?.id || '').toLowerCase() === String(provider?.id || '').toLowerCase())
  );

  const googleCandidates = uniqueResearchProviders.filter((provider: any) =>
    /^(gemini-)/.test(String(provider?.id || '').toLowerCase())
  );
  const openAIFallback = uniqueResearchProviders.find((provider: any) =>
    String(provider?.id || '').toLowerCase() === 'gpt-5-search-api'
  );

  const candidates = [
    ...googleCandidates,
    ...(openAIFallback ? [openAIFallback] : []),
  ].slice(0, MAX_PROVIDER_ATTEMPTS);

  if (!candidates.length) {
    res.status(503).json({ error: 'No configured grounded-search provider is available. Configure Google Gemini or OpenAI web search.', code: 'NO_CONFIGURED_RESEARCH_PROVIDER' });
    return;
  }

  const guidance = scopeGuidance(String(searchScope));
  const focusAreasText = Array.isArray(focusAreas) ? focusAreas.join(', ') : String(focusAreas || '');

  try {
    const planPrompt = `You are a Principal Research Analyst. Break down the research topic into 3 key analytical sub-questions and formulate exact search queries.
Topic: "${topic}"
Research Domain Scope: ${searchScope} (${guidance})
Additional Context: ${focusAreasText}

Respond with a clean markdown plan summarizing the hypothesis, search strategy, and key inquiry dimensions.`;

    const planResult = await completeNonStreaming({
      base, token, candidates,
      messages: [
        { role: 'system', content: `You are an elite research synthesizer specialized in ${searchScope} investigations. Formulate thorough research plans.` },
        { role: 'user', content: planPrompt },
      ],
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      moonexModelId: profile.id,
    });

    if (!planResult.ok) {
      res.status(planResult.statusCode || 502).json({ error: planResult.errorMessage || 'Failed to generate research plan.', code: 'MOONEX_RESEARCH_PLAN_FAILED', attempts: planResult.attempts });
      return;
    }

    const deepPrompt = `Conduct comprehensive, multi-angle research on: "${topic}".
Domain Focus: ${guidance}
Investigate:
1. Executive Summary & Core Dynamics
2. Detailed Technical / Fact-Based Findings & Evidence
3. Market, Academic, or Practical Implications
4. Key Challenges, Counter-Arguments, & Future Outlook
5. Actionable Takeaways & Next Steps

Ensure rigorous depth, citing verified facts and data points where applicable.`;

    const deepResult = await completeNonStreaming({
      base, token, candidates,
      messages: [
        { role: 'system', content: `You are a lead investigator and research scientist specializing in ${searchScope} analysis. Produce exhaustive, publication-grade research reports with citations.` },
        { role: 'user', content: deepPrompt },
      ],
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      moonexModelId: profile.id,
      enableSearch: true,
    });

    if (!deepResult.ok) {
      res.status(deepResult.statusCode || 502).json({ error: deepResult.errorMessage || 'Failed to execute research workflow.', code: 'MOONEX_RESEARCH_REPORT_FAILED', attempts: deepResult.attempts });
      return;
    }

    res.status(200).json({
      topic,
      plan: planResult.text || 'Research plan formulated.',
      report: deepResult.text || 'Report completed.',
      sources: deepResult.groundingSources || [],
      moonexModel: profile.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Moonex /api/research failed:', error);
    res.status(500).json({ error: errorText(error), code: 'MOONEX_INTERNAL_ERROR' });
  }
}
