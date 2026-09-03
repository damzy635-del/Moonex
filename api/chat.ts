import {
  normalizeMoonexModelId,
  rankProviderModels,
  resolveMoonexProfile,
} from '../lib/moonex-models.js';

export const config = { maxDuration: 300 };

type Msg = {
  role?: string;
  content?: unknown;
  files?: Array<{ data?: string; mimeType?: string; type?: string; name?: string }>;
};

type AttemptDiagnostic = {
  provider: string;
  model: string;
  status: number;
  reason: string;
  retryable: boolean;
  durationMs: number;
};

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_MESSAGES = 100;
const MAX_MESSAGE_CHARS = 100_000;
const MAX_ATTACHMENT_TEXT_CHARS = 100_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const MAX_PROVIDER_ATTEMPTS = 5;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_PROVIDER_MAX_TOKENS = 4096;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 120_000;
const MODEL_CATALOG_TIMEOUT_MS = 7_500;
const MAX_CONFIGURED_TIMEOUT_MS = 120_000;
const rateBuckets = new Map<string, { started: number; count: number }>();

const baseUrl = () => (process.env.MYAI_API_URL || '').replace(/\/$/, '');
const apiKey = () => process.env.MYAI_API_KEY || '';

function configuredTimeoutMs() {
  const value = Number(process.env.MOONEX_UPSTREAM_TIMEOUT_MS);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_UPSTREAM_TIMEOUT_MS;
  return Math.min(Math.floor(value), MAX_CONFIGURED_TIMEOUT_MS);
}

function clientKey(req: any) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.socket?.remoteAddress || 'unknown');
}

function rateLimit(req: any) {
  const key = clientKey(req);
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || now - current.started >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { started: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT - 1, retryAfter: 60 };
  }
  current.count += 1;
  const remaining = Math.max(0, RATE_LIMIT - current.count);
  return {
    allowed: current.count <= RATE_LIMIT,
    remaining,
    retryAfter: Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - current.started)) / 1000)),
  };
}

function isImageFile(file: { mimeType?: string; type?: string }) {
  return String(file.mimeType || '').toLowerCase().startsWith('image/') || file.type === 'image';
}

