import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 300 };

type Message = { role?: string; content?: any; files?: Array<{ data?: string; mimeType?: string }> };

const apiBase = () => (process.env.MYAI_API_URL || '').replace(/\/$/, '');
const apiKey = () => process.env.MYAI_API_KEY || '';

function messageForMyAI(msg: Message) {
  const role = msg.role === 'assistant' || msg.role === 'model' ? 'assistant' : msg.role === 'system' ? 'system' : 'user';
  const files = Array.isArray(msg.files) ? msg.files : [];
  if (!files.length) return { role, content: typeof msg.content === 'string' && msg.content.trim() ? msg.content : ' ' };

  const parts: any[] = [];
  if (typeof msg.content === 'string' && msg.content.trim()) parts.push({ type: 'text', text: msg.content });
  for (const file of files) {
    if (!file.data || !file.mimeType) continue;
    const url = file.data.startsWith('data:') ? file.data : `data:${file.mimeType};base64,${file.data}`;
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return { role, content: parts.length ? parts : [{ type: 'text', text: ' ' }] };
}

function systemPrompt(systemInstruction: unknown, projectKnowledge: unknown, tone: string) {
  let prompt = 'You are My AI Model, an advanced, highly capable AI assistant. Always provide accurate, useful, well-structured answers using Markdown when appropriate.';
  if (tone === 'concise') prompt += ' Be exceptionally direct and concise.';
  if (tone === 'explanatory') prompt += ' Give detailed, step-by-step educational explanations.';
  if (tone === 'creative') prompt += ' Be expressive and imaginative while remaining accurate.';
  if (tone === 'technical') prompt += ' Be rigorous and technical, including edge cases and implementation details.';
  if (typeof systemInstruction === 'string' && systemInstruction.trim()) prompt += `\n\nCustom User Instructions:\n${systemInstruction.trim()}`;
  if (Array.isArray(projectKnowledge) && projectKnowledge.length) {
    prompt += '\n\n=== PROJECT KNOWLEDGE CONTEXT ===';
    for (const item of projectKnowledge as any[]) if (item?.name && item?.content) prompt += `\n\n--- ${item.name} ---\n${item.content}`;
    prompt += '\n=== END PROJECT KNOWLEDGE ===';
  }
  return prompt;
}

function send(res: VercelResponse, payload: Record<string, unknown>) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).setHeader('Allow', 'POST').json({ error: 'Method Not Allowed. Use POST /api/chat.' });
    return;
  }

  const base = apiBase();
  const key = apiKey();
  if (!base || !key) {
    res.status(500).json({ error: 'My AI backend is not configured. Set MYAI_API_URL and MYAI_API_KEY in Vercel.' });
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
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const requestedModel = body.model || 'gemini-3.7-flash';
    const resolvedModel = requestedModel === 'gemini-3.7-flash-thinking' ? 'gemini-3.7-flash' : requestedModel;
    const thinkingLevel = body.thinkingLevel === 'none' ? null : (body.thinkingLevel || null);

    const upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [{ role: 'system', content: systemPrompt(body.systemInstruction, body.projectKnowledge, body.tone || 'balanced') }, ...messages.map(messageForMyAI)],
        stream: true,
        enable_search: !!body.enableWebSearch,
        thinking_level: thinkingLevel,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const raw = await upstream.text().catch(() => '');
      let detail = raw.slice(0, 1000) || `My AI returned HTTP ${upstream.status}.`;
      try { const parsed = JSON.parse(raw); detail = parsed?.detail || parsed?.error?.message || detail; } catch {}
      const message = upstream.status === 401 || upstream.status === 403 ? 'My AI authentication failed. Check MYAI_API_KEY.'
        : upstream.status === 404 ? 'My AI endpoint was not found. MYAI_API_URL must end at /v1, not /chat/completions.'
        : upstream.status === 429 ? 'My AI is rate-limiting this request. Please try again shortly.'
        : upstream.status === 503 ? 'The AI service is temporarily busy. Please try again shortly.' : detail;
      send(res, { type: 'error', error: message, status: upstream.status });
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let modelUsed = resolvedModel;
    let groundingSources: any[] = [];

    const process = (line: string) => {
      if (!line.startsWith('data:')) return false;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') return false;
      let chunk: any;
      try { chunk = JSON.parse(payload); } catch { return false; }
      if (chunk.error) { send(res, { type: 'error', error: chunk.error.message || 'Upstream AI error.' }); return true; }
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) { fullText += text; send(res, { type: 'chunk', text }); }
      if (chunk.model) modelUsed = chunk.model;
      if (Array.isArray(chunk.x_unified_api?.grounding_sources)) groundingSources = chunk.x_unified_api.grounding_sources;
      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) if (process(line)) { await reader.cancel(); return; }
    }
    buffer += decoder.decode();
    if (buffer.trim()) process(buffer.trim());
    send(res, { type: 'done', fullText, groundingSources, modelUsed });
  } catch (error: any) {
    console.error('POST /api/chat failed:', error);
    send(res, { type: 'error', error: error?.message || 'Unexpected error while contacting My AI.' });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
}
