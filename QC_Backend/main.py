from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from datetime import datetime
import uvicorn
import threading
import os
from constants import SERVER_URL, PORT
from routes.qa_route import qa_router
from routes.bGrade_route import bgrade_router
from routes.peel_route import peel_router
from routes.user_route import user_router
from routes.gel_route import gel_router, get_gel_current_user, require_gel_export_access
from routes.adhesion_route import adhesion_router, get_adhesion_current_user, require_adhesion_export_access
from routes.potting_ratio_route import potting_router
from routes.jb_sealant_wt_route import jb_sealant_router
from routes.frame_sealant_wt_route import frame_sealant_router
from routes.bus_ribbon_pull_strength_route import bus_ribbon_pull_strength_router
from routes.peel_strength_bus_ribbon_jb_soldering_route import peel_strength_bus_ribbon_jb_router
from routes.jb_contact_block_maintenance_route import jb_contact_block_maintenance_router
from routes.stringer_parameter_report_route import stringer_parameter_report_router
from routes.ssh_route import ssh_router
from routes.peel_test_route import peel_test_router, get_peel_current_user, require_peel_export_access
from routes.rot_route import rot_router
from routes.task_routes import task_router
from routes.goal_routes import goal_router
from routes.wet_leakage_route import wet_leakage_router
from routes.ipqc_audit_route import ipqc_audit_router, get_ipqc_current_user, require_ipqc_export_access
from generators.AuditReportGenerator import generate_audit_report
from generators.GelReportGenerator import generate_gel_report
from generators.AdhesionReportGenerator import generate_adhesion_report
from generators.PottingRatioReportGenerator import generate_potting_report
from generators.JBSealantWeightReportGenerator import generate_jb_sealant_report
from generators.SSHReportGenerator import generate_ssh_report
from generators.PeelReportGenerator import generate_peel_report
from generators.RoTReportGenerator import generate_rot_report
from generators.WetLeakageReportGenerator import generate_wet_leakage_report

app = FastAPI(
    title="Manufacturing Analytics API",
    description="Combined API for Quality Analysis, B-Grade Trend data, Peel Test results, User Management, Task Management, and Audit Reports",
    version="1.0.0"
)

cors_env = os.getenv("CORS_ORIGINS", "")
if cors_env:
    parsed_origins = [o.strip() for o in cors_env.split(",") if o.strip()]
else:
    parsed_origins = []

