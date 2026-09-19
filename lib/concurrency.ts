const DEFAULT_MAX_CONCURRENT = 8;

function configuredLimit(): number {
  const value = Number(process.env.MOONEX_MAX_CONCURRENT);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_CONCURRENT;
  return Math.max(1, Math.min(64, Math.floor(value)));
}

let activeRequests = 0;

export function concurrencyState() {
  return { active: activeRequests, limit: configuredLimit() };
}

export function tryAcquireConcurrency(): boolean {
  const limit = configuredLimit();
  if (activeRequests >= limit) return false;
  activeRequests += 1;
  return true;
}

export function releaseConcurrency(): void {
  activeRequests = Math.max(0, activeRequests - 1);
}

export function clearConcurrency(): void {
  activeRequests = 0;
}
