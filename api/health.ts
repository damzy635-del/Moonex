import { rankProviderModels, resolveMoonexProfile } from '../lib/moonex-models.js';
import { logMoonexTelemetry } from '../lib/telemetry.js';

export const config = { maxDuration: 10 };
const baseUrl = () => (process.env.MYAI_API_URL || '').replace(/\/$/, '');
const apiKey = () => process.env.MYAI_API_KEY || '';
function providerName(model: any): string {
  const value = model?.provider || model?.provider_name || model?.providerName || model?.owned_by || model?.owner;
  return typeof value === 'string' && value.trim() ? value.trim() : 'unknown';
}
async function fetchCatalog(base: string, token: string) {
  const started = Date.now();
  const response = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(7_500) });
  const latencyMs = Date.now() - started;
  if (!response.ok) throw new Error(`Model catalog returned HTTP ${response.status}.`);
  const json: any = await response.json();
  const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? Object.values(json.models) : [];
  return { latencyMs, models: list.filter((item: any) => item && item.id).map((item: any) => ({ ...item, id: String(item.id) })) };
}
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') { res.status(405).json({ status: 'error', error: 'Method not allowed. Use GET /api/health.' }); return; }
  const base = baseUrl(); const token = apiKey();
  if (!base || !token) { res.status(503).json({ status: 'degraded', code: 'BACKEND_NOT_CONFIGURED' }); return; }
  const requestStarted = Date.now();
  try {
    const catalog = await fetchCatalog(base, token); const models = catalog.models;
    const providers = [...new Set(models.map(providerName).filter((name: string) => name !== 'unknown'))];
    const profiles = ['moonex-lite-1.5','moonex-fast-1.5','moonex-pro-1.5','moonex-pro-max-1.5','moonex-ultra-1.5','moonex-reasoning-1.5','moonex-code-1.5','moonex-vision-1.5','moonex-research-1.5'];
    const profileCoverage = profiles.map((id) => { const profile = resolveMoonexProfile(id, { messages: [], enableWebSearch: id === 'moonex-research-1.5', thinkingLevel: 'none' }); return { id: profile.id, name: profile.name, eligibleModels: rankProviderModels(profile, models).length }; });
    const healthy = models.length > 0 && providers.length === 4 && profileCoverage.every((item) => item.eligibleModels > 0);
    logMoonexTelemetry({ event: 'health_check', durationMs: Date.now() - requestStarted, status: healthy ? 200 : 503, fallbackCount: 0 });
    res.setHeader('Cache-Control', 'no-store');
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', service: 'moonex', catalogLatencyMs: catalog.latencyMs, modelCount: models.length, providers, expectedProviderCount: 4, expectedProfileCount: 9, profileCoverage, timestamp: new Date().toISOString() });
  } catch (error: any) {
    logMoonexTelemetry({ event: 'health_check_failed', durationMs: Date.now() - requestStarted, status: 503, reason: 'MODEL_CATALOG_UNAVAILABLE', retryable: true });
    res.status(503).json({ status: 'degraded', service: 'moonex', code: 'MODEL_CATALOG_UNAVAILABLE', error: error?.message || 'Unable to reach the Moonex model backend.', timestamp: new Date().toISOString() });
  }
}
