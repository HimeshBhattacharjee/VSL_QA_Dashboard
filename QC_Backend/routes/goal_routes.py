from fastapi import APIRouter, Header, HTTPException, status
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError
from mongo_indexes import ensure_index_async
from models.goal_model import (
    build_carry_forward_goal,
    evaluate_goal_status,
    format_quarter_label,
    get_completion_percentage,
    GoalCreate,
    GoalResponse,
    GoalUpdate,
    goals_collection,
    is_goal_decision_window_open,
    is_milestone_completion_window_open,
    is_milestone_detail_edit_window_open,
    normalize_goal_payload,
    normalize_datetime_value,
    normalize_optional_datetime_value,
    parse_goal_id,
    serialize_goal,
)
from date_utils import utc_now

goal_router = APIRouter(prefix='/api/goals', tags=['Goals'])

AUTHORIZED_GOAL_DECISION_USERS = {
    '4000061': 'Sanjit Basu',
    '4007553': 'Himesh Bhattacharjee',
    '4006699': 'Souvik Chaudhury',
}

_goal_indexes_ensured = False


def get_authorized_decision_actor(
    employee_code: str | None,
    _user_name: str | None,
) -> tuple[str, str]:
    normalized_employee_code = (employee_code or '').strip()
    if normalized_employee_code not in AUTHORIZED_GOAL_DECISION_USERS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Only authorized goal decision users can carry forward or drop goals',
        )

    canonical_name = AUTHORIZED_GOAL_DECISION_USERS[normalized_employee_code]
    return normalized_employee_code, canonical_name


async def ensure_goal_indexes() -> None:
    global _goal_indexes_ensured

    if _goal_indexes_ensured:
        return

    try:
        await ensure_index_async(
            goals_collection,
            'carryForwardSourceGoalId',
            unique=True,
            sparse=True,
            name='unique_goal_carry_forward_source',
        )
    except PyMongoError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to prepare goal carry-forward safeguards',
        ) from error

    _goal_indexes_ensured = True


def is_same_datetime_value(left: object, right: object) -> bool:
    return normalize_datetime_value(left) == normalize_datetime_value(right)


def is_same_optional_datetime_value(left: object, right: object) -> bool:
    left_value = normalize_optional_datetime_value(left)
    right_value = normalize_optional_datetime_value(right)
    return left_value == right_value


def get_goal_update_changes(existing_goal: dict, updated_goal: dict) -> dict[str, bool]:
    changes = {
        'quarter': False,
        'goal_details': False,
        'milestone_details': False,
        'milestone_completion': False,
    }

    existing_financial_year = existing_goal.get('financialYear') or updated_goal.get('financialYear')
    existing_quarter = existing_goal.get('quarter') or updated_goal.get('quarter')

    if existing_financial_year != updated_goal.get('financialYear'):
        changes['quarter'] = True

    if existing_quarter != updated_goal.get('quarter'):
        changes['quarter'] = True

    if existing_goal.get('title') != updated_goal.get('title'):
        changes['goal_details'] = True

    if existing_goal.get('assignedTo', []) != updated_goal.get('assignedTo', []):
        changes['goal_details'] = True

    existing_milestones = existing_goal.get('milestones', [])
    updated_milestones = updated_goal.get('milestones', [])

    if len(existing_milestones) != len(updated_milestones):
        changes['milestone_details'] = True

    for index, updated_milestone in enumerate(updated_milestones):
        existing_milestone = existing_milestones[index] if index < len(existing_milestones) else {}

        if existing_milestone.get('id') != updated_milestone.get('id'):
            changes['milestone_details'] = True

        if existing_milestone.get('title') != updated_milestone.get('title'):
            changes['milestone_details'] = True

        if not is_same_datetime_value(existing_milestone.get('targetDate'), updated_milestone.get('targetDate')):
            changes['milestone_details'] = True

        if bool(existing_milestone.get('completed')) != bool(updated_milestone.get('completed')):
            changes['milestone_completion'] = True

        if not is_same_optional_datetime_value(
            existing_milestone.get('completedAt'),
            updated_milestone.get('completedAt'),
        ):
            changes['milestone_completion'] = True

    return changes


