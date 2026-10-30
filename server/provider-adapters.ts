export type ProviderId = "google" | "openai" | "mistral" | "groq";
export type MoonexProfile =
  | "moonex-lite-1.5" | "moonex-fast-1.5" | "moonex-pro-1.5"
  | "moonex-pro-max-1.5" | "moonex-ultra-1.5" | "moonex-reasoning-1.5"
  | "moonex-code-1.5" | "moonex-vision-1.5" | "moonex-research-1.5";
export type ProviderMessage = { role: "user" | "assistant"; content: string };
export type ProviderRequest = {
  profile: MoonexProfile;
  messages: ProviderMessage[];
  systemPrompt: string;
  images?: Array<{ mimeType: string; data: string }>;
  signal: AbortSignal;
};
export type ProviderCandidate = { id: ProviderId; model: string; key: string };

const providers: Record<ProviderId, {
  key: string; baseUrl: string; defaultModels: Record<MoonexProfile, string>;
  vision: boolean;
}> = {
  google: {
    key: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    vision: true,
    defaultModels: {
      "moonex-lite-1.5":"gemini-2.5-flash-lite","moonex-fast-1.5":"gemini-2.5-flash-lite",
      "moonex-pro-1.5":"gemini-2.5-flash","moonex-pro-max-1.5":"gemini-2.5-pro",
      "moonex-ultra-1.5":"gemini-2.5-pro","moonex-reasoning-1.5":"gemini-2.5-pro",
      "moonex-code-1.5":"gemini-2.5-flash","moonex-vision-1.5":"gemini-2.5-flash",
      "moonex-research-1.5":"gemini-2.5-flash",
    },
  },
  openai: {
    key: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1", vision: true,
    defaultModels: {
      "moonex-lite-1.5":"gpt-4.1-nano","moonex-fast-1.5":"gpt-4.1-mini",
      "moonex-pro-1.5":"gpt-4.1","moonex-pro-max-1.5":"gpt-4.1",
      "moonex-ultra-1.5":"o3","moonex-reasoning-1.5":"o3",
      "moonex-code-1.5":"gpt-4.1","moonex-vision-1.5":"gpt-4.1-mini",
      "moonex-research-1.5":"gpt-4.1",
    },
  },
  mistral: {
    key: "MISTRAL_API_KEY", baseUrl: "https://api.mistral.ai/v1", vision: false,
    defaultModels: {
      "moonex-lite-1.5":"ministral-3b-latest","moonex-fast-1.5":"ministral-8b-latest",
      "moonex-pro-1.5":"mistral-small-latest","moonex-pro-max-1.5":"mistral-large-latest",
      "moonex-ultra-1.5":"mistral-large-latest","moonex-reasoning-1.5":"magistral-medium-latest",
      "moonex-code-1.5":"codestral-latest","moonex-vision-1.5":"",
      "moonex-research-1.5":"mistral-small-latest",
    },
  },
  groq: {
    key: "GROQ_API_KEY", baseUrl: "https://api.groq.com/openai/v1", vision: false,
    defaultModels: {
      "moonex-lite-1.5":"llama-3.1-8b-instant","moonex-fast-1.5":"llama-3.3-70b-versatile",
      "moonex-pro-1.5":"llama-3.3-70b-versatile","moonex-pro-max-1.5":"llama-3.3-70b-versatile",
      "moonex-ultra-1.5":"llama-3.3-70b-versatile","moonex-reasoning-1.5":"deepseek-r1-distill-llama-70b",
      "moonex-code-1.5":"llama-3.3-70b-versatile","moonex-vision-1.5":"",
      "moonex-research-1.5":"llama-3.3-70b-versatile",
    },
  },
};

