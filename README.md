# CaseFile AI — Autonomous Legal Research Agent

> **LexHack 2026 Submission**  
> Tracks: **⚡ Legal Automation & Workflow Innovation** · **🛡️ AI Safety, Ethics & Governance** · **📜 Digital Rights**

**CaseFile AI** is an autonomous conversational legal research agent and litigation strategy workbench. Rather than acting as a simple search box or generic chat wrapper, CaseFile AI executes an end-to-end **Reasoning + Acting (ReAct)** loop across live federal and state court records from [CourtListener](https://www.courtlistener.com/) (Free Law Project):

1. **Deconstructs Legal Objectives**: Automatically identifies statutory frameworks, relevant circuit jurisdictions, majority standards, and potential counter-arguments.
2. **Autonomous Tool Execution**: Dispatches targeted queries to CourtListener REST API v4, reads and filters opinion full texts, and separates holdings from dicta.
3. **Adversarial Precedent Mapping**: Organizes case law into an affirmative strategy alongside opposing counsel's best counter-precedents and tactical distinguishing arguments.
4. **Anti-Hallucination Citation Verification**: Audits every cited legal authority against authentic CourtListener docket clusters to eliminate fabricated case citations.
5. **Formal IRAC Legal Memorandum**: Synthesizes a structured legal brief (Issue, Rule, Application, Counter-arguments, Conclusion) with one-click Markdown, Printable PDF, and JSON export.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CaseFile AI Studio (Split-Screen UI)                     │
│                                                                             │
│   ┌───────────────────────────────┐     ┌───────────────────────────────┐   │
│   │     LEFT: Conversational      │     │     RIGHT: Dynamic Artifact   │   │
│   │     Research Assistant        │     │     Legal Canvas              │   │
│   │                               │     │                               │   │
│   │  • Session History Drawer     │     │  • Verified Case Cards        │   │
│   │  • Multi-turn chat input      │     │  • Adversarial Matrix         │   │
│   │  • Live ReAct Thought Stream  │◄───►│  • IRAC Legal Memo            │   │
│   │  • Pause / Steer / Resume     │     │  • Inline Guardrail Badges    │   │
│   │  • BYOK Settings Drawer       │     │  • MD / PDF / JSON Export     │   │
│   └───────────────┬───────────────┘     └───────────────┬───────────────┘   │
└───────────────────┼─────────────────────────────────────┼───────────────────┘
                    │                                     │
                    │ SSE Stream (/api/agent/chat)        │
                    ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Express Backend (server/agent.js)                      │
│                                                                             │
│   • ReAct Agent Loop with Gemini 2.0 / Flash (Function Calling / Reasoning) │
│   • Tool: CourtListener Search (filtered by circuit, court, published)      │
│   • Tool: Full Opinion Text Extractor (SSRF-safe, binary sniffing)          │
│   • Tool: Citation Verification Engine (validates against cluster IDs)      │
│   • Tool: Adversarial Matrix Classifier & IRAC Synthesizer                  │
│   • Dual-Key Resolver (req.headers['x-gemini-key'] || env.GOOGLE_GEMINI_KEY)│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (Local Run)

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (Express backend on :8787 + Vite on :8080)
npm run dev
```

- **App**: `http://localhost:8080`
- **Backend API**: `http://localhost:8787`

---

## API Keys & Authentication (Dual Mode)

CaseFile AI supports **Dual-Mode Authentication**:

1. **Server Environment Variable**:
   ```bash
   # Windows PowerShell
   $env:GOOGLE_GEMINI_KEY="your-gemini-key"
   $env:COURTLISTENER_TOKEN="your-cl-token" # optional for full text
   npm run dev
   ```
2. **Bring-Your-Own-Key (BYOK) in the UI**:
   - Hackathon judges and testers can simply click the **Set API Key** button in the top-right of the Agent Studio and paste their personal Gemini API key. It is saved directly in browser `localStorage` and sent via `x-gemini-key`.
   - Free Gemini keys can be generated in seconds at [Google AI Studio](https://aistudio.google.com/apikey).

---

## API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/agent/chat` | `POST` | Primary Server-Sent Events (SSE) streaming endpoint driving the autonomous ReAct agent loop. |
| `/api/search?q=…` | `GET` | Search published CourtListener opinions with snippet extraction. |
| `/api/extract` | `POST` | SSRF-safe batch extraction of full opinion text. |
| `/api/enrich` | `POST` | Multi-field structured LLM extraction. |
| `/api/health` | `GET` | Reports service status, CourtListener token, and Gemini key availability. |

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 7, Vanilla CSS design system, Motion, GSAP, Phosphor Icons.
- **Backend**: Node.js, Express 5, Server-Sent Events (SSE), SSRF guardrail with IP pinning.
- **Data & AI**: CourtListener REST API v4, Google Gemini 2.0 Flash (`gemini-2.0-flash`).