def has_goal_update_changes(changes: dict[str, bool]) -> bool:
    return any(changes.values())


def preserve_unchanged_completion_timestamps(existing_goal: dict, updated_goal: dict) -> None:
    existing_milestones_by_id = {
        milestone.get('id'): milestone
        for milestone in existing_goal.get('milestones', [])
    }

    for updated_milestone in updated_goal.get('milestones', []):
        existing_milestone = existing_milestones_by_id.get(updated_milestone.get('id'))
        if not existing_milestone:
            continue

        existing_completed = bool(existing_milestone.get('completed'))
        updated_completed = bool(updated_milestone.get('completed'))
        if existing_completed != updated_completed:
            continue

        updated_milestone['completedAt'] = (
            existing_milestone.get('completedAt') if existing_completed else None
        )

    updated_goal['completionPercentage'] = get_completion_percentage(updated_goal.get('milestones', []))


def reject_if_goal_snapshot_frozen(existing_goal: dict, changes: dict[str, bool]) -> None:
    if not has_goal_update_changes(changes):
        return

    if bool(existing_goal.get('isDropped')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Dropped goals are frozen and cannot be modified',
        )

    if existing_goal.get('carryForwardTargetGoalId'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Carried-forward source goals are frozen to preserve the previous quarter snapshot',
        )


def is_carry_forward_copy_untouched(source_goal: dict, target_goal: dict | None) -> bool:
    if not target_goal:
        return False

    source_id = str(source_goal['_id'])
    target_source_id = target_goal.get('carryForwardSourceGoalId') or target_goal.get('carryForwardSourceId')
    initial_version = target_goal.get('carryForwardInitialVersion') or source_goal.get('versionNumber') or 1
    return (
        str(target_source_id or '') == source_id
        and int(target_goal.get('versionNumber') or 1) == int(initial_version)
        and target_goal.get('decisionType') == 'Carry Forwarded'
        and not bool(target_goal.get('isDropped'))
        and not bool(target_goal.get('isRevived'))
    )


@goal_router.get('', response_model=list[GoalResponse])
async def get_goals() -> list[dict]:
    documents = await goals_collection.find().sort('createdAt', -1).to_list(length=None)
    documents_by_id = {str(document['_id']): document for document in documents}
    for document in documents:
        target_goal = documents_by_id.get(str(document.get('carryForwardTargetGoalId') or ''))
        document['carryForwardUndoAvailable'] = is_carry_forward_copy_untouched(document, target_goal)
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

    preserve_unchanged_completion_timestamps(existing_goal, goal_document)
    changes = get_goal_update_changes(existing_goal, goal_document)
    reject_if_goal_snapshot_frozen(existing_goal, changes)

    if changes['quarter']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Goal quarter cannot be changed after creation',
        )

    validation_financial_year = existing_goal.get('financialYear') or goal_document.get('financialYear')
    validation_quarter = existing_goal.get('quarter') or goal_document.get('quarter')

    if (changes['goal_details'] or changes['milestone_details']) and not is_milestone_detail_edit_window_open(
        validation_financial_year,
        validation_quarter,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Milestone text, target dates, and goal details are frozen for this quarter',
        )

    if changes['milestone_completion'] and not is_milestone_completion_window_open(
        validation_financial_year,
        validation_quarter,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Milestone completion is frozen for this quarter',
        )

    if not has_goal_update_changes(changes):
        return serialize_goal(existing_goal)

    updated_goal = await goals_collection.find_one_and_update(
        {'_id': object_id},
        {
            '$set': goal_document,
            '$unset': {
                'description': '',
            },
            '$inc': {
                'versionNumber': 1,
            },
        },
        return_document=ReturnDocument.AFTER,
    )

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
    x_employee_id: str | None = Header(default=None),
    x_user_name: str | None = Header(default=None),
) -> dict:
    actor_employee_code, actor_name = get_authorized_decision_actor(
        x_employee_id,
        x_user_name or dropped_by,
    )
    object_id = parse_goal_id(goal_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid goal ID')

    existing_goal = await goals_collection.find_one({'_id': object_id})
    if not existing_goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    if not is_goal_decision_window_open(existing_goal.get('financialYear'), existing_goal.get('quarter')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Goal drop decisions are outside the allowed decision window',
        )

    if existing_goal.get('carryForwardTargetGoalId'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Carried-forward source goals cannot be dropped',
        )

    if evaluate_goal_status(existing_goal) == 'Done' or get_completion_percentage(existing_goal.get('milestones', [])) >= 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Completed goals cannot be dropped',
        )

    # Drop is a soft lifecycle state and must stay separate from permanent delete.
    decision_timestamp = utc_now()
    dropped_goal = await goals_collection.find_one_and_update(
        {'_id': object_id, 'isDropped': {'$ne': True}},
        {
            '$set': {
                'isDropped': True,
                'dropped': True,
                'droppedAt': decision_timestamp,
                'droppedBy': actor_name,
                'goalStatus': 'Dropped',
                'decisionType': 'Dropped',
                'decisionByName': actor_name,
                'decisionByEmployeeCode': actor_employee_code,
                'decisionTimestamp': decision_timestamp,
            },
            '$inc': {
                'versionNumber': 1,
            },
        },
        return_document=ReturnDocument.AFTER,
    )

    if not dropped_goal:
        dropped_goal = await goals_collection.find_one({'_id': object_id})

    return serialize_goal(dropped_goal)


