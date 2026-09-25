// Shared server-side helpers for talking to My AI's unified API
// (`${MYAI_API_URL}/chat/completions`, `${MYAI_API_URL}/models`) from any
// Moonex route. Extracted from api/chat.ts so /api/research and
// /api/code/run can reuse the same credential handling, provider ranking,
// retry/error classification, and rate limiting instead of calling Gemini
// directly. Streaming (SSE) request handling stays in api/chat.ts, since
// it's the only route that needs it — this module is for single-shot,
// non-streaming completions.

export const MODEL_CATALOG_TIMEOUT_MS = 7_500;
export const MAX_PROVIDER_ATTEMPTS = 5;
export const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_PROVIDER_MAX_TOKENS = 4096;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 120_000;
const MAX_CONFIGURED_TIMEOUT_MS = 120_000;

export function baseUrl(): string {
  return (process.env.MYAI_API_URL || '').replace(/\/$/, '');
}

export function apiKey(): string {
  return process.env.MYAI_API_KEY || '';
}

export function configuredTimeoutMs(): number {
  const value = Number(process.env.MOONEX_UPSTREAM_TIMEOUT_MS);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_UPSTREAM_TIMEOUT_MS;
  return Math.min(Math.floor(value), MAX_CONFIGURED_TIMEOUT_MS);
}

export function errorText(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value instanceof Error && value.message) return value.message;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of ['message', 'detail', 'error', 'description', 'reason']) {
      const nested = object[key];
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
      if (nested && nested !== value) {
        const nestedText = errorText(nested);
        if (nestedText) return nestedText;
      }
    }
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== '{}') return serialized;
    } catch {}
  }
  return 'The AI provider returned an unknown error.';
}

export function classifyProviderError(status: number, message: string): { reason: string; retryable: boolean } {
  if (status === 401 || status === 403) return { reason: 'AUTHENTICATION_FAILED', retryable: false };
  if (status === 429) return { reason: 'RATE_LIMITED', retryable: true };
  if (status === 408) return { reason: 'TIMEOUT', retryable: true };
  if (status === 404) return { reason: 'MODEL_UNAVAILABLE', retryable: false };
  if (status === 400 || status === 422) return { reason: 'INVALID_REQUEST', retryable: false };
  if (status >= 500 && status <= 599) return { reason: 'UPSTREAM_UNAVAILABLE', retryable: true };

  const text = message.toLowerCase();
  if (/invalid.*(api|key)|authentication|unauthorized|forbidden|credential/i.test(text)) {
    return { reason: 'AUTHENTICATION_FAILED', retryable: false };
  }
  if (/model.*(not found|does not exist|unavailable)/i.test(text)) {
    return { reason: 'MODEL_UNAVAILABLE', retryable: false };
  }
  if (/invalid (request|parameter)|validation error|malformed/i.test(text)) {
    return { reason: 'INVALID_REQUEST', retryable: false };
  }
  if (/rate.?limit|too many requests|quota exceeded|capacity/i.test(text)) {
    return { reason: 'RATE_LIMITED', retryable: true };
  }
  if (/timeout|timed out/i.test(text)) return { reason: 'TIMEOUT', retryable: true };
  if (/overload|overloaded|temporarily unavailable|upstream|bad gateway|service unavailable/i.test(text)) {
    return { reason: 'UPSTREAM_UNAVAILABLE', retryable: true };
  }
  return { reason: RETRYABLE_STATUS.has(status) ? 'UPSTREAM_RETRYABLE_ERROR' : 'PROVIDER_ERROR', retryable: RETRYABLE_STATUS.has(status) };
}

export function providerLabel(provider: any): string {
  const value = provider?.provider || provider?.provider_name || provider?.providerName || provider?.owned_by || provider?.owner;
  if (typeof value === 'string' && value.trim()) return value.trim();
  const id = String(provider?.id || '').toLowerCase();
  if (/gemini|gemma|google/.test(id)) return 'Google';
  if (/gpt|o[134]|openai/.test(id)) return 'OpenAI';
  if (/mistral|mixtral|codestral/.test(id)) return 'Mistral';
  if (/llama|groq|compound/.test(id)) return 'Groq';
  return 'My AI provider';
}

export function providerMaxTokens(provider: any): number {
  const candidates = [provider?.max_tokens, provider?.maxTokens, provider?.max_output_tokens, provider?.maxOutputTokens, provider?.limits?.max_tokens, provider?.limits?.maxOutputTokens];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return DEFAULT_PROVIDER_MAX_TOKENS;
}

export async function liveProviders(base: string, token: string): Promise<any[]> {
  const response = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(MODEL_CATALOG_TIMEOUT_MS),
  });
  if (!response.ok) return [];
  const json: any = await response.json();
  const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
  return list.map((item: any) => typeof item === 'string' ? { id: item } : item?.id ? { ...item, id: String(item.id) } : null).filter(Boolean);
}

