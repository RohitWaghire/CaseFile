export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <strong>CaseFile</strong>
          <p>
            Case law research helper powered by the public CourtListener search
            index. Structured for researchers who need title, link, and opinion
            text in one export.
          </p>
        </div>
        <div className="footer-meta">
          <p>
            Data from{" "}
            <a href="https://www.courtlistener.com/" target="_blank" rel="noreferrer">
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