function isTextFile(file: { mimeType?: string; type?: string; name?: string }) {
  const mime = String(file.mimeType || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return file.type === 'code' ||
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/javascript' ||
    mime === 'application/typescript' ||
    mime === 'application/xml' ||
    mime === 'application/sql' ||
    /\.(txt|md|markdown|csv|json|js|jsx|ts|tsx|py|html|htm|css|scss|sass|sql|sh|bash|xml|yaml|yml|toml|ini|env|java|c|cc|cpp|h|hpp|go|rs|rb|php|swift|kt|kts|vue|svelte)$/i.test(name);
}

function decodeAttachmentText(data: string): string {
  if (data.startsWith('data:')) {
    const comma = data.indexOf(',');
    if (comma === -1) return '';
    const metadata = data.slice(5, comma).toLowerCase();
    const payload = data.slice(comma + 1);
    if (metadata.includes(';base64')) return Buffer.from(payload, 'base64').toString('utf8');
    try { return decodeURIComponent(payload); } catch { return payload; }
  }
  return data;
}

function convertMessage(message: Msg) {
  const role = message.role === 'assistant' || message.role === 'model'
    ? 'assistant'
    : message.role === 'system' ? 'system' : 'user';
  const files = Array.isArray(message.files) ? message.files : [];
  const text = typeof message.content === 'string' ? message.content : '';
  if (text.length > MAX_MESSAGE_CHARS) throw new Error(`Message exceeds the ${MAX_MESSAGE_CHARS.toLocaleString()} character limit.`);
  if (!files.length) return { role, content: text.trim() || ' ' };

  const parts: any[] = [];
  if (text.trim()) parts.push({ type: 'text', text });

  for (const file of files) {
    if (!file?.data || !file?.mimeType) continue;
    if (isImageFile(file)) {
      if (file.data.length > 1_500_000) throw new Error('An attached image is too large.');
      const url = file.data.startsWith('data:') ? file.data : `data:${file.mimeType};base64,${file.data}`;
      parts.push({ type: 'image_url', image_url: { url } });
      continue;
    }
    if (isTextFile(file)) {
      const attachmentText = decodeAttachmentText(file.data).slice(0, MAX_ATTACHMENT_TEXT_CHARS);
      if (attachmentText) {
        const filename = String(file.name || 'attachment').slice(0, 200);
        parts.push({ type: 'text', text: `\n\n=== ATTACHED FILE: ${filename} ===\n${attachmentText}\n=== END ATTACHED FILE ===` });
      }
      continue;
    }
    const filename = String(file.name || 'attachment').slice(0, 200);
    parts.push({ type: 'text', text: `\n\n[Attached document: ${filename}. Binary document extraction is not available in this chat path.]` });
  }
  return { role, content: parts.length ? parts : [{ type: 'text', text: text.trim() || ' ' }] };
}

function buildPrompt(instruction: unknown, knowledge: unknown, tone: string, modelName: string) {
  let prompt = `You are Moonex, an advanced AI assistant. Your product identity is Moonex. The current Moonex model profile is ${modelName}. If asked what model you are, say you are ${modelName}, a Moonex model, and do not claim that the product is a provider model. Never call yourself My AI Model. Always provide accurate, useful, well-structured answers using Markdown when appropriate.`;
  if (tone === 'concise') prompt += ' Be exceptionally direct and concise.';
  if (tone === 'explanatory') prompt += ' Give detailed, step-by-step educational explanations.';
  if (tone === 'creative') prompt += ' Be expressive and imaginative while remaining accurate.';
  if (tone === 'technical') prompt += ' Be rigorous and technical, including edge cases and implementation details.';
  if (typeof instruction === 'string' && instruction.trim()) prompt += `\n\nCustom User Instructions:\n${instruction.trim().slice(0, MAX_MESSAGE_CHARS)}`;
  if (Array.isArray(knowledge) && knowledge.length) {
    prompt += '\n\n=== PROJECT KNOWLEDGE CONTEXT ===';
    for (const item of knowledge.slice(0, 20) as any[]) {
      if (item?.name && item?.content) prompt += `\n\n--- ${String(item.name).slice(0, 200)} ---\n${String(item.content).slice(0, MAX_MESSAGE_CHARS)}`;
    }
    prompt += '\n=== END PROJECT KNOWLEDGE ===';
  }
  return prompt;
}

function send(res: any, payload: unknown) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function errorText(value: unknown): string {
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

function providerMaxTokens(provider: any): number {
  const candidates = [provider?.max_tokens, provider?.maxTokens, provider?.max_output_tokens, provider?.maxOutputTokens, provider?.limits?.max_tokens, provider?.limits?.maxOutputTokens];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return DEFAULT_PROVIDER_MAX_TOKENS;
}

function providerLabel(provider: any): string {
  const value = provider?.provider || provider?.provider_name || provider?.providerName || provider?.owned_by || provider?.owner;
  if (typeof value === 'string' && value.trim()) return value.trim();
  const id = String(provider?.id || '').toLowerCase();
  if (/gemini|gemma|google/.test(id)) return 'Google';
  if (/gpt|o[134]|openai/.test(id)) return 'OpenAI';
  if (/mistral|mixtral|codestral/.test(id)) return 'Mistral';
  if (/llama|groq|compound/.test(id)) return 'Groq';
  return 'My AI provider';
}

function publicAttempt(attempt: AttemptDiagnostic) {
  return { provider: attempt.provider, model: attempt.model, status: attempt.status, reason: attempt.reason, retryable: attempt.retryable, durationMs: attempt.durationMs };
}

function finalDiagnosticMessage(selectedModel: string, attempts: AttemptDiagnostic[]): string {
  if (!attempts.length) return 'No provider attempt was made.';
  const summary = attempts.map((attempt) => `${attempt.provider} (${attempt.reason}${attempt.status ? `, HTTP ${attempt.status}` : ''})`).join('; ');
  return `Moonex could not complete ${selectedModel}. Provider attempts: ${summary}.`;
}

async function liveProviders(base: string, token: string): Promise<any[]> {
  const response = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(MODEL_CATALOG_TIMEOUT_MS),
  });
  if (!response.ok) return [];
  const json: any = await response.json();
  const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
  return list.map((item: any) => typeof item === 'string' ? { id: item } : item?.id ? { ...item, id: String(item.id) } : null).filter(Boolean);
}

