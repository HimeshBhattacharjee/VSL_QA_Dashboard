from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from generators.StringerParameterReportGenerator import generate_stringer_parameter_report
from routes.ipqc_audit_route import get_ipqc_current_user
from services.stringer_parameter_report_service import (
    MANUAL_FIELDS,
    normalize_report_line,
    synchronize_month_report,
    update_manual_fields,
)


stringer_parameter_report_router = APIRouter(
    prefix="/api/stringer-parameter-reports",
    tags=["Stringer Parameter Reports"],
)

IPQC_REPORT_ROLES = {"Operator", "Supervisor", "Manager", "Admin", "System Administrator"}


def require_report_access(employee_id: str | None) -> dict:
    user = get_ipqc_current_user(employee_id)
    if user.get("role") not in IPQC_REPORT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access Stringer Parameter Reports",
        )
    return user


def validate_period(year: int, month: int) -> None:
    if year < 2020 or year > 2100:
        raise HTTPException(status_code=400, detail="Year must be between 2020 and 2100")
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")


def parse_period_payload(payload: dict) -> tuple[int, int]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Year and month are required")
    if payload.get("year") in (None, "") or payload.get("month") in (None, ""):
        raise HTTPException(status_code=400, detail="Year and month are required")
    try:
        year = int(payload.get("year"))
        month = int(payload.get("month"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Year and month are required")
    validate_period(year, month)
    return year, month


@stringer_parameter_report_router.get("/monthly")
async def get_monthly_stringer_parameter_report(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    line: str = Query(...),
    refresh: bool = Query(False),
    x_employee_id: str | None = Header(default=None),
):
    try:
        require_report_access(x_employee_id)
        validate_period(year, month)
        report = synchronize_month_report(
            year,
            month,
            normalize_report_line(line),
            force_refresh=refresh,
        )
        return {"success": True, "data": report}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load Stringer Parameter Report: {exc}")


@stringer_parameter_report_router.put("/manual-fields")
async def save_stringer_parameter_manual_fields(
    payload: dict,
    x_employee_id: str | None = Header(default=None),
):
    try:
        user = require_report_access(x_employee_id)
        year, month = parse_period_payload(payload)
        line = normalize_report_line(payload.get("line"))
        changes = payload.get("changes")
        if not isinstance(changes, list):
            raise HTTPException(status_code=400, detail="Changes must be a list")

        normalized_changes = []
        for change in changes:
            if not isinstance(change, dict) or not change.get("rowKey"):
                continue
            normalized_changes.append({
                "rowKey": str(change["rowKey"]),
                **{
                    field: str(change.get(field) or "")
                    for field in MANUAL_FIELDS
                    if field in change
                },
            })

        report = update_manual_fields(
            year,
            month,
            line,
            normalized_changes,
            updated_by=user["name"],
        )
        return {
            "success": True,
            "message": "Manual fields saved successfully",
            "data": report,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save manual fields: {exc}")


@stringer_parameter_report_router.post("/refresh")
async def refresh_stringer_parameter_report(
    payload: dict,
    x_employee_id: str | None = Header(default=None),
):
    try:
        require_report_access(x_employee_id)
        year, month = parse_period_payload(payload)
        line = normalize_report_line(payload.get("line"))
        report = synchronize_month_report(year, month, line, force_refresh=True)
        return {
            "success": True,
            "message": "Report refreshed from IPQC audits",
            "data": report,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to refresh report: {exc}")


@stringer_parameter_report_router.post("/export/excel")
async def export_stringer_parameter_report(
    payload: dict,
    x_employee_id: str | None = Header(default=None),
):
    try:
        require_report_access(x_employee_id)
        year, month = parse_period_payload(payload)
        line = normalize_report_line(payload.get("line"))
        report = synchronize_month_report(year, month, line)
        output, filename = generate_stringer_parameter_report(report)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to export Stringer Parameter Report: {exc}")
