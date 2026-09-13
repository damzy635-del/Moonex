import type { StreamSession } from './streamSession';
import { canPublishStream } from './streamSession';

/**
 * Centralizes the two checks a streaming UI needs before publishing state:
 * the session must still be active and it must still be the current session.
 */
export function canPublishStreamState(session: StreamSession, currentSessionId: number): boolean {
  return canPublishStream(session, currentSessionId);
}

/**
 * Stop a stream without throwing when the request has already completed or
 * another stop action has already won the race.
 */
export function stopStream(session: StreamSession | null): boolean {
  if (!session) return false;
  return session.abort();
}

/**
 * Mark a stream complete only if it is still active. This makes completion
 * safe against late callbacks racing with cancellation.
 */
export function completeStream(session: StreamSession | null): boolean {
  if (!session) return false;
  return session.complete();
}
