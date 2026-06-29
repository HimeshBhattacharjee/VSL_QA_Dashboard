import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError, PyMongoError

from constants import MONGODB_DB_NAME
from models.peel_data_models import (
    PEEL_DATA_COLLECTION_NAME,
    ensure_peel_indexes,
    insert_manual_peel_record,
    month_number_from_abbreviation,
    peel_data_collection,
    serialize_peel_doc,
    serialize_peel_docs,
    update_manual_peel_record,
)

peel_router = APIRouter(prefix="/api/peel", tags=["Peel Test Data"], responses={404: {"description": "Not found"}})

SORT_FIELDS = {
    "year": "year",
    "month": "month",
    "date": "date",
    "shift": "shift",
    "machine": "machine",
    "module_type": "module_type",
    "cell_vendor": "cell_vendor",
    "po_number": "po_number",
    "file_name": "file_name",
    "updated_at": "updated_at",
    "last_extracted_at": "last_extracted_at",
}

ALLOWED_SHIFTS = {"A", "B", "C"}
AUDIT_PEEL_POSITION_COUNT = 16
AUDIT_PEEL_RIBBON_COUNT = 7
AUDIT_PEEL_SIDES = ("Front", "Back")
AUDIT_PEEL_SIDE_RESPONSE_KEYS = {
    "Front": "frontSide",
    "Back": "backSide",
}


def _normalize_month_filter(month: Optional[str]) -> Optional[str]:
    if not month:
        return None
    month_number = month_number_from_abbreviation(month)
    if month_number:
        return datetime(2000, month_number, 1).strftime("%b").upper()
    return str(month).strip().upper()[:3]


