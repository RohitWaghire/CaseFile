import { useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import {
  MagnifyingGlass,
  FileArrowDown,
  Stack,
  ArrowRight,
  CaretLeft,
  CaretRight,
  Sparkle,
  ShieldCheck,
  Scales,
  CheckCircle,
  ShieldWarning,
  Lightning,
} from "@phosphor-icons/react";
import { ImageScaleFade } from "./gsap/ImageScaleFade";
import { CardStack } from "./gsap/CardStack";

const PRESET_CARDS = [
  {
    tag: "Tech & IP",
    title: "DTSA Trade Secrets & Reverse Engineering",
    query: "DTSA trade secret reverse engineering defense",
    court: "ca9",
    snippet: "9th Circuit clean-room standard & independent product discovery privileges.",
  },
  {
    tag: "Constitutional",
    title: "Fourth Amendment Warrantless Geofence Dragnets",
    query: "Fourth Amendment warrantless geofence warrants",
    court: "scotus",
    snippet: "Challenging broad reverse-location dragnet warrants under Carpenter v. United States.",
  },
  {
    tag: "AI & Copyright",
    title: "AI Model Training & Transformative Fair Use",
    query: "AI model training copyright fair use",
    court: "ca2",
    snippet: "Interplay between Authors Guild, Warhol, and intermediate software decompilation.",
  },
  {
    tag: "Antitrust",
    title: "Algorithmic Pricing & Landlord Cartels",
    query: "Tenant rights against algorithmic rent fixing",
    court: "fed",
    snippet: "Sherman Act § 1 algorithmic collusion standards and landlord market dominance.",
  },
];

const QUOTES = [
  {
    text: "CaseFile AI's adversarial matrix exposed the exact counter-precedents opposing counsel was preparing to cite. We neutralized them before oral argument.",
    name: "Maya Ortiz",
    role: "Appellate litigation associate, 9th Circuit",
  },
  {
    text: "Zero hallucination is what makes this viable for our legal clinic. The green shield verification against CourtListener cluster dockets gives us confidence to cite every paragraph.",
    name: "Priya Nandakumar",
    role: "Clinical law professor & appellate advocate",
  },
  {
    text: "Having an autonomous agent conduct iterative searches, extract holdings, and draft an initial IRAC memo saved our litigation team 6 billable hours per brief.",
    name: "Jonah Ellison",
    role: "Senior litigation counsel",
  },
];

const ACCORDION = [
  {
    title: "1. Autonomous Planning & Deconstruction",
    body: "The agent deconstructs complex legal questions, detecting relevant circuit jurisdictions, majority standards, and adverse theories.",
    img: "/assets/workspace.jpg",
  },
  {
    title: "2. Adversarial Precedent Matrix",
    body: "Precedents are split into favorable holdings and adverse authorities, providing tactical distinguishing arguments against counter-claims.",
    img: "/assets/panel.jpg",
  },
  {
    title: "3. Court Pleading Paper & Verified Citations",
    body: "Outputs an authoritative legal memorandum with lines 1–28 and every cited authority verified against live CourtListener dockets.",
    img: "/assets/appellate-desk.jpg",
  },
];

interface LandingProps {
  onStartResearch: (query: string) => void;
  onStartAgent: (prompt?: string, court?: string) => void;
}

export function Landing({ onStartResearch, onStartAgent }: LandingProps) {
  const [q, setQ] = useState("DTSA trade secret reverse engineering defense");
  const [showcaseTab, setShowcaseTab] = useState<"matrix" | "pleading" | "citations">("matrix");
  const [openSlice, setOpenSlice] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const reduce = useReducedMotion();

  function launchAgent(query = q, court?: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    onStartAgent(trimmed, court);
  }

  const quote = QUOTES[quoteIdx];

  return (
    <div className="landing">
      {/* ATTENTION: Hero section with authentic executive aesthetic */}
      <section className="hero-asym" aria-labelledby="hero-title">
        <div className="hero-asym-inner">
          <motion.div
            className="hero-asym-copy"
            initial={reduce ? false : { opacity: 1, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="hero-badge">
              <Sparkle size={14} weight="fill" /> LexHack 2026 Legal AI Agent
            </div>

            <h1 id="hero-title" className="hero-title">
              Autonomous legal research &amp; appellate strategy, structured for the brief.
            </h1>

            <p className="hero-lead">
              CaseFile AI plans multi-step CourtListener investigations, separates favorable from adverse precedent, maps circuit splits, and drafts verified IRAC memorandums with zero hallucinations.
            </p>

            <div className="hero-ctas">
              <button type="button" className="btn btn-solid" onClick={() => launchAgent()}>
                <Sparkle size={16} weight="fill" />
                Launch AI Agent Studio
                <ArrowRight size={16} weight="bold" />
              </button>
              <button
                type="button"
                className="btn btn-line"
                onClick={() => onStartResearch(q || "cyber crime")}
              >
                Open Research Desk
              </button>
            </div>

            {/* Cognitive Inquiry Terminal */}
            <div className="teaser-search cognitive-terminal-box">
              <div className="terminal-box-header">
                <div className="box-indicator">
                  <span className="live-pulse" />
                  <span className="box-tag">CourtListener v4 Autonomous Inquiry</span>
                </div>
                <span className="box-kbd-hint">Press ↵ to Launch • ⌘K for Command Bar</span>
              </div>

              <div className="teaser-row">
                <label htmlFor="hero-query" className="sr-only">
                  Legal inquiry
                </label>
                <input
                  id="hero-query"
                  aria-label="Legal inquiry"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && launchAgent()}
                  placeholder="e.g. DTSA trade secret reverse engineering defense"
                  autoComplete="off"
                />
                <button type="button" className="btn btn-solid" onClick={() => launchAgent()}>
                  Run Agent ↵
                </button>
              </div>

              {/* Starter Precedent Cards */}
              <div className="starter-presets-grid" aria-label="Litigation Scenarios">
                {PRESET_CARDS.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    className="starter-card"
                    onClick={() => {
                      setQ(preset.query);
                      launchAgent(preset.query, preset.court);
                    }}
                  >
                    <div className="starter-card-top">
                      <span className="starter-tag">{preset.tag}</span>
                      <span className="starter-court-badge">{preset.court.toUpperCase()}</span>
                    </div>
                    <div className="starter-title">{preset.title}</div>
                    <div className="starter-snippet">{preset.snippet}</div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="hero-float-visual"
            initial={reduce ? false : { opacity: 1, y: 28, rotate: 1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          >
            <div className="hero-float-frame group-hover-media">
              <img
                src="/assets/appellate-desk.jpg"
                alt="Chamber desk with legal case reporters and brief materials"
                width={900}
                height={1100}
              />
              <div className="hero-badge-overlay">
                <span className="live-pulse" />
                <span className="overlay-text">Autonomous Research Engine Active • LexHack 2026</span>
              </div>
            </div>
          </motion.div>
        </div>
        <div className="hero-wash" aria-hidden />
      </section>

      {/* NEW: Interactive Live Deliverables Preview */}
      <section className="section-chapter showcase-section">
        <div className="container">
          <div className="chapter-head chapter-head-center">
            <div className="hero-badge">
              <Sparkle size={13} weight="fill" /> Interactive Deliverables Preview
            </div>
            <h2>Litigation-Ready Briefs with Zero Hallucinations</h2>
            <p>
              Inspect the three synchronized artifacts generated autonomously for every legal objective.
            </p>
          </div>

          <div className="showcase-card-container">
            {/* Tab Bar */}
            <div className="showcase-nav-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={showcaseTab === "matrix"}
                className={`showcase-tab ${showcaseTab === "matrix" ? "active" : ""}`}
                onClick={() => setShowcaseTab("matrix")}
              >
                <Scales size={16} /> 1. Adversarial Precedent Matrix
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={showcaseTab === "pleading"}
                className={`showcase-tab ${showcaseTab === "pleading" ? "active" : ""}`}
                onClick={() => setShowcaseTab("pleading")}
              >
                <FileArrowDown size={16} /> 2. Court Pleading Paper (IRAC)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={showcaseTab === "citations"}
                className={`showcase-tab ${showcaseTab === "citations" ? "active" : ""}`}
                onClick={() => setShowcaseTab("citations")}
              >
                <ShieldCheck size={16} /> 3. Anti-Hallucination Audit
              </button>
            </div>

            {/* Showcase Viewport */}
            <div className="showcase-viewport">
              {showcaseTab === "matrix" && (
                <div className="showcase-matrix-preview">
                  <div className="preview-split">
                    <div className="preview-card favorable">
                      <div className="preview-card-head">
                        <CheckCircle size={16} color="var(--accent)" weight="bold" />
                        <span>Favorable Precedent (Controlling)</span>
                        <span className="cite-sub">676 F.2d 400 (9th Cir. 1982)</span>
                      </div>
                      <h4>Chicago Lock Co. v. Fanberg</h4>
                      <p className="preview-holding">
                        <strong>Holding:</strong> Lawful buyers who disassemble locks and reverse-engineer codes do not use "improper means."
                      </p>
                      <div className="preview-strategy">
                        <strong>Strategy:</strong> Anchor our defense on the public commercial availability of the hardware.
                      </div>
                    </div>

                    <div className="preview-card adverse">
                      <div className="preview-card-head">
                        <ShieldWarning size={16} color="var(--warn)" weight="bold" />
                        <span>Adverse Precedent (Opposing Counsel)</span>
                        <span className="cite-sub">2026 Fed. App.</span>
                      </div>
                      <h4>Comet Technologies USA v. XP Power, LLC</h4>
                      <p className="preview-holding">
                        <strong>Hostile Theory:</strong> Plaintiff will argue access to confidential schematics taints subsequent reverse engineering.
                      </p>
                      <div className="preview-distinguish">
                        <strong>Distinguishing Argument:</strong> In Comet, the defendant executed a pre-release NDA; here, acquisition was unencumbered.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showcaseTab === "pleading" && (
                <div className="showcase-pleading-preview">
                  <div className="pleading-sample-paper">
                    <div className="pleading-margin-col" aria-hidden>
                      {Array.from({ length: 12 }, (_, i) => (
                        <div key={i + 1} className="pleading-line-no">{i + 1}</div>
                      ))}
                    </div>
                    <div className="pleading-sample-body">
                      <div className="pleading-sample-crest">IN THE UNITED STATES COURT OF APPEALS FOR THE NINTH CIRCUIT</div>
                      <h4 className="pleading-sample-title">MEMORANDUM OF LAW &amp; AUTHORITIES IN SUPPORT OF REVERSE ENGINEERING DEFENSE</h4>
                      <div className="pleading-sample-prose">
                        <strong>I. STATEMENT OF CONTROLLING RULE:</strong> Under 18 U.S.C. § 1836(b) and binding Ninth Circuit precedent in <em>Chicago Lock Co. v. Fanberg</em>, the acquisition of a trade secret by independent discovery or reverse engineering alone does not constitute an improper means.
                      </div>
                      <div className="pleading-annotation-demo">
                        <span className="annotation-tag"><Lightning size={12} weight="fill" /> Co-Counsel Oral Argument Soundbite</span>
                        <div className="annotation-copy">"Your Honors, lawful reverse engineering is competitive discovery, not misappropriation. The plaintiff cannot expand state trade secret law to monopolize publicly sold hardware."</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showcaseTab === "citations" && (
                <div className="showcase-citations-preview">
                  <div className="showcase-cite-grid">
                    <div className="cite-audit-card">
                      <div className="audit-badge verified">🟢 Verified Official Authority</div>
                      <h5>Chicago Lock Co. v. Fanberg</h5>
                      <div className="audit-meta font-mono">676 F.2d 400 • Docket ID #1284792</div>
                      <p>Cross-referenced against CourtListener Ninth Circuit cluster records. Zero hallucinations.</p>
                    </div>

                    <div className="cite-audit-card">
                      <div className="audit-badge verified">🟢 Verified Official Authority</div>
                      <h5>Imax Corp. v. Cinema Technologies, Inc.</h5>
                      <div className="audit-meta font-mono">152 F.3d 1161 • Docket ID #1182245</div>
                      <p>Holding on trade secret precision verified in official reporter text.</p>
                    </div>

                    <div className="cite-audit-card">
                      <div className="audit-badge verified">🟢 Verified Official Authority</div>
                      <h5>United States v. Liew</h5>
                      <div className="audit-meta font-mono">856 F.3d 585 • Docket ID #2819033</div>
                      <p>Criminal trade secret standard verified against Ninth Circuit panel ruling.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Showcase Footer Action */}
            <div className="showcase-foot">
              <span>Ready to brief your own appellate issue?</span>
              <button
                type="button"
                className="btn btn-solid btn-sm"
                onClick={() => launchAgent(q)}
              >
                <Sparkle size={14} weight="fill" />
                Run Full Brief in AI Agent Studio
                <ArrowRight size={14} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* INTEREST: Gapless Bento */}
      <section className="section-chapter">
        <div className="container">
          <div className="chapter-head">
            <h2>Engineered for High-Stakes Legal Strategy</h2>
            <p>
              Beyond basic chat summaries: an autonomous ReAct agent that conducts adversarial analysis, cross-verifies authorities, and generates litigation-ready briefs.
            </p>
          </div>

          <div className="bento" aria-label="Product capabilities">
            <article className="bento-cell bento-span-2 bento-row-2 bento-media group-hover-media">
              <img src="/assets/legal-firm.jpg" alt="Modern high-vault appellate law library and archive" />
              <div className="bento-overlay">
                <h3>Live CourtListener v4 Integration</h3>
                <p>Real-time appellate opinions and circuit court dockets indexed directly from Free Law Project.</p>
              </div>
            </article>

            <article className="bento-cell bento-tint">
              <Scales size={28} weight="duotone" />
              <h3>Adversarial Case Matrix</h3>
              <p>Balances your affirmative argument against the exact counter-precedents opposing counsel will cite.</p>
            </article>

            <article className="bento-cell">
              <ShieldCheck size={28} weight="duotone" />
              <h3>Anti-Hallucination Guard</h3>
              <p>Every case reference is audited against authentic court dockets to prevent fabricated citations.</p>
            </article>

            <article className="bento-cell bento-span-2 bento-accent">
              <Stack size={28} weight="duotone" />
              <h3>IRAC Legal Memorandum Generator</h3>
              <p>
                Synthesizes formal legal briefs (Issue, Rule, Application, Counter-arguments, and Conclusion) with one-click Markdown and PDF export.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* INTEREST: Horizontal Accordion */}
      <section className="section-chapter section-tight-top">
        <div className="container">
          <div className="chapter-head">
            <h2>The Agentic Research Pipeline</h2>
            <p>Hover a stage to explore the cognitive loop from raw inquiry to verified legal brief.</p>
          </div>
          <div className="h-accordion" role="list">
            {ACCORDION.map((item, i) => {
              const open = openSlice === i;
              return (
                <button
                  key={item.title}
                  type="button"
                  role="listitem"
                  className={`h-slice${open ? " is-open" : ""}`}
                  onMouseEnter={() => setOpenSlice(i)}
                  onFocus={() => setOpenSlice(i)}
                  onClick={() => setOpenSlice(i)}
                  aria-expanded={open}
                >
                  <span className="h-slice-title">{item.title}</span>
                  <span className="h-slice-body">
                    <span
                      className="h-slice-img group-hover-media"
                      style={{ backgroundImage: `url(${item.img})` }}
                    />
                    <span className="h-slice-copy">{item.body}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* DESIRE: GSAP Image Scale / Fade */}
      <section className="section-chapter">
        <div className="container">
          <div className="chapter-head chapter-head-center">
            <h2>Designed for Rigorous Appellate Practice</h2>
            <p>
              The split-screen studio pairs real-time cognitive reasoning with a dynamic artifact canvas, keeping full opinions, adversarial matrices, and memoranda in immediate view.
            </p>
          </div>
          <ImageScaleFade
            src="/assets/panel.jpg"
            alt="Close view of open reporters under warm desk light"
            caption="Continuous verification ensures every cited passage is grounded in real judicial rulings"
          />
        </div>
      </section>

      {/* DESIRE: GSAP Card Stacking */}
      <CardStack
        title="From Complex Dispute to Actionable Strategy"
        lead="How CaseFile AI automates the workflow of a senior appellate law firm."
        cards={[
          <div key="q" className="stack-content">
            <MagnifyingGlass size={32} weight="duotone" />
            <h3>1. Multi-Circuit Investigation</h3>
            <p>
              The agent dispatches concurrent search queries across federal circuits and state supreme courts to locate both majority standards and split opinions.
            </p>
          </div>,
          <div key="e" className="stack-content">
            <Scales size={32} weight="duotone" />
            <h3>2. Adversarial Precedent Mapping</h3>
            <p>
              Precedents are mapped into tactical categories: controlling affirmative authorities versus adverse decisions with tailored distinguishing rebuttals.
            </p>
          </div>,
          <div key="x" className="stack-content">
            <FileArrowDown size={32} weight="duotone" />
            <h3>3. Formal IRAC Memorandum Export</h3>
            <p>
              Download publication-grade Markdown briefs, printable client memorandums, or structured JSON records for litigation filing software.
            </p>
          </div>,
        ]}
      />

      {/* Testimonials */}
      <section className="section-chapter">
        <div className="container quote-carousel">
          <div className="quote-controls">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous quote"
              onClick={() => setQuoteIdx((i) => (i + QUOTES.length - 1) % QUOTES.length)}
            >
              <CaretLeft size={18} weight="bold" />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next quote"
              onClick={() => setQuoteIdx((i) => (i + 1) % QUOTES.length)}
            >
              <CaretRight size={18} weight="bold" />
            </button>
          </div>
          <AnimatePresence mode="wait">
            <motion.figure
              key={quote.name}
              className="quote-slide"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <blockquote>
                <p>"{quote.text}"</p>
              </blockquote>
              <figcaption>
                <span className="quote-avatar" aria-hidden>
                  {quote.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <span>
                  <strong>{quote.name}</strong>
                  <span className="quote-role">{quote.role}</span>
                </span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>
      </section>

      {/* ACTION: Bottom Call to Action */}
      <section className="section-action">
        <div className="container action-inner">
          <h2>Ready to Brief Your Next Case?</h2>
          <p>
            Test CaseFile AI with your hardest legal issue. Review the live cognitive trace, inspect the adversarial matrix, and export the verified memorandum.
          </p>
          <div className="hero-ctas">
            <button
              type="button"
              className="btn btn-solid"
              onClick={() => launchAgent("DTSA trade secret reverse engineering defense", "ca9")}
            >
              <Sparkle size={16} weight="fill" />
              Try DTSA Reverse Engineering Scenario
              <ArrowRight size={16} weight="bold" />
            </button>
            <button
              type="button"
              className="btn btn-line"
              onClick={() => launchAgent()}
            >
              Open AI Agent Studio
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
