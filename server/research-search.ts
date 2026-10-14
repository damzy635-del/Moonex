export type ResearchSource = {
  title: string;
  url: string;
  content: string;
};

type TavilyResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
};

type TavilyResponse = { results?: unknown };

export async function searchWeb(
  query: string,
  apiKey: string,
  signal: AbortSignal = AbortSignal.timeout(12_000),
  fetcher: typeof fetch = fetch,
): Promise<ResearchSource[]> {
  const normalizedQuery = query.trim().slice(0, 2_000);
  if (!normalizedQuery) throw new Error("Research query is empty.");

  const response = await fetcher("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: normalizedQuery,
      search_depth: "advanced",
      topic: "general",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
    }),
    signal,
  });
  if (!response.ok) throw new Error(`Web search failed with status ${response.status}.`);

  const payload = await response.json() as TavilyResponse;
  if (!Array.isArray(payload.results)) return [];

  const sources: ResearchSource[] = [];
  const seen = new Set<string>();
  for (const item of payload.results as TavilyResult[]) {
    if (!item || typeof item !== "object") continue;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 300) : "";
    const url = typeof item.url === "string" ? item.url.trim() : "";
    const content = typeof item.content === "string" ? item.content.trim().slice(0, 4_000) : "";
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      continue;
    }
    if (!title || !content || !["https:", "http:"].includes(parsedUrl.protocol) || seen.has(parsedUrl.href)) continue;
    seen.add(parsedUrl.href);
    sources.push({ title, url: parsedUrl.href, content });
    if (sources.length === 5) break;
  }
  return sources;
}