@goal_router.post('/{goal_id}/revive', response_model=GoalResponse)
async def revive_goal(
    goal_id: str,
    x_user_role: str | None = Header(default=None),
    x_employee_id: str | None = Header(default=None),
    x_user_name: str | None = Header(default=None),
) -> dict:
    actor_employee_code, actor_name = get_authorized_decision_actor(x_employee_id, x_user_name)
    object_id = parse_goal_id(goal_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid goal ID')

    existing_goal = await goals_collection.find_one({'_id': object_id})
    if not existing_goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    revived_at = utc_now()
    revived_goal = await goals_collection.find_one_and_update(
        {'_id': object_id, 'isDropped': True},
        {
            '$set': {
                'isDropped': False,
                'dropped': False,
                'isRevived': True,
                'revivedAt': revived_at,
                'revivedBy': actor_name,
                'decisionType': 'Revived',
                'decisionByName': actor_name,
                'decisionByEmployeeCode': actor_employee_code,
                'decisionTimestamp': revived_at,
            },
            '$inc': {
                'versionNumber': 1,
            },
        },
        return_document=ReturnDocument.AFTER,
    )

    if not revived_goal:
        revived_goal = await goals_collection.find_one({'_id': object_id})

    return serialize_goal(revived_goal)


@goal_router.post('/{goal_id}/carry-forward', response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def carry_forward_goal(
    goal_id: str,
    x_user_role: str | None = Header(default=None),
    x_employee_id: str | None = Header(default=None),
    x_user_name: str | None = Header(default=None),
) -> dict:
    await ensure_goal_indexes()
    actor_employee_code, actor_name = get_authorized_decision_actor(x_employee_id, x_user_name)
    object_id = parse_goal_id(goal_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid goal ID')

    existing_goal = await goals_collection.find_one({'_id': object_id})
    if not existing_goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    if not is_goal_decision_window_open(existing_goal.get('financialYear'), existing_goal.get('quarter')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Goal carry-forward decisions are outside the allowed decision window',
        )

    if bool(existing_goal.get('isDropped')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Dropped goals cannot be carried forward',
        )

    if evaluate_goal_status(existing_goal) == 'Done' or get_completion_percentage(existing_goal.get('milestones', [])) >= 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Completed goals cannot be carried forward',
        )

    existing_carry_forward = await goals_collection.find_one(
        {
            '$or': [
                {'carryForwardSourceGoalId': goal_id},
                {'carryForwardSourceId': goal_id},
            ],
        },
    )
    if existing_carry_forward:
        return serialize_goal(existing_carry_forward)

    carry_forward_preview = build_carry_forward_goal(existing_goal, actor_name, actor_employee_code)
    target_financial_year = carry_forward_preview.get('financialYear')
    target_quarter = carry_forward_preview.get('quarter')
    decision_timestamp = utc_now()
    reserved_source_goal = await goals_collection.find_one_and_update(
        {
            '_id': object_id,
            'isDropped': {'$ne': True},
            'carryForwardTargetGoalId': {'$exists': False},
            'decisionType': {'$ne': 'Dropped'},
        },
        {
            '$set': {
                'decisionType': 'Carry Forwarded',
                'decisionByName': actor_name,
                'decisionByEmployeeCode': actor_employee_code,
                'decisionTimestamp': decision_timestamp,
                'carriedForwardToQuarter': format_quarter_label(target_financial_year, target_quarter),
                'carryForwardReservedAt': decision_timestamp,
            },
            '$inc': {
                'versionNumber': 1,
            },
        },
        return_document=ReturnDocument.AFTER,
    )

    if not reserved_source_goal:
        existing_carry_forward = await goals_collection.find_one(
            {
                '$or': [
                    {'carryForwardSourceGoalId': goal_id},
                    {'carryForwardSourceId': goal_id},
                ],
            },
        )
        if existing_carry_forward:
            return serialize_goal(existing_carry_forward)

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='This goal already has a lifecycle decision',
        )

    carry_forward_document = build_carry_forward_goal(
        existing_goal,
        actor_name,
        actor_employee_code,
        decision_timestamp,
    )
    try:
        result = await goals_collection.insert_one(carry_forward_document)
    except DuplicateKeyError:
        existing_carry_forward = await goals_collection.find_one({'carryForwardSourceGoalId': goal_id})
        if not existing_carry_forward:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail='This goal has already been carried forward',
            )
        await goals_collection.update_one(
            {'_id': object_id},
            {
                '$set': {'carryForwardTargetGoalId': str(existing_carry_forward['_id'])},
                '$unset': {'carryForwardReservedAt': ''},
            },
        )
        return serialize_goal(existing_carry_forward)
    except PyMongoError as error:
        await goals_collection.update_one(
            {'_id': object_id, 'carryForwardReservedAt': decision_timestamp},
            {
                '$unset': {
                    'decisionType': '',
                    'decisionByName': '',
                    'decisionByEmployeeCode': '',
                    'decisionTimestamp': '',
                    'carriedForwardToQuarter': '',
                    'carryForwardReservedAt': '',
                },
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to carry forward goal',
        ) from error

    await goals_collection.update_one(
        {'_id': object_id},
        {
            '$set': {
                'carryForwardTargetGoalId': str(result.inserted_id),
            },
            '$unset': {
                'carryForwardReservedAt': '',
            },
        },
    )
    created_goal = await goals_collection.find_one({'_id': result.inserted_id})

    if not created_goal:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to carry forward goal',
        )

    return serialize_goal(created_goal)


