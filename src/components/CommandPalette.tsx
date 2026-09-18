import { useState, useEffect, useMemo, useRef } from "react";
import {
  MagnifyingGlass,
  Sparkle,
  Scales,
  FileText,
  ShieldCheck,
  GitBranch,
  Clock,
  Printer,
  ArrowRight,
  House,
  Books,
} from "@phosphor-icons/react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateView?: (view: "home" | "agent" | "research") => void;
  onNavigateTab?: (tab: "matrix" | "graph" | "split" | "timeline" | "memo" | "citations" | "reader") => void;
  onSelectPreset?: (prompt: string, court?: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigateView,
  onNavigateTab,
  onSelectPreset,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const COMMANDS = useMemo(() => [
    {
      category: "Navigation & Workspaces",
      items: [
        {
          id: "nav-home",
          title: "Overview (Landing Console)",
          sub: "Platform introduction, live inquiry terminal, and deliverables showcase",
          icon: <House size={16} color="var(--accent)" />,
          action: () => {
            onNavigateView?.("home");
            onClose();
          },
        },
        {
          id: "nav-agent",
          title: "AI Agent Studio",
          sub: "Autonomous multi-step ReAct planning, adversarial matrix, and IRAC memo",
          icon: <Sparkle size={16} color="var(--accent)" />,
          action: () => {
            onNavigateView?.("agent");
            onClose();
          },
        },
        {
          id: "nav-research",
          title: "Case Research Desk",
          sub: "Search CourtListener v4 dockets, extract slip opinions, and generate headnotes",
          icon: <Books size={16} color="var(--warn)" />,
          action: () => {
            onNavigateView?.("research");
            onClose();
          },
        },
      ],
    },
    {
      category: "Canvas Views",
      items: [
        {
          id: "tab-matrix",
          title: "Adversarial Matrix",
          sub: "Inspect controlling affirmative vs hostile counter-precedents",
          icon: <Scales size={16} color="var(--accent)" />,
          action: () => {
            onNavigateTab?.("matrix");
            onClose();
          },
        },
        {
          id: "tab-graph",
          title: "Precedent Graph Topology",
          sub: "Open interactive node-link citation network",
          icon: <Sparkle size={16} color="var(--accent)" />,
          action: () => {
            onNavigateTab?.("graph");
            onClose();
          },
        },
        {
          id: "tab-split",
          title: "Circuit Split Matrix",
          sub: "Analyze divergence across the 13 Federal Circuits of Appeals",
          icon: <GitBranch size={16} color="#c4a35a" />,
          action: () => {
            onNavigateTab?.("split");
            onClose();
          },
        },
        {
          id: "tab-timeline",
          title: "Doctrine Timeline",
          sub: "50-year precedent evolution from Kewanee Oil to 2026",
          icon: <Clock size={16} color="#6aab8a" />,
          action: () => {
            onNavigateTab?.("timeline");
            onClose();
          },
        },
        {
          id: "tab-memo",
          title: "IRAC Legal Brief & Pleading Paper",
          sub: "Review court-formatted memorandum with co-counsel tools",
          icon: <FileText size={16} color="var(--text)" />,
          action: () => {
            onNavigateTab?.("memo");
            onClose();
          },
        },
        {
          id: "tab-citations",
          title: "Anti-Hallucination Citation Audit",
          sub: "Audit case references against official CourtListener dockets",
          icon: <ShieldCheck size={16} color="#72ba97" />,
          action: () => {
            onNavigateTab?.("citations");
            onClose();
          },
        },
        {
          id: "tab-reader",
          title: "Opinion Reader",
          sub: "Deep-read full opinion text and judicial syllabus",
          icon: <Books size={16} color="var(--accent)" />,
          action: () => {
            onNavigateTab?.("reader");
            onClose();
          },
        },
      ],
    },
    {
      category: "Litigation Scenarios",
      items: [
        {
          id: "preset-dtsa",
          title: "DTSA Trade Secrets & Reverse Engineering",
          sub: "9th Circuit clean-room defense & lawful decompilation",
          icon: <Sparkle size={16} color="var(--accent)" />,
          action: () => {
            onSelectPreset?.(
              "We represent a technology startup accused of trade secret misappropriation under DTSA. The founder legitimately reverse-engineered public APIs. Identify controlling 9th Circuit precedents on clean-room reverse engineering, analyze opposing counsel's likely counter-arguments, and draft our defense brief.",
              "ca9"
            );
            onClose();
          },
        },
        {
          id: "preset-geofence",
          title: "Fourth Amendment Warrantless Geofence Warrants",
          sub: "Constitutional privacy challenges to mass location data dragnets",
          icon: <Sparkle size={16} color="var(--accent)" />,
          action: () => {
            onSelectPreset?.(
              "Challenge a criminal conviction based on a Google geofence warrant. Search for adverse authorities and formulate our defense strategy emphasizing lack of particularized probable cause under Carpenter v. United States.",
              "scotus"
            );
            onClose();
          },
        },
        {
          id: "preset-ai",
          title: "Generative AI Training & Copyright Fair Use",
          sub: "Authors Guild, Andy Warhol, and intermediate transformativeness",
          icon: <Sparkle size={16} color="var(--accent)" />,
          action: () => {
            onSelectPreset?.(
              "Defense of an AI foundation model company facing copyright infringement. Evaluate fair use factor 1 (purpose and character) under Authors Guild v. Google and Andy Warhol Foundation v. Goldsmith.",
              "ca2"
            );
            onClose();
          },
        },
      ],
    },
    {
      category: "Actions",
      items: [
        {
          id: "act-print",
          title: "Print / Export Court Brief as PDF",
          sub: "Invoke judicial print styling for filed pleading brief",
          icon: <Printer size={16} color="var(--text-soft)" />,
          action: () => {
            window.print();
            onClose();
          },
        },
      ],
    },
  ], [onNavigateView, onNavigateTab, onSelectPreset, onClose]);

  const filtered = useMemo(() => {
    return COMMANDS.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.sub.toLowerCase().includes(query.toLowerCase())
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [COMMANDS, query]);

  // Flattened array for keyboard navigation
  const flatItems = useMemo(() => {
    return filtered.flatMap((cat) => cat.items);
  }, [filtered]);

  // Reset selected index when query changes is handled in onChange

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === "Escape" && isOpen) {
        onClose();
      } else if (isOpen && flatItems.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % flatItems.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          const target = flatItems[selectedIndex];
          if (target) target.action();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, flatItems, selectedIndex]);

  // Keep selected item in view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(".palette-item.is-selected");
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Focus restore on close + trap-lite: keep Tab cycling inside the dialog
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    function onTrapKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusables = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onTrapKey);
    return () => {
      window.removeEventListener("keydown", onTrapKey);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="command-palette-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Legal command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="palette-input-row">
          <MagnifyingGlass size={18} className="palette-search-icon" />
          <input
            autoFocus
            type="text"
            className="palette-input"
            aria-label="Search legal commands"
            placeholder="Type a legal command, navigate view, or select circuit split..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <span className="palette-esc-badge" onClick={onClose}>
            ESC
          </span>
        </div>

        <div className="palette-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="palette-empty">No legal commands match "{query}"</div>
          ) : (
            filtered.map((cat) => (
              <div key={cat.category} className="palette-group">
                <div className="palette-group-label">{cat.category}</div>
                {cat.items.map((item) => {
                  const isSelected = flatItems[selectedIndex]?.id === item.id;
                  currentIndex++;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`palette-item ${isSelected ? "is-selected" : ""}`}
                      onClick={item.action}
                      onMouseEnter={() => {
                        const idx = flatItems.findIndex((fi) => fi.id === item.id);
                        if (idx >= 0) setSelectedIndex(idx);
                      }}
                    >
                      <span className="item-icon-box">{item.icon}</span>
                      <div className="item-copy">
                        <div className="item-title">{item.title}</div>
                        <div className="item-sub">{item.sub}</div>
                      </div>
                      <ArrowRight size={14} className="item-arrow" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="palette-footer">
          <span>Navigate: <kbd>↑</kbd> <kbd>↓</kbd></span>
          <span>Execute: <kbd>↵</kbd></span>
          <span>Close: <kbd>Esc</kbd></span>
        </div>
      </div>
    </div>
  );
}
