export const AUTO_PROFILE_IDS = [
  "moonex-lite-1.5", "moonex-fast-1.5", "moonex-pro-1.5",
  "moonex-pro-max-1.5", "moonex-ultra-1.5", "moonex-reasoning-1.5",
  "moonex-code-1.5", "moonex-research-1.5", "moonex-vision-1.5",
] as const;

export type AutoProfileId = typeof AUTO_PROFILE_IDS[number];
export type RoutingInput = { prompt: string; history?: { role: "user" | "assistant"; content: string }[]; hasImages?: boolean };

const patterns = {
  research: /\b(research|latest|current|today|this week|recent|202[5-9]|sources?|citations?|verify online|look up|news|statistics|market data|compare prices)\b/i,
  code: /\b(code|coding|program|programming|debug|bug|stack trace|typescript|javascript|python|react|sql|api|database|github|deploy|compiler|refactor|function|class|component|regex)\b/i,
  reasoning: /\b(prove|proof|derive|derivation|solve|equation|calculate|mathematical|logic|logical|algorithm|step by step|complex problem|theorem)\b/i,
  deep: /\b(comprehensive|in-depth|deep dive|detailed analysis|architecture|strategy|technical design|long-form|evaluate trade-offs)\b/i,
  quick: /\b(quickly|quick answer|tl;dr|in one sentence|briefly|just the answer|short answer)\b/i,
};

export function resolveAutoProfile(input: RoutingInput): AutoProfileId {
  if (input.hasImages) return "moonex-vision-1.5";
  const prompt = input.prompt.trim();
  if (patterns.research.test(prompt)) return "moonex-research-1.5";
  if (patterns.code.test(prompt)) return "moonex-code-1.5";
  if (patterns.reasoning.test(prompt)) return "moonex-reasoning-1.5";
  if (patterns.deep.test(prompt) || prompt.length > 1800) return "moonex-pro-max-1.5";
  if (patterns.quick.test(prompt) || (prompt.length < 90 && prompt.split(/\s+/).length < 16)) return "moonex-fast-1.5";
  if (prompt.length > 900) return "moonex-ultra-1.5";
  return "moonex-pro-1.5";
}
