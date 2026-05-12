from datetime import datetime
from typing import Literal
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from constants import MONGODB_URI, MONGODB_DB_NAME
from date_utils import ensure_utc_datetime, serialize_datetime, utc_now

TASKS_COLLECTION_NAME = 'tasks'

task_client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
task_db = task_client[MONGODB_DB_NAME]
tasks_collection = task_db[TASKS_COLLECTION_NAME]

TaskPriority = Literal['Low', 'Medium', 'High']
TaskStatus = Literal['To Do', 'Done']
ASSIGNED_BY_OVERRIDE = 'Sanjit Basu'

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = ''
    assignedTo: list[str] = Field(default_factory=list)
    assignedBy: str = Field(..., min_length=1)
    priority: TaskPriority = 'Medium'
    status: TaskStatus = 'To Do'
    deadline: datetime | None = None
    remarks: str | None = None

class TaskCreate(TaskBase):
    createdAt: datetime = Field(default_factory=utc_now)

class TaskUpdate(TaskBase):
    pass

class TaskResponse(TaskBase):
    id: str
    createdAt: datetime

def normalize_task_payload(payload: TaskCreate | TaskUpdate) -> dict:
    task = payload.model_dump()
    task['title'] = task['title'].strip()
    task['description'] = task['description'].strip()
    task['assignedBy'] = ASSIGNED_BY_OVERRIDE
    task['assignedTo'] = list(
        dict.fromkeys(assignee.strip() for assignee in task['assignedTo'] if assignee.strip()),
    )
    remarks = task.get('remarks')
    task['remarks'] = remarks.strip() if isinstance(remarks, str) and remarks.strip() else None
    if task.get('deadline') is not None:
        task['deadline'] = ensure_utc_datetime(task['deadline'])
    if task.get('createdAt') is not None:
        task['createdAt'] = ensure_utc_datetime(task['createdAt'])
    if not task['title']:
        raise ValueError('Task title is required')
    if not task['assignedBy']:
        raise ValueError('Assigned by is required')
    return task

def serialize_task(document: dict) -> dict:
    serialized = {
        'id': str(document['_id']),
        'title': document['title'],
        'description': document.get('description', ''),
        'assignedTo': document.get('assignedTo', []),
        'assignedBy': document.get('assignedBy', ''),
        'priority': document.get('priority', 'Medium'),
        'status': document.get('status', 'To Do'),
        'deadline': serialize_datetime(document['deadline']) if document.get('deadline') else None,
        'remarks': document.get('remarks'),
        'createdAt': serialize_datetime(document['createdAt']),
    }
    return serialized

def parse_task_id(task_id: str) -> ObjectId | None:
    if not ObjectId.is_valid(task_id):
        return None
    return ObjectId(task_id)
