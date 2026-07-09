from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Callable, Mapping, Sequence


WORKFLOW_STATES = ("draft", "submitted", "approved", "returned")
STATUS_COUNT_KEYS = ("draft", "submitted", "returned", "approved")


def resolve_dashboard_date_range(view: str) -> tuple[str, str]:
    today = date.today()
    if view == "weekly":
        start = today - timedelta(days=6)
    elif view == "monthly":
        start = today - timedelta(days=29)
    else:
        start = today
    return start.isoformat(), today.isoformat()


def _combine_queries(*queries: Mapping[str, Any]) -> dict:
    active_queries = [dict(query) for query in queries if query]
    if not active_queries:
        return {}
    if len(active_queries) == 1:
        return active_queries[0]
    return {"$and": active_queries}


def _workflow_state_expression(state_fields: Sequence[str]) -> Any:
    expression: Any = "submitted"
    for field in reversed(state_fields or ("workflowState",)):
        field_expr = f"${field}"
        expression = {
            "$cond": [
                {"$in": [field_expr, list(WORKFLOW_STATES)]},
                field_expr,
                expression,
            ]
        }
    return expression


def _completion_expression(completion_field: str) -> dict:
    return {
        "$convert": {
            "input": f"${completion_field}",
            "to": "double",
            "onError": 0,
            "onNull": 0,
        }
    }


def _group_spec(group_id: Any, total_key: str, include_completion: bool) -> dict:
    spec = {
        "_id": group_id,
        total_key: {"$sum": 1},
    }
    for state in STATUS_COUNT_KEYS:
        spec[state] = {
            "$sum": {
                "$cond": [{"$eq": ["$_workflowState", state]}, 1, 0]
            }
        }
    if include_completion:
        spec["completed"] = {
            "$sum": {
                "$cond": [{"$gte": ["$_completion", 100]}, 1, 0]
            }
        }
        spec["averageCompletion"] = {"$avg": "$_completion"}
    return spec


def _empty_stats(total_key: str, include_completion: bool) -> dict:
    stats = {
        total_key: 0,
        "draft": 0,
        "submitted": 0,
        "returned": 0,
        "approved": 0,
    }
    if include_completion:
        stats["completed"] = 0
        stats["averageCompletion"] = 0
    return stats


def _normalize_stats(raw: Mapping[str, Any] | None, total_key: str, include_completion: bool) -> dict:
    stats = _empty_stats(total_key, include_completion)
    if not raw:
        return stats

    for key in (total_key, *STATUS_COUNT_KEYS):
        stats[key] = int(raw.get(key) or 0)
    if include_completion:
        stats["completed"] = int(raw.get("completed") or 0)
        stats["averageCompletion"] = round(float(raw.get("averageCompletion") or 0))
    return stats


def _format_day(day: date) -> dict:
    return {
        "key": day.isoformat(),
        "date": day.isoformat(),
        "dayName": day.strftime("%A"),
        "displayDate": day.strftime("%d-%b-%Y"),
    }


def _calendar_days(start_date: date, end_date: date) -> list[date]:
    days = []
    current = end_date
    while current >= start_date:
        days.append(current)
        current -= timedelta(days=1)
    return days


def _build_calendar_groups(
    raw_groups: Sequence[Mapping[str, Any]],
    start_date: date,
    end_date: date,
    total_key: str,
    include_completion: bool,
) -> list[dict]:
    stats_by_date = {
        str(group.get("_id") or ""): _normalize_stats(group, total_key, include_completion)
        for group in raw_groups
    }

    groups = []
    for day in _calendar_days(start_date, end_date):
        day_info = _format_day(day)
        groups.append({
            **day_info,
            **stats_by_date.get(day_info["date"], _empty_stats(total_key, include_completion)),
        })
    return groups


def _build_daily_groups(
    raw_groups: Sequence[Mapping[str, Any]],
    total_key: str,
    include_completion: bool,
) -> list[dict]:
    groups = []
    for group in raw_groups:
        key = str(group.get("_id") or "Unassigned")
        groups.append({
            "key": key,
            **_normalize_stats(group, total_key, include_completion),
        })
    return sorted(groups, key=lambda item: item["key"])


def build_dashboard_response(
    *,
    collection: Any,
    query: Mapping[str, Any],
    view: str,
    total_key: str,
    include_completion: bool = False,
    state_fields: Sequence[str] = ("workflowState",),
    completion_field: str = "completionPercentage",
    serialize_item: Callable[[dict], dict] | None = None,
    item_sort: Sequence[tuple[str, int]] | None = None,
    item_limit: int = 500,
    daily_group_field: str = "shift",
) -> dict:
    date_from, date_to = resolve_dashboard_date_range(view)
    start_date = date.fromisoformat(date_from)
    end_date = date.fromisoformat(date_to)

    project_stage: dict[str, Any] = {
        "_workflowState": _workflow_state_expression(state_fields),
        "_dashboardDate": {"$ifNull": ["$date", ""]},
        "_dashboardShift": {"$ifNull": ["$shift", "Unassigned"]},
    }
    daily_group_expression = "$date" if daily_group_field == "date" else f"${daily_group_field}"
    project_stage["_dashboardDailyGroup"] = {"$ifNull": [daily_group_expression, "Unassigned"]}
    if include_completion:
        project_stage["_completion"] = _completion_expression(completion_field)

    aggregate_result = list(collection.aggregate([
        {"$match": dict(query)},
        {"$project": project_stage},
        {
            "$facet": {
                "summary": [
                    {"$group": _group_spec(None, total_key, include_completion)},
                ],
                "dateGroups": [
                    {"$group": _group_spec("$_dashboardDate", total_key, include_completion)},
                ],
                "shiftGroups": [
                    {"$group": _group_spec("$_dashboardDailyGroup", total_key, include_completion)},
                ],
            }
        },
    ]))
    analytics = aggregate_result[0] if aggregate_result else {}
    summary = _normalize_stats(
        (analytics.get("summary") or [None])[0],
        total_key,
        include_completion,
    )

    if view == "daily":
        groups = _build_daily_groups(analytics.get("shiftGroups") or [], total_key, include_completion)
    else:
        groups = _build_calendar_groups(
            analytics.get("dateGroups") or [],
            start_date,
            end_date,
            total_key,
            include_completion,
        )

    items: list[dict] = []
    truncated = False
    if view == "daily" and serialize_item:
        raw_items = list(
            collection
            .find(dict(query))
            .sort(list(item_sort or [("date", -1), ("timestamp", -1)]))
            .limit(item_limit + 1)
        )
        truncated = len(raw_items) > item_limit
        items = [serialize_item(item) for item in raw_items[:item_limit]]

    return {
        "view": view,
        "dateFrom": date_from,
        "dateTo": date_to,
        "summary": summary,
        "groups": groups,
        "items": items,
        "total": summary[total_key],
        "truncated": truncated,
    }


def ensure_missing_completion_metadata(
    *,
    collection: Any,
    query: Mapping[str, Any],
    ensure_completion: Callable[[dict], dict],
    completion_fields: Sequence[str] = ("completedStages", "totalStages", "completionPercentage"),
) -> None:
    missing_completion_query = {
        "$or": [{field: {"$exists": False}} for field in completion_fields]
    }
    for document in collection.find(_combine_queries(query, missing_completion_query)):
        ensure_completion(document)