const legacyGeminiEnv: Partial<Record<MoonexProfile, string>> = {
  "moonex-lite-1.5":"GEMINI_MODEL_LITE","moonex-fast-1.5":"GEMINI_MODEL_FAST",
  "moonex-pro-1.5":"GEMINI_MODEL_PRO","moonex-pro-max-1.5":"GEMINI_MODEL_PRO_MAX",
  "moonex-ultra-1.5":"GEMINI_MODEL_ULTRA","moonex-reasoning-1.5":"GEMINI_MODEL_REASONING",
  "moonex-code-1.5":"GEMINI_MODEL_CODE","moonex-vision-1.5":"GEMINI_MODEL_VISION",
  "moonex-research-1.5":"GEMINI_MODEL_RESEARCH",
};

export function getProviderCandidates(
  profile: MoonexProfile,
  env: Record<string, string | undefined> = process.env,
): ProviderCandidate[] {
  const configuredOrder = (env.MOONEX_PROVIDER_PRIORITY ?? "google,openai,mistral,groq")
    .split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  const order = [...new Set(configuredOrder)].filter((id): id is ProviderId =>
    id === "google" || id === "openai" || id === "mistral" || id === "groq");
  // Include any omitted supported providers after the explicit priority list.
  for (const id of ["google","openai","mistral","groq"] as ProviderId[]) if (!order.includes(id)) order.push(id);
  return order.flatMap((id) => {
    const config = providers[id];
    const key = env[config.key]?.trim();
    if (!key || (profile === "moonex-vision-1.5" && !config.vision)) return [];
    const profileOverride = env[`MOONEX_${id.toUpperCase()}_MODEL_${profile.replaceAll("-", "_").toUpperCase()}"]?.trim();
    const legacyOverride = id === "google" ? env[legacyGeminiEnv[profile] ?? ""]?.trim() : "";
    const genericOverride = id === "google" ? env.GEMINI_MODEL?.trim() : "";
    const model = profileOverride || legacyOverride || genericOverride || config.defaultModels[profile];
    return model ? [{ id, model, key }] : [];
  });
}

export async function requestProvider(
  candidate: ProviderCandidate,
  request: ProviderRequest,
): Promise<Response> {
  const config = providers[candidate.id];
  if (candidate.id === "google") {
    const contents = request.messages.map((message, index) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: index === request.messages.length - 1 && request.images?.length
        ? [
            { text: message.content },
            ...request.images.map((image) => ({ inline_data: { mime_type: image.mimeType, data: image.data } })),
          ]
        : [{ text: message.content }],
    }));
    return fetch(config.baseUrl + "/models/" + encodeURIComponent(candidate.model) + ":streamGenerateContent?alt=sse", {
      method: "POST", headers: { "Content-Type":"application/json", "x-goog-api-key":candidate.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents, generationConfig: { maxOutputTokens: 2048 },
      }), signal: request.signal,
    });
  }

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: request.systemPrompt },
    ...request.messages.map((message, index) => ({
      role: message.role,
      content: index === request.messages.length - 1 && request.images?.length
        ? [
            { type:"text", text:message.content },
            ...request.images.map((image) => ({
              type:"image_url",
              image_url:{ url:"data:" + image.mimeType + ";base64," + image.data },
            })),
          ]
        : message.content,
    })),
  ];
  return fetch(config.baseUrl + "/chat/completions", {
    method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:"Bearer " + candidate.key },
    body:JSON.stringify({ model:candidate.model, messages, stream:true, max_tokens:2048 }),
    signal:request.signal,
  });
}

export async function readProviderStream(
  response: Response,
  provider: ProviderId,
  onText: (text: string) => void,
): Promise<void> {
  if (!response.body) throw new Error("Provider returned an empty stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const parseLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const event = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string | Array<{ type?: string; text?: string }> } }>;
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      let text = "";
      if (provider === "google") {
        text = event.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      } else {
        const content = event.choices?.[0]?.delta?.content;
        text = typeof content === "string" ? content
          : Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : "";
      }
      if (text) onText(text);
    } catch {
      // Malformed or provider-specific non-text frames are ignored.
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream:true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) parseLine(line);
    }
    buffer += decoder.decode();
    if (buffer.trim()) parseLine(buffer);
  } finally {
    reader.releaseLock();
  }
}
