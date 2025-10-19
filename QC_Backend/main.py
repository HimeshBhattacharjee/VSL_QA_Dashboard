from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from constants import SERVER_URL, PORT
from routes.qa_route import qa_router
from routes.bGrade_route import bgrade_router
from routes.peel_route import peel_router

app = FastAPI(
    title="Manufacturing Analytics API",
    description="Combined API for Quality Analysis, B-Grade Trend data, and Peel Test results",
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
            "peel_test": "available"
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host=SERVER_URL, port=int(PORT), reload=True)