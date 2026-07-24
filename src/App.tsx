import { useState } from "react";
import { Nav } from "./components/Nav";
import { Landing } from "./components/Landing";
import { Research } from "./components/Research";
import { Footer } from "./components/Footer";

export type View = "home" | "research";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [seedQuery, setSeedQuery] = useState("IT laws for cyber crime");

  function startResearch(query: string) {
    setSeedQuery(query);
    setView("research");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav view={view} onNavigate={navigate} />
      <main id="main" className="page-main">
        {view === "home" && <Landing onStartResearch={startResearch} />}
        {view === "research" && <Research initialQuery={seedQuery} />}
      </main>
      {view === "home" && <Footer />}
    </div>
  );
}
