import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from db import create_tables, seed_goals
from routers import emails, teams, tasks, goals, review, auth

app = FastAPI(title="JARVIS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

create_tables()
seed_goals()

app.include_router(emails.router, prefix="/api/emails", tags=["emails"])
app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(goals.router, prefix="/api/goals", tags=["goals"])
app.include_router(review.router, prefix="/api/review", tags=["review"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])


@app.get("/api/health")
def health():
    return {"status": "ok", "agent": "JARVIS"}
