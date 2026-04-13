<p align="center">
  <img src="https://img.shields.io/badge/Shadow%20Board-AI%20Powered-gold?style=for-the-badge&logo=sparkles" alt="Shadow Board"/>
  <img src="https://img.shields.io/badge/Built%20With-CrewAI-blue?style=for-the-badge" alt="CrewAI"/>
  <img src="https://img.shields.io/badge/LLM-Google%20Gemini-4285F4?style=for-the-badge&logo=google" alt="Gemini"/>
  <img src="https://img.shields.io/badge/Frontend-React%20+%20TypeScript-61DAFB?style=for-the-badge&logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi" alt="FastAPI"/>
</p>

<h1 align="center">Shadow Board</h1>
<h3 align="center">AI-Powered Executive Decision Simulation Platform</h3>

<p align="center">
  <i>Simulate a boardroom of AI executives debating your strategic questions in real-time.</i>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=Eq9tkcItfrM">
    <img src="https://img.shields.io/badge/Full%20Demo-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Full Demo"/>
  </a>
  &nbsp;
  <a href="https://youtu.be/t4cJPGrKRw8">
    <img src="https://img.shields.io/badge/Catalogue%20Demo-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Catalogue Demo"/>
  </a>
</p>

---

## Demos

### Full Application Demo

<p align="center">
  <a href="https://www.youtube.com/watch?v=Eq9tkcItfrM">
    <img src="https://img.youtube.com/vi/Eq9tkcItfrM/maxresdefault.jpg" alt="Shadow Board Full Demo" width="700"/>
  </a>
  <br/>
  <em>Click to watch the full Shadow Board application demo on YouTube</em>
</p>

### AIRIA Catalogue Interface Demo

<p align="center">
  <a href="https://youtu.be/t4cJPGrKRw8">
    <img src="https://img.youtube.com/vi/t4cJPGrKRw8/maxresdefault.jpg" alt="AIRIA Catalogue Interface Demo" width="700"/>
  </a>
  <br/>
  <em>Click to watch the AIRIA Catalogue Interface Demo on YouTube</em>
</p>

---

## What is Shadow Board?

**Shadow Board** is an intelligent boardroom simulation platform that assembles a panel of AI executive agents — each with distinct expertise, perspectives, and debate styles — to rigorously analyze your strategic business questions from every angle.

Instead of relying on a single AI response, Shadow Board orchestrates a **multi-agent debate** across research, argumentation, and synthesis phases, producing a comprehensive **Strategy Brief PDF** with actionable recommendations.

### The Problem It Solves

| Traditional Approach | Shadow Board Approach |
|---|---|
| Single-perspective AI answers | Multi-agent debate from 5 expert viewpoints |
| No structured analysis | 3-phase research + debate + synthesis pipeline |
| Static one-shot responses | Real-time streaming with human intervention |
| No institutional memory | Learns from past decisions via Supermemory |
| Generic advice | Domain-specific boards (Tech, Healthcare, Finance, Retail) |

---

## Key Features

