import app from "../server.ts";

// Catch-all Vercel function for the Express API.
// This keeps /api/chat, /api/models, /api/research, /api/tts,
// and /api/code/run on the same serverless application.
export const config = {
  maxDuration: 300,
};

export default app;
