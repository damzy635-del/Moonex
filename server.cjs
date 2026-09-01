var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");
var import_vite = require("vite");

// lib/moonex-models.js
var DEFAULT_MOONEX_MODEL_ID = "moonex-lite-1.5";
var AUTO_MODEL_ID = "auto";
var MOONEX_MODELS = [
  { id: "moonex-lite-1.5", name: "Moonex Lite 1.5", description: "Fast everyday conversations.", temperature: 0.35, maxTokens: 2048, preferredKeywords: ["flash", "mini", "lite", "haiku", "small"], fallbackIndex: 0 },
  { id: "moonex-fast-1.5", name: "Moonex Fast 1.5", description: "Low-latency answers for quick tasks.", temperature: 0.3, maxTokens: 2048, preferredKeywords: ["flash", "mini", "fast", "haiku", "small"], fallbackIndex: 1 },
  { id: "moonex-pro-1.5", name: "Moonex Pro 1.5", description: "Balanced quality and speed.", temperature: 0.45, maxTokens: 4096, preferredKeywords: ["pro", "sonnet", "gpt-4", "4.1", "gemini-2.5"], fallbackIndex: 2 },
  { id: "moonex-pro-max-1.5", name: "Moonex Pro Max 1.5", description: "Higher-quality general reasoning.", temperature: 0.4, maxTokens: 8192, preferredKeywords: ["pro", "sonnet", "opus", "gpt-4", "gemini-2.5"], fallbackIndex: 3 },
  { id: "moonex-ultra-1.5", name: "Moonex Ultra 1.5", description: "Maximum available general capability.", temperature: 0.35, maxTokens: 12288, preferredKeywords: ["opus", "o3", "o4", "reason", "ultra", "pro"], fallbackIndex: 4 },
  { id: "moonex-reasoning-1.5", name: "Moonex Reasoning 1.5", description: "Deeper reasoning for difficult problems.", temperature: 0.25, maxTokens: 12288, preferredKeywords: ["reason", "thinking", "o3", "o4", "r1", "deepseek-r1"], fallbackIndex: 5 },
  { id: "moonex-code-1.5", name: "Moonex Code 1.5", description: "Optimized for programming and technical work.", temperature: 0.2, maxTokens: 8192, preferredKeywords: ["code", "coder", "codestral", "deepseek-coder", "qwen"], fallbackIndex: 6 },
  { id: "moonex-vision-1.5", name: "Moonex Vision 1.5", description: "Multimodal tasks and image understanding.", temperature: 0.35, maxTokens: 4096, preferredKeywords: ["vision", "gemini", "gpt-4o", "gpt-4.1", "claude"], fallbackIndex: 7 },
  { id: "moonex-research-1.5", name: "Moonex Research 1.5", description: "Long-form analysis and research workflows.", temperature: 0.3, maxTokens: 12288, preferredKeywords: ["research", "sonnet", "opus", "gemini", "gpt-4"], fallbackIndex: 8 }
];
function normalizedProviderId(model) {
  return `${model.id} ${model.name || ""}`.toLowerCase();
}
function isMoonexModelId(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === AUTO_MODEL_ID || MOONEX_MODELS.some((model) => model.id === normalized);
}
function normalizeMoonexModelId(value, fallback = DEFAULT_MOONEX_MODEL_ID) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return isMoonexModelId(normalized) ? normalized : fallback;
}
function resolveProviderModel(profile, providers) {
  if (!providers.length) return null;
  const match = providers.find((provider) => {
    const haystack = normalizedProviderId(provider);
    return profile.preferredKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  });
  return match || providers[Math.min(profile.fallbackIndex, providers.length - 1)];
}
function findMoonexModel(id) {
  const normalized = normalizeMoonexModelId(id);
  return MOONEX_MODELS.find((model) => model.id === normalized) || MOONEX_MODELS[0];
}
function messageText(context) {
  return (context.messages || []).filter((message) => message.role !== "system").map((message) => typeof message.content === "string" ? message.content : "").join("\n").slice(-12e3).toLowerCase();
}
function hasImageAttachment(context) {
  return (context.messages || []).some(
    (message) => (message.files || []).some(
      (file) => String(file.mimeType || "").toLowerCase().startsWith("image/") || file.type === "image"
    )
  );
}
function classifyMoonexTask(context) {
  const text = messageText(context);
  const wordCount = text ? text.split(/\s+/).length : 0;
  const isComplex = wordCount > 220 || text.length > 1400;
  if (hasImageAttachment(context)) return findMoonexModel("moonex-vision-1.5");
  if (context.enableWebSearch || /\b(latest|current|today|this week|news|research|sources?|citations?|look up|web search|recent)\b/.test(text)) {
    return findMoonexModel("moonex-research-1.5");
  }
  if (/\b(write|build|create|implement|refactor|debug|fix|code|coding|program|function|api|react|typescript|javascript|python|sql|authentication|auth|component|app|website|regex|css|html)\b/.test(text)) {
    return findMoonexModel("moonex-code-1.5");
  }
  if (context.thinkingLevel === "high" || /\b(algorithm|algorithms|prove|proof|derive|architecture|trade-?offs?|analy[sz]e|complex|difficult|deeply|step[- ]by[- ]step|reason|logic|evaluate|critique|compare)\b/.test(text)) {
    return findMoonexModel(isComplex || wordCount > 90 ? "moonex-ultra-1.5" : "moonex-reasoning-1.5");
  }
  if (/^[\s\d()+*/%=.?x×-]+$/.test(text) || wordCount <= 24) return findMoonexModel("moonex-lite-1.5");
  return findMoonexModel(isComplex ? "moonex-pro-1.5" : "moonex-fast-1.5");
}
function resolveMoonexProfile(modelId, context = {}) {
  return normalizeMoonexModelId(modelId) === AUTO_MODEL_ID ? classifyMoonexTask(context) : findMoonexModel(modelId);
}

