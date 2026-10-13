export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

type RedisResponse = { result?: unknown; error?: string };

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Shared rate limiting is unavailable");
    this.name = "RateLimitUnavailableError";
  }
}

/**
 * Atomic fixed-window limiter backed by Upstash Redis REST.
 * Redis EVAL makes increment + expiry one operation across all app instances.
 */
export class UpstashRateLimiter {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly limit = 10,
    private readonly windowSeconds = 60,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!url || !token) throw new Error("Upstash Redis URL and token are required");
    if (!Number.isInteger(limit) || limit < 1) throw new Error("limit must be a positive integer");
    if (!Number.isInteger(windowSeconds) || windowSeconds < 1) throw new Error("windowSeconds must be a positive integer");
  }

  async consume(userId: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<RateLimitResult> {
    if (!userId.trim()) throw new Error("userId must not be empty");
    const window = Math.floor(nowSeconds / this.windowSeconds);
    const key = `moonex:chat:rate:${userId}:${window}`;
    const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
    let response: Response;
    try {
      response = await this.fetcher(this.url.replace(/\/$/, "") + "/pipeline", {
        method: "POST",
        headers: { Authorization: "Bearer " + this.token, "Content-Type": "application/json" },
        body: JSON.stringify([["EVAL", script, "1", key, String(this.windowSeconds + 2)]]),
        signal: AbortSignal.timeout(2_500),
      });
    } catch {
      throw new RateLimitUnavailableError();
    }
    if (!response.ok) throw new RateLimitUnavailableError();
    let payload: RedisResponse[];
    try {
      payload = await response.json() as RedisResponse[];
    } catch {
      throw new RateLimitUnavailableError();
    }
    const count = Number(payload?.[0]?.result);
    if (!Number.isSafeInteger(count) || count < 1 || payload?.[0]?.error) {
      throw new RateLimitUnavailableError();
    }
    const allowed = count <= this.limit;
    return {
      allowed,
      remaining: Math.max(0, this.limit - count),
      retryAfterSeconds: allowed ? 0 : Math.max(1, this.windowSeconds - (nowSeconds % this.windowSeconds)),
    };
  }
}

export function createChatRateLimiter(env: NodeJS.ProcessEnv = process.env): UpstashRateLimiter | null {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new UpstashRateLimiter(url, token, 10, 60);
}