- **Multi-Agent Debate Engine** — 5 AI executives (CFO, CMO, Legal Counsel, Devil's Advocate, Moderator) powered by Google Gemini debate your question through 3 structured rounds
- **Human-In-The-Loop (HITL)** — Pause the debate mid-round to challenge agents, ask follow-ups, or redirect the discussion with text or voice input
- **Real-Time Streaming** — Watch the debate unfold live via Server-Sent Events (SSE) with agent-by-agent responses
- **Domain-Specific Boards** — Choose from Tech, Healthcare, Finance, or Retail presets that customize each agent's expertise
- **Strategy Brief PDF** — Auto-generated executive summary with board votes (GO / NO-GO / CONDITIONAL), risk matrix, and recommendations
- **Institutional Memory** — Past debate outcomes are stored and retrieved via Supermemory, so the board references prior decisions
- **Document Upload** — Feed the board PDF, DOCX, or TXT files for data-driven analysis
- **Voice Input** — Speech-to-text via OpenAI Whisper for hands-free human intervention
- **Session History** — Review, compare, and re-run past boardroom sessions
- **Slack Notifications** — Get notified in Slack when a debate completes with vote results
- **AIRIA Chat Widget** — Embedded AI assistant to explain features and answer questions

---

## System Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '14px', 'fontFamily': 'Inter, system-ui, sans-serif', 'primaryTextColor': '#111827', 'lineColor': '#94a3b8', 'edgeLabelBackground': '#ffffff' }}}%%
graph TB
    subgraph Frontend["Frontend · React + TypeScript + Vite"]
        direction LR
        Auth["Auth Screen"]:::node
        Landing["Landing Page"]:::node
        Debate["Debate View"]:::accent
        History["Session History"]:::node
        Auth --> Landing --> Debate --> History
    end

    subgraph Backend["Backend · FastAPI + Python"]
        direction LR
        AuthRoutes["Auth Routes"]:::node
        SessionMgr["Session Manager"]:::node
        DebateEngine["Debate Engine"]:::accent
        PDFGen["PDF Generator"]:::node
    end

    subgraph Orchestration["Agent Orchestration · CrewAI"]
        Agents["AI Agent Crew"]:::accent
        Memory["Memory Engine"]:::node
    end

    Frontend -->|"HTTP / SSE"| Backend
    DebateEngine --> Agents
    DebateEngine --> Memory

    subgraph External["External Services"]
        Gemini["Google Gemini\n(LLM)"]:::node
        Serper["Serper\n(Web Search)"]:::node
        Supabase["Supabase\n(DB + Auth)"]:::node
        SuperMem["Supermemory\n(Institutional Memory)"]:::node
        Whisper["OpenAI Whisper\n(Speech-to-Text)"]:::node
        Slack["Slack\n(Notifications)"]:::node
    end

    Agents -.->|"LLM Calls"| Gemini
    Agents -.->|"Research"| Serper
    AuthRoutes -.-> Supabase
    SessionMgr -.-> Supabase
    Memory -.-> SuperMem
    PDFGen -.->|"Notify"| Slack
    Frontend -.->|"Voice Input"| Whisper

    classDef node fill:#ffffff,stroke:#e5e7eb,color:#111827,font-weight:bold,stroke-width:1px,rx:6,ry:6
    classDef accent fill:#f8fafc,stroke:#2563eb,color:#111827,font-weight:bold,stroke-width:2px,rx:6,ry:6

    style Frontend fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style Backend fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style Orchestration fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style External fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
```

---

## Agent Architecture — Example

> **Scenario:** *"Should Spotify acquire a podcast analytics company?"*

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '14px', 'fontFamily': 'Inter, system-ui, sans-serif', 'primaryTextColor': '#111827', 'lineColor': '#94a3b8', 'edgeLabelBackground': '#ffffff' }}}%%
flowchart LR
    Q(["Should Spotify acquire\na podcast analytics company?"]):::accent

    Q --> CFO["CFO\n$4.2B cash · $150-400M target\nROI & margin impact"]:::node
    Q --> CMO["CMO\n30% market share · YouTube threat\nAd revenue growth"]:::node
    Q --> LEG["Legal\nAntitrust risk · data privacy\nPast acquisition scrutiny"]:::node

    CFO --> DA["Devil's Advocate\n$1B spent on podcasts already\nROI questioned since 2022"]:::node
    CMO --> DA
    LEG --> DA

    DA --> MOD["Moderator\nSynthesizes all positions\nStrategy Brief PDF"]:::accent

    MOD --> V{"BOARD VOTE"}:::accent
    V -->|"CFO"| GO["GO"]:::goClass
    V -->|"CMO"| COND["CONDITIONAL"]:::condClass
    V -->|"Legal"| NOGO["NO-GO"]:::nogoClass

    classDef node fill:#ffffff,stroke:#e5e7eb,color:#111827,font-weight:bold,stroke-width:1px,rx:6,ry:6
    classDef accent fill:#f8fafc,stroke:#2563eb,color:#111827,font-weight:bold,stroke-width:2px,rx:6,ry:6
    classDef goClass fill:#f8fafc,stroke:#16a34a,color:#16a34a,font-weight:bold,font-size:16px,stroke-width:2px,rx:6,ry:6
    classDef condClass fill:#f8fafc,stroke:#d97706,color:#d97706,font-weight:bold,font-size:16px,stroke-width:2px,rx:6,ry:6
    classDef nogoClass fill:#f8fafc,stroke:#dc2626,color:#dc2626,font-weight:bold,font-size:16px,stroke-width:2px,rx:6,ry:6
```

---

## Debate Flow & Phases

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '14px', 'fontFamily': 'Inter, system-ui, sans-serif', 'primaryTextColor': '#111827', 'lineColor': '#94a3b8', 'edgeLabelBackground': '#ffffff' }}}%%
flowchart TD
    Start(["User Submits Question"]):::accent
    Start --> Upload["Upload Documents\n(PDF / DOCX / TXT)"]:::node
    Upload --> Board["Select Board Type\n(Tech / Healthcare / Finance / Retail)"]:::node

    Board --> P1

    subgraph P1["PHASE 1 · RESEARCH"]
        direction LR
        R1["CFO Research\n(Web Search)"]:::node
        R2["CMO Research\n(Web Search)"]:::node
        R3["Legal Research\n(Web Search)"]:::node
    end

    P1 --> P2R1

    subgraph P2R1["PHASE 2 · ROUND 1 · OPENING STATEMENTS"]
        direction LR
        S1["CFO\nPosition"]:::node
        S2["CMO\nPosition"]:::node
        S3["Legal\nPosition"]:::node
        S4["Devil's Advocate\nChallenges"]:::node
    end

    P2R1 --> HITL

    subgraph HITL["HUMAN-IN-THE-LOOP PAUSE"]
        direction TB
        H1["Challenge a specific agent"]:::accent
        H2["Ask follow-up questions"]:::accent
        H3["Provide additional context"]:::accent
        H4["Voice input via Whisper"]:::accent
        H5["Skip to continue"]:::accent
    end

    HITL --> P2R2

    subgraph P2R2["PHASE 2 · ROUND 2 · REBUTTALS"]
        direction LR
        RB1["CFO\nRebuttal"]:::node
        RB2["CMO\nRebuttal"]:::node
        RB3["Legal\nRebuttal"]:::node
        RB4["Devil's Advocate\nRebuttal"]:::node
    end

    P2R2 --> P2R3

    subgraph P2R3["PHASE 2 · ROUND 3 · FINAL POSITIONS"]
        direction LR
        F1["CFO\nFinal Vote"]:::node
        F2["CMO\nFinal Vote"]:::node
        F3["Legal\nFinal Vote"]:::node
        F4["Devil's Advocate\nFinal Position"]:::node
    end

    P2R3 --> P3

    subgraph P3["PHASE 3 · MODERATOR SYNTHESIS"]
        Mod["Reviews all 3 rounds\nWeighs positions & evidence\nGenerates executive recommendation"]:::accent
    end

    P3 --> Output

    subgraph Output["OUTPUTS"]
        direction LR
        PDF["PDF Strategy\nBrief"]:::node
        DB["Supabase\nSession Saved"]:::node
        SL["Slack\nNotification"]:::node
        MEM["Supermemory\nStored"]:::node
    end

    classDef node fill:#ffffff,stroke:#e5e7eb,color:#111827,font-weight:bold,stroke-width:1px,rx:6,ry:6
    classDef accent fill:#f8fafc,stroke:#2563eb,color:#111827,font-weight:bold,stroke-width:2px,rx:6,ry:6

    style P1 fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style P2R1 fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style HITL fill:transparent,stroke:#2563eb,color:#111827,font-weight:bold,stroke-width:1.5px,stroke-dasharray: 5 5
    style P2R2 fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style P2R3 fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style P3 fill:transparent,stroke:#2563eb,color:#111827,font-weight:bold,stroke-width:1.5px,stroke-dasharray: 5 5
    style Output fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
