from fastapi import APIRouter, HTTPException, status
from models.goal_model import (
    GoalCreate,
    GoalResponse,
    GoalUpdate,
    goals_collection,
    normalize_goal_payload,
    parse_goal_id,
    serialize_goal,
)

goal_router = APIRouter(prefix='/api/goals', tags=['Goals'])


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
