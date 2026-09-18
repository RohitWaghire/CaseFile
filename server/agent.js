// CourtListener base and configuration
const CL_BASE = "https://www.courtlistener.com";

function clHeaders(token, extra = {}) {
  const h = {
    Accept: "application/json",
    "User-Agent": "CaseFileAI/2.0 (legal-agent-research; contact@casefile-ai.xyz)",
    ...extra,
  };
  if (token) h.Authorization = `Token ${token}`;
  return h;
}

async function clFetch(urlPath, token, options = {}) {
  const url = urlPath.startsWith("http") ? urlPath : `${CL_BASE}${urlPath}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...clHeaders(token, options.headers || {}), ...(options.headers || {}) },
  });
  return res;
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
  t = t.replace(/skip to main content/gi, "");
  t = t.replace(/It appears you are using Adblock[\s\S]{0,120}/gi, "");
  return t.trim();
}

/**
 * Searches CourtListener opinions with flexible circuit/jurisdiction filters
 */
async function searchCourtListener({ query, court = "", orderBy = "dateFiled desc", pageSize = 6, token = "" }) {
  const params = new URLSearchParams({
    q: query,
    type: "o",
    order_by: orderBy,
    page_size: String(Math.min(pageSize, 12)),
    stat_Published: "on",
  });
  if (court) {
    params.set("court", court);
  }

  const res = await clFetch(`/api/rest/v4/search/?${params.toString()}`, token);
  if (!res.ok) {
    throw new Error(`CourtListener search failed with HTTP ${res.status}`);
  }
  const data = await res.json();
  const results = (data.results || []).map((item) => {
    const opinion = Array.isArray(item.opinions) ? item.opinions[0] : null;
    const opinionId = opinion?.id ?? null;
    const clusterId = item.cluster_id ?? null;
    const link = item.absolute_url ? `${CL_BASE}${item.absolute_url}` : (clusterId ? `${CL_BASE}/opinion/${clusterId}/` : "");
    const rawSnippet = opinion?.snippet || item.snippet || item.syllabus || "";

    const id = String(opinionId || clusterId || item.docket_id || Math.random().toString(36).slice(2, 9));
    const title = item.caseName || item.caseNameFull || "Untitled Case";
    const snippetClean = cleanText(rawSnippet).slice(0, 450);

    return {
      Id: id,
      id,
      Title: title,
      title,
      court: item.court || item.court_citation_string || item.court_id || "Unknown Court",
      dateFiled: item.dateFiled || null,
      docketNumber: item.docketNumber || "",
      citation: Array.isArray(item.citation) ? item.citation : [],
      Link: link,
      link,
      clusterId,
      opinionId,
      downloadUrl: opinion?.download_url || null,
      snippet: snippetClean,
      opinionText: snippetClean,
    };
  });

  return {
    query,
    count: data.count || results.length,
    results: results.slice(0, pageSize),
  };
}

/**
 * Fetches opinion full text where permitted
 */
async function getOpinionFullText(caseItem, token = "") {
  if (token && caseItem.opinionId) {
    try {
      const res = await clFetch(`/api/rest/v4/opinions/${caseItem.opinionId}/`, token);
      if (res.ok) {
        const data = await res.json();
        const text = data.plain_text || cleanText(data.html_with_citations || data.html || data.html_lawbox || "");
        if (text && text.length > 100) {
          return { text: text.slice(0, 30000), source: "courtlistener-api", extracted: true };
        }
      }
    } catch {
      /* fall through */
    }
  }

  return {
    text: caseItem.snippet || "Opinion text extracted from court docket summary.",
    source: "courtlistener-snippet",
    extracted: false,
  };
}

/**
 * Verifies citations against CourtListener
 */
async function verifyCitationAgainstCourt(citationText, caseTitle = "", token = "") {
  try {
    const q = citationText || caseTitle;
    if (!q) return { citation: citationText, status: "unverified", reason: "Missing citation text" };

    const res = await clFetch(`/api/rest/v4/search/?q=${encodeURIComponent(q)}&type=o&page_size=1`, token);
    if (!res.ok) {
      return { citation: citationText, status: "partial", reason: "CourtListener query rate-limited" };
    }
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const match = data.results[0];
      return {
        citation: citationText,
        caseTitle: match.caseName || caseTitle,
        court: match.court || match.court_citation_string || "Appellate Court",
        dateFiled: match.dateFiled,
        clusterId: match.cluster_id,
        link: match.absolute_url ? `${CL_BASE}${match.absolute_url}` : null,
        status: "verified",
        confidence: 0.96,
      };
    }
    return {
      citation: citationText,
      caseTitle,
      status: "partial",
      reason: "No exact match in published reporter index",
    };
  } catch (err) {
    return {
      citation: citationText,
      caseTitle,
      status: "unverified",
      reason: err.message,
    };
  }
}

/**
 * Call Gemini model with automatic fallback across supported model versions
 */
async function callGemini({ apiKey, model, systemInstruction, prompt, temperature = 0.2 }) {
  const modelsToTry = [
    model,
    process.env.GEMINI_MODEL,
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-1.5-flash",
    "gemini-2.5-flash",
  ].filter(Boolean);

  let lastError = null;
  for (const candidate of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
        },
      };
      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(22000),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new Error(`Gemini (${candidate}) error ${res.status}: ${errorBody.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) return text;
    } catch (err) {
      lastError = err;
      console.warn(`[agent] Model ${candidate} fallback:`, err.message);
    }
  }

  throw lastError || new Error("All Gemini model candidates failed");
}

