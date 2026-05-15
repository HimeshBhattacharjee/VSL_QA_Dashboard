from fastapi import APIRouter, Header, HTTPException, status
from models.goal_model import (
    build_carry_forward_goal,
    evaluate_goal_status,
    GoalCreate,
    GoalResponse,
    GoalUpdate,
    goals_collection,
    normalize_goal_payload,
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
        goal_document = normalize_goal_payload(goal)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    await goals_collection.update_one(
        {'_id': object_id},
        {
            '$set': goal_document,
            '$unset': {
                'description': '',
                'createdBy': '',
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

    result = await goals_collection.delete_one({'_id': object_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    return {
        'message': 'Goal deleted successfully',
        'id': goal_id,
    }