// api/chat.ts
var MAX_BODY_BYTES = 2 * 1024 * 1024;
var MAX_MESSAGES = 100;
var MAX_MESSAGE_CHARS = 1e5;
var RATE_WINDOW_MS = 6e4;
var RATE_LIMIT = 20;
var rateBuckets = /* @__PURE__ */ new Map();
var baseUrl = () => (process.env.MYAI_API_URL || "").replace(/\/$/, "");
var apiKey = () => process.env.MYAI_API_KEY || "";
function clientKey(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req.socket?.remoteAddress || "unknown");
}
function rateLimit(req) {
  const key = clientKey(req);
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || now - current.started >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { started: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT - 1, retryAfter: 60 };
  }
  current.count += 1;
  const remaining = Math.max(0, RATE_LIMIT - current.count);
  return {
    allowed: current.count <= RATE_LIMIT,
    remaining,
    retryAfter: Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - current.started)) / 1e3))
  };
}
function convertMessage(message) {
  const role = message.role === "assistant" || message.role === "model" ? "assistant" : message.role === "system" ? "system" : "user";
  const files = Array.isArray(message.files) ? message.files : [];
  const text = typeof message.content === "string" ? message.content : "";
  if (text.length > MAX_MESSAGE_CHARS) {
    throw new Error(`Message exceeds the ${MAX_MESSAGE_CHARS.toLocaleString()} character limit.`);
  }
  if (!files.length) return { role, content: text.trim() || " " };
  const parts = [];
  if (text.trim()) parts.push({ type: "text", text });
  for (const file of files) {
    if (!file?.data || !file?.mimeType) continue;
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.mimeType)) continue;
    if (file.data.length > 15e5) throw new Error("An attached image is too large.");
    const url = file.data.startsWith("data:") ? file.data : `data:${file.mimeType};base64,${file.data}`;
    parts.push({ type: "image_url", image_url: { url } });
  }
  return { role, content: parts.length ? parts : [{ type: "text", text: " " }] };
}
function buildPrompt(instruction, knowledge, tone, modelName) {
  let prompt = `You are Moonex, an advanced AI assistant. Your product identity is Moonex. The current Moonex model profile is ${modelName}. If asked what model you are, say you are ${modelName}, a Moonex model, and do not claim that the product is a provider model. Never call yourself My AI Model. Always provide accurate, useful, well-structured answers using Markdown when appropriate.`;
  if (tone === "concise") prompt += " Be exceptionally direct and concise.";
  if (tone === "explanatory") prompt += " Give detailed, step-by-step educational explanations.";
  if (tone === "creative") prompt += " Be expressive and imaginative while remaining accurate.";
  if (tone === "technical") prompt += " Be rigorous and technical, including edge cases and implementation details.";
  if (typeof instruction === "string" && instruction.trim()) {
    prompt += `

Custom User Instructions:
${instruction.trim().slice(0, MAX_MESSAGE_CHARS)}`;
  }
  if (Array.isArray(knowledge) && knowledge.length) {
    prompt += "\n\n=== PROJECT KNOWLEDGE CONTEXT ===";
    for (const item of knowledge.slice(0, 20)) {
      if (item?.name && item?.content) {
        prompt += `

--- ${String(item.name).slice(0, 200)} ---
${String(item.content).slice(0, MAX_MESSAGE_CHARS)}`;
      }
    }
    prompt += "\n=== END PROJECT KNOWLEDGE ===";
  }
  return prompt;
}
function send(res, payload) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}