```

---

## Data Flow Diagram

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '18px', 'fontFamily': 'Inter, system-ui, sans-serif', 'primaryTextColor': '#111827', 'lineColor': '#94a3b8', 'edgeLabelBackground': '#ffffff' }}}%%
flowchart TD
    subgraph UserLayer["USER"]
        User(["USER BROWSER"]):::accent
    end

    subgraph APILayer["API GATEWAY"]
        direction LR
        AuthAPI["AUTH\nAPI"]:::node
        SessionAPI["SESSION\nAPI"]:::node
        UploadAPI["UPLOAD\nAPI"]:::node
        SpeechAPI["SPEECH-TO-TEXT\nAPI"]:::node
    end

    subgraph Processing["REQUEST PROCESSING"]
        direction LR
        Store["SESSION\nSTORE"]:::node
        Valid{"INPUT VALIDATION\n& INJECTION CHECK"}:::accent
        Denied["REJECTED"]:::rejectNode
    end

    subgraph Memory["MEMORY RETRIEVAL"]
        direction LR
        MemCheck["RETRIEVE PAST\nDECISIONS"]:::node
        SMem[("SUPERMEMORY")]:::node
    end

    subgraph Execution["AGENT EXECUTION"]
        Stream["SSE STREAM\nENDPOINT"]:::node
        Crew["CREWAI AGENT\nEXECUTION"]:::accent
    end

    subgraph ExternalAI["EXTERNAL AI SERVICES"]
        direction LR
        Gem["GOOGLE GEMINI\n2.5 FLASH"]:::node
        Srp["SERPER\nSEARCH"]:::node
        OAI["OPENAI\nWHISPER"]:::node
    end

    subgraph Frontend["LIVE FRONTEND"]
        direction LR
        FE["LIVE DEBATE UI"]:::accent
        HInput["HUMAN-IN-THE-LOOP\nINPUT"]:::node
    end

    subgraph PostDebate["POST-DEBATE PIPELINE"]
        direction LR
        Post["POST-DEBATE\nPIPELINE"]:::node
        Votes["PARSE VOTES\nGO / NO-GO / CONDITIONAL"]:::node
        GenPDF["GENERATE PDF\nSTRATEGY BRIEF"]:::node
    end

    subgraph Persistence["DATA PERSISTENCE"]
        direction LR
        SupaDB[("SUPABASE\nPOSTGRESQL")]:::node
        SlkHook["SLACK\nWEBHOOK"]:::node
    end

    %% User to API
    User -->|"Login / Signup"| AuthAPI
    User -->|"Submit Question"| SessionAPI
    User -->|"Upload Documents"| UploadAPI
    User -->|"Voice Input"| SpeechAPI

    %% API to Processing
    AuthAPI -.-> SupaDB
    SessionAPI --> Store
    UploadAPI --> Store
    Store --> Valid
    Valid -->|"PASS"| MemCheck
    Valid -->|"FAIL"| Denied

    %% Memory
    MemCheck <-.->|"Query / Results"| SMem

    %% Execution
    MemCheck --> Stream
    Stream --> Crew
    Crew <-.->|"LLM Calls"| Gem
    Crew <-.->|"Web Search"| Srp
    SpeechAPI -.->|"Audio"| OAI

    %% Frontend
    Crew -->|"Real-time Messages"| FE
    OAI -.->|"Transcription"| FE
    FE -->|"Human Feedback"| HInput
    HInput -->|"Re-inject"| Store

    %% Post-debate
    Crew --> Post
    Post --> Votes
    Post --> GenPDF

    %% Persistence
    Post -.->|"Save Session"| SupaDB
    Post -.->|"Save Memory"| SMem
    Post -.->|"Notify"| SlkHook

    classDef node fill:#ffffff,stroke:#e5e7eb,color:#111827,font-weight:bold,stroke-width:1px,rx:6,ry:6
    classDef accent fill:#f8fafc,stroke:#2563eb,color:#111827,font-weight:bold,stroke-width:2px,rx:6,ry:6
    classDef rejectNode fill:#ffffff,stroke:#dc2626,color:#dc2626,font-weight:bold,stroke-width:2px,rx:6,ry:6

    style UserLayer fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style APILayer fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style Processing fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style Memory fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style Execution fill:transparent,stroke:#2563eb,color:#111827,font-weight:bold,stroke-width:1.5px,stroke-dasharray: 5 5
    style ExternalAI fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style Frontend fill:transparent,stroke:#2563eb,color:#111827,font-weight:bold,stroke-width:1.5px,stroke-dasharray: 5 5
    style PostDebate fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
    style Persistence fill:transparent,stroke:#d4d4d8,color:#111827,font-weight:bold,stroke-width:1px,stroke-dasharray: 5 5
```

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Component library (45+ components) |
| **Framer Motion** | Animations & transitions |
| **React Router** | Client-side routing |
| **TanStack Query** | Server state management |
| **React Hook Form + Zod** | Form validation |
| **React Markdown** | Render agent responses |
| **Recharts** | Data visualization |
| **Lucide Icons** | Icon system |