app.add_middleware(
    CORSMiddleware,
    allow_origins=parsed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(qa_router)
app.include_router(bgrade_router)
app.include_router(peel_router)
app.include_router(user_router)
app.include_router(gel_router)
app.include_router(adhesion_router)
app.include_router(potting_router)
app.include_router(jb_sealant_router)
app.include_router(frame_sealant_router)
app.include_router(bus_ribbon_pull_strength_router)
app.include_router(peel_strength_bus_ribbon_jb_router)
app.include_router(jb_contact_block_maintenance_router)
app.include_router(stringer_parameter_report_router)
app.include_router(ssh_router)
app.include_router(peel_test_router)
app.include_router(rot_router)
app.include_router(task_router)
app.include_router(goal_router)
app.include_router(wet_leakage_router)
app.include_router(ipqc_audit_router)

_extractors_started = False

@app.post("/api/ipqc-audits/generate-audit-report")
async def generate_audit_report_endpoint(request: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_ipqc_current_user(x_employee_id)
        audit_id = request.get("audit_id")
        
        if audit_id:
            # Saved report export - fetch from S3
            from models.ipqc_audit_models import ipqc_audit_collection, IPQCAudit
            from bson import ObjectId

            if not ObjectId.is_valid(audit_id):
                raise HTTPException(status_code=400, detail="Invalid audit ID")

            audit = ipqc_audit_collection.find_one({"_id": ObjectId(audit_id)})
            if not audit:
                raise HTTPException(status_code=404, detail="Audit not found")
            require_ipqc_export_access(audit, user)

            # Fetch data from S3
            ipqc_audit = IPQCAudit.from_dict(audit)
            audit_data = ipqc_audit.to_dict(include_data=True)

            # Prepare data for report generation
            s3_data = audit_data.get("data", {})
            report_data = s3_data.copy()
            report_data["name"] = audit["name"]
        else:
            raise HTTPException(status_code=403, detail="Audit Excel can be generated only from submitted saved checksheets")

        output, filename = generate_audit_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating audit report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.post("/api/gel-test-reports/generate-gel-report")
async def generate_gel_report_endpoint(request: dict, x_employee_id: str | None = Header(default=None)):
    try:
        report_id = request.get("report_id")
        
        if report_id:
            # Saved report export - fetch from S3
            from models.gel_test_models import gel_test_collection, GelTestReport
            from bson import ObjectId

            if not ObjectId.is_valid(report_id):
                raise HTTPException(status_code=400, detail="Invalid report ID")

            report = gel_test_collection.find_one({"_id": ObjectId(report_id)})
            if not report:
                raise HTTPException(status_code=404, detail="Report not found")
            user = get_gel_current_user(x_employee_id)
            require_gel_export_access(report, user)

            # Fetch data from S3
            gel_report = GelTestReport.from_dict(report)
            gel_data = gel_report.to_dict(include_data=True)

            # Prepare data for report generation
            report_data = {
                "form_data": gel_data.get("form_data", {}),
                "averages": gel_data.get("averages", {}),
                "name": report["name"]
            }
        else:
            raise HTTPException(status_code=403, detail="Gel Excel can be generated only from submitted or approved saved reports")

        output, filename = generate_gel_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating gel test report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
    
@app.post("/api/adhesion-test-reports/generate-adhesion-report")
async def generate_adhesion_report_endpoint(request: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_adhesion_current_user(x_employee_id)
        report_id = request.get("report_id")
        
        if report_id:
            # Saved report export - fetch from S3
            from models.adhesion_test_models import adhesion_test_collection, AdhesionTestReport
            from bson import ObjectId

            if not ObjectId.is_valid(report_id):
                raise HTTPException(status_code=400, detail="Invalid report ID")

            report = adhesion_test_collection.find_one({"_id": ObjectId(report_id)})
            if not report:
                raise HTTPException(status_code=404, detail="Report not found")
            require_adhesion_export_access(report, user)

            # Fetch data from S3
            adhesion_report = AdhesionTestReport.from_dict(report)
            adhesion_data = adhesion_report.to_dict(include_data=True)

            # Prepare data for report generation
            report_data = {
                "form_data": adhesion_data.get("form_data", {}),
                "averages": adhesion_data.get("averages", {}),
                "name": report["name"]
            }
        else:
            raise HTTPException(status_code=403, detail="Adhesion Excel can be generated only from submitted or approved saved reports")

        output, filename = generate_adhesion_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating adhesion test report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.post("/api/ssh-test-reports/generate-ssh-report")
async def generate_ssh_report_endpoint(request: dict):
    try:
        report_data = {
            "form_data": request.get("form_data", {}),
            "entries": request.get("entries", []),
            "name": request.get("report_name", "SSH_Test_Report"),
        }
        output, filename = generate_ssh_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating SSH test report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
    
@app.post("/api/potting-ratio-reports/generate-potting-report")
async def generate_potting_report_endpoint(request: dict):
    try:
        report_data = {
            "entries": request.get("entries", []),
            "year": request.get("year", datetime.now().year),
            "month": request.get("month", datetime.now().month),
            "name": request.get("report_name", "Potting_Ratio_Report")
        }
        output, filename = generate_potting_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating potting ratio report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
    
@app.post("/api/jb-sealant-weight-reports/generate-jb-sealant-report")
async def generate_jb_sealant_report_endpoint(request: dict):
    try:
        report_data = {
            "entries": request.get("entries", []),
            "year": request.get("year", datetime.now().year),
            "month": request.get("month", datetime.now().month),
            "name": request.get("report_name", "JB_Sealant_Weight_Report")
        }
        output, filename = generate_jb_sealant_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating JB sealant weight report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.post("/api/peel/generate-peel-report")
async def generate_peel_report_endpoint(request: dict, x_employee_id: str | None = Header(default=None)):
    try:
        user = get_peel_current_user(x_employee_id)
        report_id = request.get("report_id")
        
        if report_id:
            # Saved report export - fetch from S3
            from models.peel_test_models import peel_test_collection, PeelTestReport
            from bson import ObjectId

            if not ObjectId.is_valid(report_id):
                raise HTTPException(status_code=400, detail="Invalid report ID")

            report = peel_test_collection.find_one({"_id": ObjectId(report_id)})
            if not report:
                raise HTTPException(status_code=404, detail="Report not found")
            require_peel_export_access(report, user)

            # Fetch data from S3
            peel_report = PeelTestReport.from_dict(report)
            peel_data = peel_report.to_dict(include_data=True)

            # Prepare data for report generation
            report_data = {
                "form_data": peel_data.get("form_data", {}),
                "row_data": peel_data.get("row_data", []),
                "averages": peel_data.get("averages", {}),
                "name": report["name"],
                "line": report.get("line")
            }
        else:
            raise HTTPException(status_code=403, detail="Peel Excel can be generated only from submitted or approved saved reports")

        output, filename = generate_peel_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating peel test report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.post("/api/rot-test-reports/generate-rot-report")
async def generate_rot_report_endpoint(request: dict):
    try:
        report_data = {
            "form_data": request.get("form_data", {}),
            "entries": request.get("entries", []),
            "name": request.get("report_name", "RoT_Test_Report")
        }
        output, filename = generate_rot_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating RoT test report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
    
@app.post("/api/wet-leakage-test-reports/generate-wet-leakage-report")
async def generate_wet_leakage_report_endpoint(request: dict):
    try:
        report_data = {
            "form_data": request.get("form_data", {}),
            "entries": request.get("entries", []),
            "name": request.get("report_name", "Wet_Leakage_Test_Report")
        }
        output, filename = generate_wet_leakage_report(report_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating Wet Leakage test report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.get("/")
async def root():
    return {
        "message": "Manufacturing Analytics API",
        "version": "1.0.0",
        "apis": {
            "quality_analysis": {
                "base_path": "/qa",
                "description": "Quality Analysis data for production lines"
            },
            "b_grade_trend": {
                "base_path": "/bgrade", 
                "description": "B-Grade trend analysis data"
            },
            "peel_test": {
                "base_path": "/peel",
                "description": "Peel test data for solar cell manufacturing"
            },
            "user_management": {
                "base_path": "/user",
                "description": "User management and authentication"
            },
            "task_management": {
                "base_path": "/api/tasks",
                "description": "Task management board data stored in MongoDB"
            },
            "gel_test_reports": {
                "base_path": "/api/gel-test-reports",
                "description": "Gel test reports management with MongoDB"
            },
            "audit_reports": {
                "base_path": "/generate-audit-report",
                "description": "Generate audit reports"
            },
            "gel_test_reports": {
                "base_path": "/generate-gel-report",
                "description": "Generate gel test reports"
            },
            "adhesion_test_reports": {
                "base_path": "/api/adhesion-test-reports",
                "description": "Adhesion test reports management with MongoDB"
            },
            "adhesion_report_generation": {
                "base_path": "/generate-adhesion-report",
                "description": "Generate adhesion test reports"
            },
            "potting_ratio_report_generation": {
                "base_path": "/generate-potting-report",
                "description": "Generate potting ratio test reports"
            },
            "jb_sealant_weight_reports": {
                "base_path": "/api/jb-sealant-weight-reports",
                "description": "JB Sealant Weight reports management with MongoDB"
            },
            "jb_sealant_weight_report_generation": {
                "base_path": "/generate-jb-sealant-report",
                "description": "Generate JB sealant weight test reports"
            },
            "bus_ribbon_pull_strength_reports": {
                "base_path": "/api/bus-ribbon-pull-strength-reports",
                "description": "Bus Ribbon to INTC Ribbon Pull Strength reports management with MongoDB"
            },
            "bus_ribbon_pull_strength_report_generation": {
                "base_path": "/api/bus-ribbon-pull-strength-reports/export/excel",
                "description": "Generate bus ribbon pull strength test reports"
            },
            "peel_strength_bus_ribbon_jb_soldering_reports": {
                "base_path": "/api/peel-strength-bus-ribbon-jb-soldering-reports",
                "description": "Peel Strength of Bus Ribbon to JB Soldering reports management with MongoDB"
            },
            "peel_strength_bus_ribbon_jb_soldering_report_generation": {
                "base_path": "/api/peel-strength-bus-ribbon-jb-soldering-reports/export/excel",
                "description": "Generate peel strength of bus ribbon to JB soldering test reports"
            },
            "jb_contact_block_maintenance_reports": {
                "base_path": "/api/jb-contact-block-maintenance-reports",
                "description": "JB Contact Block Maintenance reports management with MongoDB"
            },
            "jb_contact_block_maintenance_report_generation": {
                "base_path": "/api/jb-contact-block-maintenance-reports/export/excel",
                "description": "Generate JB contact block maintenance reports"
            },
            "peel_test_reports": {
                "base_path": "/generate-peel-report",
                "description": "Generate peel test reports"
            },
            "rot_test_reports": {
                "base_path": "/api/rot-test-reports",
                "description": "Robustness of Termination test reports management with MongoDB"
            },
            "rot_report_generation": {
                "base_path": "/generate-rot-report",
                "description": "Generate RoT test reports"
            }
        },
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc"
        }
    }

def run_extractors():
    """Run all data extractors in background threads"""
    global _extractors_started
    if _extractors_started:
        return
    _extractors_started = True

    def run_qa():
        try:
            from extractors.qa_extractor import main as qa_main
            qa_main()
        except Exception as e:
            print(f"QA extractor failed: {e}")
    
    def run_b():
        try:
            from extractors.b_extractor import main as b_main
            b_main()
        except Exception as e:
            print(f"B-grade extractor failed: {e}")

    qa_thread = threading.Thread(target=run_qa, daemon=True)
    b_thread = threading.Thread(target=run_b, daemon=True)

    qa_thread.start()
    b_thread.start()

    try:
        from services.peel_scheduler import start_peel_scheduler
        start_peel_scheduler(run_immediately=True)
    except Exception as e:
        print(f"Peel scheduler failed to start: {e}")

    try:
        from services.calibration_scheduler import start_calibration_scheduler
        start_calibration_scheduler(run_immediately=True)
    except Exception as e:
        print(f"Calibration scheduler failed to start: {e}")

    print("Data extractors, peel scheduler, and calibration scheduler started in background threads")


@app.on_event("startup")
async def start_background_extractors():
    if os.getenv("DISABLE_BACKGROUND_EXTRACTORS", "false").lower() in {"1", "true", "yes"}:
        return
    run_extractors()

@app.get("/health")
async def global_health_check():
    health_status = {
        "status": "all_services_running",
        "timestamp": datetime.now().isoformat(),
        "platform": "Linux",
        "templates_source": "AWS S3",
        "services": {
            "quality_analysis": "available",
            "b_grade_trend": "available",
            "peel_test": "available",
            "user_management": "available",
            "task_management": "available",
            "audit_reports": "available",
            "audit_pdf_reports": "available",
            "gel_test_reports": "available",
            "adhesion_test_reports": "available",
            "jb_sealant_weight_reports": "available",
            "bus_ribbon_pull_strength_reports": "available",
            "peel_strength_bus_ribbon_jb_soldering_reports": "available",
            "jb_contact_block_maintenance_reports": "available",
            "calibration_extractor": "available",
            "peel_test_reports": "available"
        }
    }
    return health_status

if __name__ == "__main__":
    uvicorn.run("main:app", host=SERVER_URL, port=int(PORT), reload=True)