function attachAbortListener(req: any, res: any, controller: AbortController) {
  let disconnected = false;
  const abort = () => {
    if (disconnected || controller.signal.aborted) return;
    disconnected = true;
    controller.abort(new DOMException('Client disconnected.', 'AbortError'));
  };
  if (typeof req?.on === 'function') {
    req.on('aborted', abort);
  }
  if (typeof res?.on === 'function') {
    res.on('close', () => {
      if (!res.writableEnded) abort();
    });
  }
  return () => {
    if (typeof req?.off === 'function') req.off('aborted', abort);
  };
}

function abortReason(error: unknown): { reason: string; retryable: boolean } {
  const message = errorText(error);
  if (/client disconnected/i.test(message)) return { reason: 'CLIENT_DISCONNECTED', retryable: false };
  if (error instanceof Error && (error.name === 'TimeoutError' || /timed out|timeout/i.test(message))) {
    return { reason: 'TIMEOUT', retryable: true };
  }
  if (error instanceof Error && error.name === 'AbortError') return { reason: 'STREAM_INTERRUPTED', retryable: true };
  return { reason: 'UPSTREAM_UNAVAILABLE', retryable: true };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed. Use POST /api/chat.' }); return; }

  const limit = rateLimit(req);
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    res.status(429).json({ error: 'Too many chat requests. Please retry later.', retryAfter: limit.retryAfter });
    return;
  }

  const base = baseUrl();
  const token = apiKey();
  if (!base || !token) { res.status(500).json({ error: 'Moonex AI backend is not configured. Set MYAI_API_URL and MYAI_API_KEY in Vercel.' }); return; }

  const body = req.body || {};
  const serialized = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(body);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) { res.status(413).json({ error: 'Request body is too large.' }); return; }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length > MAX_MESSAGES) { res.status(400).json({ error: `Too many messages. Maximum is ${MAX_MESSAGES}.` }); return; }

  let providers: any[] = [];
  try { providers = await liveProviders(base, token); } catch (error) { console.warn('Moonex model catalog lookup failed:', error); }
  if (!providers.length) { res.status(503).json({ error: 'No usable AI model is available from the configured Moonex backend.', code: 'MODEL_CATALOG_UNAVAILABLE' }); return; }

  const requested = normalizeMoonexModelId(body.model);
  const profile = resolveMoonexProfile(requested, { messages, enableWebSearch: !!body.enableWebSearch, thinkingLevel: body.thinkingLevel });
  const rankedProviders = rankProviderModels(profile, providers);
  if (!rankedProviders.length) { res.status(503).json({ error: `No provider model is available for ${profile.name}.`, code: 'NO_MATCHING_PROVIDER_MODEL', moonexModel: profile.id }); return; }

  let converted;
  try { converted = messages.map(convertMessage); } catch (error) { res.status(400).json({ error: errorText(error), code: 'INVALID_ATTACHMENT' }); return; }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  send(res, { type: 'route', requestedModel: requested, moonexModel: profile.id, modelName: profile.name });

  const heartbeat = setInterval(() => { if (!res.writableEnded) res.write(': keep-alive\n\n'); }, 15_000);
  const requestController = new AbortController();
  const detachAbortListener = attachAbortListener(req, res, requestController);
  const attempts: AttemptDiagnostic[] = [];
  let completed = false;
  let partialStream = false;

  try {
    const candidates = rankedProviders.slice(0, Math.min(MAX_PROVIDER_ATTEMPTS, rankedProviders.length));

    for (let attemptIndex = 0; attemptIndex < candidates.length; attemptIndex += 1) {
      if (requestController.signal.aborted) break;

      const provider = candidates[attemptIndex];
      const providerName = providerLabel(provider);
      const modelId = String(provider.id);
      const started = Date.now();
      const maxTokens = Math.min(profile.maxTokens, providerMaxTokens(provider));
      let upstream: Response;

      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(new DOMException('Upstream request timed out.', 'TimeoutError')), configuredTimeoutMs());
      const abortHandler = () => timeoutController.abort(requestController.signal.reason || new DOMException('Client disconnected.', 'AbortError'));
      if (requestController.signal.aborted) abortHandler();
      else requestController.signal.addEventListener('abort', abortHandler, { once: true });

      try {
        upstream = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8', Accept: 'text/event-stream; charset=utf-8' },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'system', content: buildPrompt(body.systemInstruction, body.projectKnowledge, body.tone || 'balanced', profile.name) }, ...converted],
            stream: true,
            enable_search: !!body.enableWebSearch,
            ...(body.thinkingLevel && body.thinkingLevel !== 'none' ? { thinking_level: body.thinkingLevel } : {}),
            temperature: profile.temperature,
            max_tokens: maxTokens,
          }),
          signal: timeoutController.signal,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        requestController.signal.removeEventListener('abort', abortHandler);
        const message = errorText(error);
        const aborted = timeoutController.signal.aborted;
        const classification = aborted ? abortReason(timeoutController.signal.reason || error) : classifyProviderError(502, message);
        attempts.push({ provider: providerName, model: modelId, status: classification.reason === 'TIMEOUT' ? 504 : 502, reason: classification.reason, retryable: classification.retryable, durationMs: Date.now() - started });
        if (classification.reason === 'CLIENT_DISCONNECTED') break;
        if (classification.retryable && attemptIndex + 1 < candidates.length) continue;
        break;
      }
      clearTimeout(timeoutId);
      requestController.signal.removeEventListener('abort', abortHandler);

      if (!upstream.ok || !upstream.body) {
        const raw = await upstream.text().catch(() => '');
        let detail: unknown = raw.slice(0, 1500) || `Moonex AI returned HTTP ${upstream.status}.`;
        try { const json = JSON.parse(raw); detail = json?.detail ?? json?.error?.message ?? json?.error ?? json ?? detail; } catch {}
        const message = errorText(detail);
        const classification = classifyProviderError(upstream.status, message);
        attempts.push({ provider: providerName, model: modelId, status: upstream.status, reason: classification.reason, retryable: classification.retryable, durationMs: Date.now() - started });
        if (classification.retryable && attemptIndex + 1 < candidates.length) continue;
        break;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: false });
      let buffer = '';
      let emittedText = false;
      let providerStreamError = false;
      let providerStreamStatus = 200;
      let providerStreamMessage = '';
      let streamTimedOut = false;
      let lastActivity = Date.now();

      const streamTimeoutMs = configuredTimeoutMs();
      let streamTimeoutId = setTimeout(() => { streamTimedOut = true; }, streamTimeoutMs);

      try {
        while (true) {
          const readController = new AbortController();
          const readTimeoutId = setTimeout(() => readController.abort(new DOMException('Upstream stream timed out.', 'TimeoutError')), streamTimeoutMs);
          const requestAbortHandler = () => readController.abort(requestController.signal.reason || new DOMException('Client disconnected.', 'AbortError'));
          if (requestController.signal.aborted) requestAbortHandler();
          else requestController.signal.addEventListener('abort', requestAbortHandler, { once: true });

          let result: ReadableStreamReadResult<Uint8Array>;
          try {
            result = await Promise.race([
              reader.read(),
              new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
                readController.signal.addEventListener('abort', () => reject(readController.signal.reason || new DOMException('Upstream stream timed out.', 'TimeoutError')), { once: true });
              }),
            ]);
          } catch (error) {
            providerStreamError = true;
            const classification = abortReason(error);
            providerStreamStatus = classification.reason === 'TIMEOUT' ? 504 : 502;
            providerStreamMessage = errorText(error);
          } finally {
            clearTimeout(readTimeoutId);
            requestController.signal.removeEventListener('abort', requestAbortHandler);
          }

          if (providerStreamError) break;
          if (result.done) break;
          if (result.value) {
            lastActivity = Date.now();
            clearTimeout(streamTimeoutId);
            streamTimeoutId = setTimeout(() => { streamTimedOut = true; }, streamTimeoutMs);
            buffer += decoder.decode(result.value, { stream: true });
          }
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const chunk: any = JSON.parse(payload);
              if (chunk?.error) {
                providerStreamMessage = errorText(chunk.error);
                providerStreamStatus = Number(chunk.error?.status || chunk.status || 502);
                providerStreamError = true;
                break;
              }
              const text = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.text ?? '';
              if (typeof text === 'string' && text) {
                emittedText = true;
                send(res, { type: 'chunk', text });
              }
            } catch {}
          }
          if (providerStreamError) break;
          if (streamTimedOut || Date.now() - lastActivity > streamTimeoutMs) {
            providerStreamError = true;
            providerStreamStatus = 504;
            providerStreamMessage = 'Upstream stream timed out.';
            break;
          }
        }
      } catch (error) {
        providerStreamError = true;
        providerStreamStatus = 502;
        providerStreamMessage = errorText(error);
      } finally {
        clearTimeout(streamTimeoutId);
        await reader.cancel().catch(() => {});
      }

      buffer += decoder.decode();
      if (!providerStreamError && buffer.trim().startsWith('data:')) {
        const payload = buffer.slice(5).trim();
        if (payload && payload !== '[DONE]') {
          try {
            const chunk: any = JSON.parse(payload);
            if (chunk?.error) {
              providerStreamError = true;
              providerStreamStatus = Number(chunk.error?.status || chunk.status || 502);
              providerStreamMessage = errorText(chunk.error);
            } else {
              const text = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.text ?? '';
              if (typeof text === 'string' && text) { emittedText = true; send(res, { type: 'chunk', text }); }
            }
          } catch {}
        }
      }

      if (providerStreamError) {
        const classification = classifyProviderError(providerStreamStatus, providerStreamMessage);
        attempts.push({ provider: providerName, model: modelId, status: providerStreamStatus, reason: classification.reason, retryable: classification.retryable, durationMs: Date.now() - started });
        if (!emittedText && classification.retryable && attemptIndex + 1 < candidates.length && !requestController.signal.aborted) continue;
        partialStream = emittedText;
        break;
      }

      if (!emittedText) {
        attempts.push({ provider: providerName, model: modelId, status: 502, reason: 'EMPTY_STREAM', retryable: true, durationMs: Date.now() - started });
        if (attemptIndex + 1 < candidates.length && !requestController.signal.aborted) continue;
        break;
      }

      send(res, { type: 'done', modelUsed: profile.id });
      completed = true;
      break;
    }

    if (!completed && !requestController.signal.aborted) {
      const last = attempts[attempts.length - 1];
      const retryable = attempts.some((attempt) => attempt.retryable);
      const code = partialStream ? 'STREAM_INTERRUPTED' : retryable ? 'PROVIDER_EXHAUSTED' : (last?.reason || 'PROVIDER_ERROR');
      const error = partialStream
        ? `The response stream was interrupted by ${last?.provider || 'the provider'} (${last?.reason || 'STREAM_ERROR'}). Some content was received.`
        : finalDiagnosticMessage(profile.name, attempts);
      send(res, {
        type: 'error',
        error,
        status: last?.status || 502,
        code,
        moonexModel: profile.id,
        attempts: attempts.map(publicAttempt),
        attemptedProviders: attempts.map((item) => item.provider),
      });
    }
  } catch (error) {
    if (!requestController.signal.aborted) {
      console.error('Moonex /api/chat failed:', error);
      send(res, {
        type: 'error',
        error: errorText(error),
        code: 'MOONEX_INTERNAL_ERROR',
        moonexModel: profile.id,
        attempts: attempts.map(publicAttempt),
      });
    }
  } finally {
    requestController.abort();
    detachAbortListener();
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
    if (rateBuckets.size > 5000) rateBuckets.clear();
  }
}
