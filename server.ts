import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

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

// Helper to determine if an error is transient (503 UNAVAILABLE, 429 rate limit, high demand)
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
app.get("/api/models", (_req: Request, res: Response) => {
  res.json({
    models: AVAILABLE_MODELS,
    defaultModel: "gemini-3.7-flash",
  });
});

// 2. Chat Streaming API (Server-Sent Events)
app.post("/api/chat", async (req: Request, res: Response) => {
  // Set up SSE headers immediately
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const {
      messages = [],
      model = "gemini-3.7-flash",
      enableWebSearch = false,
      thinkingLevel = "none", // 'none' | 'low' | 'high'
      systemInstruction = "",
      projectKnowledge = [],
      tone = "balanced", // 'concise' | 'balanced' | 'explanatory' | 'creative' | 'technical'
    } = req.body;

    const ai = getGenAI();
    const primaryModel = model === "gemini-3.7-flash-thinking" ? "gemini-3.7-flash" : model;

    // Prepare system instructions with tone and project knowledge
    let combinedSystemInstruction = "You are My AI Model, an advanced, highly capable, and polished AI assistant built for consumers, professionals, researchers, and creators.\n";
    combinedSystemInstruction += "Always provide clean, accurate, and thoughtfully structured answers. Use Markdown formatting (headings, bullet points, bold text, code blocks, tables) to maximize readability.\n";
    combinedSystemInstruction += "When generating code, provide comprehensive, working code with language tags (e.g. ```typescript, ```python, ```html, ```css, ```json).\n";
    combinedSystemInstruction += "If presenting a standalone document, code component, web preview, SVG, or artifact, frame it clearly with Markdown blocks.\n";

    if (tone === "concise") {
      combinedSystemInstruction += "\nTone: Be exceptionally direct, concise, and to-the-point without fluff.";
    } else if (tone === "explanatory") {
      combinedSystemInstruction += "\nTone: Provide detailed, step-by-step educational explanations with analogies and breakdowns.";
    } else if (tone === "creative") {
      combinedSystemInstruction += "\nTone: Be expressive, imaginative, vivid, and engaging in your prose.";
    } else if (tone === "technical") {
      combinedSystemInstruction += "\nTone: Highly technical, rigorous, precise, including specifications, edge cases, and architectural best practices.";
    }

    if (systemInstruction && systemInstruction.trim()) {
      combinedSystemInstruction += `\n\nCustom User Instructions:\n${systemInstruction.trim()}`;
    }

    if (projectKnowledge && Array.isArray(projectKnowledge) && projectKnowledge.length > 0) {
      combinedSystemInstruction += "\n\n=== PROJECT KNOWLEDGE CONTEXT ===\n";
      for (const item of projectKnowledge) {
        if (item.name && item.content) {
          combinedSystemInstruction += `\n--- Document: ${item.name} ---\n${item.content}\n`;
        }
      }
      combinedSystemInstruction += "=================================\nUse the above Project Knowledge whenever relevant to answer user questions accurately.\n";
    }

    // Build the contents array for Gemini API
    const formattedContents: any[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const role = msg.role === "assistant" || msg.role === "model" ? "model" : "user";
      const parts: any[] = [];

      // Add attached files/images if any
      if (msg.files && Array.isArray(msg.files)) {
        for (const file of msg.files) {
          if (file.data && file.mimeType) {
            const cleanBase64 = file.data.includes(";base64,")
              ? file.data.split(";base64,")[1]
              : file.data;

            parts.push({
              inlineData: {
                mimeType: file.mimeType,
                data: cleanBase64,
              },
            });
          }
        }
      }

      // Add text content
      if (msg.content && msg.content.trim()) {
        parts.push({ text: msg.content });
      } else if (parts.length === 0) {
        parts.push({ text: " " });
      }

      formattedContents.push({
        role,
        parts,
      });
    }

    if (formattedContents.length === 0) {
      formattedContents.push({
        role: "user",
        parts: [{ text: "Hello!" }],
      });
    }

    // Tools configuration
    const tools: any[] = [];
    if (enableWebSearch) {
      tools.push({ googleSearch: {} });
    }

    const fallbackCandidateModels = getFallbackModels(primaryModel);
    let streamSucceeded = false;
    let lastError: any = null;

    // Try candidate models with retry backoff
    for (const candidateModel of fallbackCandidateModels) {
      if (streamSucceeded) break;

      // Build model-specific config
      const config: any = {
        systemInstruction: combinedSystemInstruction,
      };

      if (tools.length > 0) {
        config.tools = tools;
      }

      // Configure thinking level appropriately (only for gemini-3.7 models)
      if (candidateModel.includes("gemini-3.7")) {
        if (model === "gemini-3.7-flash-thinking" || thinkingLevel === "high") {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
        } else if (thinkingLevel === "low") {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        }
      }

      // Up to 2 retries per model if transient
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const responseStream = await ai.models.generateContentStream({
            model: candidateModel,
            contents: formattedContents,
            config,
          });

          let fullText = "";
          let groundingSources: any[] = [];

          for await (const chunk of responseStream) {
            const chunkText = chunk.text || "";
            if (chunkText) {
              fullText += chunkText;
              res.write(`data: ${JSON.stringify({ type: "chunk", text: chunkText })}\n\n`);
            }

            const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks && Array.isArray(groundingChunks) && groundingChunks.length > 0) {
              groundingSources = groundingChunks
                .filter((gc: any) => gc.web?.uri)
                .map((gc: any) => ({
                  title: gc.web.title || new URL(gc.web.uri).hostname,
                  url: gc.web.uri,
                }));
            }
          }

          // Successfully streamed
          res.write(
            `data: ${JSON.stringify({
              type: "done",
              fullText,
              groundingSources,
              modelUsed: candidateModel,
            })}\n\n`
          );
          res.end();
          streamSucceeded = true;
          break;
        } catch (err: any) {
          lastError = err;
          console.warn(
            `Attempt ${attempt + 1} with model ${candidateModel} failed:`,
            err?.message || err
          );

          if (isTransientError(err) && attempt < 1) {
            // Wait briefly with jitter before retry
            await delay(600 + Math.random() * 400);
            continue;
          } else {
            // Move to next candidate model
            break;
          }
        }
      }
    }

    if (!streamSucceeded) {
      const userFriendlyMsg = isTransientError(lastError)
        ? "The AI model is currently experiencing high demand. Please try again in a few moments, or switch to a different model in the top bar."
        : lastError?.message || "An unexpected error occurred while communicating with the AI service.";

      res.write(`data: ${JSON.stringify({ type: "error", error: userFriendlyMsg })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error("Top-level error in /api/chat:", error);
    const userFriendlyMsg = isTransientError(error)
      ? "The AI model is currently experiencing high demand. Please try again in a few moments."
      : error?.message || "An unexpected error occurred while communicating with the AI service.";
    res.write(`data: ${JSON.stringify({ type: "error", error: userFriendlyMsg })}\n\n`);
    res.end();
  }
});

// Generic robust content generation with retry and fallback
async function generateContentWithRetryAndFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  generateParams: {
    contents: any;
    config?: any;
  }
) {
  const candidateModels = getFallbackModels(primaryModel);
  let lastErr: any = null;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const configCopy = { ...(generateParams.config || {}) };
        // Adjust thinkingConfig if model doesn't support it
        if (!model.includes("gemini-3.7")) {
          delete configCopy.thinkingConfig;
        }

        const res = await ai.models.generateContent({
          model,
          contents: generateParams.contents,
          config: configCopy,
        });
        return res;
      } catch (err: any) {
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

// 3. Deep Research Workflow API
app.post("/api/research", async (req: Request, res: Response) => {
  try {
    const { topic, focusAreas = [], searchScope = "general" } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required for research." });
    }

    const ai = getGenAI();

    const scopeGuidance =
      searchScope === "academic"
        ? "Focus on peer-reviewed research, arXiv preprints, nature/science publications, and empirical STEM studies."
        : searchScope === "tech"
        ? "Focus on open-source repositories, engineering documentation, RFCs, GitHub discussions, and architecture whitepapers."
        : searchScope === "finance"
        ? "Focus on SEC regulatory filings, market quarterly analyses, earnings transcripts, and economic indicators."
        : "Perform comprehensive, multi-domain search across authoritative global sources.";

    // Stage 1: Generate Research Plan
    const planPrompt = `You are a Principal Research Analyst. Break down the research topic into 3 key analytical sub-questions and formulate exact search queries.
Topic: "${topic}"
Research Domain Scope: ${searchScope} (${scopeGuidance})
Additional Context: ${focusAreas.join(", ")}

Respond with a clean markdown plan summarizing the hypothesis, search strategy, and key inquiry dimensions.`;

    const planResponse = await generateContentWithRetryAndFallback(ai, "gemini-3.7-flash", {
      contents: planPrompt,
      config: {
        systemInstruction: `You are an elite research synthesizer specialized in ${searchScope} investigations. Formulate thorough research plans.`,
      },
    });

    const researchPlan = planResponse.text || "Research plan formulated.";

    // Stage 2: Deep Grounded Search & Synthesis
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
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        systemInstruction: `You are a lead investigator and research scientist specializing in ${searchScope} analysis. Produce exhaustive, publication-grade research reports with citations.`,
      },
    });

    const sources = deepResponse.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.filter((gc: any) => gc.web?.uri)
      .map((gc: any) => ({
        title: gc.web.title || gc.web.uri,
        url: gc.web.uri,
      })) || [];

    res.json({
      topic,
      plan: researchPlan,
      report: deepResponse.text || "Report completed.",
      sources,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in /api/research:", error);
    const userFriendlyMsg = isTransientError(error)
      ? "The research service is currently experiencing high demand. Please try again in a moment."
      : error?.message || "Failed to execute research workflow";
    res.status(500).json({ error: userFriendlyMsg });
  }
});

// 4. Voice Text-to-Speech API
app.post("/api/tts", async (req: Request, res: Response) => {
  try {
    const { text, voice = "Kore" } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required for TTS." });
    }

    const ai = getGenAI();

    // Clean markdown elements from text for optimal audio narration
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "Code block omitted from audio.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*#_~\[\]]/g, "")
      .trim()
      .slice(0, 800); // Reasonable clip limit

    let response: any = null;
    let ttsError: any = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: cleanText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        });
        break;
      } catch (err: any) {
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
        error: isTransientError(ttsError)
          ? "TTS service busy, falling back to browser speech."
          : "Could not generate speech audio.",
      });
    }

    res.json({
      audioBase64: base64Audio,
      mimeType: "audio/pcm;rate=24000",
      sampleRate: 24000,
    });
  } catch (error: any) {
    console.error("Error in /api/tts:", error);
    res.status(500).json({ error: error.message || "Speech synthesis failed." });
  }
});

// 5. Code Execution Simulation / Sandbox
app.post("/api/code/run", async (req: Request, res: Response) => {
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
        systemInstruction: "You are a high-speed code interpreter and execution simulator. Provide crisp terminal outputs.",
      },
    });

    res.json({
      output: response.text || "Execution completed with 0 errors.",
    });
  } catch (error: any) {
    const userFriendlyMsg = isTransientError(error)
      ? "Code execution service is currently busy. Please try again in a few moments."
      : error?.message || "Execution simulation failed";
    res.status(500).json({ error: userFriendlyMsg });
  }
});

// Setup Vite / Static handling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`My AI Model Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
