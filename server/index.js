import express from "express";
import cors from "cors";
import path from "path";
import net from "net";
import http from "http";
import https from "https";
import dns from "dns/promises";
import { fileURLToPath } from "url";
import { mkdir, writeFile } from "fs/promises";
import rateLimit from "express-rate-limit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8787;
const CL_BASE = "https://www.courtlistener.com";
const TOKEN = process.env.COURTLISTENER_TOKEN || process.env.CL_TOKEN || "";

// Optional LLM enrichment (mirrors the n8n Google Gemini extraction node).
const GEMINI_KEY = process.env.GOOGLE_GEMINI_KEY || process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

// Optional delivery sinks (mirror the n8n Webhook + Write-to-disk nodes).
const WEBHOOK_URL = process.env.CASEFILE_WEBHOOK_URL || "";
const ARCHIVE_DIR = process.env.CASEFILE_ARCHIVE_DIR || "";

// Optional shared-password gate for a private/pre-launch deploy. When set, every
// /api call must send `x-access-password` (or ?access=) matching it.
const ACCESS_PASSWORD = process.env.CASEFILE_ACCESS_PASSWORD || "";

// Max records one /api/deliver call may fan out to webhook/disk sinks.
const MAX_DELIVER_BATCH = Number(process.env.MAX_DELIVER_BATCH) || 25;

// Behind a host proxy (Render/Railway/Fly), trust it so rate-limit sees real IPs.
// Only enable when explicitly configured: trusting the proxy unconditionally lets
// any client spoof `X-Forwarded-For` and sidestep the per-IP rate limits below.
// TRUST_PROXY accepts a hop count ("1"), a boolean ("true"/"false"), or an
// Express trust-proxy expression such as "loopback" / a subnet.
const TRUST_PROXY = process.env.TRUST_PROXY;
if (TRUST_PROXY !== undefined && TRUST_PROXY !== "") {
  if (/^\d+$/.test(TRUST_PROXY)) {
    app.set("trust proxy", Number(TRUST_PROXY));
  } else if (TRUST_PROXY === "true" || TRUST_PROXY === "false") {
    app.set("trust proxy", TRUST_PROXY === "true");
  } else {
    app.set("trust proxy", TRUST_PROXY);
  }
}
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Rate limits. Cheap reads get a generous bucket; the LLM/scraping endpoints
// that cost real money get a tight one so a public URL can't drain the wallet.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_API) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
const costlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_COSTLY) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Hourly limit reached for extract/enrich. Try again later." },
});

// Access gate + baseline limiter applied to the whole API surface.
app.use("/api", apiLimiter, (req, res, next) => {
  if (!ACCESS_PASSWORD || req.path === "/health") return next();
  const provided = req.get("x-access-password") || req.query.access;
  if (provided === ACCESS_PASSWORD) return next();
  return res.status(401).json({ error: "Access password required." });
});

function clHeaders(extra = {}) {
  const h = {
    Accept: "application/json",
    "User-Agent": "CaseFile/1.0 (legal-research-demo; contact@casefile.local)",
    ...extra,
  };
  if (TOKEN) h.Authorization = `Token ${TOKEN}`;
  return h;
}