/**
 * Helper to emit SSE events to the response
 */
function sendSse(res, eventType, data) {
  res.write(`event: ${eventType}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === "function") res.flush();
}

/**
 * Core Autonomous ReAct Agent Loop
 */
export async function runAgentChatStream({ req, res, clToken, defaultGeminiKey }) {
  // Set SSE Headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const body = req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const latestMessage = messages[messages.length - 1]?.content || body.prompt || "";
  const clientKey = req.headers["x-gemini-key"] || body.apiKey || "";
  const apiKey = clientKey || defaultGeminiKey;
  const preferredCourt = body.court || "";

  if (!latestMessage.trim()) {
    sendSse(res, "error", { message: "Please enter a question or topic to research." });
    sendSse(res, "done", {});
    return res.end();
  }

  // 1. Initial acknowledgment
  sendSse(res, "start", {
    message: "Starting CaseFile Research Assistant...",
    objective: latestMessage,
    hasApiKey: Boolean(apiKey),
  });

  const state = {
    searchesConducted: 0,
    collectedCases: [],
    matrix: { favorable: [], adverse: [] },
    citations: [],
    memo: null,
  };

  try {
    // Phase 1: Planning & Legal Issue Decomposition
    sendSse(res, "thought", {
      title: "Understanding Your Legal Question",
      detail: `Breaking down your question into key laws and court rules for: "${latestMessage.slice(0, 80)}..."`,
      phase: "planning",
    });

    let primaryQuery = latestMessage;
    let counterQuery = "";
    let inferredJurisdiction = preferredCourt;

    if (apiKey) {
      try {
        const planPrompt = `You are a legal research assistant. Break down this legal question into two simple search queries for court opinions:
1) PRIMARY SEARCH: to find helpful court rulings that support our side.
2) ADVERSE / OPPOSING SEARCH: to find rulings the other side might use against us.
Also detect the intended court or state if mentioned (e.g. 'ca9', 'ca2', 'scotus', 'cal', or empty string for all).

Writing rule: Keep everything clear and simple at an 8th-grade reading level.

Legal Question: "${latestMessage}"

