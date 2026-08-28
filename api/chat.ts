export const config = { maxDuration: 300 };

type Msg = {
  role?: string;
  content?: unknown;
  files?: Array<{ data?: string; mimeType?: string }>;
};

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_MESSAGES = 100;
const MAX_MESSAGE_CHARS = 100_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
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

function convertMessage(m: Msg) {
  const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : m.role === 'system' ? 'system' : 'user';
  const files = Array.isArray(m.files) ? m.files : [];
  const text = typeof m.content === 'string' ? m.content : '';
  if (text.length > MAX_MESSAGE_CHARS) throw new Error(`Message exceeds the ${MAX_MESSAGE_CHARS.toLocaleString()} character limit.`);
  if (!files.length) return { role, content: text.trim() || ' ' };

  const parts: any[] = [];
  if (text.trim()) parts.push({ type: 'text', text });
  for (const file of files) {
    if (!file?.data || !file?.mimeType) continue;
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.mimeType)) continue;
    if (file.data.length > 1_500_000) throw new Error('An attached image is too large.');
    const url = file.data.startsWith('data:') ? file.data : `data:${file.mimeType};base64,${file.data}`;
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return { role, content: parts.length ? parts : [{ type: 'text', text: ' ' }] };
}

function buildPrompt(instruction: unknown, knowledge: unknown, tone: string) {
  let prompt = 'You are Moonex, an advanced, highly capable AI assistant. Moonex is the assistant and product name; do not describe yourself as My AI Model. If the user asks what model you are, identify yourself as Moonex and, when the active model ID is known, distinguish Moonex from the underlying AI model. Always provide accurate, useful, well-structured answers using Markdown when appropriate.';
  if (tone === 'concise') prompt += ' Be exceptionally direct and concise.';
  if (tone === 'explanatory') prompt += ' Give detailed, step-by-step educational explanations.';
  if (tone === 'creative') prompt += ' Be expressive and imaginative while remaining accurate.';
  if (tone === 'technical') prompt += ' Be rigorous and technical, including edge cases and implementation details.';
  if (typeof instruction === 'string' && instruction.trim()) prompt += `\n\nCustom User Instructions:\n${instruction.trim().slice(0, MAX_MESSAGE_CHARS)}`;
  if (Array.isArray(knowledge) && knowledge.length) {
    prompt += '\n\n=== PROJECT KNOWLEDGE CONTEXT ===';
    for (const item of knowledge.slice(0, 20) as any[]) if (item?.name && item?.content) prompt += `\n\n--- ${String(item.name).slice(0, 200)} ---\n${String(item.content).slice(0, MAX_MESSAGE_CHARS)}`;
    prompt += '\n=== END PROJECT KNOWLEDGE ===';
  }
  return prompt;
}

function send(res: any, payload: unknown) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function liveModelIds(base: string, token: string): Promise<string[]> {
  const response = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok) return [];
  const json: any = await response.json();
  const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
  return list.map((item: any) => typeof item === 'string' ? item : item?.id).filter((id: unknown): id is string => typeof id === 'string' && !!id.trim());
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

  const requested = typeof body.model === 'string' ? body.model.trim() : '';
  let ids: string[] = [];
  try { ids = await liveModelIds(base, token); } catch (error) { console.warn('Moonex model catalog lookup failed:', error); }
  const model = requested && ids.includes(requested) ? requested : ids[0] || requested;

  if (!model) {
    res.status(503).json({ error: 'No usable AI model is available from the configured My AI backend.' });
    return;
  }

  let converted;
  try {
    converted = messages.map(convertMessage);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const heartbeat = setInterval(() => { if (!res.writableEnded) res.write(': keep-alive\n\n'); }, 15000);

  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: buildPrompt(body.systemInstruction, body.projectKnowledge, body.tone || 'balanced') }, ...converted],
        stream: true,
        enable_search: !!body.enableWebSearch,
        ...(body.thinkingLevel && body.thinkingLevel !== 'none' ? { thinking_level: body.thinkingLevel } : {}),
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const raw = await upstream.text().catch(() => '');
      let detail = raw.slice(0, 1500) || `My AI returned HTTP ${upstream.status}.`;
      try { const json = JSON.parse(raw); detail = json?.detail || json?.error?.message || json?.error || detail; } catch {}
      send(res, { type: 'error', error: String(detail), status: upstream.status });
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
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
        if (payload === '[DONE]') { send(res, { type: 'done', modelUsed: model }); continue; }
        try {
          const chunk: any = JSON.parse(payload);
          if (chunk?.error) { send(res, { type: 'error', error: chunk.error?.message || String(chunk.error) }); continue; }
          const text = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.text ?? '';
          if (text) send(res, { type: 'chunk', text });
        } catch {}
      }
    }
    buffer += decoder.decode();
    send(res, { type: 'done', modelUsed: model });
  } catch (error) {
    console.error('Moonex /api/chat failed:', error);
    send(res, { type: 'error', error: error instanceof Error ? error.message : String(error) });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
    // Prevent an in-memory bucket from growing without bound in long-lived runtimes.
    if (rateBuckets.size > 5000) rateBuckets.clear();
  }
}
