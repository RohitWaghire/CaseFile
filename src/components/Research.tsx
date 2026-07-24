import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  MagnifyingGlass,
  DownloadSimple,
  BracketsCurly,
  ArrowSquareOut,
  CircleNotch,
  Copy,
  X,
  Stack,
  FileText,
  Sparkle,
} from "@phosphor-icons/react";
import {
  downloadJson,
  enrichCases,
  exportSchema,
  extractCases,
  searchCases,
  slugifyQuery,
} from "../lib/api";
import type { CaseRecord } from "../lib/api";

interface ResearchProps {
  initialQuery: string;
}

export function Research({ initialQuery }: ResearchProps) {
  const [query, setQuery] = useState(initialQuery || "");
  const [results, setResults] = useState<CaseRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Enter a topic to search CourtListener.");
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduce = useReducedMotion();

  const selected = useMemo(
    () => results.find((r) => r.Id === selectedId) || null,
    [results, selectedId]
  );

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    setStatus(`Searching CourtListener for "${trimmed}"...`);
    setExtractProgress(0);

    try {
      const data = await searchCases(trimmed, { pageSize: 15, signal: ac.signal });
      setResults(data.results);
      setTotal(data.count);
      setSelectedId(data.results[0]?.Id ?? null);
      setStatus(
        data.count
          ? `${data.count.toLocaleString()} opinions matched, showing ${data.results.length}`
          : "No published opinions matched that topic."
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "Search failed");
      setStatus("Search failed");
      setResults([]);
      setSelectedId(null);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
      void runSearch(initialQuery);
    }
    // only on mount / initialQuery change from parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // Modal: lock background scroll, move focus in, trap Tab, restore on close.
  useEffect(() => {
    if (!jsonOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setJsonOpen(false);
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === modalRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [jsonOpen]);

  // Keep the keyboard-selected case visible within the scrolling list.
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(".case-item.is-active");
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!results.length || jsonOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const idx = results.findIndex((r) => r.Id === selectedId);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = results[Math.min(results.length - 1, Math.max(0, idx) + 1)];
        if (next) setSelectedId(next.Id);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = results[Math.max(0, (idx < 0 ? 0 : idx) - 1)];
        if (prev) setSelectedId(prev.Id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [results, selectedId, jsonOpen]);

  async function handleExtract() {
    if (!results.length || extracting || enriching) return;
    setExtracting(true);
    setError(null);
    setExtractProgress(0.15);
    setStatus("Extracting opinion text for the current page…");

    const tick = window.setInterval(() => {
      setExtractProgress((p) => Math.min(0.9, p + 0.08));
    }, 400);

    try {
      const data = await extractCases(results);
      setExtractProgress(1);

      const byId = new Map(data.cases.map((c) => [c.Id, c]));
      setResults((prev) =>
        prev.map((r) => {
          const ex = byId.get(r.Id);
          if (!ex) return r;
          return {
            ...r,
            opinionText: ex.opinionText,
            textSource: ex.textSource,
            extracted: ex.extracted,
          };
        })
      );
      setStatus(
        `Extracted text for ${data.count} case${data.count === 1 ? "" : "s"}. Ready to export.`
      );
    } catch (err) {
      setError((err as Error).message || "Extract failed");
      setStatus("Extract failed");
    } finally {
      window.clearInterval(tick);
      setExtracting(false);
      window.setTimeout(() => setExtractProgress(0), 800);
    }
  }

  async function handleEnrich() {
    if (!results.length || enriching || extracting) return;
    setEnriching(true);
    setError(null);
    setStatus("Enriching cases with structured fields…");

    try {
      const data = await enrichCases(results);
      if (data.mode === "disabled") {
        setStatus(data.detail || "LLM enrichment is not configured on the server.");
        return;
      }

      const byId = new Map(data.cases.map((c) => [c.Id, c]));
      setResults((prev) =>
        prev.map((r) => {
          const ex = byId.get(r.Id);
          if (!ex || !ex.enriched) return r;
          return {
            ...r,
            court: ex.court || r.court,
            summary: ex.summary,
            jurisdiction: ex.jurisdiction,
            outcome: ex.outcome,
            precedents: ex.precedents,
            enriched: true,
          };
        })
      );
      const done = data.cases.filter((c) => c.enriched).length;
      setStatus(`Enriched ${done} case${done === 1 ? "" : "s"} with ${data.model || "LLM"} fields.`);
    } catch (err) {
      setError((err as Error).message || "Enrich failed");
      setStatus("Enrich failed");
    } finally {
      setEnriching(false);
    }
  }

  function handleDownload() {
    if (!results.length) return;
    const payload = {
      query,
      exportedAt: new Date().toISOString(),
      count: results.length,
      cases: exportSchema(results),
    };
    downloadJson(`casefile-${slugifyQuery(query)}.json`, payload);
  }

  function handleDownloadOne() {
    if (!selected) return;
    downloadJson(`case-${selected.Id}.json`, exportSchema([selected])[0]);
  }

  const jsonPreview = useMemo(() => {
    return JSON.stringify(
      {
        query,
        count: results.length,
        cases: exportSchema(results),
      },
      null,
      2
    );
  }, [query, results]);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(jsonPreview);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  return (
    <div className="workspace">
      <div className="workspace-bar">
        <div className="workspace-bar-inner">
          <form
            className="search-field"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(query);
            }}
          >
            <MagnifyingGlass size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topic, e.g. IT laws for cyber crime"
              aria-label="Search topic"
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <CircleNotch size={16} className="spin" />
                  Searching
                </>
              ) : (
                "Search"
              )}
            </button>
          </form>
          <div className="workspace-tools">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleExtract()}
              disabled={!results.length || extracting || enriching || loading}
              title="Pull fuller opinion text for listed cases"
            >
              {extracting ? <CircleNotch size={14} className="spin" /> : <Stack size={14} />}
              Extract text
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleEnrich()}
              disabled={!results.length || enriching || extracting || loading}
              title="Extract summary, jurisdiction, and outcome via LLM"
            >
              {enriching ? <CircleNotch size={14} className="spin" /> : <Sparkle size={14} />}
              Enrich
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setJsonOpen(true)}
              disabled={!results.length}
            >
              <BracketsCurly size={14} />
              View JSON
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleDownload}
              disabled={!results.length}
            >
              <DownloadSimple size={14} />
              Download JSON
            </button>
          </div>
        </div>
        <div className={`status-bar${error ? " error" : ""}`} role="status">
          {error || status}
        </div>
      </div>

      <div className="workspace-body">
        <section className="panel" aria-label="Case results">
          <div className="panel-head">
            <h2>Cases</h2>
            <span className="count">
              {loading ? "…" : `${results.length}${total ? ` / ${total.toLocaleString()}` : ""}`}
            </span>
          </div>

          {(extracting || extractProgress > 0) && (
            <div className="extract-progress">
              <span>Extract</span>
              <div className="bar" aria-hidden>
                <span style={{ transform: `scaleX(${extractProgress || 0.05})` }} />
              </div>
            </div>
          )}

          {loading && (
            <div className="skeleton-list" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skel" />
              ))}
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="empty-state">
              <img
                src="/assets/workspace.jpg"
                alt=""
                width={280}
                height={160}
              />
              <h3>No cases loaded</h3>
              <p>Search a legal topic to pull matching CourtListener opinions into this list.</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <ul className="case-list" ref={listRef}>
              {results.map((c, i) => (
                <li key={c.Id || i}>
                  <button
                    type="button"
                    className={`case-item${selectedId === c.Id ? " is-active" : ""}`}
                    onClick={() => setSelectedId(c.Id)}
                  >
                    <h3>{c.Title}</h3>
                    <div className="meta">
                      {c.dateFiled && <span>{c.dateFiled}</span>}
                      {c.court && <span>{c.court}</span>}
                      {c.extracted && <span>extracted</span>}
                      {c.enriched && <span>enriched</span>}
                    </div>
                    {c.snippet && <p className="snippet">{c.snippet}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label="Case detail">
          <div className="panel-head">
            <h2>Opinion</h2>
            {selected && (
              <span className="count">Id {selected.Id}</span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!selected && (
              <motion.div
                key="empty"
                className="empty-state"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
              >
                <FileText size={36} color="var(--text-mute)" />
                <h3>Select a case</h3>
                <p>Open a result to read metadata, opinion text, and export a single record.</p>
              </motion.div>
            )}

            {selected && (
              <motion.div
                key={selected.Id}
                className="detail"
                initial={reduce ? false : { opacity: 1, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className="detail-title">{selected.Title}</h2>
                <div className="detail-meta">
                  {selected.court && <span className="chip">{selected.court}</span>}
                  {selected.dateFiled && <span className="chip">{selected.dateFiled}</span>}
                  {selected.docketNumber && (
                    <span className="chip">Docket {selected.docketNumber}</span>
                  )}
                  {selected.jurisdiction && (
                    <span className="chip">{selected.jurisdiction}</span>
                  )}
                  {selected.outcome && (
                    <span className="chip">Outcome: {selected.outcome}</span>
                  )}
                  {selected.citation?.map((cite) => (
                    <span className="chip" key={cite}>
                      {cite}
                    </span>
                  ))}
                  {selected.extracted ? (
                    <span className="chip ok">Text extracted</span>
                  ) : (
                    <span className="chip warn">Snippet / partial</span>
                  )}
                  {selected.textSource && (
                    <span className="chip">{selected.textSource}</span>
                  )}
                </div>

                <div className="detail-actions">
                  {selected.Link && (
                    <a
                      className="btn btn-secondary btn-sm"
                      href={selected.Link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open on CourtListener
                      <ArrowSquareOut size={14} />
                    </a>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleDownloadOne}
                  >
                    <DownloadSimple size={14} />
                    Download this case
                  </button>
                </div>

                {selected.summary && (
                  <div className="opinion opinion-summary">
                    <h3>
                      <Sparkle size={14} weight="fill" /> Summary
                    </h3>
                    <div className="opinion-body">{selected.summary}</div>
                    {selected.precedents && selected.precedents.length > 0 && (
                      <div className="detail-meta" style={{ marginTop: "0.6rem" }}>
                        {selected.precedents.map((p) => (
                          <span className="chip" key={p}>
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="opinion">
                  <h3>Opinion text</h3>
                  <div className="opinion-body">
                    {selected.opinionText ||
                      selected.snippet ||
                      "No opinion text available for this record yet. Run Extract text to pull fuller content where CourtListener or the court host allows."}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      <AnimatePresence>
        {jsonOpen && (
          <motion.div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="json-modal-title"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            onClick={() => setJsonOpen(false)}
          >
            <motion.div
              className="modal"
              ref={modalRef}
              tabIndex={-1}
              initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: 10 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-head">
                <h2 id="json-modal-title">Structured export preview</h2>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setJsonOpen(false)}
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="modal-body">
                <pre>{jsonPreview}</pre>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-secondary" onClick={() => void copyJson()}>
                  <Copy size={14} />
                  {copied ? "Copied" : "Copy JSON"}
                </button>
                <button type="button" className="btn btn-primary" onClick={handleDownload}>
                  <DownloadSimple size={14} />
                  Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
