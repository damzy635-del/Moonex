import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";
import chatApiHandler from "./api/chat";
import modelsApiHandler from "./api/models";
import researchApiHandler from "./api/research";
import codeRunApiHandler from "./api/code/run";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Support large payloads for uploaded documents and images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy GoogleGenAI client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not set in environment.");
    }
    genAIClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

// Model Catalog
const AVAILABLE_MODELS = [
  {
    id: "gemini-3.7-flash",
    name: "My AI 3.7 Flash (Default)",
    tagline: "Ultra-fast, intelligent, and multimodal with optional deep thinking",
    description: "Best for everyday tasks, coding, writing, research, and analysis with low latency.",
    contextWindow: "1M tokens",
    supportsThinking: true,
    supportsSearch: true,
    supportsVision: true,
    badge: "Recommended",
  },
  {
    id: "gemini-3.7-flash-thinking",
    name: "My AI 3.7 Deep Thinker",
    tagline: "Extended chain-of-thought reasoning for complex problem solving",
    description: "Specialized for advanced mathematics, algorithms, scientific queries, and deep logic.",
    contextWindow: "1M tokens",
    supportsThinking: true,
    supportsSearch: true,
    supportsVision: true,
    badge: "Reasoning",
  },
  {
    id: "gemini-2.5-flash",
    name: "My AI 2.5 Flash",
    tagline: "Ultra-reliable, high-throughput model for general intelligence",
    description: "High speed, dependable response generation, coding, and multimodal analysis.",
    contextWindow: "1M tokens",
    supportsThinking: false,
    supportsSearch: true,
    supportsVision: true,
    badge: "Reliable",
  },
  {
    id: "gemini-2.5-pro",
    name: "My AI 2.5 Pro",
    tagline: "Deep contextual reasoning for complex architecture and creative synthesis",
    description: "High-parameter model for complex multi-file analysis and high-nuance STEM reasoning.",
    contextWindow: "2M tokens",
    supportsThinking: false,
    supportsSearch: true,
    supportsVision: true,
    badge: "Pro",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "My AI 3.1 Flash Lite",
    tagline: "Lightweight, instantaneous response speed",
    description: "Optimized for quick translations, definitions, grammar checks, and brief queries.",
    contextWindow: "1M tokens",
    supportsThinking: false,
    supportsSearch: false,
    supportsVision: true,
    badge: "Fast",
  },
];

// My AI unified API client — chat, research, and code/run now route
// through here instead of calling Gemini directly. TTS still uses
// getGenAI() below since My AI has no audio synthesis capability.
const MYAI_API_URL = (process.env.MYAI_API_URL || "").replace(/\/$/, "");
const MYAI_API_KEY = process.env.MYAI_API_KEY || "";

function assertMyAIConfigured(): void {
  if (!MYAI_API_URL || !MYAI_API_KEY) {
    throw new Error(
      "MYAI_API_URL and MYAI_API_KEY must be configured to use chat, research, or code features. " +
      "See docs/MYAI_INTEGRATION.md."
    );
  }
}

// Translate a Moonex message ({role, content, files}) into My AI's
// canonical message shape (string content, or a list of {type:"text"} /
// {type:"image_url"} parts when files are attached — the same OpenAI-style
// format My AI's unified API accepts natively).
function toMyAIMessage(msg: any): { role: string; content: any } {
  const role = msg.role === "assistant" || msg.role === "model" ? "assistant" : (msg.role === "system" ? "system" : "user");
  const files = Array.isArray(msg.files) ? msg.files : [];

  if (files.length === 0) {
    return { role, content: msg.content && msg.content.trim() ? msg.content : " " };
  }

  const parts: any[] = [];
  if (msg.content && msg.content.trim()) {
    parts.push({ type: "text", text: msg.content });
  }
  for (const file of files) {
    if (!file.data || !file.mimeType) continue;
    // file.data may already be a full data URI, or just the raw base64
    // payload depending on how the frontend captured it — handle both.
    const url = file.data.startsWith("data:") ? file.data : `data:${file.mimeType};base64,${file.data}`;
    parts.push({ type: "image_url", image_url: { url } });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", text: " " });
  }
  return { role, content: parts };
}

// gemini-3.7-flash-thinking isn't a real distinct model at the API level —
// it's the base 3.7-flash model with thinking forced on, exactly mirroring
// the model/thinking split this app already used when calling Gemini
// directly. Preserved here so front-end model IDs don't need to change.
function resolveMyAIModelAndThinking(model: string, thinkingLevel: string): { model: string; thinking_level: string | null } {
  if (model === "gemini-3.7-flash-thinking") {
    return { model: "gemini-3.7-flash", thinking_level: "high" };
  }
  return { model, thinking_level: thinkingLevel === "none" ? null : thinkingLevel };
}


function isTransientError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.code || error.statusCode;
  const msg = (error.message || "").toLowerCase();
  return (
    status === 503 ||
    status === 429 ||
    status === "UNAVAILABLE" ||
    status === "RESOURCE_EXHAUSTED" ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("spikes in demand") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("quota exceeded") ||
    msg.includes("overloaded")
  );
}

// Sleep helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fallback model candidate generator with high-availability verified models
function getFallbackModels(preferredModel: string): string[] {
  const modelOrder = [
    preferredModel,
    "gemini-3.7-flash",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-pro",
  ];
  return Array.from(new Set(modelOrder));
}

// 1. Available Models API
app.get("/api/models", async (req: Request, res: Response) => {
  await modelsApiHandler(req, res);
  return;

  res.json({
    models: AVAILABLE_MODELS,
    defaultModel: "gemini-3.7-flash",
  });
});

