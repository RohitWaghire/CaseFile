import { useState } from "react";
import { Clock, BookmarkSimple } from "@phosphor-icons/react";

interface Milestone {
  year: string;
  era: string;
  title: string;
  court: string;
  holding: string;
  impact: string;
  doctrineStatus: "foundational" | "expansion" | "statutory" | "modern";
}

const TIMELINE_EVENTS: Milestone[] = [
  {
    year: "1974",
    era: "Pre-emption & Common Law",
    title: "Kewanee Oil Co. v. Bicron Corp.",
    court: "U.S. Supreme Court (416 U.S. 470)",
    holding: "State trade secret law is not preempted by federal patent law; reverse engineering is explicitly protected as lawful competition.",
    impact: "Established the cornerstone constitutional rule that trade secret protection does not grant a monopoly against independent discovery or reverse engineering.",
    doctrineStatus: "foundational",
  },
  {
    year: "1982",
    era: "Appellate Consolidation",
    title: "Chicago Lock Co. v. Fanberg",
    court: "U.S. Court of Appeals for the Ninth Circuit (676 F.2d 400)",
    holding: "Purchasers of tubular lock picks who disassembled and published master key codes did not use 'improper means.'",
    impact: "Formulated the 9th Circuit rule that a trade secret owner's rights only extend against those who obtain information through breach of confidence or wrongful acts.",
    doctrineStatus: "expansion",
  },
  {
    year: "2016",
    era: "Federal Codification",
    title: "Defend Trade Secrets Act (DTSA) Enactment",
    court: "U.S. Congress (18 U.S.C. § 1836 et seq.)",
    holding: "Creates a federal civil cause of action for trade secret misappropriation while codifying an express affirmative exception for reverse engineering.",
    impact: "Nationalized trade secret litigation and provided statutory immunity for reverse engineering and whistleblowing.",
    doctrineStatus: "statutory",
  },
  {
    year: "2021",
    era: "Fair Use Interplay",
    title: "Google LLC v. Oracle America, Inc.",
    court: "U.S. Supreme Court (141 S. Ct. 1183)",
    holding: "Re-implementing software interfaces for interoperability constitutes transformative fair use.",
    impact: "Harmonized copyright fair use standards with technical interoperability and reverse engineering principles.",
    doctrineStatus: "modern",
  },
  {
    year: "2026",
    era: "Autonomous & AI Frontier",
    title: "AI Model Weights & Decompilation Standards",
    court: "Federal Appellate Consensus (Emerging)",
    holding: "Analyzing public model inference APIs and weight inspection is protected under statutory reverse engineering absent affirmative contractual bypass.",
    impact: "Defines the boundary between model extraction attacks and lawful technical validation.",
    doctrineStatus: "modern",
  },
];

export function DoctrineTimeline() {
  const [activeIdx, setActiveIdx] = useState(2);
  const activeEvent = TIMELINE_EVENTS[activeIdx];

  return (
    <div className="doctrine-timeline-wrap">
      <div className="timeline-header">
        <div>
          <h4 className="timeline-title">
            <Clock size={16} color="var(--accent)" weight="bold" /> Doctrinal Evolution &amp; Precedent Chronology
          </h4>
          <p className="timeline-lead">
            Tracking the 50-year arc from Common Law preemption to the 2026 Defend Trade Secrets Act framework.
          </p>
        </div>
        <span className="era-badge">
          <BookmarkSimple size={13} weight="fill" /> {TIMELINE_EVENTS.length} Historical Benchmarks
        </span>
      </div>

      {/* Horizontal Interactive Timeline Axis */}
      <div className="timeline-axis-container">
        <div className="timeline-axis-line" />
        <div className="timeline-nodes-row">
          {TIMELINE_EVENTS.map((event, idx) => {
            const isSelected = activeIdx === idx;
            return (
              <button
                key={event.year + event.title}
                type="button"
                className={`timeline-node-btn ${isSelected ? "active" : ""} ${event.doctrineStatus}`}
                onClick={() => setActiveIdx(idx)}
              >
                <span className="node-marker">
                  <span className="node-ring" />
                </span>
                <span className="node-year">{event.year}</span>
                <span className="node-era">{event.era}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Milestone Detail Card */}
      <div className="timeline-milestone-card">
        <div className="milestone-head">
          <div>
            <div className="milestone-year-tag">{activeEvent.year} • {activeEvent.era}</div>
            <h3 className="milestone-title">{activeEvent.title}</h3>
            <div className="milestone-court">{activeEvent.court}</div>
          </div>
          <span className={`status-pill ${activeEvent.doctrineStatus}`}>
            {activeEvent.doctrineStatus.toUpperCase()} PRECEDENT
          </span>
        </div>

        <div className="milestone-body">
          <div className="milestone-block">
            <div className="block-label">Legal Holding &amp; Principle</div>
            <div className="block-text">{activeEvent.holding}</div>
          </div>

          <div className="milestone-block highlight">
            <div className="block-label">Doctrinal Impact on Modern Briefs</div>
            <div className="block-text">{activeEvent.impact}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
