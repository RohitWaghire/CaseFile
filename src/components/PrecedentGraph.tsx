import { useState, useRef, useMemo } from "react";
import { ShieldWarning, CheckCircle, ArrowsOut, Sparkle, Eye } from "@phosphor-icons/react";
import type { FavorableCase as FavorablePrecedent, AdverseCase as AdversePrecedent, VerifiedCitation as CitationAudit } from "../lib/api";

interface Node {
  id: string;
  title: string;
  citation: string;
  type: "favorable" | "adverse" | "root";
  year: number;
  court: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  holding: string;
  importance: number; // 1 to 3 (radius multiplier)
}

interface Edge {
  source: string;
  target: string;
  label: "cites" | "distinguishes" | "limits" | "establishes";
}

interface PrecedentGraphProps {
  favorable: FavorablePrecedent[];
  adverse: AdversePrecedent[];
  citations?: CitationAudit[];
  onSelectCase?: (title: string) => void;
}

export function PrecedentGraph({
  favorable,
  adverse,
  citations = [],
  onSelectCase,
}: PrecedentGraphProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState<"all" | "favorable" | "adverse">("all");
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Synthesize nodes & edges from current session precedents via useMemo
  const { nodes, edges } = useMemo(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Central anchor node (e.g. governing statute or query root)
    newNodes.push({
      id: "root-issue",
      title: "Controlling Doctrine Anchor",
      citation: "18 U.S.C. § 1836 / U.S. Const.",
      type: "root",
      year: 2016,
      court: "Federal Statutory Root",
      x: 380,
      y: 220,
      holding: "Statutory & constitutional foundation governing trade secret & privacy analysis",
      importance: 3,
    });

    // Spread favorable nodes on left/top-right
    favorable.forEach((fav, i) => {
      const angle = (i / Math.max(1, favorable.length)) * Math.PI - Math.PI / 2;
      const radius = 170 + (i % 2) * 35;
      const nodeId = `fav-${fav.id || i}`;
      newNodes.push({
        id: nodeId,
        title: fav.title,
        citation: fav.citation,
        type: "favorable",
        year: 2018 + (i * 2),
        court: fav.citation.includes("9th") ? "9th Cir." : "Federal Appellate",
        x: 380 + Math.cos(angle) * radius,
        y: 220 + Math.sin(angle) * radius,
        holding: fav.holding,
        importance: 2,
      });

      newEdges.push({
        source: nodeId,
        target: "root-issue",
        label: i % 2 === 0 ? "establishes" : "cites",
      });
    });

    // Spread adverse nodes on right/bottom
    adverse.forEach((adv, i) => {
      const angle = (i / Math.max(1, adverse.length)) * Math.PI + Math.PI / 2;
      const radius = 180 + (i % 2) * 40;
      const nodeId = `adv-${adv.id || i}`;
      newNodes.push({
        id: nodeId,
        title: adv.title,
        citation: adv.citation,
        type: "adverse",
        year: 2020 + i,
        court: "Circuit Precedent",
        x: 380 + Math.cos(angle) * radius,
        y: 220 + Math.sin(angle) * radius,
        holding: adv.opposingArgument,
        importance: 2,
      });

      newEdges.push({
        source: nodeId,
        target: "root-issue",
        label: "limits",
      });

      // Connect to first favorable node as distinguishing authority
      if (newNodes.length > 1) {
        newEdges.push({
          source: nodeId,
          target: newNodes[1].id,
          label: "distinguishes",
        });
      }
    });

    return { nodes: newNodes, edges: newEdges };
  }, [favorable, adverse]);

  const isVerifiedAuthority = useMemo(() => {
    if (!selectedNode || selectedNode.type === "root") return false;
    return citations.some(
      (c) =>
        c.status === "verified" &&
        (c.caseTitle?.toLowerCase().includes(selectedNode.title.toLowerCase()) ||
          selectedNode.title.toLowerCase().includes(c.caseTitle?.toLowerCase()))
    );
  }, [selectedNode, citations]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === "svg") {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  const filteredNodes = nodes.filter((n) => {
    if (filter === "favorable") return n.type === "favorable" || n.type === "root";
    if (filter === "adverse") return n.type === "adverse" || n.type === "root";
    return true;
  });

  return (
    <div className="precedent-graph-container">
      {/* Top Toolbar */}
      <div className="graph-toolbar">
        <div className="graph-title-block">
          <h4 className="graph-heading">
            <Sparkle size={15} weight="fill" color="var(--accent)" /> Citation Network & Precedent Topology
          </h4>
          <span className="graph-subtitle">
            Visualizing doctrinal links, adverse tensions, and controlling authorities
          </span>
        </div>

        <div className="graph-controls">
          <div className="segmented-control seg-sm">
            <button
              type="button"
              className={`seg-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All ({nodes.length})
            </button>
            <button
              type="button"
              className={`seg-btn ${filter === "favorable" ? "active" : ""}`}
              onClick={() => setFilter("favorable")}
            >
              <CheckCircle size={12} weight="bold" color="var(--accent)" /> Favorable
            </button>
            <button
              type="button"
              className={`seg-btn ${filter === "adverse" ? "active" : ""}`}
              onClick={() => setFilter("adverse")}
            >
              <ShieldWarning size={12} weight="bold" color="var(--warn)" /> Adverse
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={resetView}
            title="Reset Pan & Zoom"
          >
            <ArrowsOut size={13} /> Reset View
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        className="graph-canvas-wrap"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <svg
          ref={svgRef}
          className="graph-svg"
          viewBox="0 0 760 440"
          style={{
            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          <defs>
            {/* Arrowhead markers */}
            <marker
              id="arrow-cites"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6aab8a" />
            </marker>
            <marker
              id="arrow-distinguishes"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#c4a35a" />
            </marker>
            {/* Grid Pattern */}
            <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(255, 255, 255, 0.03)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* Background Grid */}
          <rect width="100%" height="100%" fill="url(#graph-grid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {edges.map((edge, idx) => {
              const sourceNode = filteredNodes.find((n) => n.id === edge.source);
              const targetNode = filteredNodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const isAdverseEdge = edge.label === "distinguishes" || edge.label === "limits";
              const strokeColor = isAdverseEdge ? "rgba(196, 163, 90, 0.45)" : "rgba(106, 171, 138, 0.45)";
              const markerEnd = isAdverseEdge ? "url(#arrow-distinguishes)" : "url(#arrow-cites)";

              return (
                <g key={`edge-${idx}`}>
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={strokeColor}
                    strokeWidth={isAdverseEdge ? 1.5 : 1.2}
                    strokeDasharray={edge.label === "distinguishes" ? "4 3" : undefined}
                    markerEnd={markerEnd}
                  />
                  {/* Midpoint Label */}
                  <text
                    x={(sourceNode.x + targetNode.x) / 2}
                    y={(sourceNode.y + targetNode.y) / 2 - 4}
                    fill="var(--text-mute)"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isFavorable = node.type === "favorable";
              const isAdverse = node.type === "adverse";
              const isRoot = node.type === "root";

              let fillColor = "#161b22";
              let strokeColor = "#3d4654";
              let glowColor = "transparent";
              let radius = 18;

              if (isRoot) {
                fillColor = "#1a251e";
                strokeColor = "var(--accent)";
                glowColor = "rgba(106, 171, 138, 0.35)";
                radius = 24;
              } else if (isFavorable) {
                fillColor = "#10231b";
                strokeColor = "#6aab8a";
                glowColor = "rgba(106, 171, 138, 0.25)";
                radius = 20;
              } else if (isAdverse) {
                fillColor = "#261e14";
                strokeColor = "#c4a35a";
                glowColor = "rgba(196, 163, 90, 0.25)";
                radius = 20;
              }

              if (isSelected) {
                strokeColor = "#ffffff";
                glowColor = "rgba(255, 255, 255, 0.4)";
                radius += 3;
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="graph-node-group"
                  onClick={() => {
                    setSelectedNode(node);
                    if (onSelectCase && !isRoot) onSelectCase(node.title);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {/* Subtle outer aura */}
                  <circle
                    r={radius + 6}
                    fill={glowColor}
                    className="node-aura"
                  />
                  {/* Core Node circle */}
                  <circle
                    r={radius}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 2.5 : 1.8}
                  />
                  {/* Inner glyph or symbol */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isRoot ? "var(--accent)" : isFavorable ? "#72ba97" : isAdverse ? "#dbc07a" : "#fff"}
                    fontSize={isRoot ? 13 : 11}
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                  >
                    {isRoot ? "§" : isFavorable ? "F" : isAdverse ? "A" : "•"}
                  </text>
                  {/* Node Label underneath */}
                  <text
                    y={radius + 14}
                    textAnchor="middle"
                    fill={isSelected ? "#ffffff" : "var(--text)"}
                    fontSize="10"
                    fontWeight={isSelected ? "600" : "500"}
                    className="graph-node-label"
                  >
                    {node.title.length > 22 ? `${node.title.slice(0, 20)}…` : node.title}
                  </text>
                  <text
                    y={radius + 25}
                    textAnchor="middle"
                    fill="var(--text-mute)"
                    fontSize="8.5"
                    fontFamily="var(--font-mono)"
                  >
                    {node.citation}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Node Details Card */}
        {selectedNode && (
          <div className="graph-node-card">
            <div className="node-card-head">
              <span
                className={`node-card-badge ${selectedNode.type}`}
              >
                {selectedNode.type === "root"
                  ? "Doctrine Foundation"
                  : selectedNode.type === "favorable"
                  ? "Favorable Precedent"
                  : "Adverse Authority"}
              </span>
              {isVerifiedAuthority && (
                <span className="node-card-badge favorable" title="Verified against CourtListener cluster docket">
                  <CheckCircle size={12} weight="fill" /> Verified
                </span>
              )}
              <button
                type="button"
                className="btn-icon"
                onClick={() => setSelectedNode(null)}
              >
                ✕
              </button>
            </div>
            <h5 className="node-card-title">{selectedNode.title}</h5>
            <div className="node-card-citation">{selectedNode.citation}</div>
            <p className="node-card-holding">{selectedNode.holding}</p>
            <div className="node-card-actions">
              <span className="node-card-meta">Court: {selectedNode.court}</span>
              {onSelectCase && selectedNode.type !== "root" && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onSelectCase(selectedNode.title)}
                >
                  <Eye size={12} /> Inspect Full Record
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="graph-legend">
        <div className="legend-item">
          <span className="legend-dot root" />
          <span>Statutory Root (§ 1836 / Rule of Law)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot favorable" />
          <span>Controlling Precedent (Favorable)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot adverse" />
          <span>Adverse Authority (Opposing Counsel)</span>
        </div>
        <div className="legend-item">
          <span className="legend-line dashed" />
          <span>Distinguishing Doctrine</span>
        </div>
      </div>
    </div>
  );
}