// 2. Chat Streaming API (Server-Sent Events)
app.post("/api/chat", async (req: Request, res: Response) => {
  await chatApiHandler(req, res);
  return;

  // Flush headers immediately so Vercel/proxies know this is a live stream.
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (payload: Record<string, any>) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": keep-alive\n\n");
  }, 15000);

  try {
    assertMyAIConfigured();

    const {
      messages = [],
      model = "gemini-3.7-flash",
      enableWebSearch = false,
      thinkingLevel = "none",
      systemInstruction = "",
      projectKnowledge = [],
      tone = "balanced",
    } = req.body || {};

    if (!Array.isArray(messages)) {
      sendEvent({ type: "error", error: "Invalid request: messages must be an array." });
      return;
    }

    let combinedSystemInstruction = "You are My AI Model, an advanced, highly capable, and polished AI assistant built for consumers, professionals, researchers, and creators.\n";
    combinedSystemInstruction += "Always provide clean, accurate, and thoughtfully structured answers. Use Markdown formatting (headings, bullet points, bold text, code blocks, tables) to maximize readability.\n";
    combinedSystemInstruction += "When generating code, provide comprehensive, working code with language tags (e.g. ```typescript, ```python, ```html, ```css, ```json).\n";
    combinedSystemInstruction += "If presenting a standalone document, code component, web preview, SVG, or artifact, frame it clearly with Markdown blocks.\n";

    if (tone === "concise") combinedSystemInstruction += "\nTone: Be exceptionally direct, concise, and to-the-point without fluff.";
    else if (tone === "explanatory") combinedSystemInstruction += "\nTone: Provide detailed, step-by-step educational explanations with analogies and breakdowns.";
    else if (tone === "creative") combinedSystemInstruction += "\nTone: Be expressive, imaginative, vivid, and engaging in your prose.";
    else if (tone === "technical") combinedSystemInstruction += "\nTone: Highly technical, rigorous, precise, including specifications, edge cases, and architectural best practices.";

    if (systemInstruction && String(systemInstruction).trim()) {
      combinedSystemInstruction += `\n\nCustom User Instructions:\n${String(systemInstruction).trim()}`;
    }

    if (Array.isArray(projectKnowledge) && projectKnowledge.length > 0) {
      combinedSystemInstruction += "\n\n=== PROJECT KNOWLEDGE CONTEXT ===\n";
      for (const item of projectKnowledge) {
        if (item?.name && item?.content) {
          combinedSystemInstruction += `\n--- Document: ${item.name} ---\n${item.content}\n`;
        }
      }
      combinedSystemInstruction += "=================================\nUse the above Project Knowledge whenever relevant to answer user questions accurately.\n";
    }

    const myaiMessages = [
      { role: "system", content: combinedSystemInstruction },
      ...messages.map(toMyAIMessage),
    ];

    const { model: resolvedModel, thinking_level } = resolveMyAIModelAndThinking(model, thinkingLevel);
    const endpoint = `${MYAI_API_URL}/chat/completions`;

    const upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MYAI_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: myaiMessages,
        stream: true,
        enable_search: !!enableWebSearch,
        thinking_level,
      }),
    });

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const status = upstreamResponse.status;
      let detail = `My AI request failed with HTTP ${status}.`;
      try {
        const raw = await upstreamResponse.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            detail = parsed?.detail || parsed?.error?.message || detail;
          } catch {
            detail = raw.slice(0, 1000);
          }
        }
      } catch {
        // Keep the status-based detail.
      }

      const friendly =
        status === 401 || status === 403
          ? "My AI authentication failed. Check MYAI_API_KEY and make sure the key has the required chat scope."
          : status === 404
          ? "My AI endpoint was not found. Set MYAI_API_URL to the API base URL ending in /v1, not /chat/completions."
          : status === 429
          ? "My AI is rate-limiting this request. Please try again shortly."
          : status === 503
          ? "The AI model is currently experiencing high demand. Please try again in a few moments, or switch to another model."
          : detail;

      sendEvent({ type: "error", error: friendly, status });
      return;
    }

    const reader = upstreamResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let groundingSources: any[] = [];
    let modelUsed = resolvedModel;

    const processLine = (line: string) => {
      const trimmed = line.trimEnd();
      if (!trimmed.startsWith("data:")) return false;

      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") return false;

      let chunk: any;
      try {
        chunk = JSON.parse(payload);
      } catch {
        // A complete SSE line should be JSON, but ignore malformed upstream events.
        return false;
      }

      if (chunk.error) {
        sendEvent({ type: "error", error: chunk.error.message || String(chunk.error) || "Upstream AI error." });
        return true;
      }

      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) {
        fullText += delta.content;
        sendEvent({ type: "chunk", text: delta.content });
      }

      const meta = chunk.x_unified_api;
      if (meta?.grounding_sources && Array.isArray(meta.grounding_sources)) {
        groundingSources = meta.grounding_sources;
      }
      if (chunk.model) modelUsed = chunk.model;
      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        const hadError = processLine(line);
        if (hadError) {
          await reader.cancel();
          return;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) processLine(buffer);

    sendEvent({ type: "done", fullText, groundingSources, modelUsed });
  } catch (error: any) {
    console.error("Top-level error in /api/chat:", error);
    const message = error?.message || "An unexpected error occurred while communicating with the AI service.";
    sendEvent({ type: "error", error: message });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
});


// Generic robust content generation with retry and fallback
async function generateContentWithRetryAndFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  generateParams: {
    contents: any;
    config?: any;
