from fastapi import APIRouter, HTTPException, status
from models.task_model import (
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    normalize_task_payload,
    parse_task_id,
    serialize_task,
    tasks_collection,
)

task_router = APIRouter(prefix='/api/tasks', tags=['Tasks'])

@task_router.get('', response_model=list[TaskResponse])
async def get_tasks() -> list[dict]:
    documents = await tasks_collection.find().sort('createdAt', -1).to_list(length=None)
    return [serialize_task(document) for document in documents]

@task_router.post('', response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(task: TaskCreate) -> dict:
    try:
        task_document = normalize_task_payload(task)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    result = await tasks_collection.insert_one(task_document)
    created_task = await tasks_collection.find_one({'_id': result.inserted_id})
    if not created_task:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to create task')
    return serialize_task(created_task)


@task_router.put('/{task_id}', response_model=TaskResponse)
async def update_task(task_id: str, task: TaskUpdate) -> dict:
    object_id = parse_task_id(task_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid task ID')
    existing_task = await tasks_collection.find_one({'_id': object_id})
    if not existing_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Task not found')
    try:
        task_document = normalize_task_payload(task)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    await tasks_collection.update_one({'_id': object_id}, {'$set': task_document})
    updated_task = await tasks_collection.find_one({'_id': object_id})
    if not updated_task:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to load updated task')
    return serialize_task(updated_task)


@task_router.delete('/{task_id}', status_code=status.HTTP_200_OK)
async def delete_task(task_id: str) -> dict:
    object_id = parse_task_id(task_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid task ID')
    result = await tasks_collection.delete_one({'_id': object_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Task not found')
    return {
        'message': 'Task deleted successfully',
        'id': task_id,
    }
