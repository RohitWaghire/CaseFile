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
  Scales,
  BookmarkSimple,
  Lightning,
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
  onStartAgent?: (prompt: string, court?: string) => void;
}

const JURISDICTION_CHIPS = [
  { id: "", label: "All Jurisdictions" },
  { id: "scotus", label: "SCOTUS" },
  { id: "ca9", label: "9th Cir. (Tech/IP)" },
  { id: "ca2", label: "2nd Cir. (NY/Finance)" },
  { id: "cal", label: "California Supreme" },
];

export function Research({ initialQuery, onStartAgent }: ResearchProps) {
  const [query, setQuery] = useState(initialQuery || "");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState("");
  const [results, setResults] = useState<CaseRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Connected to CourtListener v4 Public Index");
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copiedCite, setCopiedCite] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [detailTab, setDetailTab] = useState<"text" | "headnotes" | "docket">("text");
  const [fontChoice, setFontChoice] = useState<"serif" | "mono" | "sans">("serif");

  const abortRef = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduce = useReducedMotion();

  const selected = useMemo(
    () => results.find((r) => r.Id === selectedId) || null,
    [results, selectedId]
  );

  const runSearch = useCallback(async (q: string, courtOverride = selectedJurisdiction) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    setStatus(`Searching CourtListener dockets for "${trimmed}"...`);
    setExtractProgress(0);

    try {
      const data = await searchCases(trimmed, {
        court: courtOverride || undefined,
        pageSize: 18,
        signal: ac.signal,
      });
      setResults(data.results);
      setTotal(data.count);
      setSelectedId(data.results[0]?.Id ?? null);
      setStatus(
        data.count
          ? `${data.count.toLocaleString()} published opinions indexed • Showing top ${data.results.length}`
          : "No published judicial opinions matched this inquiry."
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "Search failed");
      setStatus("CourtListener search request failed");
      setResults([]);
      setSelectedId(null);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [selectedJurisdiction]);

  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
      void runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // Modal keyboard controls
  useEffect(() => {
    if (!jsonOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setJsonOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [jsonOpen]);

  // Keep selected item in view
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(".case-item.is-active");
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  // Arrow key navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!results.length || jsonOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const idx = results.findIndex((r) => r.Id === selectedId);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIdx = idx < 0 ? 0 : Math.min(results.length - 1, idx + 1);
        const next = results[nextIdx];
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
    setStatus("Extracting authentic opinion text from CourtListener...");

    const tick = window.setInterval(() => {
      setExtractProgress((p) => Math.min(0.92, p + 0.08));
    }, 350);

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
      setStatus(`Successfully extracted full opinion text for ${data.count} case${data.count === 1 ? "" : "s"}.`);
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
    setStatus("Synthesizing judicial summaries and procedural postures via Gemini 2.0...");

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
      setStatus(`Enriched ${done} case records with AI headnotes and precedent analysis.`);
    } catch (err) {
      setError((err as Error).message || "Enrich failed");
      setStatus("Enrich failed");
    } finally {
      setEnriching(false);
    }
  }

  function handleDownloadAll() {
    if (!results.length) return;
    const payload = {
      query,
      jurisdiction: selectedJurisdiction || "all",
      exportedAt: new Date().toISOString(),
      count: results.length,
      cases: exportSchema(results),
    };
    downloadJson(`casefile-desk-${slugifyQuery(query)}.json`, payload);
  }

  function handleDownloadOne() {
    if (!selected) return;
    downloadJson(`case-${selected.Id}.json`, exportSchema([selected])[0]);
  }

  const bluebookCitation = useMemo(() => {
    if (!selected) return "";
    const cite = selected.citation?.[0] || selected.docketNumber || `Docket ${selected.Id}`;
    const year = selected.dateFiled ? new Date(selected.dateFiled).getFullYear() : "";
    const court = selected.court ? selected.court.replace("United States Court of Appeals for the ", "").replace("Court of Appeals", "Cir.") : "";
    return `${selected.Title}, ${cite} (${court}${year ? ` ${year}` : ""})`;
  }, [selected]);

  async function copyBluebook() {
    if (!bluebookCitation) return;
    try {
      await navigator.clipboard.writeText(bluebookCitation);
      setCopiedCite(true);
      window.setTimeout(() => setCopiedCite(false), 1600);
    } catch {
      setError("Could not copy citation");
    }
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
      setCopiedJson(true);
      window.setTimeout(() => setCopiedJson(false), 1600);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  function handleEscalateToAgent() {
    if (!onStartAgent) return;
    const prompt = selected
      ? `Conduct an autonomous strategic investigation on ${selected.Title} (${selected.citation?.[0] || "precedent"}). Formulate our offensive and defensive legal theory, map adverse authorities, and generate an IRAC memorandum.`
      : query;
    const court = selected?.courtId || selected?.court || selectedJurisdiction || undefined;
    onStartAgent(prompt, court);
  }

  return (
    <div className="workspace desk-redesign">
      {/* Executive Research Command Bar */}
      <div className="research-command-bar">
        <div className="command-bar-main">
          {/* Query Search Form */}
          <form
            className="search-field research-search-box"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(query);
            }}
          >
            <MagnifyingGlass size={18} className="search-box-icon" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topic, precedent, or doctrine, e.g. trade secret reverse engineering"
              aria-label="Search legal topic"
            />
            {query && (
              <button
                type="button"
                className="btn-icon"
                onClick={() => setQuery("")}
                title="Clear input"
              >
                <X size={14} />
              </button>
            )}
            <button type="submit" className="btn btn-primary search-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <CircleNotch size={15} className="spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Search</span>
                  <kbd className="cmd-k-kbd">↵</kbd>
                </>
              )}
            </button>
          </form>

          {/* Action Tools */}
          <div className="workspace-tools">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleExtract()}
              disabled={!results.length || extracting || enriching || loading}
              title="Pull full judicial opinion texts from CourtListener"
            >
              {extracting ? <CircleNotch size={14} className="spin" /> : <Stack size={14} />}
              <span>Extract Texts</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleEnrich()}
              disabled={!results.length || enriching || extracting || loading}
              title="Generate AI headnotes, issues, and procedural posture"
            >
              {enriching ? <CircleNotch size={14} className="spin" /> : <Sparkle size={14} weight="fill" />}
              <span>AI Headnotes</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setJsonOpen(true)}
              disabled={!results.length}
              title="Inspect structured CourtListener JSON payload"
            >
              <BracketsCurly size={14} />
              <span>JSON</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadAll}
              disabled={!results.length}
              title="Download research session as JSON"
            >
              <DownloadSimple size={14} />
              <span>Export</span>
            </button>

            {onStartAgent && (
              <button
                type="button"
                className="btn btn-solid btn-sm agent-escalate-btn"
                onClick={handleEscalateToAgent}
                title="Send current search or case to Autonomous AI Agent"
              >
                <Sparkle size={14} weight="fill" />
                <span>Launch in Studio</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-bar: Jurisdiction Filters & Status */}
        <div className="command-bar-sub">
          <div className="jurisdiction-pills">
            <span className="pills-label">Court:</span>
            {JURISDICTION_CHIPS.map((chip) => {
              const isSelected = selectedJurisdiction === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  className={`jurisdiction-chip ${isSelected ? "active" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedJurisdiction(chip.id);
                    if (query.trim()) void runSearch(query, chip.id);
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <div className={`status-bar-tag ${error ? "error" : ""}`} role="status">
            <span className="status-indicator-dot" />
            <span>{error || status}</span>
          </div>
        </div>

        {/* Extraction Progress Bar */}
        {(extracting || extractProgress > 0) && (
          <div className="extract-progress">
            <span>Extracting Opinion Records ({Math.round(extractProgress * 100)}%)</span>
            <div className="bar" aria-hidden>
              <span style={{ transform: `scaleX(${extractProgress || 0.05})` }} />
            </div>
          </div>
        )}
      </div>

      {/* Main Split Layout: Left Cases Docket | Right Judicial Slip Inspector */}
      <div className="workspace-body">
        {/* LEFT PANEL: Case Dockets List */}
        <section className="panel panel-cases" aria-label="Case dockets">
          <div className="panel-head">
            <div className="panel-title-row">
              <Scales size={16} color="var(--accent)" />
              <h2>Judicial Dockets</h2>
            </div>
            <span className="count-badge">
              {loading ? "Searching..." : `${results.length}${total ? ` of ${total.toLocaleString()}` : ""}`}
            </span>
          </div>

          {loading && (
            <div className="skeleton-list" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skel" />
              ))}
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="empty-state">
              <Scales size={42} color="var(--text-mute)" />
              <h3>No Cases Loaded</h3>
              <p>Search a legal inquiry or select a jurisdiction above to pull CourtListener opinions.</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <ul className="case-list docket-list" ref={listRef}>
              {results.map((c, i) => {
                const isActive = selectedId === c.Id;
                return (
                  <li key={c.Id || i}>
                    <button
                      type="button"
                      className={`case-item docket-card ${isActive ? "is-active" : ""}`}
                      onClick={() => setSelectedId(c.Id)}
                    >
                      <div className="docket-top">
                        <span className="docket-court">{c.court || "Federal Appellate"}</span>
                        {c.dateFiled && <span className="docket-date">{c.dateFiled}</span>}
                      </div>

                      <h3 className="docket-case-title">{c.Title}</h3>

                      <div className="docket-meta-row">
                        {c.citation?.[0] ? (
                          <span className="cite-pill">{c.citation[0]}</span>
                        ) : c.docketNumber ? (
                          <span className="cite-pill">Docket {c.docketNumber}</span>
                        ) : null}

                        {c.extracted ? (
                          <span className="badge-ok">🟢 Full Text</span>
                        ) : (
                          <span className="badge-partial">🟡 Metadata</span>
                        )}

                        {c.enriched && <span className="badge-enriched">⚡ AI Headnotes</span>}
                      </div>

                      {c.snippet && <p className="snippet docket-snippet">{c.snippet}</p>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* RIGHT PANEL: Authoritative Judicial Slip Opinion & Headnotes */}
        <section className="panel panel-detail" aria-label="Judicial Opinion Inspector">
          <div className="panel-head detail-head-bar">
            <div className="detail-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === "text"}
                className={`canvas-tab ${detailTab === "text" ? "active" : ""}`}
                onClick={() => setDetailTab("text")}
              >
                <FileText size={15} /> Opinion Text
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === "headnotes"}
                className={`canvas-tab ${detailTab === "headnotes" ? "active" : ""}`}
                onClick={() => setDetailTab("headnotes")}
              >
                <Sparkle size={15} weight="fill" /> AI Headnotes
                {selected?.enriched && <span className="tab-badge">Active</span>}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === "docket"}
                className={`canvas-tab ${detailTab === "docket" ? "active" : ""}`}
                onClick={() => setDetailTab("docket")}
              >
                <BookmarkSimple size={15} /> Docket &amp; Record
              </button>
            </div>

            {selected && (
              <div className="detail-head-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={copyBluebook}
                  title="Copy formal Bluebook citation to clipboard"
                >
                  <Copy size={13} />
                  <span>{copiedCite ? "Copied Citation" : "Copy Bluebook"}</span>
                </button>

                {onStartAgent && (
                  <button
                    type="button"
                    className="btn btn-solid btn-sm"
                    onClick={handleEscalateToAgent}
                    title="Brief this precedent in AI Agent Studio"
                  >
                    <Lightning size={13} weight="fill" />
                    <span>Brief Precedent</span>
                  </button>
                )}
              </div>
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
                <FileText size={48} color="var(--text-mute)" />
                <h3>No Case Selected</h3>
                <p>Select any judicial opinion from the left docket list to inspect the full text and headnotes.</p>
              </motion.div>
            )}

            {selected && (
              <motion.div
                key={selected.Id}
                className="detail judicial-detail"
                initial={reduce ? false : { opacity: 1, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 1 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Judicial Opinion Header */}
                <header className="judicial-slip-header">
                  <div className="court-masthead">
                    {selected.court || "UNITED STATES COURT OF APPEALS"}
                  </div>
                  <h2 className="judicial-caption-title">{selected.Title}</h2>

                  <div className="judicial-meta-grid">
                    <div className="meta-col">
                      <span className="meta-label">CITATION:</span>
                      <span className="meta-val font-mono">{selected.citation?.[0] || "Unreported / Docket Record"}</span>
                    </div>
                    <div className="meta-col">
                      <span className="meta-label">DATE DECIDED:</span>
                      <span className="meta-val">{selected.dateFiled || "Pending Judgment"}</span>
                    </div>
                    <div className="meta-col">
                      <span className="meta-label">DOCKET NO:</span>
                      <span className="meta-val font-mono">{selected.docketNumber || selected.Id}</span>
                    </div>
                    <div className="meta-col">
                      <span className="meta-label">JURISDICTION:</span>
                      <span className="meta-val">{selected.jurisdiction || selected.court || "Federal Appellate"}</span>
                    </div>
                  </div>
                </header>

                {/* TAB 1: Opinion Text */}
                {detailTab === "text" && (
                  <div className="opinion-tab-content">
                    <div className="text-toolbar">
                      <div className="typography-toggles">
                        <span className="toggle-label">Typography:</span>
                        <button
                          type="button"
                          className={`btn-toggle ${fontChoice === "serif" ? "active" : ""}`}
                          onClick={() => setFontChoice("serif")}
                        >
                          Serif
                        </button>
                        <button
                          type="button"
                          className={`btn-toggle ${fontChoice === "sans" ? "active" : ""}`}
                          onClick={() => setFontChoice("sans")}
                        >
                          Sans
                        </button>
                        <button
                          type="button"
                          className={`btn-toggle ${fontChoice === "mono" ? "active" : ""}`}
                          onClick={() => setFontChoice("mono")}
                        >
                          Mono
                        </button>
                      </div>

                      <div className="text-stats">
                        <span>
                          {selected.opinionText
                            ? `${selected.opinionText.split(/\s+/).length.toLocaleString()} words`
                            : "Summary record"}
                        </span>
                      </div>
                    </div>

                    <div className={`opinion-text-body font-${fontChoice}`}>
                      {selected.opinionText ||
                        selected.snippet ||
                        "Full judicial text has not been extracted yet. Click 'Extract Texts' in the top command bar to retrieve the full opinion from CourtListener."}
                    </div>
                  </div>
                )}

                {/* TAB 2: AI Headnotes & Case Synthesis */}
                {detailTab === "headnotes" && (
                  <div className="headnotes-tab-content">
                    {!selected.enriched && !selected.summary ? (
                      <div className="headnotes-empty">
                        <Sparkle size={36} color="var(--accent)" />
                        <h4>AI Headnotes Not Generated Yet</h4>
                        <p>
                          Click the <strong>AI Headnotes</strong> button in the top command bar to have Gemini 2.0
                          synthesize the core issue, procedural posture, controlling holding, and precedents.
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void handleEnrich()}
                          disabled={enriching}
                        >
                          {enriching ? <CircleNotch size={14} className="spin" /> : <Sparkle size={14} weight="fill" />}
                          Synthesize Headnotes Now
                        </button>
                      </div>
                    ) : (
                      <div className="headnotes-body">
                        <div className="headnote-card">
                          <div className="headnote-tag">Core Issue &amp; Holding</div>
                          <div className="headnote-text">{selected.summary}</div>
                        </div>

                        {selected.outcome && (
                          <div className="headnote-card">
                            <div className="headnote-tag">Procedural Posture / Judgment</div>
                            <div className="headnote-text">{selected.outcome}</div>
                          </div>
                        )}

                        {selected.precedents && selected.precedents.length > 0 && (
                          <div className="headnote-card">
                            <div className="headnote-tag">Controlling Precedents Cited</div>
                            <div className="precedent-chips-list">
                              {selected.precedents.map((p) => (
                                <span key={p} className="chip">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: Docket & Record Info */}
                {detailTab === "docket" && (
                  <div className="docket-tab-content">
                    <div className="docket-info-card">
                      <h4>Free Law Project / CourtListener Docket Record</h4>
                      <p>
                        This judicial authority is indexed directly from CourtListener's public legal archive.
                      </p>

                      <div className="docket-fields-table">
                        <div className="df-row">
                          <span className="df-label">Cluster Record ID</span>
                          <span className="df-val font-mono">{selected.Id}</span>
                        </div>
                        <div className="df-row">
                          <span className="df-label">Official Court Host</span>
                          <span className="df-val">{selected.court}</span>
                        </div>
                        <div className="df-row">
                          <span className="df-label">Filing Timestamp</span>
                          <span className="df-val">{selected.dateFiled}</span>
                        </div>
                        <div className="df-row">
                          <span className="df-label">Formal Bluebook String</span>
                          <span className="df-val font-mono">{bluebookCitation}</span>
                        </div>
                      </div>

                      <div className="docket-external-actions">
                        {selected.Link && (
                          <a
                            href={selected.Link}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            Open CourtListener Record <ArrowSquareOut size={13} />
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleDownloadOne}
                        >
                          <DownloadSimple size={13} /> Download Case JSON
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* JSON Inspector Modal */}
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
              ref={modalRef}
              className="modal modal-lg json-modal"
              tabIndex={-1}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-head">
                <h2 id="json-modal-title">
                  <BracketsCurly size={18} /> Research Dataset ({results.length} cases)
                </h2>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setJsonOpen(false)}
                  title="Close JSON Inspector"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="modal-body">
                <pre className="json-code">
                  <code>{jsonPreview}</code>
                </pre>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn btn-secondary" onClick={() => void copyJson()}>
                  <Copy size={14} />
                  {copiedJson ? "Copied!" : "Copy JSON"}
                </button>
                <button type="button" className="btn btn-primary" onClick={handleDownloadAll}>
                  <DownloadSimple size={14} />
                  Download JSON
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
