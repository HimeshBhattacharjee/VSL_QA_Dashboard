from fastapi import APIRouter, Header, HTTPException, status
from models.goal_model import (
    build_carry_forward_goal,
    evaluate_goal_status,
    get_quarter_lifecycle,
    GoalCreate,
    GoalResponse,
    GoalUpdate,
    goals_collection,
    is_goal_quarter_open_for_planning,
    normalize_goal_payload,
    normalize_datetime_value,
    normalize_optional_datetime_value,
    parse_goal_id,
    serialize_goal,
)
from date_utils import utc_now

goal_router = APIRouter(prefix='/api/goals', tags=['Goals'])


def require_manager_role(role: str | None) -> None:
    if role != 'Manager':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Only managers can perform this goal lifecycle action',
        )


def is_same_datetime_value(left: object, right: object) -> bool:
    return normalize_datetime_value(left) == normalize_datetime_value(right)


def is_same_optional_datetime_value(left: object, right: object) -> bool:
    left_value = normalize_optional_datetime_value(left)
    right_value = normalize_optional_datetime_value(right)
    return left_value == right_value


def is_completion_only_goal_update(existing_goal: dict, updated_goal: dict) -> bool:
    if existing_goal.get('title') != updated_goal.get('title'):
        return False

    if existing_goal.get('assignedTo', []) != updated_goal.get('assignedTo', []):
        return False

    if existing_goal.get('financialYear') != updated_goal.get('financialYear'):
        return False

    if existing_goal.get('quarter') != updated_goal.get('quarter'):
        return False

    existing_milestones = existing_goal.get('milestones', [])
    updated_milestones = updated_goal.get('milestones', [])

    if len(existing_milestones) != len(updated_milestones):
        return False

    for existing_milestone, updated_milestone in zip(existing_milestones, updated_milestones):
        if existing_milestone.get('id') != updated_milestone.get('id'):
            return False

        if existing_milestone.get('title') != updated_milestone.get('title'):
            return False

        if not is_same_datetime_value(existing_milestone.get('targetDate'), updated_milestone.get('targetDate')):
            return False

        existing_completed = bool(existing_milestone.get('completed'))
        updated_completed = bool(updated_milestone.get('completed'))

        if existing_completed and not updated_completed:
            return False

        if existing_completed and not is_same_optional_datetime_value(
            existing_milestone.get('completedAt'),
            updated_milestone.get('completedAt'),
        ):
            return False

    return True


@goal_router.get('', response_model=list[GoalResponse])
async def get_goals() -> list[dict]:
    documents = await goals_collection.find().sort('createdAt', -1).to_list(length=None)
    return [serialize_goal(document) for document in documents]


@goal_router.post('', response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(goal: GoalCreate) -> dict:
    try:
        goal_document = normalize_goal_payload(goal)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    result = await goals_collection.insert_one(goal_document)
    created_goal = await goals_collection.find_one({'_id': result.inserted_id})

    if not created_goal:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to create goal',
        )

    return serialize_goal(created_goal)


@goal_router.put('/{goal_id}', response_model=GoalResponse)
async def update_goal(goal_id: str, goal: GoalUpdate) -> dict:
    object_id = parse_goal_id(goal_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid goal ID')

    existing_goal = await goals_collection.find_one({'_id': object_id})
    if not existing_goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    try:
        goal_document = normalize_goal_payload(goal, enforce_open_quarter=False)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    existing_lifecycle = get_quarter_lifecycle(
        existing_goal.get('financialYear'),
        existing_goal.get('quarter'),
    )
    target_is_open = is_goal_quarter_open_for_planning(
        goal_document.get('financialYear'),
        goal_document.get('quarter'),
    )

    if existing_lifecycle == 'past':
        if not is_completion_only_goal_update(existing_goal, goal_document):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Previous quarter goals are read-only except milestone completion',
            )

        await goals_collection.update_one(
            {'_id': object_id},
            {
                '$set': {
                    'milestones': goal_document['milestones'],
                    'completionPercentage': goal_document['completionPercentage'],
                },
            },
        )
        updated_goal = await goals_collection.find_one({'_id': object_id})

        if not updated_goal:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail='Failed to load updated goal',
            )

        return serialize_goal(updated_goal)

    if existing_lifecycle == 'future' or not target_is_open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Goals can only be edited for the active quarter or the upcoming quarter planning window',
        )

    await goals_collection.update_one(
        {'_id': object_id},
        {
            '$set': goal_document,
            '$unset': {
                'description': '',
            },
        },
    )
    updated_goal = await goals_collection.find_one({'_id': object_id})

    if not updated_goal:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to load updated goal',
        )

    return serialize_goal(updated_goal)