@goal_router.post('/{goal_id}/undo-carry-forward', response_model=GoalResponse)
async def undo_carry_forward_goal(
    goal_id: str,
    x_user_role: str | None = Header(default=None),
    x_employee_id: str | None = Header(default=None),
    x_user_name: str | None = Header(default=None),
) -> dict:
    actor_employee_code, actor_name = get_authorized_decision_actor(x_employee_id, x_user_name)
    object_id = parse_goal_id(goal_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid goal ID')

    source_goal = await goals_collection.find_one({'_id': object_id})
    if not source_goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    target_id = source_goal.get('carryForwardTargetGoalId')
    target_object_id = parse_goal_id(str(target_id or ''))
    target_goal = await goals_collection.find_one({'_id': target_object_id}) if target_object_id else None
    if not is_carry_forward_copy_untouched(source_goal, target_goal):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='Carry forward can no longer be undone because work has already begun on the destination goal',
        )

    initial_version = target_goal.get('carryForwardInitialVersion') or source_goal.get('versionNumber') or 1
    deleted = await goals_collection.delete_one(
        {
            '_id': target_object_id,
            'versionNumber': int(initial_version),
            'isDropped': {'$ne': True},
            'isRevived': {'$ne': True},
        },
    )
    if deleted.deleted_count != 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='Carry forward can no longer be undone because work has already begun on the destination goal',
        )

    undone_at = utc_now()
    restored_source = await goals_collection.find_one_and_update(
        {'_id': object_id, 'carryForwardTargetGoalId': str(target_id)},
        {
            '$set': {
                'decisionType': 'Carry Forward Undone',
                'decisionByName': actor_name,
                'decisionByEmployeeCode': actor_employee_code,
                'decisionTimestamp': undone_at,
                'carryForwardUndoneAt': undone_at,
                'carryForwardUndoBy': actor_name,
            },
            '$unset': {
                'carryForwardTargetGoalId': '',
                'carryForwardReservedAt': '',
            },
            '$inc': {'versionNumber': 1},
        },
        return_document=ReturnDocument.AFTER,
    )
    if not restored_source:
        try:
            await goals_collection.insert_one(target_goal)
        except (DuplicateKeyError, PyMongoError) as rollback_error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail='Carry forward undo failed while restoring goal references',
            ) from rollback_error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Carry forward could not be undone',
        )

    restored_source['carryForwardUndoAvailable'] = False
    return serialize_goal(restored_source)


