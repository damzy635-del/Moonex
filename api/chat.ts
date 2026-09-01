import {
  normalizeMoonexModelId,
  rankProviderModels,
  resolveMoonexProfile,
} from '../lib/moonex-models.js';

export const config = { maxDuration: 300 };

type Msg = {
  role?: string;
  content?: unknown;
  files?: Array<{ data?: string; mimeType?: string; type?: string }>;
};

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_MESSAGES = 100;
const MAX_MESSAGE_CHARS = 100_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const MAX_PROVIDER_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const rateBuckets = new Map<string, { started: number; count: number }>();

const baseUrl = () => (process.env.MYAI_API_URL || '').replace(/\/$/, '');
const apiKey = () => process.env.MYAI_API_KEY || '';

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

function convertMessage(message: Msg) {
  const role =
    message.role === 'assistant' || message.role === 'model'
      ? 'assistant'
      : message.role === 'system'
        ? 'system'
        : 'user';
  const files = Array.isArray(message.files) ? message.files : [];
  const text = typeof message.content === 'string' ? message.content : '';
  if (text.length > MAX_MESSAGE_CHARS) {
    throw new Error(`Message exceeds the ${MAX_MESSAGE_CHARS.toLocaleString()} character limit.`);
  }
  if (!files.length) return { role, content: text.trim() || ' ' };

  const parts: any[] = [];
  if (text.trim()) parts.push({ type: 'text', text });
  for (const file of files) {
    if (!file?.data || !file?.mimeType) continue;
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.mimeType)) continue;
    if (file.data.length > 1_500_000) throw new Error('An attached image is too large.');
    const url = file.data.startsWith('data:')
      ? file.data
      : `data:${file.mimeType};base64,${file.data}`;
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return { role, content: parts.length ? parts : [{ type: 'text', text: ' ' }] };
}

function buildPrompt(instruction: unknown, knowledge: unknown, tone: string, modelName: string) {
  let prompt = `You are Moonex, an advanced AI assistant. Your product identity is Moonex. The current Moonex model profile is ${modelName}. If asked what model you are, say you are ${modelName}, a Moonex model, and do not claim that the product is a provider model. Never call yourself My AI Model. Always provide accurate, useful, well-structured answers using Markdown when appropriate.`;
  if (tone === 'concise') prompt += ' Be exceptionally direct and concise.';
  if (tone === 'explanatory') prompt += ' Give detailed, step-by-step educational explanations.';
  if (tone === 'creative') prompt += ' Be expressive and imaginative while remaining accurate.';
  if (tone === 'technical') prompt += ' Be rigorous and technical, including edge cases and implementation details.';
  if (typeof instruction === 'string' && instruction.trim()) {
    prompt += `\n\nCustom User Instructions:\n${instruction.trim().slice(0, MAX_MESSAGE_CHARS)}`;
  }
  if (Array.isArray(knowledge) && knowledge.length) {
    prompt += '\n\n=== PROJECT KNOWLEDGE CONTEXT ===';
    for (const item of knowledge.slice(0, 20) as any[]) {
      if (item?.name && item?.content) {
        prompt += `\n\n--- ${String(item.name).slice(0, 200)} ---\n${String(item.content).slice(0, MAX_MESSAGE_CHARS)}`;
      }
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
    } catch {
      // Fall through to the generic message.
    }
  }
  return 'The AI provider returned an unknown error.';
}

function isRetryableError(status: number, message: string) {
  if (RETRYABLE_STATUS.has(status)) return true;
  return /overload|overloaded|spike in demand|temporarily unavailable|rate limit|too many requests|capacity/i.test(message);
}

