const CHARS_PER_TOKEN = 4;

function estimateTokens(value) {
  if (typeof value === 'string') return Math.ceil(value.length / CHARS_PER_TOKEN);
  try {
    return Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN);
  } catch {
    return 0;
  }
}

export function fitConversationContext(messages, options) {
  const maxInputTokens = Math.max(1, Math.floor(options?.maxInputTokens || 1));
  const reservedOutputTokens = Math.max(0, Math.floor(options?.reservedOutputTokens || 0));
  const budget = Math.max(1, maxInputTokens - reservedOutputTokens);
  const systemMessages = Array.isArray(options?.systemMessages) ? options.systemMessages : [];
  const conversation = Array.isArray(messages) ? messages : [];

  const systemTokens = systemMessages.reduce((sum, message) => sum + estimateTokens(message), 0);
  const available = Math.max(1, budget - systemTokens);

  const selected = [];
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