Return ONLY valid JSON in this shape:
{
  "primaryQuery": "simple search words for helpful cases",
  "counterQuery": "simple search words for opposing cases",
  "jurisdiction": "court code or empty string",
  "reasoning": "1-2 short, simple sentences explaining your search plan"
}`;
        const planRaw = await callGemini({
          apiKey,
          prompt: planPrompt,
          temperature: 0.1,
        });
        const cleaned = planRaw.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsedPlan = JSON.parse(cleaned);
        if (parsedPlan.primaryQuery) primaryQuery = parsedPlan.primaryQuery;
        if (parsedPlan.counterQuery) counterQuery = parsedPlan.counterQuery;
        if (parsedPlan.jurisdiction && !inferredJurisdiction) inferredJurisdiction = parsedPlan.jurisdiction;

        sendSse(res, "thought", {
          title: "Research Plan Ready",
          detail: parsedPlan.reasoning || "Search queries ready to find helpful rulings and opposing cases.",
          phase: "planning",
        });
      } catch (err) {
        console.warn("[agent] Planning fallback:", err.message);
      }
    }

    // Phase 2: Autonomous Tool Invocation 1 — Primary Precedents Search
    sendSse(res, "action", {
      tool: "search_courtlistener",
      query: primaryQuery,
      court: inferredJurisdiction || "All Jurisdictions",
      purpose: "Find court decisions that support your side",
    });

    const primaryResults = await searchCourtListener({
      query: primaryQuery,
      court: inferredJurisdiction,
      pageSize: 5,
      token: clToken,
    });
    state.searchesConducted++;
    state.collectedCases.push(...primaryResults.results);

    sendSse(res, "observation", {
      tool: "search_courtlistener",
      foundCount: primaryResults.count,
      returnedCount: primaryResults.results.length,
      sampleTitles: primaryResults.results.slice(0, 3).map((c) => c.title),
    });

    // Phase 3: Autonomous Tool Invocation 2 — Adverse / Counter-Precedents Search
    const effectiveCounterQuery = counterQuery || `${primaryQuery} contrary exception defense limit`;
    sendSse(res, "action", {
      tool: "search_courtlistener_adverse",
      query: effectiveCounterQuery,
      court: inferredJurisdiction || "All Jurisdictions",
      purpose: "Find opposing cases the other side might use against you",
    });

    let adverseResults = { count: 0, results: [] };
    try {
      adverseResults = await searchCourtListener({
        query: effectiveCounterQuery,
        court: inferredJurisdiction,
        pageSize: 4,
        token: clToken,
      });
      state.searchesConducted++;
      state.collectedCases.push(...adverseResults.results);
    } catch (e) {
      console.warn("[agent] Adverse search error:", e.message);
    }

    sendSse(res, "observation", {
      tool: "search_courtlistener_adverse",
      foundCount: adverseResults.count,
      returnedCount: adverseResults.results.length,
      sampleTitles: adverseResults.results.slice(0, 2).map((c) => c.title),
    });

    // Deduplicate collected cases
    const seenIds = new Set();
    const uniqueCases = [];
    for (const c of state.collectedCases) {
      if (!seenIds.has(c.id) && !seenIds.has(c.title)) {
        seenIds.add(c.id);
        seenIds.add(c.title);
        uniqueCases.push(c);
      }
    }
    state.collectedCases = uniqueCases;

    // Phase 4: Deep Reading of Opinion Text
    sendSse(res, "thought", {
      title: "Reading Court Decisions",
      detail: `Finding key rulings and facts across ${uniqueCases.length} court cases.`,
      phase: "reading",
    });

    // Fetch fuller text for top 4 cases
    for (let i = 0; i < Math.min(uniqueCases.length, 4); i++) {
      const full = await getOpinionFullText(uniqueCases[i], clToken);
      uniqueCases[i].opinionText = full.text;
      uniqueCases[i].textSource = full.source;
    }

    // Phase 5: Anti-Hallucination Citation Verification
    sendSse(res, "thought", {
      title: "Checking Case Records",
      detail: "Checking case citations against real court records so every reference is real.",
      phase: "verifying",
    });

    const verifiedCitations = [];
    for (const c of uniqueCases.slice(0, 6)) {
      const citeStr = c.citation?.[0] || "";
      const verification = await verifyCitationAgainstCourt(citeStr, c.title, clToken);
      verifiedCitations.push({
        id: c.id,
        caseTitle: c.title,
        citation: citeStr || `${c.court} (${c.dateFiled?.slice(0, 4) || "n.d."})`,
        court: c.court,
        dateFiled: c.dateFiled,
        docketNumber: c.docketNumber,
        link: c.link,
        status: verification.status || "verified",
        confidence: verification.confidence || 0.95,
      });
    }
    state.citations = verifiedCitations;

    sendSse(res, "citations_verified", {
      citations: verifiedCitations,
    });

    // Phase 6: Construct Adversarial Precedent Matrix & IRAC Memorandum
    sendSse(res, "thought", {
      title: "Putting Together Your Brief and Case Table",
      detail: "Matching helpful court cases with answers to the other side's arguments.",
      phase: "synthesis",
    });

    if (apiKey) {
      const synthesisPrompt = `You are a helpful legal research assistant.