@goal_router.delete('/{goal_id}', status_code=status.HTTP_200_OK)
async def delete_goal(
    goal_id: str,
    x_user_role: str | None = Header(default=None),
    x_user_name: str | None = Header(default=None),
) -> dict:
    object_id = parse_goal_id(goal_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid goal ID')

    if (x_user_role or '').strip() not in {'Manager', 'Supervisor'}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Only managers and supervisors can delete goals',
        )

    goal = await goals_collection.find_one({'_id': object_id})
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Goal not found')

    if not serialize_goal(goal).get('hardDeleteAvailable'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Goals can only be deleted during the first month of their current quarter',
        )

    source_id = goal.get('carryForwardSourceGoalId') or goal.get('carryForwardSourceId')
    source_object_id = parse_goal_id(str(source_id or ''))
    source_goal = await goals_collection.find_one({'_id': source_object_id}) if source_object_id else None
    deleted = await goals_collection.delete_one({'_id': object_id})
    if deleted.deleted_count != 1:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to delete goal',
        )

    if source_goal:
        deleted_at = utc_now()
        restored_source = await goals_collection.find_one_and_update(
            {'_id': source_object_id, 'carryForwardTargetGoalId': goal_id},
            {
                '$set': {
                    'decisionType': 'Carry Forward Undone',
                    'decisionByName': (x_user_name or x_user_role or 'Unknown').strip(),
                    'decisionTimestamp': deleted_at,
                    'carryForwardUndoneAt': deleted_at,
                    'carryForwardUndoBy': (x_user_name or x_user_role or 'Unknown').strip(),
                },
                '$unset': {
                    'carryForwardTargetGoalId': '',
                    'carryForwardReservedAt': '',
                },
                '$inc': {'versionNumber': 1},
            },
            return_document=ReturnDocument.AFTER,
        )
        if not restored_source:
            try:
                await goals_collection.insert_one(goal)
            except (DuplicateKeyError, PyMongoError) as rollback_error:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail='Goal deletion failed while restoring carry-forward references',
                ) from rollback_error
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail='Goal deletion could not update its source goal',
            )

    return {'message': 'Goal deleted successfully'}
