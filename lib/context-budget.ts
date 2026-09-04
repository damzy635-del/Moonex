export type ContextMessage = {
  role?: string;
  content?: unknown;
  [key: string]: unknown;
};

export type ContextBudgetOptions = {
  maxInputTokens: number;
  reservedOutputTokens?: number;
  systemMessages?: ContextMessage[];
};

export type ContextBudgetResult = {
  messages: ContextMessage[];
  estimatedInputTokens: number;
  truncated: boolean;
  droppedMessages: number;
};

const CHARS_PER_TOKEN = 4;

function estimateTokens(value: unknown): number {
  if (typeof value === 'string') return Math.ceil(value.length / CHARS_PER_TOKEN);
  try {
    return Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN);
  } catch {
    return 0;
  }
}

/**
 * Keeps the newest conversation turns within a deterministic token budget.
 * System messages are always preserved and are not counted as conversation turns.
 */
export function fitConversationContext(
  messages: ContextMessage[],
  options: ContextBudgetOptions,
): ContextBudgetResult {
  const maxInputTokens = Math.max(1, Math.floor(options.maxInputTokens));
  const reservedOutputTokens = Math.max(0, Math.floor(options.reservedOutputTokens || 0));
  const budget = Math.max(1, maxInputTokens - reservedOutputTokens);
  const systemMessages = Array.isArray(options.systemMessages) ? options.systemMessages : [];
  const conversation = Array.isArray(messages) ? messages : [];

  const systemTokens = systemMessages.reduce((sum, message) => sum + estimateTokens(message), 0);
  const available = Math.max(1, budget - systemTokens);

  const selected: ContextMessage[] = [];
  let used = 0;
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const message = conversation[index];
    const cost = estimateTokens(message);
    if (selected.length > 0 && used + cost > available) break;
    selected.unshift(message);
    used += cost;
  }

  return {
    messages: [...systemMessages, ...selected],
    estimatedInputTokens: systemTokens + used,
    truncated: selected.length < conversation.length,
    droppedMessages: conversation.length - selected.length,
  };
}
