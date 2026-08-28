import { MOONEX_MODELS, resolveProviderModel, type ProviderModel } from '../lib/moonex-models';

export const config = { maxDuration: 20 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET /api/models.' });
    return;
  }

  const base = (process.env.MYAI_API_URL || '').replace(/\/$/, '');
  const token = process.env.MYAI_API_KEY || '';
  if (!base || !token) {
    res.status(500).json({ error: 'Moonex AI backend is not configured.' });
    return;
  }

  try {
    const upstream = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const raw = await upstream.text();
    let payload: any = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { raw: raw.slice(0, 1000) }; }

    if (!upstream.ok) {
      const detail = payload?.detail || payload?.error?.message || payload?.error || `My AI returned HTTP ${upstream.status}.`;
      res.status(upstream.status).json({ error: String(detail) });
      return;
    }

    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
    const providers: ProviderModel[] = list
      .map((item: any) => typeof item === 'string' ? { id: item } : item?.id ? { ...item, id: String(item.id) } : null)
      .filter(Boolean);

    // Expose Moonex product names, not raw provider model IDs.
    const models = MOONEX_MODELS.map((profile) => {
      const provider = resolveProviderModel(profile, providers);
      return {
        id: profile.id,
        name: profile.name,
        description: profile.description,
        temperature: profile.temperature,
        maxTokens: profile.maxTokens,
        available: !!provider,
      };
    }).filter((model) => model.available);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ models, defaultModel: models[0]?.id || null });
  } catch (error) {
    console.error('Moonex /api/models failed:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
