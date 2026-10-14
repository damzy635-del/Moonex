import { MODEL_PROFILES } from "../../packages/model-catalog/index.js";

export default function modelsHandler(request: { method?: string }, response: {
  status(code: number): { json(body: unknown): void };
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    response.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET to list available model profiles." } });
    return;
  }
  response.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  response.json({ models: MODEL_PROFILES });
}
