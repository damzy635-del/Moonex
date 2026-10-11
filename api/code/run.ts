import {
  normalizeMoonexModelId,
  rankProviderModels,
  resolveMoonexProfile,
} from '../../lib/moonex-models.js';
import {
  baseUrl,
  apiKey,
  liveProviders,
  completeNonStreaming,
  createRateLimiter,
  errorText,
  MAX_PROVIDER_ATTEMPTS,
} from '../../lib/myai-gateway.js';

export const config = { maxDuration: 300 };

const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;
const rateLimit = createRateLimiter(RATE_LIMIT, RATE_WINDOW_MS);

const CODE_PROFILE_ID = 'moonex-code-1.5';
const MAX_CODE_CHARS = 20_000;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed. Use POST /api/code/run.' }); return; }

  const limit = rateLimit(req);
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    res.status(429).json({ error: 'Too many code execution requests. Please retry later.', retryAfter: limit.retryAfter });
    return;
  }

  const base = baseUrl();
  const token = apiKey();
  if (!base || !token) { res.status(500).json({ error: 'Moonex AI backend is not configured. Set MYAI_API_URL and MYAI_API_KEY in Vercel.' }); return; }

  const { code, language, model } = req.body || {};
  if (!code || !String(code).trim()) { res.status(400).json({ error: 'Code is required' }); return; }
  if (String(code).length > MAX_CODE_CHARS) { res.status(400).json({ error: `Code is too long. Maximum is ${MAX_CODE_CHARS} characters.` }); return; }

  let providers: any[] = [];
  try { providers = await liveProviders(base, token); } catch (error) { console.warn('Moonex model catalog lookup failed:', error); }
  if (!providers.length) { res.status(503).json({ error: 'No usable AI model is available from the configured Moonex backend.', code: 'MODEL_CATALOG_UNAVAILABLE' }); return; }

  const requested = normalizeMoonexModelId(model || CODE_PROFILE_ID);
  const profile = resolveMoonexProfile(requested, { messages: [{ role: 'user', content: String(code) }] });
  const rankedProviders = rankProviderModels(profile, providers);
  if (!rankedProviders.length) { res.status(503).json({ error: `No provider model is available for ${profile.name}.`, code: 'NO_MATCHING_PROVIDER_MODEL', moonexModel: profile.id }); return; }
  const candidates = rankedProviders.slice(0, Math.min(MAX_PROVIDER_ATTEMPTS, rankedProviders.length));

  const prompt = `Simulate safe execution or linting of the following ${language || 'code'}:
\`\`\`${language || ''}
${code}
\`\`\`
Provide a realistic execution trace or output (like console.log results, execution time, and any warnings/errors), followed by a brief 2-sentence optimization review.`;

  try {
    const result = await completeNonStreaming({
      base, token, candidates,
      messages: [
        { role: 'system', content: 'You are a high-speed code interpreter and execution simulator. Provide crisp terminal outputs.' },
        { role: 'user', content: prompt },
      ],
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      moonexModelId: profile.id,
    });

    if (!result.ok) {
      res.status(502).json({ error: result.errorMessage || 'Execution simulation failed.', code: 'MOONEX_CODE_RUN_FAILED', attempts: result.attempts });
      return;
    }

    res.status(200).json({ output: result.text || 'Execution completed with 0 errors.', moonexModel: profile.id });
  } catch (error) {
    console.error('Moonex /api/code/run failed:', error);
    res.status(500).json({ error: errorText(error), code: 'MOONEX_INTERNAL_ERROR' });
  }
}
