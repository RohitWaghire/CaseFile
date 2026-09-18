import type { View } from "../App";
import { Sparkle, ShieldCheck, ArrowSquareOut, MagnifyingGlass } from "@phosphor-icons/react";

interface NavProps {
  view: View;
  onNavigate: (view: View) => void;
  onOpenCommandBar?: () => void;
}

export function Nav({ view, onNavigate, onOpenCommandBar }: NavProps) {
  const crumb =
    view === "home"
      ? "Smart Legal Assistant"
      : view === "agent"
      ? "AI Legal Studio"
      : "Case Research Desk";

  return (
    <header className="workbench-nav">
      <div className="workbench-nav-left">
        <a
          href="#home"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("home");
          }}
          title="CaseFile AI — LexHack 2026"
        >
          <span className="brand-mark" aria-hidden>
            CF
          </span>
          <span className="brand-text">
            CaseFile <span className="brand-ai">AI</span>
          </span>
        </a>
        <span className="workbench-divider" aria-hidden>/</span>
        <span className="workbench-crumb">{crumb}</span>
      </div>

      <nav className="workbench-nav-center" aria-label="View switcher">
        <div className="segmented-control">
          <button
            type="button"
            className={`seg-btn ${view === "home" ? "active" : ""}`}
            aria-current={view === "home" ? "page" : undefined}
            onClick={() => onNavigate("home")}
          >
            Overview
          </button>
          <button
            type="button"
            className={`seg-btn ${view === "agent" ? "active" : ""}`}
            aria-current={view === "agent" ? "page" : undefined}
            onClick={() => onNavigate("agent")}
          >
            <Sparkle size={13} weight="fill" /> AI Legal Studio
          </button>
          <button
            type="button"
            className={`seg-btn ${view === "research" ? "active" : ""}`}
            aria-current={view === "research" ? "page" : undefined}
            onClick={() => onNavigate("research")}
          >
            Case Search
          </button>
        </div>
      </nav>

      <div className="workbench-nav-right">
        {onOpenCommandBar && (
          <button
            type="button"
            className="nav-cmd-k-trigger"
            onClick={onOpenCommandBar}
            title="Quick actions and search (Press Cmd+K or Ctrl+K)"
          >
            <MagnifyingGlass size={13} />
            <span>Quick Actions</span>
            <kbd>⌘K</kbd>
          </button>
        )}
        <div className="engine-status">
          <span className="engine-dot" />
          <span className="engine-label">Real Court Records Live</span>
        </div>
        <a
          href="https://lexhack-2026.devpost.com/"
          target="_blank"
          rel="noreferrer"
          className="lexhack-badge"
          title="LexHack 2026 Project Entry"
        >
          <ShieldCheck size={14} /> LexHack 2026 <ArrowSquareOut size={11} />
        </a>
      </div>
    </header>
  );
}