### Backend

| Technology | Purpose |
|---|---|
| **FastAPI** | High-performance async API framework |
| **CrewAI** | Multi-agent orchestration framework |
| **Google Gemini 2.5 Flash** | LLM powering all agents |
| **SerperDev** | Real-time web search for research phase |
| **Supabase** | PostgreSQL database + authentication |
| **Supermemory** | Institutional memory for past decisions |
| **OpenAI Whisper** | Speech-to-text for voice input |
| **fpdf2** | PDF strategy brief generation |
| **PyMuPDF + python-docx** | Document parsing (PDF, DOCX) |
| **Uvicorn** | ASGI server |

### Infrastructure

| Technology | Purpose |
|---|---|
| **Render** | Cloud deployment |
| **Supabase** | Managed PostgreSQL + Auth |
| **Slack Webhooks** | Completion notifications |
| **AIRIA Platform** | Optional chat widget integration |

---

## Project Structure

```
airia-ai/
├── frontend/                      # React + TypeScript frontend
│   ├── src/
│   │   ├── pages/
│   │   │   └── Index.tsx          # Main app (auth, landing, debate UI)
│   │   ├── components/
│   │   │   ├── MessageCard.tsx    # Agent message renderer
│   │   │   ├── HumanInputPanel.tsx# HITL input interface
│   │   │   ├── PhaseIndicator.tsx # 6-phase progress bar
│   │   │   ├── TypingIndicator.tsx# Loading animation
│   │   │   ├── AiriaChatWidget.tsx# Embedded AI chat assistant
│   │   │   └── ui/               # 45+ shadcn/ui components
│   │   ├── hooks/
│   │   │   └── useSpeechRecognition.ts  # Whisper voice input
│   │   └── lib/                   # Utilities
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
├── server.py                      # FastAPI main server
├── agents_creation.py             # CrewAI agent definitions & tasks
├── database.py                    # Supabase auth & session storage
├── memory.py                      # Supermemory integration
├── pdf_generator.py               # Strategy brief PDF generation
├── slack_notify.py                # Slack webhook notifications
├── airia_client.py                # AIRIA platform integration
├── requirements.txt               # Python dependencies
├── render.yaml                    # Render deployment config
└── reports/                       # Generated PDF strategy briefs
```

