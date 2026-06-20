import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from db import get_db, Task

router = APIRouter()


class TaskCreate(BaseModel):
    title: str
    status: str = "todo"
    priority: str = "normal"
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    source_link: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None


def task_to_dict(t: Task) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "status": t.status,
        "priority": t.priority,
        "source_type": t.source_type,
        "source_id": t.source_id,
        "source_link": t.source_link,
        "due_date": t.due_date,
        "notes": t.notes,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("")
def list_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Task)
    if status:
        q = q.filter(Task.status == status)
    if priority:
        q = q.filter(Task.priority == priority)
    return [task_to_dict(t) for t in q.order_by(Task.created_at.desc()).all()]


@router.post("")
def create_task(req: TaskCreate, db: Session = Depends(get_db)):
    task = Task(
        id=str(uuid.uuid4()),
        title=req.title,
        status=req.status,
        priority=req.priority,
        source_type=req.source_type,
        source_id=req.source_id,
        source_link=req.source_link,
        due_date=req.due_date,
        notes=req.notes,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task_to_dict(task)


@router.patch("/{task_id}")
def update_task(task_id: str, req: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(task, field, value)
    task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return task_to_dict(task)


@router.delete("/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"status": "deleted"}
