from datetime import datetime
from typing import Literal
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from constants import MONGODB_URI, MONGODB_DB_NAME
from date_utils import ensure_utc_datetime, serialize_datetime, to_ist_date_key, utc_now

GOALS_COLLECTION_NAME = 'goals'

goal_client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
goal_db = goal_client[MONGODB_DB_NAME]
goals_collection = goal_db[GOALS_COLLECTION_NAME]

GoalStatus = Literal['', 'On Track', 'Off Track', 'On Track with Delay']


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

    today_key = to_ist_date_key(utc_now())
    has_completed_milestone = False
    has_delayed_completion = False

    for milestone in milestones:
        target_date_key = to_ist_date_key(milestone['targetDate'])
        completed = bool(milestone.get('completed'))
        completed_at = milestone.get('completedAt')

        if completed:
            has_completed_milestone = True
            if completed_at is not None and to_ist_date_key(completed_at) > target_date_key:
                has_delayed_completion = True
            continue

        if target_date_key < today_key:
            return 'Off Track'

    if has_delayed_completion:
        return 'On Track with Delay'

    if has_completed_milestone:
        return 'On Track'

    return ''


def normalize_goal_payload(payload: GoalCreate | GoalUpdate) -> dict:
    goal = payload.model_dump()
    goal['title'] = goal['title'].strip()
    goal['assignedTo'] = list(
        dict.fromkeys(assignee.strip() for assignee in goal['assignedTo'] if assignee.strip()),
    )
    if goal.get('createdAt') is not None:
        goal['createdAt'] = ensure_utc_datetime(goal['createdAt'])

    if not goal['title']:
        raise ValueError('Goal title is required')

    if len(goal['assignedTo']) == 0:
        raise ValueError('At least one assigned employee is required')

    normalized_milestones: list[dict] = []
    for milestone in goal['milestones']:
        milestone_id = milestone['id'].strip()
        milestone_title = milestone['title'].strip()
        target_date = ensure_utc_datetime(milestone['targetDate'])
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
        elif completed_at is not None:
            completed_at = ensure_utc_datetime(completed_at)

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
            'targetDate': serialize_datetime(milestone['targetDate']),
            'completed': milestone.get('completed', False),
            'completedAt': serialize_datetime(milestone['completedAt'])
            if milestone.get('completedAt')
            else None,
        }
        for milestone in document.get('milestones', [])
    ]

    return {
        'id': str(document['_id']),
        'title': document['title'],
        'assignedTo': document.get('assignedTo', []),
        'createdAt': serialize_datetime(document['createdAt']),
        'milestones': milestones,
        'goalStatus': evaluate_goal_status(document.get('milestones', [])),
    }


def parse_goal_id(goal_id: str) -> ObjectId | None:
    if not ObjectId.is_valid(goal_id):
        return None
    return ObjectId(goal_id)