def _date_key(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return str(value).split("T")[0]


def _normalize_shift_filter(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    compact = str(value).strip().upper().replace("SHIFT", "").replace("-", "").strip()
    if compact not in ALLOWED_SHIFTS:
        raise HTTPException(status_code=400, detail="Shift must be one of Shift-A, Shift-B, or Shift-C")
    return compact


def _normalize_unit_key(value: Any) -> str:
    raw = str(value or "").strip().upper()
    if not raw:
        return ""
    return re.sub(r"^UNIT\s*-?\s*", "", raw).strip()


def _numeric_measurement(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _sample_result_measurements(record: Dict[str, Any], side: str, position: int) -> List[float]:
    sample_results = record.get("sample_results")
    if not isinstance(sample_results, list):
        return []

    values: List[float] = []
    for item in sample_results:
        if not isinstance(item, dict):
            continue
        if str(item.get("side") or "").strip().lower() != side.lower():
            continue
        try:
            bus_pad_position = int(item.get("bus_pad_position"))
        except (TypeError, ValueError):
            continue
        if bus_pad_position != position:
            continue
        numeric_value = _numeric_measurement(item.get("value"))
        if numeric_value is not None:
            values.append(numeric_value)
    return values


def _flat_measurements(record: Dict[str, Any], side: str, position: int) -> List[float]:
    values: List[float] = []
    for ribbon in range(1, AUDIT_PEEL_RIBBON_COUNT + 1):
        numeric_value = _numeric_measurement(record.get(f"{side}_{position}_{ribbon}"))
        if numeric_value is not None:
            values.append(numeric_value)
    return values


def _position_measurements(record: Dict[str, Any], side: str, position: int) -> List[float]:
    sample_values = _sample_result_measurements(record, side, position)
    if sample_values:
        return sample_values
    return _flat_measurements(record, side, position)


def _build_audit_side_values(record: Dict[str, Any], side: str) -> Dict[str, str]:
    side_values: Dict[str, str] = {}
    for position in range(1, AUDIT_PEEL_POSITION_COUNT + 1):
        values = _position_measurements(record, side, position)
        if values:
            side_values[str(position)] = f"{sum(values) / len(values):.2f}"
    return side_values


def _audit_stringer_key(record: Dict[str, Any]) -> Optional[str]:
    raw_stringer = record.get("Stringer", record.get("stringer"))
    try:
        return f"Stringer-{int(raw_stringer)}"
    except (TypeError, ValueError):
        return None


def _audit_projection() -> Dict[str, int]:
    projection = {
        "_id": 0,
        "Stringer": 1,
        "stringer": 1,
        "Unit": 1,
        "unit": 1,
        "sample_results": 1,
    }
    for side in AUDIT_PEEL_SIDES:
        for position in range(1, AUDIT_PEEL_POSITION_COUNT + 1):
            for ribbon in range(1, AUDIT_PEEL_RIBBON_COUNT + 1):
                projection[f"{side}_{position}_{ribbon}"] = 1
    return projection


def _build_query(
    *,
    year: Optional[int],
    month: Optional[str],
    date: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
    shift: Optional[str],
    machine: Optional[str],
    module_type: Optional[str],
    search: Optional[str],
) -> Dict[str, Any]:
    query: Dict[str, Any] = {}

    if year:
        query["year"] = year
    normalized_month = _normalize_month_filter(month)
    if normalized_month:
        query["month"] = normalized_month

    exact_date = _date_key(date)
    if exact_date:
        query["date"] = exact_date
    else:
        date_range: Dict[str, str] = {}
        if start_date:
            date_range["$gte"] = _date_key(start_date) or start_date
        if end_date:
            date_range["$lte"] = _date_key(end_date) or end_date
        if date_range:
            query["date"] = date_range

    normalized_shift = _normalize_shift_filter(shift)
    if normalized_shift:
        query["shift"] = {"$regex": f"^{re.escape(normalized_shift)}$", "$options": "i"}
    if machine:
        query["machine"] = {"$regex": re.escape(machine.strip()), "$options": "i"}
    if module_type:
        query["module_type"] = {"$regex": re.escape(module_type.strip()), "$options": "i"}
    if search:
        regex = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [
            {"date": regex},
            {"shift": regex},
            {"machine": regex},
            {"module_type": regex},
            {"cell_vendor": regex},
            {"po_number": regex},
            {"file_name": regex},
            {"source_path": regex},
            {"Date": regex},
            {"Shift": regex},
            {"Cell_Vendor": regex},
            {"PO": regex},
        ]

    return query


def _list_peel_records(
    *,
    year: Optional[int],
    month: Optional[str],
    date: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
    shift: Optional[str],
    machine: Optional[str],
    module_type: Optional[str],
    search: Optional[str],
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
) -> Dict[str, Any]:
    ensure_peel_indexes()
    query = _build_query(
        year=year,
        month=month,
        date=date,
        start_date=start_date,
        end_date=end_date,
        shift=shift,
        machine=machine,
        module_type=module_type,
        search=search,
    )
    sort_field = SORT_FIELDS.get(sort_by, "date")
    direction = ASCENDING if sort_order.lower() == "asc" else DESCENDING
    skip = (page - 1) * page_size

    total = peel_data_collection.count_documents(query)
    cursor = peel_data_collection.find(query).sort(sort_field, direction).skip(skip).limit(page_size)
    data = serialize_peel_docs(cursor)
    return {
        "status": "success",
        "collection": PEEL_DATA_COLLECTION_NAME,
        "filters": query,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size if page_size else 0,
        },
        "sort": {"sort_by": sort_field, "sort_order": "asc" if direction == ASCENDING else "desc"},
        "count": len(data),
        "data": data,
    }


@peel_router.get("/info")
async def peel_info():
    return {
        "message": "Peel Test Data API",
        "version": "2.0.0",
        "collection": PEEL_DATA_COLLECTION_NAME,
        "endpoints": {
            "GET /api/peel": "List peel test data with filters, pagination, sorting, and search",
            "GET /api/peel/{id}": "Get a single peel test record",
            "POST /api/peel": "Create a peel test record",
            "PUT /api/peel/{id}": "Update a peel test record",
            "DELETE /api/peel/{id}": "Delete a peel test record",
            "/audit/date/{date}/shift/{shift}": "Audit-ready peel strength values grouped by stringer and unit",
            "/date/{date}/shift/{shift}": "Compatibility endpoint for report generation",
            "/graph-data": "Compatibility endpoint for peel strength charts",
        },
    }


@peel_router.get("/health")
async def peel_health_check():
    try:
        ensure_peel_indexes()
        return {
            "status": "healthy",
            "database": MONGODB_DB_NAME,
            "collection": PEEL_DATA_COLLECTION_NAME,
            "document_count": peel_data_collection.count_documents({}),
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "error": str(exc),
            "timestamp": datetime.now().isoformat(),
        }


@peel_router.get("/collections")
async def get_collections():
    try:
        ensure_peel_indexes()
        years = list(
            peel_data_collection.aggregate(
                [
                    {"$match": {"year": {"$exists": True}}},
                    {"$group": {"_id": "$year", "count": {"$sum": 1}}},
                    {"$sort": {"_id": 1}},
                ]
            )
        )
        months = list(
            peel_data_collection.aggregate(
                [
                    {"$match": {"year": {"$exists": True}, "month": {"$exists": True}}},
                    {
                        "$group": {
                            "_id": {"year": "$year", "month": "$month", "month_name": "$month_name"},
                            "count": {"$sum": 1},
                        }
                    },
                    {"$sort": {"_id.year": 1, "_id.month": 1}},
                ]
            )
        )
        return {
            "status": "success",
            "collection": {
                "collection_name": PEEL_DATA_COLLECTION_NAME,
                "document_count": peel_data_collection.count_documents({}),
            },
            "years": [{"year": item["_id"], "document_count": item["count"]} for item in years],
            "months": [
                {
                    "year": item["_id"].get("year"),
                    "month": item["_id"].get("month"),
                    "month_name": item["_id"].get("month_name"),
                    "document_count": item["count"],
                }
                for item in months
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching peel metadata: {str(exc)}")


@peel_router.get("")
@peel_router.get("/")
async def get_peel_records(
    year: Optional[int] = Query(None),
    month: Optional[str] = Query(None, description="Month abbreviation or number"),
    date: Optional[str] = Query(None, description="Exact date in YYYY-MM-DD format"),
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    shift: Optional[str] = Query(None),
    machine: Optional[str] = Query(None),
    module_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: str = Query("date"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
):
    try:
        return _list_peel_records(
            year=year,
            month=month,
            date=date,
            start_date=start_date,
            end_date=end_date,
            shift=shift,
            machine=machine,
            module_type=module_type,
            search=search,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching peel data: {str(exc)}")


@peel_router.get("/data")
async def get_peel_data_compat(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    shift: Optional[str] = Query(None, description="Shift"),
    stringer: Optional[int] = Query(None, description="Stringer number"),
    unit: Optional[str] = Query(None, description="Unit"),
):
    try:
        query: Dict[str, Any] = {}
        if date:
            query["date"] = _date_key(date)
        normalized_shift = _normalize_shift_filter(shift)
        if normalized_shift:
            query["shift"] = {"$regex": f"^{re.escape(normalized_shift)}$", "$options": "i"}
        if stringer:
            query["$or"] = [{"Stringer": stringer}, {"stringer": stringer}]
        if unit:
            query["Unit"] = {"$regex": f"^{re.escape(unit.strip())}$", "$options": "i"}

        results = serialize_peel_docs(peel_data_collection.find(query).sort("date", ASCENDING))
        return {"status": "success", "filters": query, "count": len(results), "data": results}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(exc)}")


@peel_router.get("/date/{date}/shift/{shift}")
async def get_data_by_date_and_shift(date: str, shift: str):
    try:
        normalized_shift = _normalize_shift_filter(shift)
        query = {
            "date": _date_key(date),
            "shift": {"$regex": f"^{re.escape(normalized_shift or '')}$", "$options": "i"},
        }
        results = serialize_peel_docs(peel_data_collection.find(query).sort([("Stringer", ASCENDING), ("Unit", ASCENDING)]))
        return {
            "status": "success",
            "date": _date_key(date),
            "shift": normalized_shift,
            "count": len(results),
            "data": results,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(exc)}")


@peel_router.get("/audit/date/{date}/shift/{shift}")
async def get_audit_peel_data_by_date_and_shift(date: str, shift: str):
    try:
        ensure_peel_indexes()
        normalized_shift = _normalize_shift_filter(shift)
        query = {
            "date": _date_key(date),
            "shift": {"$regex": f"^{re.escape(normalized_shift or '')}$", "$options": "i"},
        }
        cursor = peel_data_collection.find(query, _audit_projection()).sort(
            [("Stringer", ASCENDING), ("Unit", ASCENDING), ("updated_at", DESCENDING)]
        )

        grouped_data: Dict[str, Dict[str, Dict[str, Dict[str, str]]]] = {}
        record_count = 0
        for record in cursor:
            record_count += 1
            stringer_key = _audit_stringer_key(record)
            unit_key = _normalize_unit_key(record.get("Unit", record.get("unit")))
            if not stringer_key or not unit_key:
                continue

            unit_data = grouped_data.setdefault(stringer_key, {}).setdefault(
                unit_key,
                {"frontSide": {}, "backSide": {}},
            )
            for side in AUDIT_PEEL_SIDES:
                side_key = AUDIT_PEEL_SIDE_RESPONSE_KEYS[side]
                side_values = _build_audit_side_values(record, side)
                for position, value in side_values.items():
                    unit_data[side_key].setdefault(position, value)

        unit_count = sum(len(units) for units in grouped_data.values())
        return {
            "status": "success",
            "date": _date_key(date),
            "shift": normalized_shift,
            "record_count": record_count,
            "count": unit_count,
            "data": grouped_data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching audit peel data: {str(exc)}")


@peel_router.get("/graph-data")
async def get_graph_data(
    month: str = Query(..., description="Three-letter month abbreviation or month number"),
    year: int = Query(..., description="Four-digit year"),
    stringer: int = Query(..., description="Stringer number"),
    cell_face: str = Query(..., description="Cell face: 'front', 'back', or 'both'"),
):
    try:
        normalized_month = _normalize_month_filter(month)
        if not normalized_month:
            raise HTTPException(status_code=400, detail="Invalid month")
        if stringer < 1 or stringer > 99:
            raise HTTPException(status_code=400, detail="Stringer must be a positive number")

        cell_face = cell_face.lower()
        if cell_face not in {"front", "back", "both"}:
            raise HTTPException(status_code=400, detail="Cell face must be 'front', 'back', or 'both'")

        query_filter: Dict[str, Any] = {
            "year": year,
            "month": normalized_month,
            "$or": [
                {"Stringer": stringer},
                {"stringer": stringer},
                {"machine": {"$regex": f"STRINGER\\s*-?\\s*{stringer}(\\D|$)", "$options": "i"}},
            ],
        }
        results = list(peel_data_collection.find(query_filter, {"_id": 0}))

        if not results:
            return {
                "status": "success",
                "message": f"No data available for stringer {stringer} in {normalized_month} {year}",
                "month": normalized_month.lower(),
                "year": year,
                "stringer": stringer,
                "cell_face": cell_face,
                "data": [],
            }

        date_data: Dict[str, list] = {}
        for record in results:
            record_date = record.get("date") or record.get("Date")
            if record_date not in date_data:
                date_data[record_date] = []
            date_data[record_date].append(record)

        graph_data = []
        for record_date, records in sorted(date_data.items()):
            daily_averages = []
            max_values = []
            min_values = []

            for record in records:
                row_averages = []
                front_row_averages = []
                back_row_averages = []

                if cell_face in {"front", "both"}:
                    front_positions: Dict[int, list] = {}
                    for key, value in record.items():
                        if not str(key).lower().startswith("front_") or not isinstance(value, (int, float)):
                            continue
                        parts = str(key).split("_")
                        if len(parts) >= 3 and parts[1].isdigit():
                            front_positions.setdefault(int(parts[1]), []).append(value)
                    for values in front_positions.values():
                        if values:
                            row_avg = sum(values) / len(values)
                            front_row_averages.append(row_avg)
                            row_averages.append(row_avg)

                if cell_face in {"back", "both"}:
                    back_positions: Dict[int, list] = {}
                    for key, value in record.items():
                        if not str(key).lower().startswith("back_") or not isinstance(value, (int, float)):
                            continue
                        parts = str(key).split("_")
                        if len(parts) >= 3 and parts[1].isdigit():
                            back_positions.setdefault(int(parts[1]), []).append(value)
                    for values in back_positions.values():
                        if values:
                            row_avg = sum(values) / len(values)
                            back_row_averages.append(row_avg)
                            row_averages.append(row_avg)

                if not row_averages:
                    continue

                daily_averages.append(sum(row_averages) / len(row_averages))
                if cell_face == "both" and front_row_averages and back_row_averages:
                    max_values.append((max(front_row_averages) + max(back_row_averages)) / 2)
                    min_values.append((min(front_row_averages) + min(back_row_averages)) / 2)
                elif cell_face == "front" and front_row_averages:
                    max_values.append(max(front_row_averages))
                    min_values.append(min(front_row_averages))
                elif cell_face == "back" and back_row_averages:
                    max_values.append(max(back_row_averages))
                    min_values.append(min(back_row_averages))

            graph_data.append(
                {
                    "date": record_date,
                    "average_value": round(sum(daily_averages) / len(daily_averages), 2) if daily_averages else None,
                    "max_value": round(max(max_values), 2) if max_values else None,
                    "min_value": round(min(min_values), 2) if min_values else None,
                    "record_count": len(records),
                    "unit_count": len(set(record.get("Unit") or record.get("unit") or "" for record in records)),
                }
            )

        return {
            "status": "success",
            "month": normalized_month.lower(),
            "year": year,
            "stringer": stringer,
            "cell_face": cell_face,
            "total_days": len(graph_data),
            "data": graph_data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching graph data: {str(exc)}")


@peel_router.get("/{record_id}")
async def get_peel_record(record_id: str):
    try:
        if not ObjectId.is_valid(record_id):
            raise HTTPException(status_code=400, detail="Invalid peel record ID")
        record = peel_data_collection.find_one({"_id": ObjectId(record_id)})
        if not record:
            raise HTTPException(status_code=404, detail="Peel record not found")
        return {"status": "success", "data": serialize_peel_doc(record)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching peel record: {str(exc)}")


@peel_router.post("")
@peel_router.post("/")
async def create_peel_record(record_data: dict):
    try:
        created = insert_manual_peel_record(record_data)
        return {"status": "success", "message": "Peel record created", "data": serialize_peel_doc(created)}
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="A peel record with the same business key already exists")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"MongoDB error creating peel record: {str(exc)}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error creating peel record: {str(exc)}")


@peel_router.put("/{record_id}")
async def update_peel_record(record_id: str, record_data: dict):
    try:
        updated = update_manual_peel_record(record_id, record_data)
        if not updated:
            raise HTTPException(status_code=404, detail="Peel record not found")
        return {"status": "success", "message": "Peel record updated", "data": serialize_peel_doc(updated)}
    except HTTPException:
        raise
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="A peel record with the same business key already exists")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"MongoDB error updating peel record: {str(exc)}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error updating peel record: {str(exc)}")


@peel_router.delete("/{record_id}")
async def delete_peel_record(record_id: str):
    try:
        if not ObjectId.is_valid(record_id):
            raise HTTPException(status_code=400, detail="Invalid peel record ID")
        result = peel_data_collection.delete_one({"_id": ObjectId(record_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Peel record not found")
        return {"status": "success", "message": "Peel record deleted"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error deleting peel record: {str(exc)}")
