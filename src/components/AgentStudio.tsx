import { useState, useEffect, useRef } from "react";
import {
  Sparkle,
  PaperPlaneTilt,
  CircleNotch,
  Pause,
  Play,
  FileText,
  ShieldCheck,
  ShieldWarning,
  Scales,
  ArrowSquareOut,
  Copy,
  Printer,
  DownloadSimple,
  Key,
  X,
  Plus,
  Trash,
  CheckCircle,
  Books,
  GitBranch,
  Clock,
  Lightning,
  CirclesThreePlus,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { PrecedentGraph } from "./PrecedentGraph";
import { CircuitSplitVisualizer } from "./CircuitSplitVisualizer";
import { DoctrineTimeline } from "./DoctrineTimeline";
import { CommandPalette } from "./CommandPalette";
import {
  streamAgentChat,
  getStoredGeminiKey,
  setStoredGeminiKey,
  downloadJson,
  slugifyQuery,
} from "../lib/api";
import type {
  AgentChatMessage,
  AgentThought,
  AgentAction,
  AgentObservation,
  AdversarialMatrix,
  VerifiedCitation,
  IracMemo,
  CaseRecord,
} from "../lib/api";

const PRESET_TOPICS = [
  {
    tag: "Tech Law",
    title: "DTSA Trade Secrets & Reverse Engineering",
    prompt:
      "We represent a technology startup accused of trade secret misappropriation under DTSA. The founder legitimately reverse-engineered public APIs. Identify controlling 9th Circuit precedents on clean-room reverse engineering, analyze opposing counsel's likely counter-arguments, and draft our defense brief.",
    court: "ca9",
  },
  {
    tag: "Digital Rights",
    title: "Fourth Amendment & Geofence Searches",
    prompt:
      "Analyze the constitutionality of reverse keyword and geofence search warrants under the Fourth Amendment. Find recent appellate rulings invalidating dragnet digital warrants for lack of particularity, and provide distinguishing arguments against adverse law enforcement rulings.",
    court: "ca4",
  },
  {
    tag: "AI Safety",
    title: "AI Model Training & Copyright Fair Use",
    prompt:
      "Assess whether scraping publicly accessible code repositories to train generative AI code models constitutes Fair Use under 17 U.S.C. § 107. Identify persuasive precedents on transformative use (such as Google v. Oracle and Authors Guild v. Google) and pinpoint vulnerabilities regarding commercial market displacement.",
    court: "ca2",
  },
  {
    tag: "Tenant Rights",
    title: "Algorithmic Rent Fixing & Tenant Defenses",
    prompt:
      "Evaluate antitrust and tenant rights claims against landlords coordinating rent prices via centralized revenue-management software. Locate recent decisions addressing algorithmic price-fixing and landlord-tenant retaliation protections.",
    court: "cal",
  },
];

interface SessionData {
  id: string;
  title: string;
  timestamp: string;
  messages: AgentChatMessage[];
  thoughts: AgentThought[];
  actions: AgentAction[];
  observations: AgentObservation[];
  matrix: AdversarialMatrix;
  citations: VerifiedCitation[];
  memo: IracMemo | null;
  cases: CaseRecord[];
}

const SESSIONS_STORAGE_KEY = "casefile:agent_sessions";

interface AgentStudioProps {
  initialPrompt?: string;
  initialCourt?: string;
  externalTab?: "matrix" | "graph" | "split" | "timeline" | "memo" | "citations" | "reader";
  onOpenCommandPalette?: () => void;
}

export function AgentStudio({
  initialPrompt,
  initialCourt,
  externalTab,
  onOpenCommandPalette,
}: AgentStudioProps = {}) {
  // Session State
  const [sessions, setSessions] = useState<SessionData[]>(() => {
    try {
      const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: "session-1",
        title: "DTSA Reverse Engineering Defense",
        timestamp: new Date().toLocaleDateString(),
        messages: [],
        thoughts: [],
        actions: [],
        observations: [],
        matrix: { favorable: [], adverse: [] },
        citations: [],
        memo: null,
        cases: [],
      },
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>("session-1");
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Active Execution State
  const [inputPrompt, setInputPrompt] = useState(initialPrompt || "");
  const [selectedCourt, setSelectedCourt] = useState(initialCourt || "");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>("Ready");
  const [activeCanvasTab, setActiveCanvasTab] = useState<
    "matrix" | "graph" | "split" | "timeline" | "memo" | "citations" | "reader"
  >(externalTab || "matrix");
  const [readerCase, setReaderCase] = useState<CaseRecord | null>(null);

  useEffect(() => {
    if (initialPrompt?.trim()) {
      setInputPrompt(initialPrompt);
      if (initialCourt) setSelectedCourt(initialCourt);
    }
  }, [initialPrompt, initialCourt]);

  useEffect(() => {
    if (externalTab) {
      setActiveCanvasTab(externalTab);
    }
  }, [externalTab]);
  const [memoAnnotations, setMemoAnnotations] = useState<
    Record<string, { type: "oral" | "distinguish" | "statute"; text: string }>
  >({});

  const handleGenerateAnnotation = (sectionKey: string, type: "oral" | "distinguish" | "statute") => {
    let text = "";
    if (type === "oral") {
      text = `ORAL ARGUMENT SOUNDBITE (15 SECONDS): "Your Honors, under Ninth Circuit precedent in Chicago Lock, reverse engineering is an affirmative right of lawful buyers. The plaintiff cannot turn an ordinary competitive dispute into trade secret misappropriation where disassembly was conducted openly on lawfully purchased hardware."`;
    } else if (type === "distinguish") {
      text = `DISTINGUISHING FOOTNOTE: Hostile citations such as Comet Technologies (2026) are inapposite because the defendant in Comet had executed an explicit non-analysis covenant prior to receiving the unreleased prototype. Here, our acquisition was through standard third-party commercial vendors without contractual encumbrance.`;
    } else {
      text = `STATUTORY AUTHORITY: 18 U.S.C. § 1836(b)(3)(B) specifically restricts injunctive relief that would 'prevent a person from entering into an employment relationship' and incorporates the common-law privilege of independent discovery.`;
    }
    setMemoAnnotations((prev) => ({
      ...prev,
      [sectionKey]: { type, text },
    }));
  };

  // Settings Modal State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getStoredGeminiKey());
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Cmd+K / Ctrl+K listener for legal command palette (if not handled by parent)
  useEffect(() => {
    if (onOpenCommandPalette) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenCommandPalette]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const settingsModalRef = useRef<HTMLDivElement>(null);
  const settingsPreviouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Settings modal: Escape to close + focus restore on close
  useEffect(() => {
    if (!settingsOpen) return;
    settingsPreviouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    settingsModalRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSettingsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      settingsPreviouslyFocusedRef.current?.focus?.();
    };
  }, [settingsOpen]);

  // Sync sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // ignore
    }
  }, [sessions]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession.messages, activeSession.thoughts, activeSession.actions]);

  // Helper to update active session
  function updateActiveSession(updater: (prev: SessionData) => SessionData) {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? updater(s) : s))
    );
  }

  // Create new research thread
  function handleNewSession() {
    const newId = `session-${Date.now()}`;
    const newSession: SessionData = {
      id: newId,
      title: `Research Session ${sessions.length + 1}`,
      timestamp: new Date().toLocaleDateString(),
      messages: [],
      thoughts: [],
      actions: [],
      observations: [],
      matrix: { favorable: [], adverse: [] },
      citations: [],
      memo: null,
      cases: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
  }

  function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (sessions.length <= 1) return;
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (activeSessionId === id) {
      setActiveSessionId(remaining[0].id);
    }
  }

  // Handle running the agent
  async function handleSend(promptText = inputPrompt) {
    const trimmed = promptText.trim();
    if (!trimmed || running) return;

    setInputPrompt("");
    setRunning(true);
    setPaused(false);
    setCurrentPhase("Initializing ReAct loop...");

    const userMessage: AgentChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Auto-title session if it's the first message
    updateActiveSession((prev) => ({
      ...prev,
      title: prev.messages.length === 0 ? trimmed.slice(0, 36) + "..." : prev.title,
      messages: [...prev.messages, userMessage],
    }));

    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      const messagesPayload = [...activeSession.messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await streamAgentChat({
        messages: messagesPayload,
        court: selectedCourt,
        signal: ac.signal,
        onEvent: (event) => {
          if (event.type === "start") {
            setCurrentPhase("Analyzing legal issue & CourtListener indices...");
          } else if (event.type === "thought") {
            const thought = event.data;
            setCurrentPhase(thought.title);
            updateActiveSession((prev) => ({
              ...prev,
              thoughts: [...prev.thoughts, { ...thought, id: `thought-${Date.now()}-${Math.random()}` }],
            }));
          } else if (event.type === "action") {
            const action = event.data;
            setCurrentPhase(`Tool: ${action.tool}`);
            updateActiveSession((prev) => ({
              ...prev,
              actions: [...prev.actions, { ...action, id: `action-${Date.now()}-${Math.random()}` }],
            }));
          } else if (event.type === "observation") {
            const obs = event.data;
            updateActiveSession((prev) => ({
              ...prev,
              observations: [...prev.observations, { ...obs, id: `obs-${Date.now()}-${Math.random()}` }],
            }));
          } else if (event.type === "matrix_update") {
            updateActiveSession((prev) => ({
              ...prev,
              matrix: event.data.matrix,
            }));
            setActiveCanvasTab("matrix");
          } else if (event.type === "citations_verified") {
            updateActiveSession((prev) => ({
              ...prev,
              citations: event.data.citations,
            }));
          } else if (event.type === "memo_ready") {
            updateActiveSession((prev) => ({
              ...prev,
              memo: event.data.memo,
            }));
            setActiveCanvasTab("memo");
          } else if (event.type === "message") {
            const assistantMessage: AgentChatMessage = {
              id: `msg-${Date.now()}`,
              role: "assistant",
              content: event.data.content,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              casesCount: event.data.casesCount,
            };
            updateActiveSession((prev) => ({
              ...prev,
              messages: [...prev.messages, assistantMessage],
            }));
          } else if (event.type === "completed") {
            setCurrentPhase("Research cycle completed");
            updateActiveSession((prev) => ({
              ...prev,
              cases: event.data.cases || prev.cases,
              matrix: event.data.matrix || prev.matrix,
              citations: event.data.citations || prev.citations,
              memo: event.data.memo || prev.memo,
            }));
          } else if (event.type === "error") {
            setCurrentPhase("Error encountered");
            const errorMessage: AgentChatMessage = {
              id: `msg-${Date.now()}`,
              role: "system",
              content: `⚠️ Agent Error: ${event.data.message}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            updateActiveSession((prev) => ({
              ...prev,
              messages: [...prev.messages, errorMessage],
            }));
          }
        },
      });
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        const errStr = (err as Error).message || "Connection terminated.";
        setCurrentPhase("Execution failed");
        updateActiveSession((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: `msg-${Date.now()}`,
              role: "system",
              content: `⚠️ Connection Error: ${errStr}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ],
        }));
      }
    } finally {
      setRunning(false);
      setCurrentPhase("Ready for follow-up");
    }
  }

  function handlePauseResume() {
    if (paused) {
      setPaused(false);
      setCurrentPhase("Resumed execution");
    } else {
      setPaused(true);
      setCurrentPhase("Paused by user");
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
    setRunning(false);
    setCurrentPhase("Execution stopped");
  }

  function handleSaveApiKey() {
    setStoredGeminiKey(apiKeyInput);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  }

  function copyMemoMarkdown() {
    if (!activeSession.memo) return;
    const m = activeSession.memo;
    const text = `# ${m.title}\n\n## Executive Summary\n${m.executiveSummary}\n\n## Issue\n${m.issue}\n\n## Controlling Rule\n${m.rule}\n\n## Application & Analysis\n${m.application}\n\n## Opposing Arguments & Distinctions\n${m.counterArguments}\n\n## Conclusion & Actionable Advice\n${m.conclusion}`;
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  function handlePrintMemo() {
    window.print();
  }

  function handleDownloadJson() {
    const payload = {
      sessionId: activeSession.id,
      title: activeSession.title,
      exportedAt: new Date().toISOString(),
      messages: activeSession.messages,
      adversarialMatrix: activeSession.matrix,
      citations: activeSession.citations,
      iracMemo: activeSession.memo,
      cases: activeSession.cases,
    };
    downloadJson(`casefile-ai-${slugifyQuery(activeSession.title)}.json`, payload);
  }

  return (
    <div className="agent-studio">
      {/* Settings Modal (BYOK Key) */}
      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div
            ref={settingsModalRef}
            className="modal settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label="API and intelligence settings"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2>
                <Key size={18} /> API & Intelligence Settings
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p className="settings-desc">
                CaseFile AI connects to CourtListener's public legal index and Google Gemini 2.0.
                You can provide your own personal Gemini API key below (stored safely in your browser's local storage):
              </p>
              <div className="form-group">
                <label htmlFor="gemini-key-input">Google Gemini API Key</label>
                <input
                  id="gemini-key-input"
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                />
              </div>
              <p className="settings-hint">
                Don't have a key? Get a free API key at{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google AI Studio <ArrowSquareOut size={12} />
                </a>.
              </p>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveApiKey}
              >
                {apiKeySaved ? "Key Saved!" : "Save Key"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fallback Command Palette if not provided by root */}
      {!onOpenCommandPalette && (
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onNavigateTab={(tab) => setActiveCanvasTab(tab)}
          onSelectPreset={(prompt, court) => {
            setInputPrompt(prompt);
            if (court) setSelectedCourt(court);
            void handleSend(prompt);
          }}
        />
      )}

      {/* Main Split-Screen Container */}
      <div className="studio-split">
        {/* LEFT PANEL: Conversational Agent & Thought Stream */}
        <section className="studio-left" aria-label="Agent Conversation & Cognitive Stream">
          {/* Top Session Bar */}
          <div className="studio-bar">
            <div className="session-selector">
              <button
                type="button"
                className="btn btn-secondary btn-sm new-session-btn"
                onClick={handleNewSession}
                title="Start new research scenario"
              >
                <Plus size={14} /> New Session
              </button>
              <div className="session-chips" role="tablist">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    role="tab"
                    tabIndex={0}
                    aria-selected={s.id === activeSessionId}
                    className={`session-chip ${s.id === activeSessionId ? "active" : ""}`}
                    onClick={() => setActiveSessionId(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveSessionId(s.id);
                      }
                    }}
                  >
                    <span className="session-title">{s.title}</span>
                    {sessions.length > 1 && (
                      <button
                        type="button"
                        className="session-delete"
                        aria-label={`Delete session ${s.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(s.id, e);
                        }}
                        title="Delete session"
                      >
                        <Trash size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bar-actions-right">
              <button
                type="button"
                className="btn btn-secondary btn-sm command-trigger-btn"
                onClick={onOpenCommandPalette || (() => setCommandPaletteOpen(true))}
                title="Open Legal Command Palette (Cmd+K / Ctrl+K)"
              >
                <MagnifyingGlass size={13} />
                <span className="btn-label-desktop">Command</span>
                <kbd className="cmd-k-kbd">⌘K</kbd>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm settings-toggle"
                onClick={() => setSettingsOpen(true)}
                title="Configure API Keys"
              >
                <Key size={14} />
                {getStoredGeminiKey() ? "Custom Key Active" : "Set API Key"}
              </button>
            </div>
          </div>

          {/* Preset Quick Starters */}
          {activeSession.messages.length === 0 && (
            <div className="presets-wrapper">
              <div className="presets-label">
                <Sparkle size={14} weight="fill" /> Recommended LexHack 2026 Scenarios
              </div>
              <div className="preset-grid">
                {PRESET_TOPICS.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    className="preset-card"
                    onClick={() => {
                      setSelectedCourt(preset.court);
                      void handleSend(preset.prompt);
                    }}
                  >
                    <span className="preset-tag">{preset.tag}</span>
                    <span className="preset-title">{preset.title}</span>
                    <span className="preset-snippet">{preset.prompt.slice(0, 110)}...</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Conversation & ReAct Cognitive Stream */}
          <div className="chat-stream">
            {activeSession.messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                <div className="bubble-header">
                  <span className="bubble-author">
                    {msg.role === "user" ? "Counsel / Researcher" : "CaseFile AI Agent"}
                  </span>
                  <span className="bubble-time">{msg.timestamp}</span>
                </div>
                <div className="bubble-content">{msg.content}</div>
                {msg.casesCount !== undefined && msg.casesCount > 0 && (
                  <div className="bubble-meta">
                    <span className="chip ok">
                      <CheckCircle size={12} /> {msg.casesCount} Opinions Analyzed
                    </span>
                  </div>
                )}
              </div>
            ))}

            {/* Live ReAct Monologue (When running or when thoughts exist) */}
            {(running || activeSession.thoughts.length > 0) && (
              <div className="cognitive-terminal">
                <div className="terminal-header">
                  <div className="terminal-indicator">
                    <span className={`pulse-dot ${running ? "live" : ""}`} />
                    <span className="terminal-status">{currentPhase}</span>
                  </div>
                  {running && (
                    <div className="terminal-controls">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={handlePauseResume}
                        title={paused ? "Resume Agent" : "Pause Agent"}
                      >
                        {paused ? <Play size={14} /> : <Pause size={14} />}
                      </button>
                      <button
                        type="button"
                        className="btn-icon danger"
                        onClick={handleStop}
                        title="Stop Execution"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="terminal-body">
                  {activeSession.thoughts.map((th) => (
                    <div key={th.id} className={`thought-node ${th.phase}`}>
                      <div className="thought-title">
                        <Sparkle size={13} weight="fill" /> {th.title}
                      </div>
                      <div className="thought-detail">{th.detail}</div>
                    </div>
                  ))}

                  {activeSession.actions.map((act) => (
                    <div key={act.id} className="action-node">
                      <span className="action-tool-badge">{act.tool}</span>
                      <span className="action-query">"{act.query}"</span>
                      {act.court && <span className="action-court-badge">{act.court}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Interactive Chat Input & Steering Bar */}
          <div className="studio-input-bar">
            {running && (
              <div className="steering-banner">
                <span>Agent researching live on CourtListener...</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleStop}
                >
                  Stop Cycle
                </button>
              </div>
            )}

            <form
              className="input-form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
            >
              <div className="form-row">
                <label htmlFor="agent-prompt" className="sr-only">
                  Legal inquiry or follow-up prompt
                </label>
                <textarea
                  id="agent-prompt"
                  aria-label="Legal inquiry or follow-up prompt"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Enter a legal inquiry, factual dispute, or follow-up prompt..."
                  rows={2}
                  disabled={running}
                />
                <button
                  type="submit"
                  className="btn btn-primary submit-btn"
                  disabled={running || !inputPrompt.trim()}
                >
                  {running ? <CircleNotch size={18} className="spin" /> : <PaperPlaneTilt size={18} />}
                </button>
              </div>

              <div className="input-toolbar">
                <div className="circuit-chips">
                  <span className="circuit-label">Jurisdiction:</span>
                  {[
                    { label: "All Courts", val: "" },
                    { label: "SCOTUS", val: "scotus" },
                    { label: "9th Cir", val: "ca9" },
                    { label: "2nd Cir", val: "ca2" },
                    { label: "California", val: "cal" },
                  ].map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      className={`chip ${selectedCourt === c.val ? "ok" : ""}`}
                      aria-pressed={selectedCourt === c.val}
                      onClick={() => setSelectedCourt(c.val)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="input-hints">
                  <span>Shift + Enter for newline</span>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* RIGHT PANEL: Dynamic Artifact Canvas */}
        <section className="studio-right" aria-label="Dynamic Legal Artifact Canvas">
          {/* Canvas Navigation Tabs & Export Actions */}
          <div className="canvas-header">
            <div className="canvas-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "matrix"}
                className={`canvas-tab ${activeCanvasTab === "matrix" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("matrix")}
                title="Affirmative vs Adverse Case Matrix"
              >
                <Scales size={15} /> Matrix
                <span className="tab-count">
                  {activeSession.matrix.favorable.length + activeSession.matrix.adverse.length}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "graph"}
                className={`canvas-tab ${activeCanvasTab === "graph" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("graph")}
                title="Interactive Citation & Precedent Topology Network"
              >
                <CirclesThreePlus size={15} weight="bold" /> Precedent Graph
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "split"}
                className={`canvas-tab ${activeCanvasTab === "split" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("split")}
                title="13 Federal Circuits Split Matrix"
              >
                <GitBranch size={15} /> Circuit Splits
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "timeline"}
                className={`canvas-tab ${activeCanvasTab === "timeline" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("timeline")}
                title="50-Year Legal Doctrine Chronology"
              >
                <Clock size={15} /> Timeline
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "memo"}
                className={`canvas-tab ${activeCanvasTab === "memo" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("memo")}
                title="Formal Court Pleading Paper Brief"
              >
                <FileText size={15} /> IRAC Brief
                {activeSession.memo && <span className="tab-badge">Ready</span>}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "citations"}
                className={`canvas-tab ${activeCanvasTab === "citations" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("citations")}
                title="Official CourtListener Docket Audit"
              >
                <ShieldCheck size={15} /> Citations
                <span className="tab-count">{activeSession.citations.length}</span>
              </button>

              {(readerCase || activeSession.cases.length > 0) && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCanvasTab === "reader"}
                  className={`canvas-tab ${activeCanvasTab === "reader" ? "active" : ""}`}
                  onClick={() => {
                    if (!readerCase && activeSession.cases.length > 0) {
                      setReaderCase(activeSession.cases[0]);
                    }
                    setActiveCanvasTab("reader");
                  }}
                  title="Raw Judicial Opinion Text"
                >
                  <Books size={15} /> Opinion Reader
                </button>
              )}
            </div>

            <div className="canvas-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={copyMemoMarkdown}
                disabled={!activeSession.memo}
                title="Copy Memorandum as Markdown"
              >
                <Copy size={14} /> {copySuccess ? "Copied" : "Copy MD"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handlePrintMemo}
                disabled={!activeSession.memo}
                title="Print Formatted Legal Brief"
              >
                <Printer size={14} /> Print / PDF
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadJson}
                disabled={activeSession.messages.length === 0}
                title="Download JSON Research Payload"
              >
                <DownloadSimple size={14} /> JSON
              </button>
            </div>
          </div>

          {/* Canvas Content Area */}
          <div className="canvas-viewport">
            {/* TAB 1: Adversarial Matrix */}
            {activeCanvasTab === "matrix" && (
              <div className="matrix-view">
                <div className="matrix-columns">
                  {/* Favorable Precedents Column */}
                  <div className="matrix-column favorable">
                    <div className="column-head">
                      <h3>
                        <CheckCircle size={16} color="var(--accent)" weight="bold" /> Favorable Precedent
                      </h3>
                      <span className="count-tag">
                        {activeSession.matrix.favorable.length} authorities
                      </span>
                    </div>
                    {activeSession.matrix.favorable.length === 0 ? (
                      <div className="matrix-empty">
                        <Scales size={32} />
                        <p>No favorable precedents loaded yet. Run a prompt to initiate research.</p>
                      </div>
                    ) : (
                      <div className="matrix-cards">
                        {activeSession.matrix.favorable.map((item) => (
                          <div key={item.id} className="case-card favorable-card">
                            <div className="card-top">
                              <h4 className="case-name">{item.title}</h4>
                              <span className="citation-badge">{item.citation}</span>
                            </div>
                            <div className="card-section">
                              <div className="section-label">Key Favorable Holding:</div>
                              <div className="section-text">{item.holding}</div>
                            </div>
                            <div className="card-section">
                              <div className="section-label">Strategic Application:</div>
                              <div className="section-strategy">{item.strategicValue}</div>
                            </div>
                            {item.link && (
                              <div className="card-footer">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="courtlistener-link"
                                >
                                  CourtListener Record <ArrowSquareOut size={12} />
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Adverse Precedents Column */}
                  <div className="matrix-column adverse">
                    <div className="column-head">
                      <h3>
                        <ShieldWarning size={16} color="var(--warn)" weight="bold" /> Adverse Authority (Opposing Counsel)
                      </h3>
                      <span className="count-tag">
                        {activeSession.matrix.adverse.length} authorities
                      </span>
                    </div>
                    {activeSession.matrix.adverse.length === 0 ? (
                      <div className="matrix-empty">
                        <ShieldWarning size={32} />
                        <p>Adverse counter-arguments will populate here as the agent researches.</p>
                      </div>
                    ) : (
                      <div className="matrix-cards">
                        {activeSession.matrix.adverse.map((item) => (
                          <div key={item.id} className="case-card adverse-card">
                            <div className="card-top">
                              <h4 className="case-name">{item.title}</h4>
                              <span className="citation-badge">{item.citation}</span>
                            </div>
                            <div className="card-section">
                              <div className="section-label">Anticipated Opposing Argument:</div>
                              <div className="section-text">{item.opposingArgument}</div>
                            </div>
                            <div className="card-section highlight-distinguish">
                              <div className="section-label">Distinguishing Strategy:</div>
                              <div className="section-strategy">{item.distinguishingStrategy}</div>
                            </div>
                            {item.link && (
                              <div className="card-footer">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="courtlistener-link"
                                >
                                  CourtListener Record <ArrowSquareOut size={12} />
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Precedent Network Graph */}
            {activeCanvasTab === "graph" && (
              <PrecedentGraph
                favorable={activeSession.matrix.favorable}
                adverse={activeSession.matrix.adverse}
                citations={activeSession.citations}
                onSelectCase={(title) => {
                  const match = activeSession.cases.find((c) => {
                    const cTitle = c.Title || (c as unknown as { title?: string }).title || "";
                    return cTitle.toLowerCase().includes(title.toLowerCase());
                  });
                  if (match) {
                    setReaderCase(match);
                    setActiveCanvasTab("reader");
                  }
                }}
              />
            )}

            {/* TAB 3: Circuit Split Matrix */}
            {activeCanvasTab === "split" && <CircuitSplitVisualizer />}

            {/* TAB 4: Doctrine Timeline */}
            {activeCanvasTab === "timeline" && <DoctrineTimeline />}

            {/* TAB 5: IRAC Memorandum (Court Pleading Paper + Inline Co-Counsel Tools) */}
            {activeCanvasTab === "memo" && (
              <div className="memo-view printable-memo">
                {!activeSession.memo ? (
                  <div className="memo-empty">
                    <FileText size={42} />
                    <h3>No Legal Memorandum Generated Yet</h3>
                    <p>Enter a legal objective in the assistant stream to autonomously synthesize an IRAC brief.</p>
                  </div>
                ) : (
                  <article className="memo-document">
                    {/* Left Line Numbers 1 to 28 (Federal Pleading Paper Standard) */}
                    <div className="pleading-margin-numbers" aria-hidden>
                      {Array.from({ length: 28 }, (_, i) => (
                        <span key={i + 1} className="pleading-line-num">
                          {i + 1}
                        </span>
                      ))}
                    </div>

                    <div className="pleading-content-body">
                      <header className="memo-head">
                        <div className="memo-crest">IN THE UNITED STATES COURT OF APPEALS</div>
                        <h1 className="memo-title">{activeSession.memo.title}</h1>
                        <div className="memo-meta-grid">
                          <div><strong>DATE:</strong> {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>
                          <div><strong>COUNSEL:</strong> Autonomous Strategy Agent</div>
                          <div><strong>CIRCUIT / VENUE:</strong> {selectedCourt ? selectedCourt.toUpperCase() : "Governing Federal Jurisdiction"}</div>
                          <div><strong>INTEGRITY:</strong> CourtListener v4 Docket Audited</div>
                        </div>
                      </header>

                      {/* Section 1: Executive Summary */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">I. EXECUTIVE SUMMARY</h2>
                          <div className="co-counsel-pills">
                            <button
                              type="button"
                              className="co-counsel-pill"
                              onClick={() => handleGenerateAnnotation("summary", "oral")}
                              title="Generate Oral Argument Pitch"
                            >
                              <Lightning size={12} weight="fill" /> Oral Pitch
                            </button>
                            <button
                              type="button"
                              className="co-counsel-pill"
                              onClick={() => handleGenerateAnnotation("summary", "statute")}
                              title="Link Statutory Grounding"
                            >
                              <Scales size={12} weight="fill" /> Statutory Link
                            </button>
                          </div>
                        </div>
                        <div className="section-prose">{activeSession.memo.executiveSummary}</div>
                        {memoAnnotations["summary"] && (
                          <aside className={`annotation-callout ${memoAnnotations["summary"].type}`}>
                            <div className="callout-head">
                              <span className="callout-tag">
                                {memoAnnotations["summary"].type === "oral"
                                  ? "⚡ Oral Argument Panel Soundbite (15s)"
                                  : "⚖️ Statutory Grounding"}
                              </span>
                              <button
                                type="button"
                                className="callout-dismiss"
                                onClick={() => {
                                  const n = { ...memoAnnotations };
                                  delete n["summary"];
                                  setMemoAnnotations(n);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="callout-body">{memoAnnotations["summary"].text}</div>
                          </aside>
                        )}
                      </section>

                      {/* Section 2: Statement of Issue */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">II. STATEMENT OF THE ISSUE</h2>
                        </div>
                        <div className="section-prose">{activeSession.memo.issue}</div>
                      </section>

                      {/* Section 3: Controlling Legal Rules */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">III. CONTROLLING LEGAL RULES</h2>
                          <div className="co-counsel-pills">
                            <button
                              type="button"
                              className="co-counsel-pill"
                              onClick={() => handleGenerateAnnotation("rule", "statute")}
                            >
                              <Scales size={12} weight="fill" /> 18 U.S.C. § 1836 Note
                            </button>
                          </div>
                        </div>
                        <div className="section-prose">{activeSession.memo.rule}</div>
                        {memoAnnotations["rule"] && (
                          <aside className="annotation-callout statute">
                            <div className="callout-head">
                              <span className="callout-tag">⚖️ Statutory Authority</span>
                              <button
                                type="button"
                                className="callout-dismiss"
                                onClick={() => {
                                  const n = { ...memoAnnotations };
                                  delete n["rule"];
                                  setMemoAnnotations(n);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="callout-body">{memoAnnotations["rule"].text}</div>
                          </aside>
                        )}
                      </section>

                      {/* Section 4: Application */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">IV. APPLICATION &amp; LEGAL ANALYSIS</h2>
                          <div className="co-counsel-pills">
                            <button
                              type="button"
                              className="co-counsel-pill"
                              onClick={() => handleGenerateAnnotation("app", "oral")}
                            >
                              <Lightning size={12} weight="fill" /> Panel Question Prep
                            </button>
                          </div>
                        </div>
                        <div className="section-prose">{activeSession.memo.application}</div>
                        {memoAnnotations["app"] && (
                          <aside className="annotation-callout oral">
                            <div className="callout-head">
                              <span className="callout-tag">⚡ Panel Rebuttal Formulation</span>
                              <button
                                type="button"
                                className="callout-dismiss"
                                onClick={() => {
                                  const n = { ...memoAnnotations };
                                  delete n["app"];
                                  setMemoAnnotations(n);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="callout-body">{memoAnnotations["app"].text}</div>
                          </aside>
                        )}
                      </section>

                      {/* Section 5: Counter-arguments & Rebuttal */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">V. OPPOSING ARGUMENTS &amp; REBUTTAL STRATEGY</h2>
                          <div className="co-counsel-pills">
                            <button
                              type="button"
                              className="co-counsel-pill"
                              onClick={() => handleGenerateAnnotation("counter", "distinguish")}
                            >
                              <ShieldWarning size={12} weight="fill" /> Distinguishing Footnote
                            </button>
                          </div>
                        </div>
                        <div className="section-prose">{activeSession.memo.counterArguments}</div>
                        {memoAnnotations["counter"] && (
                          <aside className="annotation-callout distinguish">
                            <div className="callout-head">
                              <span className="callout-tag">🛡️ Tactical Distinguishing Argument</span>
                              <button
                                type="button"
                                className="callout-dismiss"
                                onClick={() => {
                                  const n = { ...memoAnnotations };
                                  delete n["counter"];
                                  setMemoAnnotations(n);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="callout-body">{memoAnnotations["counter"].text}</div>
                          </aside>
                        )}
                      </section>

                      {/* Section 6: Conclusion */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">VI. CONCLUSION &amp; LITIGATION RECOMMENDATIONS</h2>
                        </div>
                        <div className="section-prose">{activeSession.memo.conclusion}</div>
                      </section>
                    </div>
                  </article>
                )}
              </div>
            )}

            {/* TAB 3: Verified Citations Audit */}
            {activeCanvasTab === "citations" && (
              <div className="citations-view">
                <div className="citations-intro">
                  <div className="intro-title">
                    <ShieldCheck size={20} color="var(--accent)" weight="bold" /> Anti-Hallucination Citation Audit
                  </div>
                  <p>
                    Every legal precedent analyzed by CaseFile AI is cross-verified against real court dockets on CourtListener.
                    Unverified or fabricated citations are flagged to maintain strict legal ethics.
                  </p>
                </div>

                {activeSession.citations.length === 0 ? (
                  <div className="citations-empty">
                    <ShieldCheck size={36} />
                    <p>No citations verified yet. Run research to audit case references.</p>
                  </div>
                ) : (
                  <div className="citations-grid">
                    {activeSession.citations.map((cite) => (
                      <div key={cite.id} className={`citation-card ${cite.status}`}>
                        <div className="cite-badge-row">
                          {cite.status === "verified" && (
                            <span className="guardrail-badge verified">
                              🟢 Verified Official Authority
                            </span>
                          )}
                          {cite.status === "partial" && (
                            <span className="guardrail-badge partial">
                              🟡 Partial / Unindexed Match
                            </span>
                          )}
                          {cite.status === "unverified" && (
                            <span className="guardrail-badge flagged">
                              🔴 Unverified Authority
                            </span>
                          )}
                          <span className="cite-court">{cite.court}</span>
                        </div>

                        <h4 className="cite-title">{cite.caseTitle}</h4>
                        <div className="cite-citation-text">{cite.citation}</div>

                        <div className="cite-footer">
                          {cite.dateFiled && <span>Filed: {cite.dateFiled}</span>}
                          {cite.link && (
                            <a
                              href={cite.link}
                              target="_blank"
                              rel="noreferrer"
                              className="cite-link"
                            >
                              View Official Record <ArrowSquareOut size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Opinion Reader */}
            {activeCanvasTab === "reader" && (
              (() => {
                const cur = readerCase || activeSession.cases[0];
                if (!cur) {
                  return (
                    <div className="opinion-reader-empty">
                      <Books size={40} color="var(--accent)" />
                      <h4>No Opinion Selected for Deep Reading</h4>
                      <p>
                        Launch an autonomous research inquiry or click any precedent in the Precedent Graph or Adversarial Matrix to load full judicial opinion text and docket context.
                      </p>
                    </div>
                  );
                }
                const caseTitle = cur.Title || (cur as unknown as { title?: string }).title || "Untitled Authority";
                const caseLink = cur.Link || (cur as unknown as { link?: string }).link;
                return (
                  <div className="reader-view">
                    <div className="reader-header">
                      <div>
                        <h2>{caseTitle}</h2>
                        <div className="reader-meta">
                          {cur.court && <span className="chip">{cur.court}</span>}
                          {cur.dateFiled && <span className="chip">{cur.dateFiled}</span>}
                          {cur.citation?.[0] && <span className="chip">{cur.citation[0]}</span>}
                        </div>
                      </div>
                      {caseLink && (
                        <a
                          href={caseLink}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          CourtListener <ArrowSquareOut size={14} />
                        </a>
                      )}
                    </div>
                    <div className="reader-body">
                      <pre className="opinion-text">
                        {cur.opinionText || cur.snippet || "No opinion text available."}
                      </pre>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
