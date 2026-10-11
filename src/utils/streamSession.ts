export type StreamSessionState = 'active' | 'aborted' | 'completed';

export type StreamSession = {
  id: number;
  controller: AbortController;
  get state(): StreamSessionState;
  isActive(): boolean;
  abort(): boolean;
  complete(): boolean;
};

/**
 * Owns one streaming request and gives callers a stable session identity.
 * A session can transition only once, which prevents stale stream callbacks
 * from committing UI state after cancellation or completion.
 */
export function createStreamSession(previousId = 0): StreamSession {
  const id = previousId + 1;
  const controller = new AbortController();
  let state: StreamSessionState = 'active';

  return {
    id,
    controller,
    get state() {
      return state;
    },
    isActive() {
      return state === 'active' && !controller.signal.aborted;
    },
    abort() {
      if (state !== 'active') return false;
      state = 'aborted';
      controller.abort();
      return true;
    },
    complete() {
      if (state !== 'active') return false;
      state = 'completed';
      return true;
    },
  };
}

/**
 * Returns true only when a stream is still allowed to publish UI state.
 * Call this before applying chunks, route metadata, or final results.
 */
export function canPublishStream(session: StreamSession, currentId: number): boolean {
  return session.id === currentId && session.isActive();
}
