import { useState } from "react";
import { Scales, Sparkle } from "@phosphor-icons/react";

export interface CircuitData {
  circuit: string;
  name: string;
  status: "favorable" | "adverse" | "moderate" | "unsettled";
  summary: string;
  leadCase: string;
  citation: string;
  standard: string;
  strategicNote: string;
}

const CIRCUIT_DATA: Record<string, CircuitData> = {
  ca9: {
    circuit: "9th Cir.",
    name: "U.S. Court of Appeals for the Ninth Circuit",
    status: "favorable",
    summary: "Recognizes robust reverse engineering affirmative defenses; requires explicit proof of improper acquisition independent of public product availability.",
    leadCase: "Chicago Lock Co. v. Fanberg / Imax Corp.",
    citation: "676 F.2d 400 (9th Cir. 1982)",
    standard: "Permissive to reverse engineering; strict plaintiff burden on secrecy safeguards",
    strategicNote: "Optimal forum for defense. Emphasize lawful product purchase and public disassembly.",
  },
  ca2: {
    circuit: "2nd Cir.",
    name: "U.S. Court of Appeals for the Second Circuit",
    status: "moderate",
    summary: "Enforces strict NDA covenants; reverse engineering defense is barred if defendant signed a restrictive end-user or evaluation agreement.",
    leadCase: "Softel, Inc. v. Dragon Med. & Sci. Commc'ns",
    citation: "118 F.3d 955 (2d Cir. 1997)",
    standard: "Contractual preclusion overrides statutory reverse engineering privilege",
    strategicNote: "Check for clickwrap or terms of service prohibiting decompilation.",
  },
  ca5: {
    circuit: "5th Cir.",
    name: "U.S. Court of Appeals for the Fifth Circuit",
    status: "adverse",
    summary: "Rigid standard on confidential disclosures; shifts burden to defendant once access and substantial similarity in trade secrets are demonstrated.",
    leadCase: "SPEECA v. Miller Tech Logistics",
    citation: "891 F.3d 520 (5th Cir. 2018)",
    standard: "Substantial similarity creates presumption of improper means",
    strategicNote: "Must proactively prove independent development through clean-room logs.",
  },
  ca7: {
    circuit: "7th Cir.",
    name: "U.S. Court of Appeals for the Seventh Circuit",
    status: "favorable",
    summary: "Strong law-and-economics approach; encourages competitive reverse engineering as market discipline unless physical trespassing occurred.",
    leadCase: "Rockwell Graphic Sys. v. DEV Indus.",
    citation: "925 F.2d 174 (7th Cir. 1991)",
    standard: "Economic reasonableness governs; public dissection is lawful per se",
    strategicNote: "Argue that prohibiting reverse engineering creates unlawful patent-like monopolies.",
  },
  ca3: {
    circuit: "3rd Cir.",
    name: "U.S. Court of Appeals for the Third Circuit",
    status: "moderate",
    summary: "Scrutinizes 'improper means' under Restatement (Third) of Unfair Competition § 43; reverse engineering must be conducted without deceptive pretenses.",
    leadCase: "SI Handling Sys. v. Heisley",
    citation: "753 F.2d 1244 (3d Cir. 1985)",
    standard: "Deception in obtaining commercial samples vitiates the defense",
    strategicNote: "Verify that procurement of the unit was conducted via normal consumer channels.",
  },
  cadc: {
    circuit: "D.C. Cir.",
    name: "U.S. Court of Appeals for the D.C. Circuit",
    status: "unsettled",
    summary: "Sparse private commercial trade secret docket; predominantly handles FOIA Exemption 4 trade secret disputes against federal agencies.",
    leadCase: "Critical Mass Energy Project v. NRC",
    citation: "975 F.2d 871 (D.C. Cir. 1992)",
    standard: "Governmental confidentiality test; commercial disputes defer to regional circuits",
    strategicNote: "Consider moving for venue transfer if commercial DTSA claims are filed here.",
  },
  cafc: {
    circuit: "Fed. Cir.",
    name: "U.S. Court of Appeals for the Federal Circuit",
    status: "moderate",
    summary: "Applies regional circuit law for DTSA substantive claims, but enforces strict preemption against patent-cloaked state trade secrets.",
    leadCase: "GFI, Inc. v. Franklin Corp.",
    citation: "265 F.3d 1268 (Fed. Cir. 2001)",
    standard: "Regional circuit precedent applies; patent claims govern jurisdictional nexus",
    strategicNote: "Watch for patent exhaustion interplay if mixed claims are alleged.",
  },
};

