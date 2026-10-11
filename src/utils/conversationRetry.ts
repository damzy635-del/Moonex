import type { Message } from '../types';

export type RetryMutation = {
  messages: Message[];
  targetMessage: Message;
};

/**
 * Build the exact conversation snapshot needed to retry a failed assistant
 * response. The latest user turn is retained as the request to resend, while
 * everything after it is removed so no orphan/failed assistant turn is sent.
 */
export function prepareMessageRetry(messages: Message[]): RetryMutation | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'user') continue;

    return {
      messages: messages.slice(0, index),
      targetMessage: message,
    };
  }

  return null;
}
