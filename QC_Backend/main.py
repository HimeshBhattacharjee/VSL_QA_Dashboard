from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
from constants import SERVER_URL, PORT
from routes.qa_route import qa_router
from routes.bGrade_route import bgrade_router
from routes.peel_route import peel_router
from routes.user_route import user_router
from generators.AuditReportGenerator import generate_audit_report

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
        
        # Call the function from AuditReportGenerator module
        output, filename = generate_audit_report(audit_data)
        
        # Use StreamingResponse for BytesIO objects
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Access-Control-Allow-Origin': 'http://localhost:5173',
            }
        )
        
    except Exception as e:
        print(f"Error generating audit report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.get("/api/audit-health")
async def audit_health_check():
    return {"status": "healthy", "message": "Audit Report API is running"}

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
            "audit_reports": "available"
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host=SERVER_URL, port=int(PORT), reload=True)