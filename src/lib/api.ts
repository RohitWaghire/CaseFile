export interface CaseRecord {
  Id: string;
  Link: string;
  Title: string;
  caseNameFull?: string;
  court?: string;
  courtId?: string;
  dateFiled?: string | null;
  docketNumber?: string;
  citation?: string[];
  status?: string;
  clusterId?: number | null;
  opinionId?: number | null;
  downloadUrl?: string | null;
  snippet?: string;
  opinionText?: string;
  textSource?: string;
  extracted?: boolean;
  // LLM enrichment (optional, populated by /api/enrich)
  summary?: string;
  jurisdiction?: string;
  outcome?: string;
  precedents?: string[];
  enriched?: boolean;
}

export interface EnrichResponse {
  count: number;
  cases: Array<{
    Id: string;
    enriched: boolean;
    summary?: string;
    court?: string;
    jurisdiction?: string;
    outcome?: string;
    precedents?: string[];
  }>;
  mode: "gemini" | "disabled";
  model?: string;
  detail?: string;
}

export interface SearchResponse {
  query: string;
  count: number;
  next: string | null;
  results: CaseRecord[];
  meta: {
    source: string;
    orderedBy: string;
    pageSize: number;
    tokenMode: boolean;
  };
}

export interface ExtractResponse {
  count: number;
  cases: CaseRecord[];
  schema: string[];
}

export function exportSchema(cases: CaseRecord[]) {
  return cases.map((c) => ({
    Id: c.Id,
    Link: c.Link,
    Title: c.Title,
    court: c.court || "",
    dateFiled: c.dateFiled || null,
    docketNumber: c.docketNumber || "",
    citation: c.citation || [],
    opinionText: c.opinionText || c.snippet || "",
    textSource: c.textSource || (c.extracted ? "extracted" : "snippet"),
    // Enrichment fields are only included once populated, keeping exports lean.
    ...(c.enriched
      ? {
          summary: c.summary || "",
          jurisdiction: c.jurisdiction || "",
          outcome: c.outcome || "",
          precedents: c.precedents || [],
        }
      : {}),
  }));
}

// Access gate: when the server runs with CASEFILE_ACCESS_PASSWORD set, API calls
// must carry a matching password. We store it locally and prompt once on a 401.
const ACCESS_KEY = "casefile:access";

function accessHeaders(base: Record<string, string> = {}): Record<string, string> {
  const pw = localStorage.getItem(ACCESS_KEY);
  return pw ? { ...base, "x-access-password": pw } : base;
}

// Single fetch wrapper: injects the access header and, on a 401, prompts for the
// password once and retries. Keeps the gate usable without a full login screen.
async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const withPw = { ...init, headers: accessHeaders(init.headers as Record<string, string>) };
  let res = await fetch(input, withPw);
  if (res.status === 401) {
    const pw = window.prompt("This CaseFile instance is private. Enter the access password:");
    if (pw) {
      localStorage.setItem(ACCESS_KEY, pw);
      res = await fetch(input, {
        ...init,
        headers: accessHeaders(init.headers as Record<string, string>),
      });
    }
    if (res.status === 401) localStorage.removeItem(ACCESS_KEY);
  }
  return res;
}

export async function searchCases(
  query: string,
  options?: { pageSize?: number; published?: boolean; signal?: AbortSignal }
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page_size: String(options?.pageSize ?? 15),
    order_by: "dateFiled desc",
  });
  if (options?.published !== false) params.set("stat_Published", "on");

  const res = await apiFetch(`/api/search?${params}`, { signal: options?.signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || `Search failed (${res.status})`);
  }
  return res.json();
}

export async function extractCases(
  cases: CaseRecord[],
  signal?: AbortSignal
): Promise<ExtractResponse> {
  const res = await apiFetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cases }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || `Extract failed (${res.status})`);
  }
  return res.json();
}

export async function enrichCases(
  cases: CaseRecord[],
  signal?: AbortSignal
): Promise<EnrichResponse> {
  const res = await apiFetch("/api/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cases }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || `Enrich failed (${res.status})`);
  }
  return res.json();
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slugifyQuery(q: string) {
  return (
    q
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "cases"
  );
}
