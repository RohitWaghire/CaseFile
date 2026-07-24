import { useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import {
  MagnifyingGlass,
  FileArrowDown,
  Stack,
  ArrowRight,
  CaretLeft,
  CaretRight,
  BracketsCurly,
} from "@phosphor-icons/react";
import { ImageScaleFade } from "./gsap/ImageScaleFade";
import { CardStack } from "./gsap/CardStack";

const SUGGESTIONS = [
  "IT laws for cyber crime",
  "Fourth Amendment digital search",
  "trade secret misappropriation",
  "qualified immunity police",
];

const QUOTES = [
  {
    text: "I needed a short list of cyber-crime opinions with the text already pulled. CaseFile got me there without a second browser tab.",
    name: "Maya Ortiz",
    role: "Appellate associate",
  },
  {
    text: "The JSON export is what I hand to students after a research clinic. Title, link, and opinion text in one pass.",
    name: "Priya Nandakumar",
    role: "Clinical professor",
  },
  {
    text: "Faster than rebuilding a CourtListener scrape every time a partner changes the issue statement.",
    name: "Jonah Ellison",
    role: "Litigation counsel",
  },
];

const ACCORDION = [
  {
    title: "Search",
    body: "Topic queries hit CourtListener opinions, ordered by filing date with published status preferred.",
    img: "/assets/workspace.jpg",
  },
  {
    title: "Structure",
    body: "Each hit maps to Id, Link, Title, and opinion text so your export stays machine-readable.",
    img: "/assets/panel.jpg",
  },
  {
    title: "Export",
    body: "View JSON in the desk, copy a single record, or download the full set for memos and tooling.",
    img: "/assets/hero.jpg",
  },
];

interface LandingProps {
  onStartResearch: (query: string) => void;
}

export function Landing({ onStartResearch }: LandingProps) {
  const [q, setQ] = useState("IT laws for cyber crime");
  const [openSlice, setOpenSlice] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const reduce = useReducedMotion();

  function submit(query = q) {
    const trimmed = query.trim();
    if (!trimmed) return;
    onStartResearch(trimmed);
  }

  const quote = QUOTES[quoteIdx];

  return (
    <div className="landing">
      {/* ATTENTION: Artistic Asymmetry hero */}
      <section className="hero-asym" aria-labelledby="hero-title">
        <div className="hero-asym-inner">
          <motion.div
            className="hero-asym-copy"
            initial={reduce ? false : { opacity: 1, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 id="hero-title" className="hero-title">
              Court opinions{" "}
              <span
                className="inline-media"
                style={{ backgroundImage: "url(/assets/panel.jpg)" }}
                role="img"
                aria-label="Open case reporters"
              />{" "}
              structured for the brief
            </h1>
            <p className="hero-lead">
              Search a topic. Pull matching cases from CourtListener. Export
              clean JSON with title, link, and opinion text.
            </p>
            <div className="hero-ctas">
              <button type="button" className="btn btn-solid" onClick={() => submit()}>
                Search cases
                <ArrowRight size={16} weight="bold" />
              </button>
              <button
                type="button"
                className="btn btn-line"
                onClick={() => onStartResearch(q || "cyber crime")}
              >
                Open research desk
              </button>
            </div>

            <div className="teaser-search">
              <label htmlFor="hero-query">Research topic</label>
              <div className="teaser-row">
                <input
                  id="hero-query"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="e.g. IT laws for cyber crime"
                  autoComplete="off"
                />
                <button type="button" className="btn btn-solid" onClick={() => submit()}>
                  Go
                </button>
              </div>
              <div className="suggestions" aria-label="Example topics">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => submit(s)}>
                    {s}
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
                src="/assets/hero.jpg"
                alt="Legal research desk with case reporters under a brass lamp"
                width={900}
                height={1100}
              />
            </div>
          </motion.div>
        </div>
        <div className="hero-wash" aria-hidden />
      </section>

      {/* INTEREST: gapless bento */}
      <section className="section-chapter">
        <div className="container">
          <div className="chapter-head">
            <h2>What lands in the file</h2>
            <p>
              Every search becomes a portable case set you can read, extract, and
              download without rebuilding a scraper.
            </p>
          </div>

          <div className="bento" aria-label="Product capabilities">
            <article className="bento-cell bento-span-2 bento-row-2 bento-media group-hover-media">
              <img src="/assets/workspace.jpg" alt="Quiet research workspace ready for a search" />
              <div className="bento-overlay">
                <h3>Live CourtListener index</h3>
                <p>Published opinions, ranked and ready for the desk.</p>
              </div>
            </article>
            <article className="bento-cell bento-tint">
              <BracketsCurly size={28} weight="duotone" />
              <h3>Id, Link, Title, text</h3>
              <p>Structured fields aligned to the research export schema.</p>
            </article>
            <article className="bento-cell">
              <FileArrowDown size={28} weight="duotone" />
              <h3>JSON download</h3>
              <p>One file for the full page of results, or a single case.</p>
            </article>
            <article className="bento-cell bento-span-2 bento-accent">
              <Stack size={28} weight="duotone" />
              <h3>Batch extract</h3>
              <p>
                Pull fuller opinion text across the current result set, then export
                when the record is complete enough for memo prep.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* INTEREST: horizontal accordion */}
      <section className="section-chapter section-tight-top">
        <div className="container">
          <div className="chapter-head">
            <h2>Pipeline, expanded</h2>
            <p>Hover a slice to open the step. Three moves from query to file.</p>
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

      {/* DESIRE: GSAP image scale / fade */}
      <section className="section-chapter">
        <div className="container">
          <div className="chapter-head chapter-head-center">
            <h2>Built for long reads</h2>
            <p>
              The desk keeps the list beside the opinion so you stay in one surface
              from hit to export.
            </p>
          </div>
          <ImageScaleFade
            src="/assets/panel.jpg"
            alt="Close view of open reporters under warm desk light"
            caption="Opinion view stays readable while results stay in reach"
          />
        </div>
      </section>

      {/* DESIRE: GSAP card stacking */}
      <CardStack
        title="From query to export"
        lead="Each stage pins as the next rises. Same pipeline your n8n workflow encoded: discover, extract, write."
        cards={[
          <div key="q" className="stack-content">
            <MagnifyingGlass size={32} weight="duotone" />
            <h3>Topic search</h3>
            <p>
              Enter a subject the way you would brief a junior associate. Results
              prefer published opinions ordered by filing date.
            </p>
          </div>,
          <div key="e" className="stack-content">
            <Stack size={32} weight="duotone" />
            <h3>Case payload</h3>
            <p>
              Each hit becomes a structured record: identifier, CourtListener
              link, case title, and opinion text when available.
            </p>
          </div>,
          <div key="x" className="stack-content">
            <FileArrowDown size={32} weight="duotone" />
            <h3>JSON download</h3>
            <p>
              View results in the desk, open source opinions, or download the
              full collection as a single file.
            </p>
          </div>,
        ]}
      />

      {/* INTEREST: testimonial carousel */}
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

      {/* ACTION */}
      <section className="section-action">
        <div className="container action-inner">
          <h2>Ready when the deadline is not</h2>
          <p>
            Start with a topic. Filter published opinions. Export the record set
            before the coffee cools.
          </p>
          <div className="hero-ctas">
            <button
              type="button"
              className="btn btn-solid"
              onClick={() => onStartResearch("IT laws for cyber crime")}
            >
              Start with cyber crime cases
              <ArrowRight size={16} weight="bold" />
            </button>
            <button
              type="button"
              className="btn btn-line"
              onClick={() => onStartResearch(q || "cyber crime")}
            >
              Open research desk
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
