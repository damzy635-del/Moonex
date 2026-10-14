export default function healthHandler(request: { method?: string }, response: {
  status(code: number): { json(body: unknown): void };
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    response.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET for health checks." } });
    return;
  }
  response.setHeader("Cache-Control", "no-store");
  response.json({ status: "ok", service: "moonex-api" });
}
