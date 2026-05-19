from fastapi import APIRouter, Header, HTTPException, status
from models.task_model import (
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    TaskVisibilityUpdate,
    normalize_task_payload,
    parse_task_id,
    serialize_task,
    tasks_collection,
)
from users.user_db import users_collection

task_router = APIRouter(prefix='/api/tasks', tags=['Tasks'])

VISIBILITY_ROLES = {'Manager', 'Supervisor'}
BLOCKED_VISIBILITY_EMPLOYEE_ID = '4000061'
BLOCKED_VISIBILITY_EMPLOYEE_NAME = 'Sanjit Basu'

def can_manage_task_visibility(
    employee_id: str | None,
    employee_name: str | None,
    fallback_role: str | None,
) -> bool:
    normalized_employee_id = (employee_id or '').strip()
    normalized_employee_name = ' '.join((employee_name or '').split()).casefold()

    if normalized_employee_id == BLOCKED_VISIBILITY_EMPLOYEE_ID:
        return False
    if normalized_employee_name == BLOCKED_VISIBILITY_EMPLOYEE_NAME.casefold():
        return False

    user = users_collection.find_one({'employeeId': normalized_employee_id}) if normalized_employee_id else None
    role = user.get('role') if user else (fallback_role or '').strip()
    user_name = ' '.join(str(user.get('name', '')).split()).casefold() if user else normalized_employee_name

    if user:
        if str(user.get('employeeId', '')).strip() == BLOCKED_VISIBILITY_EMPLOYEE_ID:
            return False
        if user_name == BLOCKED_VISIBILITY_EMPLOYEE_NAME.casefold():
            return False

    return role in VISIBILITY_ROLES

@task_router.get('', response_model=list[TaskResponse])
async def get_tasks(
    x_employee_id: str | None = Header(default=None),
    x_employee_name: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> list[dict]:
    query = {} if can_manage_task_visibility(x_employee_id, x_employee_name, x_user_role) else {
        'visibleInMeeting': {'$ne': False},
    }
    documents = await tasks_collection.find(query).sort('createdAt', -1).to_list(length=None)
    return [serialize_task(document) for document in documents]

@task_router.post('', response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task: TaskCreate,
    x_employee_id: str | None = Header(default=None),
    x_employee_name: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> dict:
    try:
        task_document = normalize_task_payload(task)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    if not task_document.get('visibleInMeeting', True) and not can_manage_task_visibility(
        x_employee_id,
        x_employee_name,
        x_user_role,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='You are not authorized to create hidden meeting tasks',
        )
    result = await tasks_collection.insert_one(task_document)
    created_task = await tasks_collection.find_one({'_id': result.inserted_id})
    if not created_task:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to create task')
    return serialize_task(created_task)


@task_router.put('/{task_id}', response_model=TaskResponse)
async def update_task(
    task_id: str,
    task: TaskUpdate,
    x_employee_id: str | None = Header(default=None),
    x_employee_name: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> dict:
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
    if 'visibleInMeeting' not in task.model_fields_set:
        task_document['visibleInMeeting'] = existing_task.get('visibleInMeeting', True)
    if task_document['visibleInMeeting'] != existing_task.get('visibleInMeeting', True) and not can_manage_task_visibility(
        x_employee_id,
        x_employee_name,
        x_user_role,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='You are not authorized to change task meeting visibility',
        )
    await tasks_collection.update_one({'_id': object_id}, {'$set': task_document})
    updated_task = await tasks_collection.find_one({'_id': object_id})
    if not updated_task:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Failed to load updated task')
    return serialize_task(updated_task)

@task_router.patch('/{task_id}/visibility', response_model=TaskResponse)
async def update_task_visibility(
    task_id: str,
    visibility: TaskVisibilityUpdate,
    x_employee_id: str | None = Header(default=None),
    x_employee_name: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> dict:
    if not can_manage_task_visibility(x_employee_id, x_employee_name, x_user_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='You are not authorized to change task meeting visibility',
        )

    object_id = parse_task_id(task_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid task ID')

    result = await tasks_collection.update_one(
        {'_id': object_id},
        {'$set': {'visibleInMeeting': visibility.visibleInMeeting}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Task not found')

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
