import type { View } from "../App";

interface NavProps {
  view: View;
  onNavigate: (view: View) => void;
}

export function Nav({ view, onNavigate }: NavProps) {
  return (
    <header className="nav-float-wrap">
      <div className="nav-float">
        <a
          href="#home"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("home");
          }}
        >
          <span className="brand-mark" aria-hidden>
            CF
          </span>
          CaseFile
        </a>
        <nav className="nav-links" aria-label="Primary">
          <a
            href="#home"
            className={view === "home" ? "is-active" : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate("home");
            }}
          >
            Overview
          </a>
          <a
            href="#research"
            className={view === "research" ? "is-active nav-cta" : "nav-cta"}
            onClick={(e) => {
              e.preventDefault();
              onNavigate("research");
            }}
          >
            Research desk
          </a>
        </nav>
      </div>
    </header>
  );
}
