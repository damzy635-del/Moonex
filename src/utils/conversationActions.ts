import type { Message } from '../types';

export type ConversationMutation = {
  messages: Message[];
  targetMessage?: Message;
};

/**
 * Build the exact message prefix and replacement turn used by an edit.
 * The caller can pass this result directly into the send path, avoiding
 * dependence on React state settling after setConversations().
 */
export function prepareMessageEdit(
  messages: Message[],
  messageId: string,
  newContent: string,
): ConversationMutation | null {
  const index = messages.findIndex((message) => message.id === messageId);
  if (index < 0) return null;

  const targetMessage = messages[index];
  if (targetMessage.role !== 'user') return null;
  if (!newContent.trim()) return null;

  return {
    messages: messages.slice(0, index),
    targetMessage: {
      ...targetMessage,
      content: newContent,
    },
  };
}

/**
 * Build the exact prefix and user turn used to regenerate the latest request.
 * Regeneration is only valid when the latest user turn already has an
 * assistant response after it. The existing response is excluded so the
 * send path cannot replay or duplicate it.
 */
export function prepareMessageRegeneration(messages: Message[]): ConversationMutation | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'user') continue;

    const hasAssistantResponse = messages
      .slice(index + 1)
      .some((item) => item.role === 'assistant');
    if (!hasAssistantResponse) return null;

    return {
      messages: messages.slice(0, index),
      targetMessage: message,
    };
  }

  return null;
}
