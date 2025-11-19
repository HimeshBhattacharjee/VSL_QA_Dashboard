from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import tempfile
import os
import io
from win32com import client as win32client
import pythoncom
from constants import SERVER_URL, PORT
from routes.qa_route import qa_router
from routes.bGrade_route import bgrade_router
from routes.peel_route import peel_router
from routes.user_route import user_router
from generators.AuditReportGenerator import generate_audit_report
from generators.GelReportGenerator import generate_gel_report
from generators.PeelReportGenerator import generate_peel_report

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

@app.post("/generate-audit-report")
async def generate_audit_report_endpoint(audit_data: dict):
    try:
        if not audit_data:
            raise HTTPException(status_code=400, detail="No audit data provided")
        output, filename = generate_audit_report(audit_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Access-Control-Allow-Origin': '*',
            }
        )
    except Exception as e:
        print(f"Error generating audit report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.post("/generate-audit-pdf")
async def generate_audit_pdf_endpoint(audit_data: dict):
    try:
        if not audit_data:
            raise HTTPException(status_code=400, detail="No audit data provided")
        
        # First generate the Excel file
        excel_output, filename = generate_audit_report(audit_data)
        
        # Create temporary Excel file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_excel:
            temp_excel.write(excel_output.getvalue())
            temp_excel_path = temp_excel.name
        
        # Create PDF filename
        pdf_filename = filename.replace('.xlsx', '.pdf')
        temp_pdf_path = tempfile.mktemp(suffix='.pdf')
        
        try:
            # Initialize COM for Excel
            pythoncom.CoInitialize()
            
            # Create Excel application instance
            excel_app = win32client.Dispatch("Excel.Application")
            excel_app.Visible = False
            excel_app.DisplayAlerts = False
            
            # Open the Excel workbook
            workbook = excel_app.Workbooks.Open(temp_excel_path)
            
            # Configure page setup for all worksheets to fit on one page
            for worksheet in workbook.Worksheets:
                # Set page orientation to landscape for better fit
                worksheet.PageSetup.Orientation = 2  # 2 = xlLandscape
                worksheet.PageSetup.LeftMargin = 40
                worksheet.PageSetup.RightMargin = 40
                worksheet.PageSetup.TopMargin = 40
                worksheet.PageSetup.BottomMargin = 40
                worksheet.PageSetup.Zoom = False  # Disable zoom to use FitToPages
                worksheet.PageSetup.FitToPagesWide = 1  # Fit to 1 page wide
                worksheet.PageSetup.FitToPagesTall = 1  # Fit to 1 page tall
            
            # Export to PDF with the configured page setup
            workbook.ExportAsFixedFormat(0, temp_pdf_path)  # 0 = xlTypePDF
            
            # Close workbook and quit Excel
            workbook.Close()
            excel_app.Quit()
            
            # Read the PDF file
            with open(temp_pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()
            
            # Clean up COM
            pythoncom.CoUninitialize()
            
            return StreamingResponse(
                io.BytesIO(pdf_content),
                media_type='application/pdf',
                headers={
                    'Content-Disposition': f'attachment; filename="{pdf_filename}"',
                    'Access-Control-Allow-Origin': '*',
                }
            )
            
        finally:
            # Clean up temporary files
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

@app.post("/generate-gel-report")
async def generate_gel_report_endpoint(gel_data: dict):
    try:
        if not gel_data:
            raise HTTPException(status_code=400, detail="No gel test data provided")
        output, filename = generate_gel_report(gel_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Access-Control-Allow-Origin': '*',
            }
        )
    except Exception as e:
        print(f"Error generating gel test report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
    
@app.post("/generate-gel-pdf")
async def generate_gel_pdf_endpoint(gel_data: dict):
    try:
        if not gel_data:
            raise HTTPException(status_code=400, detail="No gel test data provided")
        excel_output, filename = generate_gel_report(gel_data)
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
            
            # Configure page setup for all worksheets to fit on one page with reduced margins
            for worksheet in workbook.Worksheets:
                # Set page orientation to landscape
                worksheet.PageSetup.Orientation = 2  # 2 = xlLandscape, 1 = xlPortrait
                worksheet.PageSetup.LeftMargin = 40
                worksheet.PageSetup.RightMargin = 40
                worksheet.PageSetup.TopMargin = 40
                worksheet.PageSetup.BottomMargin = 40
                worksheet.PageSetup.Zoom = False  # Disable zoom to use FitToPages
                worksheet.PageSetup.FitToPagesWide = 1  # Fit to 1 page wide
                worksheet.PageSetup.FitToPagesTall = 1  # Fit to 1 page tall
            
            # Export to PDF with the configured page setup
            workbook.ExportAsFixedFormat(0, temp_pdf_path)  # 0 = xlTypePDF
            
            workbook.Close()
            excel_app.Quit()
            
            # Read the PDF file
            with open(temp_pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()
            
            # Clean up
            pythoncom.CoUninitialize()
            
            return StreamingResponse(
                io.BytesIO(pdf_content),
                media_type='application/pdf',
                headers={
                    'Content-Disposition': f'attachment; filename="{pdf_filename}"',
                    'Access-Control-Allow-Origin': '*',
                }
            )
            
        finally:
            # Clean up temporary files
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

@app.post("/generate-peel-report")
async def generate_peel_report_endpoint(peel_data: dict):
    try:
        if not peel_data:
            raise HTTPException(status_code=400, detail="No peel test data provided")
        output, filename = generate_peel_report(peel_data)
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Access-Control-Allow-Origin': '*',
            }
        )
    except Exception as e:
        print(f"Error generating peel test report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.post("/generate-peel-pdf")
async def generate_peel_pdf_endpoint(peel_data: dict):
    try:
        if not peel_data:
            raise HTTPException(status_code=400, detail="No peel test data provided")
        excel_output, filename = generate_peel_report(peel_data)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_excel:
            temp_excel.write(excel_output.getvalue())
            temp_excel_path = temp_excel.name
        
        pdf_filename = filename.replace('.xlsx', '.pdf')
        temp_pdf_path = tempfile.mktemp(suffix='.pdf')
        
        try:
            # Convert Excel to PDF using win32com
            pythoncom.CoInitialize()
            
            excel_app = win32client.Dispatch("Excel.Application")
            excel_app.Visible = False
            excel_app.DisplayAlerts = False
            
            workbook = excel_app.Workbooks.Open(temp_excel_path)
            
            # Configure page setup for all worksheets
            for worksheet in workbook.Worksheets:
                worksheet.PageSetup.Orientation = 1  # 1 = xlPortrait
                worksheet.PageSetup.Zoom = False
                worksheet.PageSetup.FitToPagesWide = 1
                worksheet.PageSetup.FitToPagesTall = False  # Allow multiple pages tall
            
            # Export to PDF
            workbook.ExportAsFixedFormat(0, temp_pdf_path)  # 0 = xlTypePDF
            
            workbook.Close()
            excel_app.Quit()
            
            # Read the PDF file
            with open(temp_pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()
            
            # Clean up
            pythoncom.CoUninitialize()
            
            return StreamingResponse(
                io.BytesIO(pdf_content),
                media_type='application/pdf',
                headers={
                    'Content-Disposition': f'attachment; filename="{pdf_filename}"',
                    'Access-Control-Allow-Origin': '*',
                }
            )
            
        finally:
            # Clean up temporary files
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
    uvicorn.run("main:app", host=SERVER_URL, port=int(PORT), reload=True)