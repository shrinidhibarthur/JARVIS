# # JARVIS — AI-Powered Work Assistant

JARVIS is a personal AI dashboard that connects to your Microsoft 365 account (email, Teams, calendar) and uses a local or cloud LLM to surface tasks, generate email drafts, produce daily briefings, and help you manage your work day.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.10 + | [python.org](https://www.python.org/downloads/) |
| Node.js | 18 + | [nodejs.org](https://nodejs.org/) |
| npm | 9 + | Bundled with Node.js |
| Ollama *(optional, for local AI)* | latest | `brew install ollama` |

---

## 1 — Clone the repo

```bash
git clone https://github.com/shrinidhibarthur/JARVIS.git
cd JARVIS
```

---

## 2 — Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set the following:

```dotenv
# ── Microsoft Graph API ───────────────────────────────────
GRAPH_API_BASE_URL=https://graph.microsoft.com/v1.0

# Paste a fresh Bearer token from Graph Explorer (see step 3 below)
GRAPH_BEARER_TOKEN=your_bearer_token_here

# ── Your Identity ────────────────────────────────────────
JARVIS_USER_EMAIL=your.email@company.com
JARVIS_USER_DISPLAY_NAME=Your Name

# ── LLM Provider ─────────────────────────────────────────
# Options: ollama | azure | anthropic
LLM_PROVIDER=ollama

# Ollama (local, free — default)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=gemma3:12b

# Azure OpenAI (optional)
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-01

# Anthropic Claude (optional)
ANTHROPIC_API_KEY=
```

> `.env` is git-ignored and never committed — keep your token safe.

---

## 3 — Get a Microsoft Graph Bearer Token

JARVIS reads your email, Teams chats, and calendar via the Microsoft Graph API. You need a token with the right permissions.

1. Go to **[Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)**
2. Click **Sign in** (top-left) and log in with your Microsoft 365 / work account
3. Once signed in, click your profile icon (top-right) → **Access token** tab
4. Click **Copy** and paste the full token value into `.env` as `GRAPH_BEARER_TOKEN=`

> **Token lifetime**: Graph Explorer tokens are valid for ~1 hour. If emails stop loading, refresh the token from Graph Explorer and update `.env`.
>
> **Permanent fix**: Use the **Sign in with Microsoft** banner inside JARVIS after startup. This uses MSAL device-code flow and refreshes the token automatically.

---

## 4 — Set up the local LLM (Ollama — recommended)

```bash
# Install Ollama
brew install ollama          # macOS
# or: https://ollama.com/download for Windows/Linux

# Pull the default model (~8 GB download)
ollama pull gemma3:12b

# Verify it runs
ollama run gemma3:12b "Hello"
```

Alternatively set `LLM_PROVIDER=anthropic` or `LLM_PROVIDER=azure` in `.env` and fill in the corresponding API key/endpoint.

---

## 5 — Start JARVIS

```bash
bash start.sh
```

This single command:
- Starts Ollama (if installed and not already running)
- Creates a Python virtual environment in `backend/.venv` and installs dependencies
- Starts the FastAPI backend on **port 8001**
- Installs frontend npm packages if missing
- Starts the Next.js frontend on **port 3002**

Once running:

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3002 |
| API docs (Swagger) | http://localhost:8001/docs |

Press **Ctrl+C** to stop everything.

---

## 6 — Manual setup (optional)

If you prefer to run backend and frontend separately:

**Backend**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                       # runs on port 3000 by default
```

---

## Project structure

```
JARVIS/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── jarvis_agent.py      # Microsoft Graph API wrappers
│   ├── auth_manager.py      # MSAL device-code auth flow
│   ├── db.py                # SQLite database (tasks, goals)
│   └── routers/
│       ├── emails.py        # Email endpoints
│       ├── teams.py         # Teams chat endpoints
│       ├── tasks.py         # Task CRUD
│       ├── goals.py         # Goals CRUD
│       ├── review.py        # AI briefing, drafts, auto-extract
│       └── auth.py          # Auth status & device-flow endpoints
├── frontend/
│   ├── app/                 # Next.js app router pages
│   ├── components/          # React components
│   └── lib/                 # API client, types, theme
├── .env.example             # Environment variable template
├── start.sh                 # One-command startup script
└── README.md
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Emails / Teams return 502 | Bearer token expired — paste a fresh token from Graph Explorer into `.env` |
| `ollama: command not found` | Install Ollama or switch `LLM_PROVIDER` to `anthropic`/`azure` |
| Port already in use | `pkill -f "uvicorn\|next dev"` then re-run `bash start.sh` |
| Frontend blank / not loading | Check that backend is up at http://localhost:8001/api/health |
| `npm install` fails | Ensure Node.js 18+ is installed: `node --version` |

---

## License

MIT