async function clFetch(urlPath, options = {}) {
  const url = urlPath.startsWith("http") ? urlPath : `${CL_BASE}${urlPath}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...clHeaders(options.headers || {}), ...(options.headers || {}) },
  });
  return res;
}

function absoluteLink(relativeOrAbsolute) {
  if (!relativeOrAbsolute) return "";
  if (relativeOrAbsolute.startsWith("http")) return relativeOrAbsolute;
  return `${CL_BASE}${relativeOrAbsolute.startsWith("/") ? "" : "/"}${relativeOrAbsolute}`;
}

function mapSearchResult(item) {
  const opinion = Array.isArray(item.opinions) ? item.opinions[0] : null;
  const opinionId = opinion?.id ?? null;
  const clusterId = item.cluster_id ?? null;
  const linkPath = item.absolute_url || (clusterId ? `/opinion/${clusterId}/` : "");
  const snippet =
    opinion?.snippet ||
    item.snippet ||
    item.syllabus ||
    "";

  return {
    Id: String(opinionId || clusterId || item.docket_id || ""),
    Link: absoluteLink(linkPath),
    Title: item.caseName || item.caseNameFull || "Untitled case",
    caseNameFull: item.caseNameFull || item.caseName || "",
    court: item.court || item.court_citation_string || "",
    courtId: item.court_id || "",
    dateFiled: item.dateFiled || null,
    docketNumber: item.docketNumber || "",
    citation: Array.isArray(item.citation) ? item.citation : [],
    status: item.status || "",
    clusterId,
    opinionId,
    downloadUrl: opinion?.download_url || null,
    snippet: cleanText(snippet),
    opinionText: cleanText(snippet),
    extracted: false,
  };
}

function cleanText(htmlOrText) {
  if (!htmlOrText) return "";
  let t = String(htmlOrText);
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/p>/gi, "\n\n");
  t = t.replace(/<\/div>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  t = t.replace(/[ \t]{2,}/g, " ").trim();
  // Strip common CourtListener chrome
  t = t.replace(/skip to main content/gi, "");
  t = t.replace(/It appears you are using Adblock[\s\S]{0,120}/gi, "");
  return t.trim();
}

// Heuristic: is this string actually binary (PDF/image bytes) rather than
// readable text? Catches PDFs that lie about their content-type.
function looksBinary(s) {
  if (!s) return false;
  const head = s.slice(0, 1000);
  if (head.startsWith("%PDF")) return true;
  if (/endstream|endobj|\/FlateDecode|xref\b/.test(head)) return true;
  // Count replacement char (U+FFFD) and C0 control chars (except tab/newline/CR).
  let bad = 0;
  for (let k = 0; k < head.length; k++) {
    const c = head.charCodeAt(k);
    if (c === 0xfffd || (c < 0x20 && c !== 9 && c !== 10 && c !== 13)) bad++;
  }
  return head.length ? bad / head.length > 0.05 : false;
}

// SSRF guard: only allow fetching public http(s) URLs. Court download links are
// third-party hosts we cannot enumerate, so instead of a host allow-list we
// reject any URL that resolves to a private, loopback, link-local, or otherwise
// non-public address. This blocks a client-supplied downloadUrl from being used
// to reach internal services or cloud metadata endpoints via this server.
function isBlockedIp(ip) {
  const type = net.isIP(ip); // 4, 6, or 0
  if (type === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = p;
    if (a === 0) return true; // "this" network
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (type === 6) {
    const v = ip.toLowerCase().split("%")[0]; // drop zone id
    if (v === "::1" || v === "::") return true; // loopback / unspecified
    if (v.startsWith("fe80")) return true; // link-local
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — validate the embedded IPv4.
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return false;
  }
  return true; // not a valid IP literal — treat as blocked
}

// Hard ceiling on any single third-party download we will buffer.
const MAX_DOWNLOAD_BYTES = Number(process.env.MAX_DOWNLOAD_BYTES) || 2_000_000;

// Validate a URL and return the exact address to connect to. Returning the
// address (rather than a bare boolean) lets the caller pin the connection to the
// IP that was actually validated — without pinning, the hostname is resolved a
// second time at connect and a hostile DNS server can answer "public" during
// validation and "internal" at connect time (DNS rebinding).
async function resolvePublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname;
  // Bare IP literal: no DNS involved, so validate it directly.
  const literal = net.isIP(host);
  if (literal) {
    if (isBlockedIp(host)) return null;
    return { parsed, address: host, family: literal };
  }

  // Resolve once, reject if ANY answer is non-public, and pin the first address.
  try {
    const records = await dns.lookup(host, { all: true });
    if (!records.length) return null;
    for (const { address } of records) {
      if (isBlockedIp(address)) return null;
    }
    return { parsed, address: records[0].address, family: records[0].family };
  } catch {
    return null; // unresolvable host — do not fetch
  }
}

// Single request to an already-validated target, pinned to `address`. The URL's
// hostname is preserved so the Host header and TLS SNI stay correct.
//
// `deadline` is an absolute wall-clock timestamp, not an idle timeout: a hostile
// endpoint can trickle one byte at a time to reset an inactivity timer forever,
// so the socket is destroyed once the deadline passes regardless of activity.
function requestPinned({ parsed, address, family }, { headers, deadline }) {
  return new Promise((resolve, reject) => {
    const mod = parsed.protocol === "https:" ? https : http;
    // Node calls lookup with {all:true} when autoSelectFamily is on (default in
    // Node 20+), which expects an array; older callers expect (address, family).
    const lookup = (_hostname, opts, cb) =>
      opts && opts.all ? cb(null, [{ address, family }]) : cb(null, address, family);

    const req = mod.request(parsed, { method: "GET", headers, lookup }, resolve);
    const timer = setTimeout(
      () => req.destroy(new Error("download deadline exceeded")),
      Math.max(1, deadline - Date.now())
    );
    timer.unref?.(); // never hold the process open
    const clear = () => clearTimeout(timer);
    req.on("close", clear); // fires once the response is done or the socket dies
    req.on("error", (err) => {
      clear();
      reject(err);
    });
    req.end();
  });
}

// Read a response body with a hard byte ceiling, aborting mid-stream once the
// limit is passed. Buffering the whole body first (res.text()) would let a
// hostile endpoint stream unbounded data and exhaust memory before any cap.
async function readCapped(res, maxBytes, deadline) {
  const declared = Number(res.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) {
    res.destroy();
    return null;
  }
  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of res) {
      // Stop on wall-clock deadline as well as size: a slow trickle can stay
      // under the byte cap indefinitely while holding the connection open.
      if (deadline && Date.now() > deadline) {
        res.destroy();
        return null;
      }
      total += chunk.length;
      if (total > maxBytes) {
        res.destroy();
        return null; // oversized — stop reading immediately
      }
      chunks.push(chunk);
    }
  } catch {
    return null;
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Redirect-safe, rebinding-safe, size-capped fetch for third-party URLs.
// Every hop is re-validated and pinned; the body is streamed under a byte cap.
async function safeFetch(
  rawUrl,
  { headers = {}, totalTimeoutMs = 10_000, maxRedirects = 5, maxBytes = MAX_DOWNLOAD_BYTES } = {}
) {
  // One absolute budget for the whole operation — DNS, connect, every redirect
  // hop, and the body read. A per-request idle timeout would let a hostile host
  // trickle bytes (or chain slow redirects) and hold resources indefinitely.
  const deadline = Date.now() + totalTimeoutMs;
  let url = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (Date.now() >= deadline) return null;

    const target = await resolvePublicUrl(url);
    if (!target) return null; // blocked, unresolvable, or non-http(s)
    if (Date.now() >= deadline) return null; // DNS may have consumed the budget

    let res;
    try {
      res = await requestPinned(target, { headers, deadline });
    } catch {
      return null; // connection error or deadline hit
    }
    const status = res.statusCode;

    if (status >= 300 && status < 400) {
      const loc = res.headers.location;
      // Destroy rather than drain: draining a hostile redirect body is itself an
      // unbounded read, and we never need a redirect's content.
      res.destroy();
      if (!loc) return null;
      try {
        url = new URL(loc, url).toString(); // resolve relative redirects
      } catch {
        return null;
      }
      continue; // next hop re-validates + re-pins at the top of the loop
    }

    const contentType = String(res.headers["content-type"] || "").toLowerCase();
    const text = await readCapped(res, maxBytes, deadline);
    if (text === null) return null; // oversized, too slow, or read error
    return { ok: status >= 200 && status < 300, status, contentType, text };
  }
  return null; // too many redirects
}

async function fetchOpinionFullText(caseItem) {
  // 1) Authenticated API path
  if (TOKEN && caseItem.opinionId) {
    try {
      const res = await clFetch(`/api/rest/v4/opinions/${caseItem.opinionId}/`);
      if (res.ok) {
        const data = await res.json();
        const text =
          data.plain_text ||
          cleanText(data.html_with_citations || data.html || data.html_lawbox || "");
        if (text && text.length > 80) {
          return { text, source: "courtlistener-api", extracted: true };
        }
      }
    } catch {
      /* fall through */
    }
  }

  // 2) Public download_url from court site when present. safeFetch validates the
  // URL and every redirect hop against the SSRF guard before fetching.
  if (caseItem.downloadUrl && /^https?:\/\//i.test(caseItem.downloadUrl)) {
    try {
      const res = await safeFetch(caseItem.downloadUrl, {
        headers: {
          "User-Agent": "CaseFile/1.0 (legal-research-demo)",
          Accept: "text/html,application/xhtml+xml,text/plain",
        },
        // Total wall-clock budget for DNS + connect + redirects + body.
        totalTimeoutMs: Number(process.env.DOWNLOAD_TIMEOUT_MS) || 10_000,
      });
      if (res && res.ok) {
        // Only accept textual downloads. Court sites frequently serve PDFs,
        // whose raw bytes would otherwise be dumped as mojibake.
        const ctype = res.contentType;
        const isTextual = /text\/html|xhtml|text\/plain/.test(ctype) || ctype === "";
        if (isTextual) {
          const raw = res.text;
          if (!looksBinary(raw)) {
            const text = cleanText(raw);
            if (text && text.length > 200) {
              // Cap extremely long downloads for JSON export sanity
              const capped =
                text.length > 120000 ? text.slice(0, 120000) + "\n\n[truncated]" : text;
              return { text: capped, source: "court-download", extracted: true };
            }
          }
        }
        // Non-text (PDF, etc.) — fall through to the snippet rather than
        // returning unreadable bytes.
      }
    } catch {
      /* fall through */
    }
  }

  // 3) Snippet fallback from search index
  return {
    text: caseItem.snippet || caseItem.opinionText || "",
    source: "search-snippet",
    extracted: Boolean(caseItem.snippet && caseItem.snippet.length > 40),
  };
}

// Field shape the enrichment LLM is asked to fill (values are descriptions).
const ENRICH_SCHEMA = {
  summary: "2-3 sentence neutral summary of the holding",
  court: "issuing court",
  jurisdiction: "federal | state name | tribal | other",
  outcome: "affirmed | reversed | remanded | dismissed | mixed | unknown",
  precedents: "array of cited case names, [] if none",
};

// Best-effort structured extraction over the opinion text. Returns null when no
// key is configured or the call fails, so enrichment never breaks a request.
async function enrichWithLlm(caseItem) {
  const text = caseItem.opinionText || caseItem.snippet || "";
  if (!GEMINI_KEY || !text) return null;

  const prompt =
    `You are an expert legal-case data extractor. Return ONLY JSON matching this shape ` +
    `(values describe each field): ${JSON.stringify(ENRICH_SCHEMA)}.\n\n` +
    `Case: ${caseItem.Title || "Untitled"}\nCourt (hint): ${caseItem.court || "unknown"}\n\n` +
    `Opinion text:\n${text.slice(0, 24000)}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(20000),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[enrich] Gemini HTTP ${res.status}: ${body.slice(0, 300)}`);
      return null;
    }
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw) {
      console.error(`[enrich] Empty response: ${JSON.stringify(data).slice(0, 300)}`);
      return null;
    }
    const parsed = JSON.parse(raw);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      court: typeof parsed.court === "string" ? parsed.court : "",
      jurisdiction: typeof parsed.jurisdiction === "string" ? parsed.jurisdiction : "",
      outcome: typeof parsed.outcome === "string" ? parsed.outcome : "",
      precedents: Array.isArray(parsed.precedents) ? parsed.precedents.map(String) : [],
    };
  } catch (e) {
    console.error(`[enrich] ${e.name}: ${e.message}`);
    return null;
  }
}

// Deliver one record to the configured sinks (webhook POST + disk archive).
// Mirrors the n8n Webhook Notification and Write-to-disk nodes.
async function deliverRecord(record) {
  const results = {};

  if (WEBHOOK_URL) {
    try {
      const r = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
        signal: AbortSignal.timeout(8000),
      });
      results.webhook = r.ok ? "sent" : `failed:${r.status}`;
    } catch (e) {
      results.webhook = `error:${e.message}`;
    }
  }

  if (ARCHIVE_DIR) {
    try {
      await mkdir(ARCHIVE_DIR, { recursive: true });
      // Sanitize Id so it can never escape ARCHIVE_DIR via path segments.
      const safeId = String(record.Id ?? "unknown").replace(/[^\w-]/g, "") || "unknown";
      await writeFile(
        path.join(ARCHIVE_DIR, `Case-${safeId}.json`),
        JSON.stringify(record, null, 2),
        "utf8"
      );
      results.archived = true;
    } catch (e) {
      results.archived = `error:${e.message}`;
    }
  }

  return results;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "CaseFile",
    courtlistenerToken: Boolean(TOKEN),
    llmEnrichment: Boolean(GEMINI_KEY),
    sinks: { webhook: Boolean(WEBHOOK_URL), archive: Boolean(ARCHIVE_DIR) },
  });
});

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.status(400).json({ error: "Query parameter q is required." });
    }

    const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 15, 1), 30);
    const orderBy = String(req.query.order_by || "score desc");
    const params = new URLSearchParams({
      q,
      type: "o",
      order_by: orderBy,
      page_size: String(pageSize),
    });

    // Mirror n8n template filters when requested
    if (req.query.stat_Published === "on" || req.query.published === "1") {
      params.set("stat_Published", "on");
    }

    const clRes = await clFetch(`/api/rest/v4/search/?${params.toString()}`);
    if (!clRes.ok) {
      const body = await clRes.text();
      return res.status(clRes.status).json({
        error: "CourtListener search failed",
        detail: body.slice(0, 500),
      });
    }

    const data = await clRes.json();
    // CourtListener may ignore page_size without a token; enforce client page size here.
    const results = (data.results || []).map(mapSearchResult).slice(0, pageSize);

    res.json({
      query: q,
      count: data.count ?? results.length,
      next: data.next || null,
      results,
      meta: {
        source: "courtlistener",
        orderedBy: orderBy,
        pageSize,
        tokenMode: Boolean(TOKEN),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed", detail: String(err.message || err) });
  }
});

app.post("/api/extract", costlyLimiter, async (req, res) => {
  try {
    const cases = Array.isArray(req.body?.cases) ? req.body.cases : [];
    if (!cases.length) {
      return res.status(400).json({ error: "Body must include cases: []" });
    }

    // Cap how many opinions we scrape per call to bound cost/latency. The default
    // search page is 15, so cover a full page; anything beyond is reported as
    // skipped rather than silently dropped.
    const MAX_EXTRACT = Number(process.env.EXTRACT_MAX) || 15;
    const limit = Math.min(cases.length, MAX_EXTRACT);
    const extracted = [];

    for (let i = 0; i < limit; i++) {
      const c = cases[i];
      const full = await fetchOpinionFullText(c);
      extracted.push({
        Id: c.Id,
        Link: c.Link,
        Title: c.Title,
        court: c.court || "",
        dateFiled: c.dateFiled || null,
        docketNumber: c.docketNumber || "",
        citation: c.citation || [],
        opinionText: full.text,
        textSource: full.source,
        extracted: full.extracted,
      });
      // Gentle pacing to respect upstream
      if (i < limit - 1) await new Promise((r) => setTimeout(r, 350));
    }

    res.json({
      count: extracted.length,
      requested: cases.length,
      skipped: Math.max(0, cases.length - limit),
      cases: extracted,
      schema: ["Id", "Link", "Title", "opinionText"],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Extract failed", detail: String(err.message || err) });
  }
});

app.post("/api/enrich", costlyLimiter, async (req, res) => {
  try {
    const cases = Array.isArray(req.body?.cases) ? req.body.cases : [];
    if (!cases.length) {
      return res.status(400).json({ error: "Body must include cases: []" });
    }
    if (!GEMINI_KEY) {
      return res.json({
        count: 0,
        cases: [],
        mode: "disabled",
        detail: "Set GOOGLE_GEMINI_KEY to enable LLM enrichment.",
      });
    }

    const limit = Math.min(cases.length, 8);
    const enriched = [];
    for (let i = 0; i < limit; i++) {
      const meta = await enrichWithLlm(cases[i]);
      enriched.push({ Id: cases[i].Id, enriched: Boolean(meta), ...(meta || {}) });
      // Pace requests, echoing the n8n Wait node between case extractions.
      if (i < limit - 1) await new Promise((r) => setTimeout(r, 500));
    }

    res.json({ count: enriched.length, cases: enriched, mode: "gemini", model: GEMINI_MODEL });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Enrich failed", detail: String(err.message || err) });
  }
});

app.post("/api/deliver", costlyLimiter, async (req, res) => {
  try {
    const cases = Array.isArray(req.body?.cases) ? req.body.cases : [];
    if (!cases.length) {
      return res.status(400).json({ error: "Body must include cases: []" });
    }
    if (!WEBHOOK_URL && !ARCHIVE_DIR) {
      return res.status(400).json({
        error: "No delivery sink configured",
        detail: "Set CASEFILE_WEBHOOK_URL and/or CASEFILE_ARCHIVE_DIR.",
      });
    }
    // Fail closed: delivery turns one request into outbound POSTs / disk writes,
    // so it must never be reachable anonymously. Require the access gate.
    if (!ACCESS_PASSWORD) {
      return res.status(403).json({
        error: "Delivery requires authorization",
        detail:
          "Set CASEFILE_ACCESS_PASSWORD to enable /api/deliver when a webhook or archive sink is configured.",
      });
    }

    // Cap the fan-out: one 2MB request could otherwise carry tens of thousands
    // of records and amplify into that many outbound requests or file writes.
    const limit = Math.min(cases.length, MAX_DELIVER_BATCH);
    const delivered = [];
    for (let i = 0; i < limit; i++) {
      const c = cases[i];
      delivered.push({ Id: c.Id, ...(await deliverRecord(c)) });
    }

    res.json({
      count: delivered.length,
      skipped: Math.max(0, cases.length - limit),
      delivered,
      sinks: { webhook: Boolean(WEBHOOK_URL), archive: Boolean(ARCHIVE_DIR) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Deliver failed", detail: String(err.message || err) });
  }
});

// Fetches a third-party download URL like /api/extract, so it carries the same
// tighter limiter rather than only the generous baseline one.
app.get("/api/case/:id", costlyLimiter, async (req, res) => {
  try {
    const id = req.params.id;
    const seed = {
      Id: id,
      Link: req.query.link ? String(req.query.link) : `${CL_BASE}/opinion/${id}/`,
      Title: String(req.query.title || "Case"),
      opinionId: /^\d+$/.test(id) ? Number(id) : null,
      downloadUrl: req.query.downloadUrl ? String(req.query.downloadUrl) : null,
      snippet: "",
    };
    const full = await fetchOpinionFullText(seed);
    res.json({
      Id: seed.Id,
      Link: seed.Link,
      Title: seed.Title,
      opinionText: full.text,
      textSource: full.source,
      extracted: full.extracted,
    });
  } catch (err) {
    res.status(500).json({ error: "Case fetch failed", detail: String(err.message || err) });
  }
});

// Production static serve (SPA fallback)
const dist = path.join(__dirname, "..", "dist");
app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) return next();
  res.sendFile(path.join(dist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`CaseFile API on http://localhost:${PORT}`);
  console.log(`CourtListener token: ${TOKEN ? "configured" : "not set (search + snippets)"}`);
  console.log(`LLM enrichment: ${GEMINI_KEY ? `${GEMINI_MODEL}` : "off (set GOOGLE_GEMINI_KEY)"}`);
  console.log(
    `Delivery sinks: webhook ${WEBHOOK_URL ? "on" : "off"}, archive ${ARCHIVE_DIR || "off"}`
  );
  console.log(`Access gate: ${ACCESS_PASSWORD ? "ON (password required)" : "off (public)"}`);
  console.log(
    `Rate limits: ${apiLimiter.max ?? "?"}/15m api, ${costlyLimiter.max ?? "?"}/60m extract+enrich`
  );
});
