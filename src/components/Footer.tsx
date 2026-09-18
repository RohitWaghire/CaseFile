export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <span className="brand" aria-label="CaseFile AI">
            <span className="brand-mark" aria-hidden>
              CF
            </span>
            <span className="brand-text">
              CaseFile <span className="brand-ai">AI</span>
            </span>
          </span>
          <p>
            Autonomous legal research &amp; IRAC briefs — plans multi-step
            CourtListener investigations and synthesizes verified briefs.
          </p>
          <p>
            <a
              href="https://lexhack-2026.devpost.com/"
              target="_blank"
              rel="noreferrer"
            >
              LexHack 2026
            </a>
          </p>
        </div>
        <div className="footer-meta">
          <p>
            Data from{" "}
            <a
              href="https://www.courtlistener.com/"
              target="_blank"
              rel="noreferrer"
            >
              CourtListener
            </a>{" "}
            / Free Law Project. Not legal advice. Verify citations against
            primary sources before filing.
          </p>
        </div>
      </div>
    </footer>
  );
}