---

## Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **npm** or **yarn**

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/airia-ai.git
cd airia-ai
```

### 2. Backend Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Environment Variables

Create a `.env` file in the root directory:

```env
# Required - Core APIs
GEMINI_API_KEY=your_google_gemini_api_key
SERPER_API_KEY=your_serper_api_key

# Required - Database & Auth
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Required - Institutional Memory
SUPERMEMORY_API_KEY=your_supermemory_api_key

# Optional - Voice Input
OPENAI_API_KEY=your_openai_api_key

# Optional - Notifications
SLACK_WEBHOOK_URL=your_slack_webhook_url

# Optional - AIRIA Chat Widget
AIRIA_PIPELINE_ID=your_pipeline_id
AIRIA_WIDGET_API_KEY=your_widget_api_key
AIRIA_API_KEY=your_airia_api_key
```

### 5. Run the Application

**Start the backend:**

```bash
uvicorn server:app --reload --port 8000
```

**Start the frontend (in a new terminal):**

```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:8080` (frontend) and `http://localhost:8000` (API).

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register a new user |
| `POST` | `/api/auth/login` | Authenticate user |
| `POST` | `/api/session/create` | Create a new debate session |
| `POST` | `/api/{session_id}/upload` | Upload document (PDF/DOCX/TXT) |
| `GET` | `/api/{session_id}/agents_research` | Start debate (SSE stream) |
| `POST` | `/api/{session_id}/human_input` | Submit HITL feedback |
| `GET` | `/api/{session_id}/download_pdf` | Download strategy brief PDF |
| `GET` | `/api/sessions/history/{user_id}` | Get user's session history |
| `POST` | `/api/speech-to-text` | Transcribe audio via Whisper |
| `POST` | `/api/chat` | AIRIA chat widget proxy |

---

## How It Works

1. **Authenticate** — Sign up or log in via Supabase
2. **Ask a Question** — Enter a strategic business question (e.g., *"Should we expand into the European market?"*)
3. **Select Board Type** — Choose from Tech, Healthcare, Finance, or Retail to customize agent expertise
4. **Upload Context** *(optional)* — Attach relevant documents for data-driven analysis
5. **Watch the Debate** — AI agents research, take positions, and debate in real-time
6. **Intervene** — During the HITL pause, challenge agents or provide additional context
7. **Receive Strategy Brief** — Download a PDF with executive summary, board votes, and recommendations

---

## Deployment

The project is configured for deployment on **Render** via `render.yaml`:

```bash
# Deploy to Render
# Push to your GitHub repo, connect to Render, and it auto-deploys

# Manual deployment
uvicorn server:app --host 0.0.0.0 --port $PORT
```

---

## Security

- **Input Validation** — Question length limits and prompt injection detection
- **Authentication** — Supabase Auth with email/password
- **API Key Protection** — All sensitive keys stored as environment variables
- **CORS** — Configurable cross-origin resource sharing
- **Session Isolation** — Each debate session is scoped to authenticated users

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is proprietary. All rights reserved.

---

<p align="center">
  <b>Built with CrewAI + Google Gemini + React</b>
  <br/>
  <sub>Powered by AIRIA</sub>
</p>
