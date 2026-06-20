#!/bin/bash
# JARVIS — Start backend + frontend + Ollama

echo "⬡ Starting JARVIS..."
cd "$(dirname "$0")"

# Ollama (LLM for AI drafts/briefing)
if command -v ollama &>/dev/null; then
  if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
    echo "→ Starting Ollama..."
    ollama serve &>/tmp/ollama-jarvis.log &
    sleep 3
  else
    echo "→ Ollama already running"
  fi
else
  echo "⚠ Ollama not found — AI drafts unavailable (brew install ollama)"
fi

# Backend on port 8001
echo "→ Starting FastAPI backend on :8001"
cd backend
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt
uvicorn main:app --reload --port 8001 &
BACKEND_PID=$!
cd ..
sleep 3

# Frontend on port 3002
echo "→ Starting Next.js frontend on :3002"
cd frontend
if [ ! -d "node_modules" ]; then
  npm install
fi
PORT=3002 npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✓ JARVIS running:"
echo "  Dashboard → http://localhost:3002"
echo "  API docs  → http://localhost:8001/docs"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
