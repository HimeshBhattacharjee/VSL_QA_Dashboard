from calendar import monthrange
from datetime import date, datetime, timedelta
from typing import Literal
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from constants import MONGODB_DB_NAME, MONGODB_URI
from date_utils import IST_TIMEZONE, ensure_utc_datetime, serialize_datetime, to_ist_date_key, utc_now

GOALS_COLLECTION_NAME = 'goals'
GOAL_PLANNING_WINDOW_DAYS = 10
GOAL_DECISION_WINDOW_DAYS = 10
MILESTONE_COMPLETION_GRACE_DAYS = 10

goal_client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
goal_db = goal_client[MONGODB_DB_NAME]
goals_collection = goal_db[GOALS_COLLECTION_NAME]

GoalStatus = Literal[
    '',
    'On Track',
    'Off Track',
    'On Track with Delay',
    'Done',
    'Not Done',
    'Dropped',
]
GoalDecisionType = Literal['Carry Forwarded', 'Carry Forward Undone', 'Dropped', 'Revived']

FY_QUARTER_MONTHS = {
    1: (4, 6),
    2: (7, 9),
    3: (10, 12),
    4: (1, 3),
}


def normalize_datetime_value(value: datetime | str | None) -> datetime:
    if isinstance(value, datetime):
        return ensure_utc_datetime(value)

    if isinstance(value, str):
        normalized_value = value.replace('Z', '+00:00')
        try:
            return ensure_utc_datetime(datetime.fromisoformat(normalized_value))
        except ValueError:
            return utc_now()

    return utc_now()


