import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 300 };

type Msg = { role?: string; content?: any; files?: Array<{ data?: string; mimeType?: string }> };

const baseUrl = () => (process.env.MYAI_API_URL || '').replace(/\/$/, '');
const key = () => process.env.MYAI_API_KEY || '';

function convertMessage(m: Msg) {
  const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : m.role === 'system' ? 'system' : 'user';
  const files = Array.isArray(m.files) ? m.files : [];
  if (!files.length) return { role, content: typeof m.content === 'string' && m.content.trim() ? m.content : ' ' };
  const parts: any[] = [];
  if (typeof m.content === 'string' && m.content.trim()) parts.push({ type: 'text', text: m.content });
  for (const f of files) {
    if (!f?.data || !f?.mimeType) continue;
    const url = f.data.startsWith('data:') ? f.data : `data:${f.mimeType};base64,${f.data}`;
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return { role, content: parts.length ? parts : [{ type: 'text', text: ' ' }] };
}

function prompt(instruction: unknown, knowledge: unknown, tone: string) {
  let p = 'You are My AI Model, an advanced, highly capable AI assistant. Always provide accurate, useful, well-structured answers using Markdown when appropriate.';
  if (tone === 'concise') p += ' Be exceptionally direct and concise.';
  if (tone === 'explanatory') p += ' Give detailed, step-by-step educational explanations.';
  if (tone === 'creative') p += ' Be expressive and imaginative while remaining accurate.';
  if (tone === 'technical') p += ' Be rigorous and technical, including edge cases and implementation details.';
  if (typeof instruction === 'string' && instruction.trim()) p += `\n\nCustom User Instructions:\n${instruction.trim()}`;
  if (Array.isArray(knowledge) && knowledge.length) {
    p += '\n\n=== PROJECT KNOWLEDGE CONTEXT ===';
    for (const x of knowledge as any[]) if (x?.name && x?.content) p += `\n\n--- ${x.name} ---\n${x.content}`;
    p += '\n=== END PROJECT KNOWLEDGE ===';
  }
  return p;
}

function sse(res: VercelResponse, data: unknown) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function liveModelIds(base: string, token: string): Promise<string[]> {
  const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!r.ok) return [];
  const j: any = await r.json();
  const list = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.models) ? j.models : [];
  return list.map((x: any) => typeof x === 'string' ? x : x?.id).filter((x: any): x is string => typeof x === 'string' && !!x.trim());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).setHeader('Allow', 'POST').json({ error: 'Method Not Allowed. Use POST /api/chat.' });
    return;
  }

  const base = baseUrl();
  const token = key();
  if (!base || !token) {
    res.status(500).json({ error: 'My AI backend is not configured. Set MYAI_API_URL and MYAI_API_KEY in Vercel.' });
    return;
  }

  const body: any = req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const requested = typeof body.model === 'string' ? body.model.trim() : '';
  let ids: string[] = [];
  try { ids = await liveModelIds(base, token); } catch (e) { console.warn('Model catalog lookup failed:', e); }
  const model = requested && ids.includes(requested) ? requested : ids[0] || requested;

  if (!model) {
    res.status(503).json({ error: 'No usable model is available from My AI.' });
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
        messages: [{ role: 'system', content: prompt(body.systemInstruction, body.projectKnowledge, body.tone || 'balanced') }, ...messages.map(convertMessage)],
        stream: true,
        enable_search: !!body.enableWebSearch,
        ...(body.thinkingLevel && body.thinkingLevel !== 'none' ? { thinking_level: body.thinkingLevel } : {}),
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const raw = await upstream.text().catch(() => '');
      let detail = raw.slice(0, 1500) || `My AI returned HTTP ${upstream.status}.`;
      try { const j = JSON.parse(raw); detail = j?.detail || j?.error?.message || j?.error || detail; } catch {}
      sse(res, { type: 'error', error: String(detail), status: upstream.status });
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
        const raw = line.slice(5).trim();
        if (!raw) continue;
        if (raw === '[DONE]') { sse(res, { type: 'done' }); continue; }
        try {
          const chunk: any = JSON.parse(raw);
          const text = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.text ?? '';
          if (text) sse(res, { type: 'chunk', text });
          if (chunk?.error) sse(res, { type: 'error', error: chunk.error?.message || String(chunk.error) });
        } catch { /* ignore non-JSON SSE lines */ }
      }
    }
    if (buffer.startsWith('data:')) {
      const raw = buffer.slice(5).trim();
      if (raw && raw !== '[DONE]') { try { const j: any = JSON.parse(raw); const text = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.text ?? ''; if (text) sse(res, { type: 'chunk', text }); } catch {} }
    }
    sse(res, { type: 'done' });
  } catch (e) {
    sse(res, { type: 'error', error: e instanceof Error ? e.message : String(e) });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
}
