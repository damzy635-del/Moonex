export const config = { maxDuration: 300 };

type Msg = {
  role?: string;
  content?: unknown;
  files?: Array<{ data?: string; mimeType?: string }>;
};

const baseUrl = () => (process.env.MYAI_API_URL || '').replace(/\/$/, '');
const apiKey = () => process.env.MYAI_API_KEY || '';

function convertMessage(m: Msg) {
  const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : m.role === 'system' ? 'system' : 'user';
  const files = Array.isArray(m.files) ? m.files : [];
  const text = typeof m.content === 'string' ? m.content : '';
  if (!files.length) return { role, content: text.trim() || ' ' };

  const parts: any[] = [];
  if (text.trim()) parts.push({ type: 'text', text });
  for (const file of files) {
    if (!file?.data || !file?.mimeType) continue;
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
  if (typeof instruction === 'string' && instruction.trim()) prompt += `\n\nCustom User Instructions:\n${instruction.trim()}`;
  if (Array.isArray(knowledge) && knowledge.length) {
    prompt += '\n\n=== PROJECT KNOWLEDGE CONTEXT ===';
    for (const item of knowledge as any[]) if (item?.name && item?.content) prompt += `\n\n--- ${item.name} ---\n${item.content}`;
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
  return list
    .map((item: any) => typeof item === 'string' ? item : item?.id)
    .filter((id: unknown): id is string => typeof id === 'string' && !!id.trim());
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST /api/chat.' });
    return;
  }

  const base = baseUrl();
  const token = apiKey();
  if (!base || !token) {
    res.status(500).json({ error: 'Moonex AI backend is not configured. Set MYAI_API_URL and MYAI_API_KEY in Vercel.' });
    return;
  }

  const body = req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const requested = typeof body.model === 'string' ? body.model.trim() : '';
  let ids: string[] = [];
  try { ids = await liveModelIds(base, token); } catch (error) { console.warn('Moonex model catalog lookup failed:', error); }
  const model = requested && ids.includes(requested) ? requested : ids[0] || requested;

  if (!model) {
    res.status(503).json({ error: 'No usable AI model is available from the configured My AI backend.' });
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': keep-alive\n\n');
  }, 15000);

  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildPrompt(body.systemInstruction, body.projectKnowledge, body.tone || 'balanced') },
          ...messages.map(convertMessage),
        ],
        stream: true,
        enable_search: !!body.enableWebSearch,
        ...(body.thinkingLevel && body.thinkingLevel !== 'none' ? { thinking_level: body.thinkingLevel } : {}),
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const raw = await upstream.text().catch(() => '');
      let detail = raw.slice(0, 1500) || `My AI returned HTTP ${upstream.status}.`;
      try {
        const json = JSON.parse(raw);
        detail = json?.detail || json?.error?.message || json?.error || detail;
      } catch {}
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
        if (payload === '[DONE]') {
          send(res, { type: 'done', modelUsed: model });
          continue;
        }
        try {
          const chunk: any = JSON.parse(payload);
          if (chunk?.error) {
            send(res, { type: 'error', error: chunk.error?.message || String(chunk.error) });
            continue;
          }
          const text = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.text ?? '';
          if (text) send(res, { type: 'chunk', text });
        } catch {
          // Ignore non-JSON SSE comments/metadata.
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.startsWith('data:')) {
      const payload = buffer.slice(5).trim();
      if (payload && payload !== '[DONE]') {
        try {
          const chunk: any = JSON.parse(payload);
          const text = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.text ?? '';
          if (text) send(res, { type: 'chunk', text });
        } catch {}
      }
    }

    send(res, { type: 'done', modelUsed: model });
  } catch (error) {
    console.error('Moonex /api/chat failed:', error);
    send(res, { type: 'error', error: error instanceof Error ? error.message : String(error) });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
}
