from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import datetime
import threading
import os
from constants import SERVER_URL, PORT
from routes.qa_route import qa_router
from routes.bGrade_route import bgrade_router
from routes.peel_route import peel_router
from routes.user_route import user_router
from routes.gel_route import gel_router
from routes.peel_test_route import peel_test_router
from routes.ipqc_audit_route import ipqc_audit_router
from generators.AuditReportGenerator import generate_audit_report
from generators.GelReportGenerator import generate_gel_report
from generators.PeelReportGenerator import generate_peel_report
from extractors.qa_extractor import main as qa_main
from extractors.b_extractor import main as b_main
from extractors.peel_extractor import main as peel_main

app = FastAPI(
    title="Manufacturing Analytics API",
    description="Combined API for Quality Analysis, B-Grade Trend data, Peel Test results, User Management, and Audit Reports",
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
app.include_router(peel_test_router)
app.include_router(ipqc_audit_router)

@app.post("/api/ipqc-audits/generate-audit-report")
async def generate_audit_report_endpoint(request: dict):
    try:
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

            # Fetch data from S3
            ipqc_audit = IPQCAudit.from_dict(audit)
            audit_data = ipqc_audit.to_dict(include_data=True)

            # Prepare data for report generation
            s3_data = audit_data.get("data", {})
            report_data = s3_data.copy()
            report_data["name"] = audit["name"]
        else:
            # Current report export - use data from request
            report_data = request.copy()
            if "audit_id" in report_data:
                del report_data["audit_id"]

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
async def generate_gel_report_endpoint(request: dict):
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
            # Current report export - use data from request
            report_data = {
                "form_data": request.get("form_data", {}),
                "averages": request.get("averages", {}),
                "name": request.get("report_name", "Gel_Test_Report")
            }

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

@app.post("/api/peel/generate-peel-report")
async def generate_peel_report_endpoint(request: dict):
    try:
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

            # Fetch data from S3
            peel_report = PeelTestReport.from_dict(report)
            peel_data = peel_report.to_dict(include_data=True)

            # Prepare data for report generation
            report_data = {
                "form_data": peel_data.get("form_data", {}),
                "row_data": peel_data.get("row_data", []),
                "averages": peel_data.get("averages", {}),
                "name": report["name"]
            }
        else:
            # Current report export - use data from request
            report_data = {
                "form_data": request.get("form_data", {}),
                "row_data": request.get("row_data", []),
                "averages": request.get("averages", {}),
                "name": request.get("report_name", "Peel_Test_Report")
            }

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
            "peel_test_reports": {
                "base_path": "/generate-peel-report",
                "description": "Generate peel test reports"
            }
        },
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc"
        }
    }

def run_extractors():
    """Run all data extractors in background threads"""
    def run_qa():
        try:
            qa_main()
        except Exception as e:
            print(f"QA extractor failed: {e}")
    
    def run_b():
        try:
            b_main()
        except Exception as e:
            print(f"B-grade extractor failed: {e}")
    
    def run_peel():
        try:
            peel_main()
        except Exception as e:
            print(f"Peel extractor failed: {e}")
    
    qa_thread = threading.Thread(target=run_qa, daemon=True)
    peel_thread = threading.Thread(target=run_peel, daemon=True)
    b_thread = threading.Thread(target=run_b, daemon=True)
    
    qa_thread.start()
    peel_thread.start()
    b_thread.start()
    
    print("Data extractors started in background threads")

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
            "audit_reports": "available",
            "audit_pdf_reports": "available",
            "gel_test_reports": "available",
            "peel_test_reports": "available"
        }
    }
    return health_status

if __name__ == "__main__":
    run_extractors()    
    uvicorn.run("main:app", host=SERVER_URL, port=int(PORT), reload=True)