export type NonStreamAttempt = {
  provider: string;
  model: string;
  status: number;
  reason: string;
  retryable: boolean;
  durationMs: number;
};

export type NonStreamResult = {
  ok: boolean;
  text?: string;
  moonexModel?: string;
  providerModel?: string;
  groundingSources?: Array<{ title: string; url: string }>;
  attempts: NonStreamAttempt[];
  errorMessage?: string;
};

// Runs a single-shot (non-streaming) chat completion against My AI,
// trying ranked provider candidates in order with the same retry
// classification /api/chat uses, until one succeeds or all are exhausted.
export async function completeNonStreaming(opts: {
  base: string;
  token: string;
  candidates: any[];
  messages: Array<{ role: string; content: any }>;
  temperature: number;
  maxTokens: number;
  moonexModelId: string;
  enableSearch?: boolean;
}): Promise<NonStreamResult> {
  const attempts: NonStreamAttempt[] = [];
  const timeoutMs = configuredTimeoutMs();

  for (let i = 0; i < opts.candidates.length; i += 1) {
    const provider = opts.candidates[i];
    const providerName = providerLabel(provider);
    const modelId = String(provider.id);
    const started = Date.now();
    const maxTokens = Math.min(opts.maxTokens, providerMaxTokens(provider));
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(new DOMException('Upstream request timed out.', 'TimeoutError')), timeoutMs);

    try {
      const upstream = await fetch(`${opts.base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${opts.token}`, 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json; charset=utf-8' },
        body: JSON.stringify({
          model: modelId,
          messages: opts.messages,
          stream: false,
          enable_search: !!opts.enableSearch,
          temperature: opts.temperature,
          max_tokens: maxTokens,
        }),
        signal: timeoutController.signal,
      });
      clearTimeout(timeoutId);

      if (!upstream.ok) {
        const raw = await upstream.text().catch(() => '');
        let detail: unknown = raw.slice(0, 1500) || `My AI returned HTTP ${upstream.status}.`;
        try { const json = JSON.parse(raw); detail = json?.detail ?? json?.error?.message ?? json?.error ?? json ?? detail; } catch {}
        const message = errorText(detail);
        const classification = classifyProviderError(upstream.status, message);
        attempts.push({ provider: providerName, model: modelId, status: upstream.status, reason: classification.reason, retryable: classification.retryable, durationMs: Date.now() - started });
        if (classification.retryable && i + 1 < opts.candidates.length) continue;
        return { ok: false, attempts, errorMessage: message };
      }

      const data: any = await upstream.json();
      const text = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
      const groundingSources = Array.isArray(data?.x_unified_api?.grounding_sources)
        ? data.x_unified_api.grounding_sources
            .filter((s: any) => s?.url || s?.uri)
            .map((s: any) => ({ title: s.title || s.url || s.uri, url: s.url || s.uri }))
        : [];

      attempts.push({ provider: providerName, model: modelId, status: upstream.status, reason: 'OK', retryable: false, durationMs: Date.now() - started });
      return { ok: true, text: typeof text === 'string' ? text : '', moonexModel: opts.moonexModelId, providerModel: modelId, groundingSources, attempts };
    } catch (error) {
      clearTimeout(timeoutId);
      const message = errorText(error);
      const timedOut = timeoutController.signal.aborted;
      const classification = timedOut ? { reason: 'TIMEOUT', retryable: true } : classifyProviderError(502, message);
      attempts.push({ provider: providerName, model: modelId, status: timedOut ? 504 : 502, reason: classification.reason, retryable: classification.retryable, durationMs: Date.now() - started });
      if (classification.retryable && i + 1 < opts.candidates.length) continue;
      return { ok: false, attempts, errorMessage: message };
    }
  }

  return { ok: false, attempts, errorMessage: 'No provider attempt was made.' };
}

// Simple in-memory sliding-window rate limiter, matching the one in
// api/chat.ts, so /api/research and /api/code/run get the same protection.
export function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, { started: number; count: number }>();
  return function rateLimit(req: any) {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const key = forwarded || String(req.socket?.remoteAddress || 'unknown');
    const now = Date.now();
    const current = buckets.get(key);
    if (buckets.size > 5000) buckets.clear();
    if (!current || now - current.started >= windowMs) {
      buckets.set(key, { started: now, count: 1 });
      return { allowed: true, remaining: limit - 1, retryAfter: Math.ceil(windowMs / 1000) };
    }
    current.count += 1;
    return {
      allowed: current.count <= limit,
      remaining: Math.max(0, limit - current.count),
      retryAfter: Math.max(1, Math.ceil((windowMs - (now - current.started)) / 1000)),
    };
  };
}
