import type { Conversation } from '../types';
import { DEFAULT_MOONEX_MODEL_ID, normalizeMoonexModelId } from '../../lib/moonex-models';

const DEFAULT_MODEL = DEFAULT_MOONEX_MODEL_ID;

/**
 * Normalize a conversation before it crosses a persistence boundary.
 * This keeps legacy/provider model identifiers from leaking back into the UI.
 */
export function normalizePersistedConversation(conversation: Conversation): Conversation {
  const model = normalizeMoonexModelId(conversation.model, DEFAULT_MODEL);
  return {
    ...conversation,
    model,
    messages: Array.isArray(conversation.messages)
      ? conversation.messages.map((message) => ({
          ...message,
          modelUsed:
            message.role === 'assistant'
              ? normalizeMoonexModelId(message.modelUsed, model)
              : message.modelUsed,
        }))
      : [],
  };
}

/**
 * Merge local and cloud snapshots by conversation id.
 * The newest updatedAt wins, making sync deterministic across devices and
 * preserving local work when the cloud copy is stale.
 */
export function mergePersistedConversations(
  localConversations: Conversation[],
  cloudConversations: Conversation[],
): Conversation[] {
  const byId = new Map<string, Conversation>();

  for (const conversation of [...localConversations, ...cloudConversations]) {
    if (!conversation?.id) continue;
    const normalized = normalizePersistedConversation(conversation);
    const existing = byId.get(normalized.id);
    if (!existing || normalized.updatedAt > existing.updatedAt) {
      byId.set(normalized.id, normalized);
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
    return b.createdAt - a.createdAt;
  });
}

export function shouldPersistConversation(
  previous: Conversation | undefined,
  next: Conversation,
): boolean {
  if (!previous) return true;
  return next.updatedAt > previous.updatedAt;
}
