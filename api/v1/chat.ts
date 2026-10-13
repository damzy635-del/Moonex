import OpenAI from "openai";
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

const profileModels: Record<string, string> = {
  "moonex-lite-1.5": "gpt-6-luna",
  "moonex-fast-1.5": "gpt-6-luna",
  "moonex-pro-1.5": "gpt-6-sol",
  "moonex-pro-max-1.5": "gpt-6-astra",
  "moonex-ultra-1.5": "gpt-6-astra",
  "moonex-reasoning-1.5": "gpt-6-astra",
  "moonex-code-1.5": "gpt-5.3-codex",
};

function bearerToken(request: ApiRequest): string | null {
  const header = request.headers.authorization ?? request.headers.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST for chat requests." } });
    return;
  }

  const token = bearerToken(request);
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !supabaseUrl || !supabaseKey) {
    response.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Sign in to use live Moonex chat." } });
    return;
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    response.status(401).json({ error: { code: "INVALID_SESSION", message: "Your session is invalid or expired. Sign in again." } });
    return;
  }

  const body = request.body as { modelProfile?: unknown; messages?: unknown } | null;
  const profile = typeof body?.modelProfile === "string" ? body.modelProfile : "";
  const upstreamModel = profileModels[profile];
  if (!upstreamModel) {
    const code = profile === "moonex-vision-1.5" || profile === "moonex-research-1.5" ? "CAPABILITY_NOT_CONFIGURED" : "UNKNOWN_MODEL_PROFILE";
    response.status(code === "CAPABILITY_NOT_CONFIGURED" ? 501 : 400).json({
      error: { code, message: code === "CAPABILITY_NOT_CONFIGURED"
        ? "This profile needs image input or web-search tools that are not enabled yet. Choose another profile for now."
        : "Choose a valid Moonex model profile." },
    });
    return;
  }

  if (!Array.isArray(body?.messages) || body.messages.length === 0 || body.messages.length > 60) {
    response.status(400).json({ error: { code: "INVALID_MESSAGES", message: "Provide between 1 and 60 chat messages." } });
    return;
  }

  const messages: ChatMessage[] = [];
  let totalCharacters = 0;
  for (const item of body.messages) {
    if (!item || typeof item !== "object") {
      response.status(400).json({ error: { code: "INVALID_MESSAGES", message: "Each message must include a valid role and text." } });
      return;
    }
    const candidate = item as { role?: unknown; content?: unknown };
    if ((candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.content !== "string" || !candidate.content.trim()) {
      response.status(400).json({ error: { code: "INVALID_MESSAGES", message: "Each message must include a valid role and non-empty text." } });
      return;
    }
    totalCharacters += candidate.content.length;
    if (totalCharacters > 100_000) {
      response.status(413).json({ error: { code: "CONTEXT_TOO_LARGE", message: "This conversation is too large. Start a new chat or shorten the context." } });
      return;
    }
    messages.push({ role: candidate.role, content: candidate.content });
  }
  if (messages[messages.length - 1]?.role !== "user") {
    response.status(400).json({ error: { code: "INVALID_MESSAGES", message: "The final message must be from the user." } });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    response.status(503).json({ error: { code: "PROVIDER_NOT_CONFIGURED", message: "Live chat is not configured yet. Add OPENAI_API_KEY to the server environment." } });
    return;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 1 });
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");

  try {
    const stream = await client.responses.create({
      model: upstreamModel,
      input: messages,
      max_output_tokens: 2048,
      stream: true,
    });
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        response.write(`event: delta\ndata: ${JSON.stringify({ text: event.delta })}\n\n`);
      }
      if (event.type === "response.failed") {
        response.write(`event: error\ndata: ${JSON.stringify({ message: "The AI provider could not complete this response." })}\n\n`);
        response.end();
        return;
      }
    }
    response.write("event: done\ndata: {}\n\n");
    response.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "The AI provider request failed.";
    if (!response.write(`event: error\ndata: ${JSON.stringify({ message: message.slice(0, 500) })}\n\n`)) {
      response.end();
      return;
    }
    response.end();
  }
}