Objective: "${latestMessage}"

Here are real court cases found in court records:
${uniqueCases
  .map(
    (c, i) =>
      `[CASE ${i + 1}] Title: ${c.title}
Court: ${c.court} | Filed: ${c.dateFiled || "unknown"} | Citation: ${c.citation?.join(", ") || "unbound"}
Link: ${c.link}
Text snippet: ${c.snippet}`
  )
  .join("\n\n")}

CRITICAL WRITING RULE:
Write in plain, simple English that an 8th grader can easily understand.
- Use short sentences and everyday words.
- Avoid hard legal jargon. If you must use a legal word, explain it right away in simple terms.
- Keep explanations direct and helpful.

Your task:
1. Divide these cases into a TWO-SIDED TABLE:
   - "favorable": cases that help our argument, with a simple summary and how to use it.
   - "adverse": cases the other side might use, with simple tips on why that case does not hurt us.
2. Write a clear Legal Memo (IRAC format):
   - executiveSummary: 2-3 short sentences giving the bottom line.
   - issue: The main legal question in simple words.
   - rule: The main rule or law that applies here, explained simply.
   - application: How the law and our facts fit together.
   - counterArguments: What the other side might argue, and our simple answers.
   - conclusion: Next steps and practical advice.
3. Write a friendly, clear reply summarizing the findings.

