from datetime import datetime, timezone
from typing import Literal
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from constants import MONGODB_URI, MONGODB_DB_NAME

GOALS_COLLECTION_NAME = 'goals'

goal_client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
goal_db = goal_client[MONGODB_DB_NAME]
goals_collection = goal_db[GOALS_COLLECTION_NAME]

GoalStatus = Literal['', 'On Track', 'Off Track']


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_date_key(value: datetime) -> str:
    if value.tzinfo is None:
        return value.date().isoformat()
    return value.astimezone(timezone.utc).date().isoformat()


class GoalMilestoneBase(BaseModel):
    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    targetDate: datetime
    completed: bool = False
    completedAt: datetime | None = None


class GoalBase(BaseModel):
    title: str = Field(..., min_length=1)
    assignedTo: list[str] = Field(default_factory=list)
    milestones: list[GoalMilestoneBase] = Field(default_factory=list)


class GoalCreate(GoalBase):
    createdAt: datetime = Field(default_factory=utc_now)


class GoalUpdate(GoalBase):
    pass


class GoalResponse(GoalBase):
    id: str
    createdAt: datetime
    goalStatus: GoalStatus


def evaluate_goal_status(milestones: list[dict]) -> GoalStatus:
    if len(milestones) == 0:
        return ''

    today_key = utc_now().date().isoformat()
    has_reached_evaluation_window = False

    for milestone in milestones:
        target_date_key = to_date_key(milestone['targetDate'])
        completed = bool(milestone.get('completed'))
        completed_at = milestone.get('completedAt')

        if target_date_key <= today_key or completed:
            has_reached_evaluation_window = True

        if completed_at is not None and to_date_key(completed_at) > target_date_key:
            return 'Off Track'

        if target_date_key < today_key and not completed:
            return 'Off Track'

    return 'On Track' if has_reached_evaluation_window else ''


def normalize_goal_payload(payload: GoalCreate | GoalUpdate) -> dict:
    goal = payload.model_dump()
    goal['title'] = goal['title'].strip()
    goal['assignedTo'] = list(
        dict.fromkeys(assignee.strip() for assignee in goal['assignedTo'] if assignee.strip()),
    )

    if not goal['title']:
        raise ValueError('Goal title is required')

    if len(goal['assignedTo']) == 0:
        raise ValueError('At least one assigned employee is required')

    normalized_milestones: list[dict] = []
    for milestone in goal['milestones']:
        milestone_id = milestone['id'].strip()
        milestone_title = milestone['title'].strip()
        target_date = milestone['targetDate']
        completed = bool(milestone.get('completed'))
        completed_at = milestone.get('completedAt')

        if not milestone_id:
            raise ValueError('Milestone ID is required')

        if not milestone_title:
            raise ValueError('Milestone title is required')

        if completed and completed_at is None:
            completed_at = utc_now()

        if not completed:
            completed_at = None

        normalized_milestones.append(
            {
                'id': milestone_id,
                'title': milestone_title,
                'targetDate': target_date,
                'completed': completed,
                'completedAt': completed_at,
            },
        )

    if len(normalized_milestones) == 0:
        raise ValueError('At least one milestone is required')

    goal['milestones'] = normalized_milestones
    return goal


def serialize_goal(document: dict) -> dict:
    milestones = [
        {
            'id': milestone['id'],
            'title': milestone['title'],
            'targetDate': milestone['targetDate'].isoformat(),
            'completed': milestone.get('completed', False),
            'completedAt': milestone['completedAt'].isoformat()
            if milestone.get('completedAt')
            else None,
        }
        for milestone in document.get('milestones', [])
    ]

    return {
        'id': str(document['_id']),
        'title': document['title'],
        'assignedTo': document.get('assignedTo', []),
        'createdAt': document['createdAt'].isoformat(),
        'milestones': milestones,
        'goalStatus': evaluate_goal_status(document.get('milestones', [])),
    }


def parse_goal_id(goal_id: str) -> ObjectId | None:
    if not ObjectId.is_valid(goal_id):
        return None
    return ObjectId(goal_id)
