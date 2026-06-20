import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from db import get_db, Goal

router = APIRouter()


class GoalUpdate(BaseModel):
    progress: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


def goal_to_dict(g: Goal) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "description": g.description,
        "success_criteria": json.loads(g.success_criteria) if g.success_criteria else [],
        "start_date": g.start_date,
        "target_date": g.target_date,
        "progress": g.progress or 0.0,
        "status": g.status,
        "notes": g.notes,
        "updated_at": g.updated_at.isoformat() if g.updated_at else None,
    }


@router.get("")
def list_goals(db: Session = Depends(get_db)):
    return [goal_to_dict(g) for g in db.query(Goal).order_by(Goal.id).all()]


@router.patch("/{goal_id}")
def update_goal(goal_id: int, req: GoalUpdate, db: Session = Depends(get_db)):
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(goal, field, value)
    goal.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(goal)
    return goal_to_dict(goal)
