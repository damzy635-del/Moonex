export type MoonexTelemetryEvent = {
  event: string;
  durationMs?: number;
  provider?: string;
  model?: string;
  moonexModel?: string;
  status?: number;
  reason?: string;
  retryable?: boolean;
  fallbackCount?: number;
  confidence?: number;
  qualityScore?: number;
  healthScore?: number;
  latencyScore?: number;
  candidateCount?: number;
};

const SAFE_PROVIDER_NAMES = new Set(['openai', 'google', 'mistral', 'groq']);

function cleanProvider(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return SAFE_PROVIDER_NAMES.has(normalized) ? normalized : undefined;
}

function cleanModel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || /[\r\n]/.test(normalized)) return undefined;
  return normalized;
}

function cleanScore(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Number(value.toFixed(2)))) : undefined;
}

export function createMoonexTelemetryEvent(input: MoonexTelemetryEvent): MoonexTelemetryEvent {
  return {
    event: String(input.event).slice(0, 80),
    ...(Number.isFinite(input.durationMs) ? { durationMs: Math.max(0, Math.floor(input.durationMs!)) } : {}),
    ...(cleanProvider(input.provider) ? { provider: cleanProvider(input.provider) } : {}),
    ...(cleanModel(input.model) ? { model: cleanModel(input.model) } : {}),
    ...(cleanModel(input.moonexModel) ? { moonexModel: cleanModel(input.moonexModel) } : {}),
    ...(Number.isInteger(input.status) ? { status: input.status } : {}),
    ...(typeof input.reason === 'string' ? { reason: input.reason.slice(0, 120) } : {}),
    ...(typeof input.retryable === 'boolean' ? { retryable: input.retryable } : {}),
    ...(Number.isInteger(input.fallbackCount) ? { fallbackCount: Math.max(0, input.fallbackCount!) } : {}),
    ...(typeof input.confidence === 'number' && Number.isFinite(input.confidence) ? { confidence: Math.max(0, Math.min(1, input.confidence)) } : {}),
    ...(cleanScore(input.qualityScore) !== undefined ? { qualityScore: cleanScore(input.qualityScore) } : {}),
    ...(cleanScore(input.healthScore) !== undefined ? { healthScore: cleanScore(input.healthScore) } : {}),
    ...(cleanScore(input.latencyScore) !== undefined ? { latencyScore: cleanScore(input.latencyScore) } : {}),
    ...(Number.isInteger(input.candidateCount) ? { candidateCount: Math.max(0, input.candidateCount!) } : {}),
  };
}

export function logMoonexTelemetry(input: MoonexTelemetryEvent): void {
  const event = createMoonexTelemetryEvent(input);
  console.info('[moonex.telemetry]', JSON.stringify(event));
}
