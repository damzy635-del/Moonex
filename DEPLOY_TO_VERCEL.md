# Moonex — Vercel Deployment

This build is configured for Vercel with an Express API function and a Vite frontend.

## 1. Environment variables

In Vercel → Project → Settings → Environment Variables, add:

```
MYAI_API_URL=https://my-ai-model-xi.vercel.app/v1
MYAI_API_KEY=YOUR_MY_AI_KEY
```

Optional, only if the existing TTS feature is used:

```
GEMINI_API_KEY=YOUR_GEMINI_KEY
```

**Important:** `MYAI_API_URL` is the API base URL and must end at `/v1`. Do not add `/chat/completions`.

## 2. Deploy

Upload this project to GitHub and import the repository into Vercel, or deploy the folder with the Vercel CLI. The included `vercel.json` supplies the build, SPA fallback, API rewrite, and streaming function duration.

Build command:

```
npm run build
```

Output directory:

```
dist
```

## 3. API routing

All `/api/*` requests are rewritten to `api/index.ts`, which exports the Express app from `server.ts`. The app's local `listen()` call is disabled automatically on Vercel.

## 4. Streaming

`/api/chat` uses Server-Sent Events. Both the server and browser buffer incomplete SSE lines, so events split across network chunks are preserved. The server also sends periodic SSE heartbeats to reduce idle proxy timeouts.

## 5. If chat still fails

Open the deployed app and retry. The UI now surfaces the HTTP status/body returned by `/api/chat` instead of replacing every failure with a generic connection message. For My AI authentication failures, verify `MYAI_API_KEY`; for a 404, verify `MYAI_API_URL` is exactly the `/v1` base.