`);
}
async function liveProviders(base, token) {
  const response = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  if (!response.ok) return [];
  const json = await response.json();
  const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
  return list.map(
    (item) => typeof item === "string" ? { id: item } : item?.id ? { ...item, id: String(item.id) } : null
  ).filter(Boolean);
}
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST /api/chat." });
    return;
  }
  const limit = rateLimit(req);
  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT));
  res.setHeader("X-RateLimit-Remaining", String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    res.status(429).json({ error: "Too many chat requests. Please retry later.", retryAfter: limit.retryAfter });
    return;
  }
  const base = baseUrl();
  const token = apiKey();
  if (!base || !token) {
    res.status(500).json({ error: "Moonex AI backend is not configured. Set MYAI_API_URL and MYAI_API_KEY in Vercel." });
    return;
  }
  const body = req.body || {};
  const serialized = typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(body);
  if (Buffer.byteLength(serialized, "utf8") > MAX_BODY_BYTES) {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length > MAX_MESSAGES) {
    res.status(400).json({ error: `Too many messages. Maximum is ${MAX_MESSAGES}.` });
    return;
  }
  let providers = [];
  try {
    providers = await liveProviders(base, token);
  } catch (error) {
    console.warn("Moonex model catalog lookup failed:", error);
  }
  if (!providers.length) {
    res.status(503).json({ error: "No usable AI model is available from the configured Moonex backend." });
    return;
  }
  const requested = normalizeMoonexModelId(body.model);
  const profile = resolveMoonexProfile(requested, {
    messages,
    enableWebSearch: !!body.enableWebSearch,
    thinkingLevel: body.thinkingLevel
  });
  const provider = resolveProviderModel(profile, providers);
  if (!provider) {
    res.status(503).json({ error: `No provider model is available for ${profile.name}.` });
    return;
  }
  let converted;
  try {
    converted = messages.map(convertMessage);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    return;
  }
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  send(res, {
    type: "route",
    requestedModel: requested,
    moonexModel: profile.id,
    modelName: profile.name
  });
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": keep-alive\n\n");
  }, 15e3);
  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        model: provider.id,
        messages: [
          {
            role: "system",
            content: buildPrompt(body.systemInstruction, body.projectKnowledge, body.tone || "balanced", profile.name)
          },
          ...converted
        ],
        stream: true,
        enable_search: !!body.enableWebSearch,
        ...body.thinkingLevel && body.thinkingLevel !== "none" ? { thinking_level: body.thinkingLevel } : {},
        temperature: profile.temperature,
        max_tokens: profile.maxTokens
      })
    });
    if (!upstream.ok || !upstream.body) {
      const raw = await upstream.text().catch(() => "");
      let detail = raw.slice(0, 1500) || `Moonex AI returned HTTP ${upstream.status}.`;
      try {
        const json = JSON.parse(raw);
        detail = json?.detail || json?.error?.message || json?.error || detail;
      } catch {
      }
      send(res, { type: "error", error: String(detail), status: upstream.status, moonexModel: profile.id });
      return;
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === "[DONE]") {
          send(res, { type: "done", modelUsed: profile.id });
          continue;
        }
        try {
          const chunk = JSON.parse(payload);
          if (chunk?.error) {
            send(res, {
              type: "error",
              error: chunk.error?.message || String(chunk.error),
              moonexModel: profile.id
            });
            continue;
          }
          const text = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.text ?? "";
          if (text) send(res, { type: "chunk", text });
        } catch {
        }
      }
    }
    buffer += decoder.decode();
    send(res, { type: "done", modelUsed: profile.id });
  } catch (error) {
    console.error("Moonex /api/chat failed:", error);
    send(res, {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
      moonexModel: profile.id
    });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
    if (rateBuckets.size > 5e3) rateBuckets.clear();
  }
}

// api/models.ts
async function handler2(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed. Use GET /api/models." });
    return;
  }
  const base = (process.env.MYAI_API_URL || "").replace(/\/$/, "");
  const token = process.env.MYAI_API_KEY || "";
  if (!base || !token) {
    res.status(500).json({ error: "Moonex AI backend is not configured." });
    return;
  }
  try {
    const upstream = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
    const raw = await upstream.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { raw: raw.slice(0, 1e3) };
    }
    if (!upstream.ok) {
      const detail = payload?.detail || payload?.error?.message || payload?.error || `Moonex AI returned HTTP ${upstream.status}.`;
      res.status(upstream.status).json({ error: String(detail) });
      return;
    }
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
    const providers = list.map((item) => typeof item === "string" ? { id: item } : item?.id ? { ...item, id: String(item.id) } : null).filter(Boolean);
    const models = [
      {
        id: "auto",
        name: "Auto",
        tagline: "Moonex chooses the best profile for this task.",
        description: "Automatically routes each request to a Moonex model profile.",
        contextWindow: "Profile dependent",
        supportsThinking: true,
        supportsSearch: true,
        supportsVision: true,
        badge: "Recommended",
        available: true
      },
      ...MOONEX_MODELS.map((profile) => {
        const provider = resolveProviderModel(profile, providers);
        const lower = profile.id.toLowerCase();
        const supportsVision = lower.includes("vision");
        const supportsCode = lower.includes("code");
        const supportsThinking = lower.includes("reasoning") || lower.includes("ultra") || lower.includes("pro-max");
        return {
          id: profile.id,
          name: profile.name,
          tagline: profile.description,
          description: profile.description,
          contextWindow: provider?.context_length ? `${provider.context_length.toLocaleString()} tokens` : "Provider dependent",
          supportsThinking,
          supportsSearch: true,
          supportsVision,
          badge: lower.includes("lite") ? "Fast" : lower.includes("ultra") ? "Advanced" : lower.includes("pro") ? "Pro" : void 0,
          available: !!provider
        };
      }).filter((model) => model.available)
    ];
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ models, defaultModel: models[0]?.id || null });
  } catch (error) {
    console.error("Moonex /api/models failed:", error);
    res.status(502).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = Number(process.env.PORT || 3e3);
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
var genAIClient = null;
function getGenAI() {
  if (!genAIClient) {
    const apiKey2 = process.env.GEMINI_API_KEY;
    if (!apiKey2) {
      console.warn("WARNING: GEMINI_API_KEY is not set in environment.");
    }
    genAIClient = new import_genai.GoogleGenAI({
      apiKey: apiKey2 || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return genAIClient;
}
var AVAILABLE_MODELS = [
  {
    id: "gemini-3.7-flash",
    name: "My AI 3.7 Flash (Default)",
    tagline: "Ultra-fast, intelligent, and multimodal with optional deep thinking",
    description: "Best for everyday tasks, coding, writing, research, and analysis with low latency.",
    contextWindow: "1M tokens",
    supportsThinking: true,
    supportsSearch: true,
    supportsVision: true,
    badge: "Recommended"
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
    badge: "Reasoning"
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
    badge: "Reliable"
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
    badge: "Pro"
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
    badge: "Fast"
  }
];
var MYAI_API_URL = (process.env.MYAI_API_URL || "").replace(/\/$/, "");
var MYAI_API_KEY = process.env.MYAI_API_KEY || "";
function assertMyAIConfigured() {
  if (!MYAI_API_URL || !MYAI_API_KEY) {
    throw new Error(
      "MYAI_API_URL and MYAI_API_KEY must be configured to use chat, research, or code features. See docs/MYAI_INTEGRATION.md."
    );
  }
}
function toMyAIMessage(msg) {
  const role = msg.role === "assistant" || msg.role === "model" ? "assistant" : msg.role === "system" ? "system" : "user";
  const files = Array.isArray(msg.files) ? msg.files : [];
  if (files.length === 0) {
    return { role, content: msg.content && msg.content.trim() ? msg.content : " " };
  }
  const parts = [];
  if (msg.content && msg.content.trim()) {
    parts.push({ type: "text", text: msg.content });
  }
  for (const file of files) {
    if (!file.data || !file.mimeType) continue;
    const url = file.data.startsWith("data:") ? file.data : `data:${file.mimeType};base64,${file.data}`;
    parts.push({ type: "image_url", image_url: { url } });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", text: " " });
  }
  return { role, content: parts };
}
function resolveMyAIModelAndThinking(model, thinkingLevel) {
  if (model === "gemini-3.7-flash-thinking") {
    return { model: "gemini-3.7-flash", thinking_level: "high" };
  }
  return { model, thinking_level: thinkingLevel === "none" ? null : thinkingLevel };
}
function isTransientError(error) {
  if (!error) return false;
  const status = error.status || error.code || error.statusCode;
  const msg = (error.message || "").toLowerCase();
  return status === 503 || status === 429 || status === "UNAVAILABLE" || status === "RESOURCE_EXHAUSTED" || msg.includes("503") || msg.includes("unavailable") || msg.includes("high demand") || msg.includes("spikes in demand") || msg.includes("resource_exhausted") || msg.includes("rate limit") || msg.includes("quota exceeded") || msg.includes("overloaded");
}
var delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function getFallbackModels(preferredModel) {
  const modelOrder = [
    preferredModel,
    "gemini-3.7-flash",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-pro"
  ];
  return Array.from(new Set(modelOrder));
}
app.get("/api/models", async (req, res) => {
  await handler2(req, res);
  return;
  res.json({
    models: AVAILABLE_MODELS,
    defaultModel: "gemini-3.7-flash"
  });
});
app.post("/api/chat", async (req, res) => {
  await handler(req, res);
  return;
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const sendEvent = (payload) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}

`);
    }
  };
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": keep-alive\n\n");
  }, 15e3);
  try {
    assertMyAIConfigured();
    const {
      messages = [],
      model = "gemini-3.7-flash",
      enableWebSearch = false,
      thinkingLevel = "none",
      systemInstruction = "",
      projectKnowledge = [],
      tone = "balanced"
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
      combinedSystemInstruction += `

Custom User Instructions:
${String(systemInstruction).trim()}`;
    }
    if (Array.isArray(projectKnowledge) && projectKnowledge.length > 0) {
      combinedSystemInstruction += "\n\n=== PROJECT KNOWLEDGE CONTEXT ===\n";
      for (const item of projectKnowledge) {
        if (item?.name && item?.content) {
          combinedSystemInstruction += `
--- Document: ${item.name} ---
${item.content}
`;
        }
      }
      combinedSystemInstruction += "=================================\nUse the above Project Knowledge whenever relevant to answer user questions accurately.\n";
    }
    const myaiMessages = [
      { role: "system", content: combinedSystemInstruction },
      ...messages.map(toMyAIMessage)
    ];
    const { model: resolvedModel, thinking_level } = resolveMyAIModelAndThinking(model, thinkingLevel);
    const endpoint = `${MYAI_API_URL}/chat/completions`;
    const upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MYAI_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: myaiMessages,
        stream: true,
        enable_search: !!enableWebSearch,
        thinking_level
      })
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
            detail = raw.slice(0, 1e3);
          }
        }
      } catch {
      }
      const friendly = status === 401 || status === 403 ? "My AI authentication failed. Check MYAI_API_KEY and make sure the key has the required chat scope." : status === 404 ? "My AI endpoint was not found. Set MYAI_API_URL to the API base URL ending in /v1, not /chat/completions." : status === 429 ? "My AI is rate-limiting this request. Please try again shortly." : status === 503 ? "The AI model is currently experiencing high demand. Please try again in a few moments, or switch to another model." : detail;
      sendEvent({ type: "error", error: friendly, status });
      return;
    }
    const reader = upstreamResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let groundingSources = [];
    let modelUsed = resolvedModel;
    const processLine = (line) => {
      const trimmed = line.trimEnd();
      if (!trimmed.startsWith("data:")) return false;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") return false;
      let chunk;
      try {
        chunk = JSON.parse(payload);
      } catch {
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
  } catch (error) {
    console.error("Top-level error in /api/chat:", error);
    const message = error?.message || "An unexpected error occurred while communicating with the AI service.";
    sendEvent({ type: "error", error: message });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
});
async function generateContentWithRetryAndFallback(ai, primaryModel, generateParams) {
  const candidateModels = getFallbackModels(primaryModel);
  let lastErr = null;
  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const configCopy = { ...generateParams.config || {} };
        if (!model.includes("gemini-3.7")) {
          delete configCopy.thinkingConfig;
        }
        const res = await ai.models.generateContent({
          model,
          contents: generateParams.contents,
          config: configCopy
        });
        return res;
      } catch (err) {
        lastErr = err;
        console.warn(`generateContent failed on ${model} (attempt ${attempt + 1}):`, err?.message || err);
        if (isTransientError(err) && attempt < 1) {
          await delay(600 + Math.random() * 400);
          continue;
        }
        break;
      }
    }
  }
  throw lastErr || new Error("Failed to generate content after retries and model fallbacks.");
}
app.post("/api/research", async (req, res) => {
  try {
    const { topic, focusAreas = [], searchScope = "general" } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required for research." });
    }
    const ai = getGenAI();
    const scopeGuidance = searchScope === "academic" ? "Focus on peer-reviewed research, arXiv preprints, nature/science publications, and empirical STEM studies." : searchScope === "tech" ? "Focus on open-source repositories, engineering documentation, RFCs, GitHub discussions, and architecture whitepapers." : searchScope === "finance" ? "Focus on SEC regulatory filings, market quarterly analyses, earnings transcripts, and economic indicators." : "Perform comprehensive, multi-domain search across authoritative global sources.";
    const planPrompt = `You are a Principal Research Analyst. Break down the research topic into 3 key analytical sub-questions and formulate exact search queries.
Topic: "${topic}"
Research Domain Scope: ${searchScope} (${scopeGuidance})
Additional Context: ${focusAreas.join(", ")}

Respond with a clean markdown plan summarizing the hypothesis, search strategy, and key inquiry dimensions.`;
    const planResponse = await generateContentWithRetryAndFallback(ai, "gemini-3.7-flash", {
      contents: planPrompt,
      config: {
        systemInstruction: `You are an elite research synthesizer specialized in ${searchScope} investigations. Formulate thorough research plans.`
      }
    });
    const researchPlan = planResponse.text || "Research plan formulated.";
    const deepPrompt = `Conduct comprehensive, multi-angle research on: "${topic}".
Domain Focus: ${scopeGuidance}
Investigate:
1. Executive Summary & Core Dynamics
2. Detailed Technical / Fact-Based Findings & Evidence
3. Market, Academic, or Practical Implications
4. Key Challenges, Counter-Arguments, & Future Outlook
5. Actionable Takeaways & Next Steps

Ensure rigorous depth, citing verified facts and data points where applicable.`;
    const deepResponse = await generateContentWithRetryAndFallback(ai, "gemini-3.7-flash", {
      contents: deepPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: import_genai.ThinkingLevel.HIGH },
        systemInstruction: `You are a lead investigator and research scientist specializing in ${searchScope} analysis. Produce exhaustive, publication-grade research reports with citations.`
      }
    });
    const sources = deepResponse.candidates?.[0]?.groundingMetadata?.groundingChunks?.filter((gc) => gc.web?.uri).map((gc) => ({
      title: gc.web.title || gc.web.uri,
      url: gc.web.uri
    })) || [];
    res.json({
      topic,
      plan: researchPlan,
      report: deepResponse.text || "Report completed.",
      sources,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Error in /api/research:", error);
    const userFriendlyMsg = isTransientError(error) ? "The research service is currently experiencing high demand. Please try again in a moment." : error?.message || "Failed to execute research workflow";
    res.status(500).json({ error: userFriendlyMsg });
  }
});
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice = "Kore" } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required for TTS." });
    }
    const ai = getGenAI();
    const cleanText = text.replace(/```[\s\S]*?```/g, "Code block omitted from audio.").replace(/`([^`]+)`/g, "$1").replace(/[*#_~\[\]]/g, "").trim().slice(0, 800);
    let response = null;
    let ttsError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: cleanText }] }],
          config: {
            responseModalities: [import_genai.Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice }
              }
            }
          }
        });
        break;
      } catch (err) {
        ttsError = err;
        if (isTransientError(err) && attempt < 1) {
          await delay(500);
          continue;
        }
        break;
      }
    }
    const base64Audio = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({
        error: isTransientError(ttsError) ? "TTS service busy, falling back to browser speech." : "Could not generate speech audio."
      });
    }
    res.json({
      audioBase64: base64Audio,
      mimeType: "audio/pcm;rate=24000",
      sampleRate: 24e3
    });
  } catch (error) {
    console.error("Error in /api/tts:", error);
    res.status(500).json({ error: error.message || "Speech synthesis failed." });
  }
});
app.post("/api/code/run", async (req, res) => {
  try {
    const { code, language } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }
    const ai = getGenAI();
    const prompt = `Simulate safe execution or linting of the following ${language || "code"}:
\`\`\`${language || ""}
${code}
\`\`\`
Provide a realistic execution trace or output (like console.log results, execution time, and any warnings/errors), followed by a brief 2-sentence optimization review.`;
    const response = await generateContentWithRetryAndFallback(ai, "gemini-3.7-flash", {
      contents: prompt,
      config: {
        systemInstruction: "You are a high-speed code interpreter and execution simulator. Provide crisp terminal outputs."
      }
    });
    res.json({
      output: response.text || "Execution completed with 0 errors."
    });
  } catch (error) {
    const userFriendlyMsg = isTransientError(error) ? "Code execution service is currently busy. Please try again in a few moments." : error?.message || "Execution simulation failed";
    res.status(500).json({ error: userFriendlyMsg });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`My AI Model Server running at http://0.0.0.0:${PORT}`);
  });
}
var server_default = app;
if (process.env.VERCEL !== "1") {
  startServer().catch((error) => {
    console.error("Failed to start My AI Model server:", error);
    process.exit(1);
  });
}
//# sourceMappingURL=server.cjs.map
