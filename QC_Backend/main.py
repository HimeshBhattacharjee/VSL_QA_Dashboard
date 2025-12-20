from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import tempfile
import os
import io
from win32com import client as win32client
import pythoncom
import threading
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
                'Access-Control-Allow-Origin': '*',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating audit report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.post("/api/ipqc-audits/generate-audit-pdf")
async def generate_audit_pdf_endpoint(request: dict):
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

        excel_output, filename = generate_audit_report(report_data)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_excel:
            temp_excel.write(excel_output.getvalue())
            temp_excel_path = temp_excel.name
        pdf_filename = filename.replace('.xlsx', '.pdf')
        temp_pdf_path = tempfile.mktemp(suffix='.pdf')
        try:
            pythoncom.CoInitialize()
            excel_app = win32client.Dispatch("Excel.Application")
            excel_app.Visible = False
            excel_app.DisplayAlerts = False
            workbook = excel_app.Workbooks.Open(temp_excel_path)
            for worksheet in workbook.Worksheets:
                worksheet.PageSetup.Orientation = 2
                worksheet.PageSetup.Zoom = False
                worksheet.PageSetup.FitToPagesWide = 1
                worksheet.PageSetup.FitToPagesTall = False
            workbook.ExportAsFixedFormat(0, temp_pdf_path) # 0 = xlTypePDF
            workbook.Close()
            excel_app.Quit()
            with open(temp_pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()
            pythoncom.CoUninitialize()
            return StreamingResponse(io.BytesIO(pdf_content), media_type='application/pdf',
                headers={
                    'Content-Disposition': f'attachment; filename="{pdf_filename}"',
                    'Access-Control-Allow-Origin': '*',
                }
            )
        finally:
            try:
                if os.path.exists(temp_excel_path):
                    os.unlink(temp_excel_path)
                if os.path.exists(temp_pdf_path):
                    os.unlink(temp_pdf_path)
            except Exception as cleanup_error:
                print(f"Warning: Error cleaning up temporary files: {cleanup_error}")
    except Exception as e:
        print(f"Error generating audit PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

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
                'Access-Control-Allow-Origin': '*',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating gel test report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
    
@app.post("/api/gel-test-reports/generate-gel-pdf")
async def generate_gel_pdf_endpoint(request: dict):
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

        excel_output, filename = generate_gel_report(report_data)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_excel:
            temp_excel.write(excel_output.getvalue())
            temp_excel_path = temp_excel.name
        pdf_filename = filename.replace('.xlsx', '.pdf')
        temp_pdf_path = tempfile.mktemp(suffix='.pdf')
        try:
            pythoncom.CoInitialize()
            excel_app = win32client.Dispatch("Excel.Application")
            excel_app.Visible = False
            excel_app.DisplayAlerts = False
            workbook = excel_app.Workbooks.Open(temp_excel_path)
            for worksheet in workbook.Worksheets:
                worksheet.PageSetup.Orientation = 2  # 2 = xlLandscape, 1 = xlPortrait
                worksheet.PageSetup.LeftMargin = 40
                worksheet.PageSetup.RightMargin = 40
                worksheet.PageSetup.TopMargin = 40
                worksheet.PageSetup.BottomMargin = 40
                worksheet.PageSetup.Zoom = False
                worksheet.PageSetup.FitToPagesWide = 1
                worksheet.PageSetup.FitToPagesTall = 1
            workbook.ExportAsFixedFormat(0, temp_pdf_path)  # 0 = xlTypePDF
            workbook.Close()
            excel_app.Quit()
            with open(temp_pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()
            pythoncom.CoUninitialize()
            return StreamingResponse(io.BytesIO(pdf_content), media_type='application/pdf',
                headers={
                    'Content-Disposition': f'attachment; filename="{pdf_filename}"',
                    'Access-Control-Allow-Origin': '*',
                }
            )
        finally:
            try:
                if os.path.exists(temp_excel_path):
                    os.unlink(temp_excel_path)
                if os.path.exists(temp_pdf_path):
                    os.unlink(temp_pdf_path)
            except Exception as cleanup_error:
                print(f"Warning: Error cleaning up temporary files: {cleanup_error}")
    except Exception as e:
        print(f"Error generating gel test PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

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
                'Access-Control-Allow-Origin': '*',
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating peel test report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.post("/api/peel/generate-peel-pdf")
async def generate_peel_pdf_endpoint(request: dict):
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

        excel_output, filename = generate_peel_report(report_data)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_excel:
            temp_excel.write(excel_output.getvalue())
            temp_excel_path = temp_excel.name
        pdf_filename = filename.replace('.xlsx', '.pdf')
        temp_pdf_path = tempfile.mktemp(suffix='.pdf')
        try:
            pythoncom.CoInitialize()
            excel_app = win32client.Dispatch("Excel.Application")
            excel_app.Visible = False
            excel_app.DisplayAlerts = False
            workbook = excel_app.Workbooks.Open(temp_excel_path)
            for worksheet in workbook.Worksheets:
                worksheet.PageSetup.Orientation = 1
                worksheet.PageSetup.Zoom = False
                worksheet.PageSetup.FitToPagesWide = 1
                worksheet.PageSetup.FitToPagesTall = False
            workbook.ExportAsFixedFormat(0, temp_pdf_path)  # 0 = xlTypePDF
            workbook.Close()
            excel_app.Quit()
            with open(temp_pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()
            pythoncom.CoUninitialize()
            return StreamingResponse(io.BytesIO(pdf_content), media_type='application/pdf',
                headers={
                    'Content-Disposition': f'attachment; filename="{pdf_filename}"',
                    'Access-Control-Allow-Origin': '*',
                }
            )
        finally:
            try:
                if os.path.exists(temp_excel_path):
                    os.unlink(temp_excel_path)
                if os.path.exists(temp_pdf_path):
                    os.unlink(temp_pdf_path)
            except Exception as cleanup_error:
                print(f"Warning: Error cleaning up temporary files: {cleanup_error}")
    except Exception as e:
        print(f"Error generating peel test PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

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
            "audit_pdf_reports": {
                "base_path": "/generate-audit-pdf",
                "description": "Generate audit PDF reports"
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
    
    # Start extractors in separate threads
    qa_thread = threading.Thread(target=run_qa, daemon=True)
    b_thread = threading.Thread(target=run_b, daemon=True)
    peel_thread = threading.Thread(target=run_peel, daemon=True)
    
    qa_thread.start()
    b_thread.start()
    peel_thread.start()
    
    print("Data extractors started in background threads")

@app.get("/health")
async def global_health_check():
    return {
        "status": "all_services_running",
        "timestamp": "2024-01-01T00:00:00Z",
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

if __name__ == "__main__":
    # Start data extractors in background
    run_extractors()
    # Start the server
    uvicorn.run("main:app", host=SERVER_URL, port=int(PORT), reload=True)