async function liveProviders(base: string, token: string): Promise<any[]> {
  const response = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok) return [];
  const json: any = await response.json();
  const list = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.models)
        ? json.models
        : [];
  return list
    .map((item: any) =>
      typeof item === 'string'
        ? { id: item }
        : item?.id
          ? { ...item, id: String(item.id) }
          : null,
    )
    .filter(Boolean);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST /api/chat.' });
    return;
  }

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
  if (!base || !token) {
    res.status(500).json({ error: 'Moonex AI backend is not configured. Set MYAI_API_URL and MYAI_API_KEY in Vercel.' });
    return;
  }

  const body = req.body || {};
  const serialized = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(body);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'Request body is too large.' });
    return;
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length > MAX_MESSAGES) {
    res.status(400).json({ error: `Too many messages. Maximum is ${MAX_MESSAGES}.` });
    return;
  }

  let providers: any[] = [];
  try {
    providers = await liveProviders(base, token);
  } catch (error) {
    console.warn('Moonex model catalog lookup failed:', error);
  }
  if (!providers.length) {
    res.status(503).json({ error: 'No usable AI model is available from the configured Moonex backend.' });
    return;
  }

  const requested = normalizeMoonexModelId(body.model);
  const profile = resolveMoonexProfile(requested, {
    messages,
    enableWebSearch: !!body.enableWebSearch,
    thinkingLevel: body.thinkingLevel,
  });
  const rankedProviders = rankProviderModels(profile, providers);
  if (!rankedProviders.length) {
    res.status(503).json({ error: `No provider model is available for ${profile.name}.` });
    return;
  }

  let converted;
  try {
    converted = messages.map(convertMessage);
  } catch (error) {
    res.status(400).json({ error: errorText(error) });
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  send(res, {
    type: 'route',
    requestedModel: requested,
    moonexModel: profile.id,
    modelName: profile.name,
  });

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': keep-alive\n\n');
  }, 15_000);

  let lastError = '';
  let lastStatus = 502;
  let completed = false;

  try {
    const candidates = rankedProviders.slice(0, MAX_PROVIDER_ATTEMPTS);

    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const provider = candidates[attempt];
      let upstream: Response;

      try {
        upstream = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            model: provider.id,
            messages: [
              {
                role: 'system',
                content: buildPrompt(body.systemInstruction, body.projectKnowledge, body.tone || 'balanced', profile.name),
              },
              ...converted,
            ],
            stream: true,
            enable_search: !!body.enableWebSearch,
            ...(body.thinkingLevel && body.thinkingLevel !== 'none'
              ? { thinking_level: body.thinkingLevel }
              : {}),
            temperature: profile.temperature,
            max_tokens: profile.maxTokens,
          }),
        });
      } catch (error) {
        lastError = errorText(error);
        lastStatus = 502;
        if (attempt + 1 < candidates.length) continue;
        break;
      }

      if (!upstream.ok || !upstream.body) {
        const raw = await upstream.text().catch(() => '');
        let detail: unknown = raw.slice(0, 1500) || `Moonex AI returned HTTP ${upstream.status}.`;
        try {
          const json = JSON.parse(raw);
          detail = json?.detail ?? json?.error?.message ?? json?.error ?? json ?? detail;
        } catch {
          // Keep the readable upstream detail.
        }
        lastError = errorText(detail);
        lastStatus = upstream.status;
        if (attempt + 1 < candidates.length && isRetryableError(upstream.status, lastError)) continue;
        break;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let emittedText = false;
      let providerFailedBeforeContent = false;
      let providerStreamError = false;
      let streamDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          if (payload === '[DONE]') {
            streamDone = true;
            continue;
          }

          try {
            const chunk: any = JSON.parse(payload);
            if (chunk?.error) {
              lastError = errorText(chunk.error);
              lastStatus = Number(chunk.error?.status || chunk.status || 502);
              providerStreamError = true;
              if (!emittedText && attempt + 1 < candidates.length && isRetryableError(lastStatus, lastError)) {
                providerFailedBeforeContent = true;
                await reader.cancel().catch(() => undefined);
              }
              break;
            }
            const text = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.text ?? '';
            if (text) {
              emittedText = true;
              send(res, { type: 'chunk', text });
            }
          } catch {
            // Ignore malformed upstream SSE frames and continue the stream.
          }
        }

        if (providerFailedBeforeContent || providerStreamError) break;
      }

      if (providerFailedBeforeContent) continue;

      if (buffer.trim().startsWith('data:')) {
        const payload = buffer.slice(5).trim();
        if (payload && payload !== '[DONE]') {
          try {
            const chunk: any = JSON.parse(payload);
            if (chunk?.error) {
              lastError = errorText(chunk.error);
              lastStatus = Number(chunk.error?.status || chunk.status || 502);
              providerStreamError = true;
            } else {
              const text = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.text ?? '';
              if (text) {
                emittedText = true;
                send(res, { type: 'chunk', text });
              }
            }
          } catch {
            // Ignore an incomplete trailing frame.
          }
        }
      }

      if (providerStreamError && !emittedText && attempt + 1 < candidates.length && isRetryableError(lastStatus, lastError)) {
        continue;
      }

      if (providerStreamError) break;

      send(res, { type: 'done', modelUsed: profile.id });
      completed = true;
      break;
    }

    if (!completed) {
      const friendly = isRetryableError(lastStatus, lastError)
        ? 'The selected AI model is temporarily busy. Moonex tried another available model, but no provider was ready. Please try again shortly.'
        : lastError || 'The AI provider could not complete the request.';
      send(res, {
        type: 'error',
        error: friendly,
        status: lastStatus,
        moonexModel: profile.id,
      });
    }
  } catch (error) {
    console.error('Moonex /api/chat failed:', error);
    send(res, {
      type: 'error',
      error: errorText(error),
      moonexModel: profile.id,
    });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
    if (rateBuckets.size > 5000) rateBuckets.clear();
  }
}