@goal_router.post('/{goal_id}/drop', response_model=GoalResponse)
async def drop_goal(
    goal_id: str,
    dropped_by: str | None = None,
    x_user_role: str | None = Header(default=None),
) -> dict:
    require_manager_role(x_user_role)
    object_id = parse_goal_id(goal_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid goal ID')

    existing_goal = await goals_collection.find_one({'_id': object_id})
    if not existing_goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    if get_quarter_lifecycle(existing_goal.get('financialYear'), existing_goal.get('quarter')) == 'past':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Previous quarter goals cannot be dropped',
        )

    # Drop is a soft lifecycle state and must stay separate from permanent delete.
    await goals_collection.update_one(
        {'_id': object_id},
        {
            '$set': {
                'isDropped': True,
                'droppedAt': utc_now(),
                'droppedBy': dropped_by,
            },
        },
    )
    dropped_goal = await goals_collection.find_one({'_id': object_id})
    return serialize_goal(dropped_goal)


@goal_router.post('/{goal_id}/revive', response_model=GoalResponse)
async def revive_goal(goal_id: str, x_user_role: str | None = Header(default=None)) -> dict:
    require_manager_role(x_user_role)
    object_id = parse_goal_id(goal_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid goal ID')

    existing_goal = await goals_collection.find_one({'_id': object_id})
    if not existing_goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    if get_quarter_lifecycle(existing_goal.get('financialYear'), existing_goal.get('quarter')) == 'past':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Previous quarter goals cannot be revived',
        )

    await goals_collection.update_one(
        {'_id': object_id},
        {
            '$set': {
                'isDropped': False,
            },
            '$unset': {
                'droppedAt': '',
                'droppedBy': '',
            },
        },
    )
    revived_goal = await goals_collection.find_one({'_id': object_id})
    return serialize_goal(revived_goal)


@goal_router.post('/{goal_id}/carry-forward', response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def carry_forward_goal(
    goal_id: str,
    x_user_role: str | None = Header(default=None),
) -> dict:
    require_manager_role(x_user_role)
    object_id = parse_goal_id(goal_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid goal ID')

    existing_goal = await goals_collection.find_one({'_id': object_id})
    if not existing_goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    if evaluate_goal_status(existing_goal) != 'Not Done':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Only Not Done goals can be carried forward',
        )

    existing_carry_forward = await goals_collection.find_one({'carryForwardSourceId': goal_id})
    if existing_carry_forward:
        return serialize_goal(existing_carry_forward)

    carry_forward_document = build_carry_forward_goal(existing_goal)
    result = await goals_collection.insert_one(carry_forward_document)
    created_goal = await goals_collection.find_one({'_id': result.inserted_id})

    if not created_goal:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to carry forward goal',
        )

    return serialize_goal(created_goal)


@goal_router.delete('/{goal_id}', status_code=status.HTTP_200_OK)
async def delete_goal(goal_id: str) -> dict:
    object_id = parse_goal_id(goal_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid goal ID')

    existing_goal = await goals_collection.find_one({'_id': object_id})
    if not existing_goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    if get_quarter_lifecycle(existing_goal.get('financialYear'), existing_goal.get('quarter')) == 'past':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Previous quarter goals cannot be deleted',
        )

    result = await goals_collection.delete_one({'_id': object_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    return {
        'message': 'Goal deleted successfully',
        'id': goal_id,
    }
