import { createClient } from "@supabase/supabase-js";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type ApiResponse = {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  write(chunk: string): boolean;
  end(): void;
};

const enabledProfiles = new Set([
  "moonex-lite-1.5",
  "moonex-fast-1.5",
  "moonex-pro-1.5",
  "moonex-pro-max-1.5",
  "moonex-ultra-1.5",
  "moonex-reasoning-1.5",
  "moonex-code-1.5",
]);

const profileInstructions: Record<string, string> = {
  "moonex-lite-1.5": "Be concise, clear, and efficient. Prefer direct answers.",
  "moonex-fast-1.5": "Answer directly and efficiently. Avoid unnecessary preamble.",
  "moonex-pro-1.5": "Provide a balanced, helpful answer with enough detail to be actionable.",
  "moonex-pro-max-1.5": "Give a thorough, structured answer. Explain important trade-offs and assumptions.",
  "moonex-ultra-1.5": "Prioritize depth, precision, completeness, and well-organized reasoning.",
  "moonex-reasoning-1.5": "Work carefully through complex problems and make the conclusion and key reasoning clear. Do not claim hidden chain-of-thought.",
  "moonex-code-1.5": "Act as a senior software engineer. Prefer correct, maintainable code, explain important implementation choices, and call out assumptions.",
};

function bearerToken(request: ApiRequest): string | null {
  const header = request.headers.authorization ?? request.headers.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function sendError(response: ApiResponse, status: number, code: string, message: string) {
  response.status(status).json({ error: { code, message } });
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendError(response, 405, "METHOD_NOT_ALLOWED", "Use POST for chat requests.");
    return;
  }

  const token = bearerToken(request);
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !supabaseUrl || !supabaseKey) {
    sendError(response, 401, "AUTH_REQUIRED", "Sign in to use live Moonex chat.");
    return;
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    sendError(response, 401, "INVALID_SESSION", "Your session is invalid or expired. Sign in again.");
    return;
  }

  const body = request.body as { modelProfile?: unknown; messages?: unknown } | null;
  const profile = typeof body?.modelProfile === "string" ? body.modelProfile : "";
  if (!enabledProfiles.has(profile)) {
    const code = profile === "moonex-vision-1.5" || profile === "moonex-research-1.5"
      ? "CAPABILITY_NOT_CONFIGURED"
      : "UNKNOWN_MODEL_PROFILE";
    sendError(
      response,
      code === "CAPABILITY_NOT_CONFIGURED" ? 501 : 400,
      code,
      code === "CAPABILITY_NOT_CONFIGURED"
        ? "Vision input and web research tools are not enabled yet. Choose a text profile for now."
        : "Choose a valid Moonex model profile.",
    );
    return;
  }

  if (!Array.isArray(body?.messages) || body.messages.length === 0 || body.messages.length > 60) {
    sendError(response, 400, "INVALID_MESSAGES", "Provide between 1 and 60 chat messages.");
    return;
  }

  const messages: ChatMessage[] = [];
  let totalCharacters = 0;
  for (const item of body.messages) {
    if (!item || typeof item !== "object") {
      sendError(response, 400, "INVALID_MESSAGES", "Each message must include a valid role and text.");
      return;
    }
    const candidate = item as { role?: unknown; content?: unknown };
    if ((candidate.role !== "user" && candidate.role !== "assistant") ||
        typeof candidate.content !== "string" || !candidate.content.trim()) {
      sendError(response, 400, "INVALID_MESSAGES", "Each message must include a valid role and non-empty text.");
      return;
    }
    totalCharacters += candidate.content.length;
    if (totalCharacters > 100_000) {
      sendError(response, 413, "CONTEXT_TOO_LARGE", "This conversation is too large. Start a new chat or shorten the context.");
      return;
    }
    messages.push({ role: candidate.role, content: candidate.content });
  }
  if (messages[messages.length - 1]?.role !== "user") {
    sendError(response, 400, "INVALID_MESSAGES", "The final message must be from the user.");
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    sendError(response, 503, "PROVIDER_NOT_CONFIGURED", "Live chat is not configured. Add GEMINI_API_KEY to the server environment.");
    return;
  }

  // Configure the model server-side. Never accept upstream model IDs from the browser.
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  let upstream: Response;
  try {
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `You are Moonex, a helpful AI assistant. Follow this response style: ${profileInstructions[profile]}` }],
          },
          contents: messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: { maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
  } catch {
    sendError(response, 502, "PROVIDER_UNAVAILABLE", "Moonex could not reach the AI provider. Please try again.");
    return;
  }

  if (!upstream.ok) {
    if (upstream.status === 401 || upstream.status === 403) {
      sendError(response, 502, "PROVIDER_AUTH_FAILED", "The Gemini API key was rejected. Check GEMINI_API_KEY in the server environment.");
    } else if (upstream.status === 429) {
      sendError(response, 429, "PROVIDER_RATE_LIMITED", "Gemini has reached a rate or quota limit. Try again later.");
    } else {
      sendError(response, 502, "PROVIDER_REQUEST_FAILED", "Gemini could not complete the request. Check the configured model and try again.");
    }
    return;
  }

  if (!upstream.body) {
    sendError(response, 502, "EMPTY_PROVIDER_STREAM", "Gemini returned an empty response stream.");
    return;
  }

  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = chunk.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
          if (text) response.write(`event: delta\ndata: ${JSON.stringify({ text })}\n\n`);
        } catch {
          // Ignore malformed provider chunks; never forward raw provider payloads to clients.
        }
      }
    }
    response.write("event: done\ndata: {}\n\n");
    response.end();
  } catch {
    response.write(`event: error\ndata: ${JSON.stringify({ message: "The AI response stream was interrupted. Please try again." })}\n\n`);
    response.end();
  } finally {
    reader.releaseLock();
  }
}