def normalize_optional_datetime_value(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None

    return normalize_datetime_value(value)


def normalize_quarter_value(value: int | str | None, fallback_quarter: int) -> int:
    if isinstance(value, int) and value in FY_QUARTER_MONTHS:
        return value

    if isinstance(value, str):
        normalized_value = value.strip().upper().removeprefix('Q')

        if normalized_value.isdigit():
            parsed_quarter = int(normalized_value)
            if parsed_quarter in FY_QUARTER_MONTHS:
                return parsed_quarter

    return fallback_quarter


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
    financialYear: str | None = None
    quarter: int | None = Field(default=None, ge=1, le=4)


class GoalCreate(GoalBase):
    createdAt: datetime = Field(default_factory=utc_now)


class GoalUpdate(GoalBase):
    pass


class GoalResponse(GoalBase):
    id: str
    createdAt: datetime
    goalStatus: GoalStatus
    isDropped: bool = False
    dropped: bool = False
    droppedAt: datetime | None = None
    droppedBy: str | None = None
    isRevived: bool = False
    revivedAt: datetime | None = None
    revivedBy: str | None = None
    completionPercentage: int
    parentGoalId: str | None = None
    originGoalId: str | None = None
    carryForwardSourceId: str | None = None
    carryForwardSourceGoalId: str | None = None
    carryForwardTargetGoalId: str | None = None
    carriedForwardFromQuarter: str | None = None
    carriedForwardToQuarter: str | None = None
    carryForwardedAt: datetime | None = None
    carryForwardUndoneAt: datetime | None = None
    carryForwardUndoBy: str | None = None
    decisionType: GoalDecisionType | None = None
    decisionByName: str | None = None
    decisionByEmployeeCode: str | None = None
    decisionTimestamp: datetime | None = None
    versionNumber: int = 1
    carryForwardEligible: bool = False
    carryForwardAvailable: bool = False
    carryForwardUndoAvailable: bool = False
    hardDeleteAvailable: bool = False
    dropAvailable: bool = False
    milestoneEditAvailable: bool = False
    milestoneCompletionAvailable: bool = False
    quarterLifecycle: Literal['past', 'active', 'upcoming', 'future']


def get_financial_year_start(value: datetime | None = None) -> int:
    current = normalize_datetime_value(value).astimezone(IST_TIMEZONE)
    return current.year if current.month >= 4 else current.year - 1


def format_financial_year(start_year: int) -> str:
    return f'FY {start_year}-{str(start_year + 1)[-2:]}'


def parse_financial_year_start(financial_year: str | None) -> int | None:
    if not financial_year:
        return None

    normalized = financial_year.strip().replace('FY', '').strip()
    start_year = normalized.split('-')[0].strip()
    return int(start_year) if start_year.isdigit() else None


def get_financial_quarter(value: datetime | None = None) -> tuple[str, int]:
    current = normalize_datetime_value(value).astimezone(IST_TIMEZONE)
    financial_year_start = get_financial_year_start(value)

    if 4 <= current.month <= 6:
        quarter = 1
    elif 7 <= current.month <= 9:
        quarter = 2
    elif 10 <= current.month <= 12:
        quarter = 3
    else:
        quarter = 4

    return format_financial_year(financial_year_start), quarter


def get_quarter_end_date(financial_year: str | None, quarter: int | None) -> date:
    financial_year_start = parse_financial_year_start(financial_year) or get_financial_year_start()
    normalized_quarter = normalize_quarter_value(quarter, get_financial_quarter()[1])
    _, end_month = FY_QUARTER_MONTHS[normalized_quarter]
    quarter_year = financial_year_start + 1 if normalized_quarter == 4 else financial_year_start

    if end_month in {6, 9}:
        end_day = 30
    else:
        end_day = 31

    return date(quarter_year, end_month, end_day)


def get_quarter_start_date(financial_year: str | None, quarter: int | None) -> date:
    financial_year_start = parse_financial_year_start(financial_year) or get_financial_year_start()
    normalized_quarter = normalize_quarter_value(quarter, get_financial_quarter()[1])
    start_month, _ = FY_QUARTER_MONTHS[normalized_quarter]
    quarter_year = financial_year_start + 1 if normalized_quarter == 4 else financial_year_start
    return date(quarter_year, start_month, 1)


def get_next_quarter(financial_year: str, quarter: int) -> tuple[str, int]:
    financial_year_start = parse_financial_year_start(financial_year) or get_financial_year_start()

    if quarter == 4:
        financial_year_start += 1
        quarter = 1
    else:
        quarter += 1

    return format_financial_year(financial_year_start), quarter


def format_quarter_label(financial_year: str | None, quarter: int | None) -> str:
    default_financial_year, default_quarter = get_financial_quarter()
    normalized_financial_year = financial_year or default_financial_year
    normalized_quarter = normalize_quarter_value(quarter, default_quarter)
    return f'{normalized_financial_year} Q{normalized_quarter}'


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    target_year = value.year + month_index // 12
    target_month = month_index % 12 + 1
    target_day = min(value.day, monthrange(target_year, target_month)[1])
    return date(target_year, target_month, target_day)


def get_quarter_lifecycle(
    financial_year: str | None,
    quarter: int | None,
    today: date | None = None,
) -> Literal['past', 'active', 'upcoming', 'future']:
    today = today or utc_now().astimezone(IST_TIMEZONE).date()
    start_date = get_quarter_start_date(financial_year, quarter)
    end_date = get_quarter_end_date(financial_year, quarter)

    if today > end_date:
        return 'past'

    if today >= start_date:
        return 'active'

    if today >= start_date - timedelta(days=GOAL_PLANNING_WINDOW_DAYS):
        return 'upcoming'

    return 'future'


def get_goal_planning_quarter(value: datetime | None = None) -> tuple[str, int]:
    reference_date = normalize_datetime_value(value).astimezone(IST_TIMEZONE).date()
    financial_year, quarter = get_financial_quarter(value)
    next_financial_year, next_quarter = get_next_quarter(financial_year, quarter)
    next_quarter_start = get_quarter_start_date(next_financial_year, next_quarter)

    if next_quarter_start - timedelta(days=GOAL_PLANNING_WINDOW_DAYS) <= reference_date < next_quarter_start:
        return next_financial_year, next_quarter

    return financial_year, quarter


def get_milestone_detail_edit_freeze_date(
    financial_year: str | None,
    quarter: int | None,
) -> date:
    return add_months(get_quarter_start_date(financial_year, quarter), 1)


def get_milestone_completion_freeze_date(
    financial_year: str | None,
    quarter: int | None,
) -> date:
    return get_quarter_end_date(financial_year, quarter) + timedelta(days=MILESTONE_COMPLETION_GRACE_DAYS)


def get_goal_decision_window_start_date(
    financial_year: str | None,
    quarter: int | None,
) -> date:
    return get_quarter_end_date(financial_year, quarter) - timedelta(days=GOAL_DECISION_WINDOW_DAYS)


def get_goal_decision_freeze_date(
    financial_year: str | None,
    quarter: int | None,
) -> date:
    return add_months(get_quarter_end_date(financial_year, quarter), 1)


def get_today_ist(value: datetime | None = None) -> date:
    return normalize_datetime_value(value).astimezone(IST_TIMEZONE).date()


def is_milestone_detail_edit_window_open(
    financial_year: str | None,
    quarter: int | None,
    today: date | None = None,
) -> bool:
    today = today or get_today_ist()
    lifecycle = get_quarter_lifecycle(financial_year, quarter, today)
    return lifecycle in {'active', 'upcoming'} and today < get_milestone_detail_edit_freeze_date(financial_year, quarter)


def is_milestone_completion_window_open(
    financial_year: str | None,
    quarter: int | None,
    today: date | None = None,
) -> bool:
    today = today or get_today_ist()
    lifecycle = get_quarter_lifecycle(financial_year, quarter, today)
    return lifecycle in {'active', 'upcoming'} or (
        lifecycle == 'past' and today <= get_milestone_completion_freeze_date(financial_year, quarter)
    )


def is_goal_decision_window_open(
    financial_year: str | None,
    quarter: int | None,
    today: date | None = None,
) -> bool:
    today = today or get_today_ist()
    window_start = get_goal_decision_window_start_date(financial_year, quarter)
    freeze_date = get_goal_decision_freeze_date(financial_year, quarter)
    return window_start <= today <= freeze_date


def get_completion_percentage(milestones: list[dict]) -> int:
    if len(milestones) == 0:
        return 0

    completed_count = sum(1 for milestone in milestones if bool(milestone.get('completed')))
    return round((completed_count / len(milestones)) * 100)


def is_goal_quarter_open_for_planning(financial_year: str | None, quarter: int | None) -> bool:
    return get_quarter_lifecycle(financial_year, quarter) in {'active', 'upcoming'}


def evaluate_goal_status(document: dict) -> GoalStatus:
    if bool(document.get('isDropped')):
        return 'Dropped'

    milestones = document.get('milestones', [])
    if len(milestones) == 0:
        return ''

    today_key = to_ist_date_key(utc_now())
    quarter_end_key = get_quarter_end_date(
        document.get('financialYear'),
        document.get('quarter'),
    ).isoformat()
    completed_count = sum(1 for milestone in milestones if bool(milestone.get('completed')))

    # Quarter lifecycle states are terminal business states derived on the backend.
    if completed_count == len(milestones):
        return 'Done'

    if today_key > quarter_end_key:
        return 'Not Done'

    has_completed_milestone = False
    has_delayed_completion = False

    for milestone in milestones:
        target_date_key = to_ist_date_key(normalize_datetime_value(milestone.get('targetDate')))
        completed = bool(milestone.get('completed'))
        completed_at = normalize_optional_datetime_value(milestone.get('completedAt'))

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


def normalize_goal_payload(payload: GoalCreate | GoalUpdate, enforce_open_quarter: bool = True) -> dict:
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

    default_financial_year, default_quarter = get_goal_planning_quarter()
    financial_year = goal.get('financialYear') or default_financial_year
    quarter = goal.get('quarter') or default_quarter

    if quarter not in FY_QUARTER_MONTHS:
        raise ValueError('Quarter must be between Q1 and Q4')

    if enforce_open_quarter and not is_goal_quarter_open_for_planning(financial_year, quarter):
        raise ValueError('Goals can only be created or edited for the active quarter or the upcoming quarter planning window')

    goal['financialYear'] = financial_year
    goal['quarter'] = quarter

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
    goal['completionPercentage'] = get_completion_percentage(normalized_milestones)
    if isinstance(payload, GoalCreate):
        goal.setdefault('isDropped', False)
        goal.setdefault('versionNumber', 1)
    return goal


def serialize_goal(document: dict) -> dict:
    default_financial_year, default_quarter = get_financial_quarter()
    financial_year = document.get('financialYear') or default_financial_year
    quarter = normalize_quarter_value(document.get('quarter'), default_quarter)
    milestones = [
        {
            'id': str(milestone.get('id', '')),
            'title': str(milestone.get('title', '')),
            'targetDate': serialize_datetime(normalize_datetime_value(milestone.get('targetDate'))),
            'completed': milestone.get('completed', False),
            'completedAt': serialize_datetime(normalize_optional_datetime_value(milestone.get('completedAt')))
            if normalize_optional_datetime_value(milestone.get('completedAt'))
            else None,
        }
        for milestone in document.get('milestones', [])
    ]
    lifecycle_document = {
        **document,
        'financialYear': financial_year,
        'quarter': quarter,
    }
    goal_status = evaluate_goal_status(lifecycle_document)
    completion_percentage = get_completion_percentage(document.get('milestones', []))
    quarter_lifecycle = get_quarter_lifecycle(financial_year, quarter)

    return {
        'id': str(document['_id']),
        'title': document['title'],
        'assignedTo': document.get('assignedTo', []),
        'createdAt': serialize_datetime(normalize_datetime_value(document.get('createdAt'))),
        'milestones': milestones,
        'financialYear': financial_year,
        'quarter': quarter,
        'goalStatus': goal_status,
        'isDropped': bool(document.get('isDropped', False)),
        'dropped': bool(document.get('isDropped', False) or document.get('dropped', False)),
        'droppedAt': serialize_datetime(normalize_optional_datetime_value(document.get('droppedAt')))
        if normalize_optional_datetime_value(document.get('droppedAt'))
        else None,
        'droppedBy': document.get('droppedBy'),
        'isRevived': bool(document.get('isRevived', False)),
        'revivedAt': serialize_datetime(normalize_optional_datetime_value(document.get('revivedAt')))
        if normalize_optional_datetime_value(document.get('revivedAt'))
        else None,
        'revivedBy': document.get('revivedBy'),
        'completionPercentage': completion_percentage,
        'parentGoalId': document.get('parentGoalId'),
        'originGoalId': document.get('originGoalId'),
        'carryForwardSourceId': document.get('carryForwardSourceId'),
        'carryForwardSourceGoalId': document.get('carryForwardSourceGoalId') or document.get('carryForwardSourceId'),
        'carryForwardTargetGoalId': document.get('carryForwardTargetGoalId'),
        'carriedForwardFromQuarter': document.get('carriedForwardFromQuarter'),
        'carriedForwardToQuarter': document.get('carriedForwardToQuarter'),
        'carryForwardedAt': serialize_datetime(normalize_optional_datetime_value(document.get('carryForwardedAt')))
        if normalize_optional_datetime_value(document.get('carryForwardedAt'))
        else None,
        'carryForwardUndoneAt': serialize_datetime(normalize_optional_datetime_value(document.get('carryForwardUndoneAt')))
        if normalize_optional_datetime_value(document.get('carryForwardUndoneAt'))
        else None,
        'carryForwardUndoBy': document.get('carryForwardUndoBy'),
        'decisionType': document.get('decisionType'),
        'decisionByName': document.get('decisionByName'),
        'decisionByEmployeeCode': document.get('decisionByEmployeeCode'),
        'decisionTimestamp': serialize_datetime(normalize_optional_datetime_value(document.get('decisionTimestamp')))
        if normalize_optional_datetime_value(document.get('decisionTimestamp'))
        else None,
        'versionNumber': int(document.get('versionNumber') or 1),
        'carryForwardEligible': goal_status != 'Done'
        and completion_percentage < 100
        and not bool(document.get('isDropped', False))
        and not bool(document.get('carryForwardTargetGoalId')),
        'carryForwardAvailable': is_goal_decision_window_open(financial_year, quarter)
        and goal_status != 'Done'
        and completion_percentage < 100
        and not bool(document.get('isDropped', False))
        and not bool(document.get('carryForwardTargetGoalId'))
        and not bool(document.get('carryForwardReservedAt')),
        'carryForwardUndoAvailable': bool(document.get('carryForwardUndoAvailable', False)),
        'hardDeleteAvailable': quarter_lifecycle == 'active'
        and get_today_ist() < get_milestone_detail_edit_freeze_date(financial_year, quarter),
        'dropAvailable': is_goal_decision_window_open(financial_year, quarter)
        and goal_status != 'Done'
        and completion_percentage < 100
        and not bool(document.get('isDropped', False))
        and not bool(document.get('carryForwardTargetGoalId'))
        and not bool(document.get('carryForwardReservedAt')),
        'milestoneEditAvailable': is_milestone_detail_edit_window_open(financial_year, quarter),
        'milestoneCompletionAvailable': is_milestone_completion_window_open(financial_year, quarter),
        'quarterLifecycle': quarter_lifecycle,
    }


def build_carry_forward_goal(
    source_goal: dict,
    decision_by_name: str,
    decision_by_employee_code: str,
    decision_timestamp: datetime | None = None,
) -> dict:
    source_id = str(source_goal['_id'])
    source_milestones = source_goal.get('milestones', [])
    target_financial_year, target_quarter = get_next_quarter(
        source_goal.get('financialYear') or get_financial_quarter()[0],
        normalize_quarter_value(source_goal.get('quarter'), get_financial_quarter()[1]),
    )
    decision_timestamp = decision_timestamp or utc_now()
    copied_milestones = [dict(milestone) for milestone in source_milestones]

    return {
        'title': source_goal['title'],
        'assignedTo': source_goal.get('assignedTo', []),
        'createdAt': source_goal.get('createdAt') or decision_timestamp,
        'milestones': copied_milestones,
        'financialYear': target_financial_year,
        'quarter': target_quarter,
        'completionPercentage': get_completion_percentage(copied_milestones),
        'isDropped': False,
        'parentGoalId': source_goal.get('parentGoalId') or source_id,
        'originGoalId': source_goal.get('originGoalId') or source_id,
        'carryForwardSourceId': source_id,
        'carryForwardSourceGoalId': source_id,
        'carriedForwardFromQuarter': format_quarter_label(
            source_goal.get('financialYear'),
            source_goal.get('quarter'),
        ),
        'carriedForwardToQuarter': format_quarter_label(target_financial_year, target_quarter),
        'carryForwardedAt': decision_timestamp,
        'decisionType': 'Carry Forwarded',
        'decisionByName': decision_by_name,
        'decisionByEmployeeCode': decision_by_employee_code,
        'decisionTimestamp': decision_timestamp,
        'versionNumber': int(source_goal.get('versionNumber') or 1) + 1,
        'carryForwardInitialVersion': int(source_goal.get('versionNumber') or 1) + 1,
        'progressHistory': [
            *source_goal.get('progressHistory', []),
            {
                'sourceGoalId': source_id,
                'statusAtCarryForward': evaluate_goal_status(source_goal),
                'completionPercentage': get_completion_percentage(source_milestones),
                'carriedForwardAt': decision_timestamp,
                'sourceFinancialYear': source_goal.get('financialYear'),
                'sourceQuarter': source_goal.get('quarter'),
                'targetFinancialYear': target_financial_year,
                'targetQuarter': target_quarter,
                'decisionByName': decision_by_name,
                'decisionByEmployeeCode': decision_by_employee_code,
            },
        ],
    }


def parse_goal_id(goal_id: str) -> ObjectId | None:
    if not ObjectId.is_valid(goal_id):
        return None
    return ObjectId(goal_id)