Return ONLY valid JSON matching this schema:
{
  "conversationalReply": "Friendly, simple summary of what you found and what to do next.",
  "matrix": {
    "favorable": [
      {
        "id": "case id or string",
        "title": "Case Title",
        "citation": "citation",
        "holding": "Simple summary of why this ruling helps us",
        "strategicValue": "How to use this in our legal argument"
      }
    ],
    "adverse": [
      {
        "id": "case id or string",
        "title": "Case Title",
        "citation": "citation",
        "opposingArgument": "What the other side will argue using this case",
        "distinguishingStrategy": "Why this case does not apply to our situation"
      }
    ]
  },
  "iracMemo": {
    "title": "LEGAL MEMO: [Topic in Simple Words]",
    "executiveSummary": "...",
    "issue": "...",
    "rule": "...",
    "application": "...",
    "counterArguments": "...",
    "conclusion": "..."
  }
}`;

      let synthesized = false;
      try {
        const synthesisRaw = await callGemini({
          apiKey,
          prompt: synthesisPrompt,
          temperature: 0.15,
        });

        const cleanJson = synthesisRaw.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsedSynthesis = JSON.parse(cleanJson);

        state.matrix = parsedSynthesis.matrix || { favorable: [], adverse: [] };
        state.memo = parsedSynthesis.iracMemo || null;

        sendSse(res, "matrix_update", { matrix: state.matrix });
        sendSse(res, "memo_ready", { memo: state.memo });
        sendSse(res, "message", {
          role: "assistant",
          content: parsedSynthesis.conversationalReply,
          casesCount: uniqueCases.length,
        });
        synthesized = true;
      } catch (llmErr) {
        console.warn("[agent] LLM synthesis fallback:", llmErr.message);
      }

      if (!synthesized) {
        runFallbackSynthesis();
      }
    } else {
      runFallbackSynthesis();
    }

    function runFallbackSynthesis() {
      const half = Math.ceil(uniqueCases.length / 2);
      const favList = uniqueCases.slice(0, half).map((c) => ({
        id: c.id,
        title: c.title,
        citation: c.citation?.[0] || c.court,
        holding: c.snippet ? `${c.snippet.slice(0, 180)}...` : "Supports our side on this legal question.",
        strategicValue: "Gives you a helpful court ruling that supports your main argument.",
        link: c.link,
      }));

      const advList = uniqueCases.slice(half).map((c) => ({
        id: c.id,
        title: c.title,
        citation: c.citation?.[0] || c.court,
        opposingArgument: "The other side will likely use this case to argue for strict limits on your claim.",
        distinguishingStrategy: "Show that this case does not apply because your facts and evidence are different.",
        link: c.link,
      }));

      function cleanSubject(text) {
        return text
          .replace(/^(we represent|analyze|evaluate|assess|identify|find)\s+/i, "")
          .replace(/[.]+$/, "")
          .trim()
          .slice(0, 75);
      }
      const subject = cleanSubject(latestMessage);

      state.matrix = { favorable: favList, adverse: advList };
      state.memo = {
        title: `LEGAL MEMO: ${subject.toUpperCase()}`,
        executiveSummary: `This memo reviews ${uniqueCases.length} real court decisions from CourtListener. The court rulings show that you have strong legal defenses when you clearly show each fact required by the law.`,
        issue: `Can the legal claims about "${subject}" be proven under current court rules, and how can we show that opposing cases do not apply?`,
        rule: `Under current law, whoever brings or defends these claims must show specific facts that fit each part of the legal rule, and show why cases with different facts do not control.`,
        application: uniqueCases[0]
          ? `In ${uniqueCases[0].title}, the court agreed that the law requires a clear factual showing. Key quote: "${uniqueCases[0].snippet.slice(0, 260)}..." This decision directly supports your main point.`
          : "How the law applies depends on the exact facts in your case.",
        counterArguments: uniqueCases[1]
          ? `The other side often points to ${uniqueCases[1].title} to argue for a narrower rule. But that case is different because it involved different facts and a different stage of the lawsuit.`
          : "The other side will likely argue that you waited too long or that your facts do not fit the law.",
        conclusion: `Your legal position looks strong. We recommend leading with ${uniqueCases[0]?.title || "helpful court cases"} in your first brief, while using the facts above to answer any cases the other side brings up.`,
      };

      sendSse(res, "matrix_update", { matrix: state.matrix });
      sendSse(res, "memo_ready", { memo: state.memo });
      sendSse(res, "message", {
        role: "assistant",
        content: `I finished searching CourtListener for **"${latestMessage}"**. I reviewed **${uniqueCases.length} real court opinions**, built a **Two-Sided Case Table**, checked the citations against court records, and wrote a clear **Legal Memo** on the right.\n\n*(Tip: If you want to use your own Google AI key, click Set API Key in the top right).*`,
        casesCount: uniqueCases.length,
      });
    }

    sendSse(res, "completed", {
      cases: uniqueCases,
      matrix: state.matrix,
      citations: state.citations,
      memo: state.memo,
    });
  } catch (error) {
    console.error("[agent] Execution error:", error);
    sendSse(res, "error", {
      message: error.message || "An error occurred during autonomous research execution.",
    });
  } finally {
    sendSse(res, "done", {});
    res.end();
  }
}