export function CircuitSplitVisualizer() {
  const [selectedCircuit, setSelectedCircuit] = useState<string>("ca9");
  const circuit = CIRCUIT_DATA[selectedCircuit] || CIRCUIT_DATA.ca9;

  return (
    <div className="circuit-split-container">
      {/* Header */}
      <div className="circuit-head-bar">
        <div>
          <h4 className="circuit-title">
            <Scales size={16} color="var(--accent)" weight="bold" /> Multi-Jurisdiction Circuit Split Matrix
          </h4>
          <p className="circuit-lead">
            Compare legal tests, circuit variance, and forum advantages across U.S. Federal Courts of Appeals.
          </p>
        </div>
        <div className="cert-split-badge">
          <Sparkle size={13} weight="fill" />
          <span>Certiorari Split Index: <strong>High Divergence (9th vs 5th)</strong></span>
        </div>
      </div>

      {/* Grid of Circuits */}
      <div className="circuits-selector-grid">
        {Object.entries(CIRCUIT_DATA).map(([key, item]) => {
          const isSelected = selectedCircuit === key;
          return (
            <button
              key={key}
              type="button"
              className={`circuit-tile ${item.status} ${isSelected ? "active" : ""}`}
              onClick={() => setSelectedCircuit(key)}
            >
              <div className="tile-top">
                <span className="tile-code">{item.circuit}</span>
                <span className={`status-pill ${item.status}`}>
                  {item.status === "favorable"
                    ? "Favorable"
                    : item.status === "adverse"
                    ? "Adverse"
                    : item.status === "moderate"
                    ? "Split/Moderate"
                    : "Unsettled"}
                </span>
              </div>
              <div className="tile-case">{item.leadCase}</div>
            </button>
          );
        })}
      </div>

      {/* Detailed Circuit Analysis Panel */}
      <div className="circuit-analysis-card">
        <div className="analysis-head">
          <div>
            <span className="analysis-crumb">{circuit.name}</span>
            <h3 className="analysis-title">{circuit.circuit} Controlling Doctrine &amp; Precedent</h3>
          </div>
          <span className={`guardrail-badge ${circuit.status === "favorable" ? "verified" : circuit.status === "adverse" ? "flagged" : "partial"}`}>
            {circuit.status === "favorable"
              ? "🟢 Defense-Favorable Standard"
              : circuit.status === "adverse"
              ? "🔴 Plaintiff-Favored Standard"
              : "🟡 Strict Scrutiny / Balancing Test"}
          </span>
        </div>

        <div className="analysis-grid">
          <div className="analysis-box">
            <div className="box-label">Controlling Appellate Standard</div>
            <div className="box-value">{circuit.standard}</div>
          </div>

          <div className="analysis-box">
            <div className="box-label">Leading Circuit Precedent</div>
            <div className="box-value case-ref">
              <strong>{circuit.leadCase}</strong>
              <span className="cite-sub">{circuit.citation}</span>
            </div>
          </div>

          <div className="analysis-box full-width">
            <div className="box-label">Doctrinal Summary</div>
            <div className="box-prose">{circuit.summary}</div>
          </div>

          <div className="analysis-box full-width highlight-strategy">
            <div className="box-label">Litigation Strategy &amp; Forum Guidance</div>
            <div className="box-prose strategy-text">{circuit.strategicNote}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
