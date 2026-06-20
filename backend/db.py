import json
from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, String, Integer, Float, Text, DateTime
)
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./jarvis.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Task(Base):
    __tablename__ = "tasks"
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    status = Column(String, default="todo")      # todo|in_progress|waiting|blocked|done
    priority = Column(String, default="normal")  # low|normal|high|urgent
    source_type = Column(String)                 # email|teams_chat|teams_channel|manual
    source_id = Column(String)
    source_link = Column(String)
    due_date = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    success_criteria = Column(Text)   # JSON array of strings
    start_date = Column(String)
    target_date = Column(String)
    progress = Column(Float, default=0.0)  # 0–100
    status = Column(String, default="on_track")  # on_track|at_risk|blocked|complete
    notes = Column(Text)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


INITIAL_GOALS = [
    {
        "name": "Drive customer growth through joyful personalized experiences",
        "description": "Drive the hyper-personalization strategy for C&C through personalized substitution recommendations.",
        "success_criteria": json.dumps([
            "Increase substitution acceptance rate by 5% in eligible cart sessions"
        ]),
        "start_date": "Q2'26",
        "target_date": "Q4'26",
    },
    {
        "name": "Modernize cart & checkout to enable seamless purchase journey",
        "description": "Drive a more seamless and intelligent purchase journey across Cart and Checkout through the C&C AI Agent.",
        "success_criteria": json.dumps([
            "Improve checkout conversion rate by ~0.1%",
            "Track AI assistant engagement rate and resolution rate"
        ]),
        "start_date": "Q2'26",
        "target_date": "Q4'26",
    },
    {
        "name": "Accelerate customer-facing and internal AI capabilities",
        "description": "Accelerate AI capabilities through Catalog Quality Engine and AI Generated Review Summary.",
        "success_criteria": json.dumps([
            "Improve catalog data quality score by 5% for targeted categories",
            "Reduce manual product data validation effort by 10%",
            "Detect and flag high-priority catalog defects with at least 85% precision",
            "Reduce time to identify and resolve catalog issues by 25%",
            "Launch Phase 1 MVP by Q2/Q3 FY26",
            "Launch review summary MVP for priority product categories by Q2 FY26",
            "Achieve summary quality acceptance score of 80%+ through business or UX review"
        ]),
        "start_date": "Q2'26",
        "target_date": "Q4'26",
    },
    {
        "name": "Scale enterprise simulation and experimentation capabilities",
        "description": "Build an enterprise-level Simulation Lab to support learning, testing, experimentation, and decision-making.",
        "success_criteria": json.dumps([
            "Launch enterprise Simulation Lab MVP by Q3/Q4 FY26",
            "Reduce experimentation or scenario validation cycle time by 20% to 30%",
            "Enable at least 3 priority use cases across product, operations, or digital workflows"
        ]),
        "start_date": "Q2'26",
        "target_date": "Q4'26",
    },
    {
        "name": "Support cross-functional digital transformation initiatives",
        "description": "Partner with dependent initiative teams to enable digital commerce across In-store Digitization, Custom Cakes, ROKT, and EBT.",
        "success_criteria": json.dumps([
            "Launch cart and checkout enhancement by target ETA",
            "Increase made-to-order cake order completion rate by 2%",
            "Resolve EBT-related Unity banner issue by Q2 FY26",
            "Achieve 100% correct banner rendering for eligible EBT order confirmation scenarios"
        ]),
        "start_date": "Q2'26",
        "target_date": "Q4'26",
    },
    {
        "name": "Improve Cart Confidence through Better OOS Handling",
        "description": "Better OOS handling, partial OOS resolution, substitute and quantity handling.",
        "success_criteria": json.dumps([
            "Improve Cart CVR by 0.04%",
            "Reduce cart abandonment caused by partial OOS scenarios",
            "Improve customer resolution rate for OOS items through clear actions and alternatives",
            "Measure impact through experiment readout and post-launch funnel tracking"
        ]),
        "start_date": "Q2'26",
        "target_date": "Q4'26",
    },
    {
        "name": "Build GenAI agent development skills to optimize PM operational workflows",
        "description": "Develop hands-on capability to design, build, and evaluate GenAI agents for PM operational tasks.",
        "success_criteria": json.dumps([
            "Complete at least 1 structured GenAI / AI agent learning path or certification by FY26"
        ]),
        "start_date": "Q2'26",
        "target_date": "Q4'26",
    },
]


def seed_goals():
    db = SessionLocal()
    try:
        if db.query(Goal).count() == 0:
            for g in INITIAL_GOALS:
                db.add(Goal(**g))
            db.commit()
    finally:
        db.close()
