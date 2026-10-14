const profileEnvironmentVariables: Record<string, string> = {
  "moonex-lite-1.5": "GEMINI_MODEL_LITE",
  "moonex-fast-1.5": "GEMINI_MODEL_FAST",
  "moonex-pro-1.5": "GEMINI_MODEL_PRO",
  "moonex-pro-max-1.5": "GEMINI_MODEL_PRO_MAX",
  "moonex-ultra-1.5": "GEMINI_MODEL_ULTRA",
  "moonex-reasoning-1.5": "GEMINI_MODEL_REASONING",
  "moonex-code-1.5": "GEMINI_MODEL_CODE",
  "moonex-research-1.5": "GEMINI_MODEL_RESEARCH",
};

export type TextModelProfile = keyof typeof profileEnvironmentVariables;

export function resolveGeminiModel(
  profile: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const profileVariable = profileEnvironmentVariables[profile];
  const configuredProfileModel = profileVariable ? env[profileVariable]?.trim() : "";
  const defaultModel = env.GEMINI_MODEL?.trim();
  return configuredProfileModel || defaultModel || "gemini-3.1-flash-lite";
}
