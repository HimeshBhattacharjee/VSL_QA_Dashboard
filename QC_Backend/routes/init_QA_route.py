from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import MongoClient
from datetime import datetime, timedelta
import json
from bson import json_util
from typing import Optional, List
import uvicorn

# Initialize FastAPI app
app = FastAPI(
    title="Quality Analysis API",
    description="API for accessing quality analysis data from MongoDB",
    version="1.0.0"
)

# CORS middleware to allow requests from your website
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this with your website domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
def get_database():
    try:
        client = MongoClient("mongodb://localhost:27017/")
        db = client["quality_analysis"]
        # Test connection
        client.admin.command('ping')
        return db
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

# Helper function to convert MongoDB documents to JSON
def serialize_doc(doc):
    """Convert MongoDB document to JSON serializable format"""
    return json.loads(json_util.dumps(doc))

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Quality Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "line_data": "/api/lines/{line_number}/{inspection_type}",
            "combined_data": "/api/combined/{inspection_type}",
            "line_summary": "/api/lines/{line_number}/{inspection_type}/summary",
            "combined_summary": "/api/combined/{inspection_type}/summary",
            "defect_analysis": "/api/analysis/defects/{inspection_type}",
            "production_stats": "/api/analysis/production",
            "date_range_data": "/api/data/date-range"
        }
    }

# Get line data
@app.get("/api/lines/{line_number}/{inspection_type}")
async def get_line_data(
    line_number: int,
    inspection_type: str,
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: Optional[int] = Query(None, description="Limit number of records")
):
    """
    Get data for a specific line and inspection type
    """
    try:
        db = get_database()
        collection_name = f"line_{line_number}_{inspection_type.lower().replace('-', '_')}_data"
        
        if collection_name not in db.list_collection_names():
            raise HTTPException(status_code=404, detail=f"Collection {collection_name} not found")
        
        # Build query for date range
        query = {}
        if date_from and date_to:
            try:
                start_date = datetime.strptime(date_from, "%Y-%m-%d")
                end_date = datetime.strptime(date_to, "%Y-%m-%d")
                query["Date"] = {
                    "$gte": start_date.strftime("%Y-%m-%d"),
                    "$lte": end_date.strftime("%Y-%m-%d")
                }
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # Get data
        collection = db[collection_name]
        cursor = collection.find(query).sort("Date", 1)
        
        if limit:
            cursor = cursor.limit(limit)
        
        data = [serialize_doc(doc) for doc in cursor]
        
        return {
            "line_number": line_number,
            "inspection_type": inspection_type,
            "total_records": len(data),
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")

# Get combined data
@app.get("/api/combined/{inspection_type}")
async def get_combined_data(
    inspection_type: str,
    line_number: Optional[int] = Query(None, description="Filter by specific line"),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: Optional[int] = Query(None, description="Limit number of records")
):
    """
    Get combined data for an inspection type, optionally filtered by line
    """
    try:
        db = get_database()
        collection_name = f"combined_{inspection_type.lower().replace('-', '_')}_data"
        
        if collection_name not in db.list_collection_names():
            raise HTTPException(status_code=404, detail=f"Collection {collection_name} not found")
        
        # Build query
        query = {}
        if line_number:
            query["Line"] = line_number
        
        if date_from and date_to:
            try:
                start_date = datetime.strptime(date_from, "%Y-%m-%d")
                end_date = datetime.strptime(date_to, "%Y-%m-%d")
                query["Date"] = {
                    "$gte": start_date.strftime("%Y-%m-%d"),
                    "$lte": end_date.strftime("%Y-%m-%d")
                }
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # Get data
        collection = db[collection_name]
        cursor = collection.find(query).sort("Date", 1)
        
        if limit:
            cursor = cursor.limit(limit)
        
        data = [serialize_doc(doc) for doc in cursor]
        
        return {
            "inspection_type": inspection_type,
            "line_filter": line_number,
            "total_records": len(data),
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")

# Get line summary
@app.get("/api/lines/{line_number}/{inspection_type}/summary")
async def get_line_summary(line_number: int, inspection_type: str):
    """
    Get summary for a specific line and inspection type
    """
    try:
        db = get_database()
        collection_name = f"line_{line_number}_{inspection_type.lower().replace('-', '_')}_summary"
        
        if collection_name not in db.list_collection_names():
            raise HTTPException(status_code=404, detail=f"Summary {collection_name} not found")
        
        collection = db[collection_name]
        summary = collection.find_one({})
        
        if not summary:
            raise HTTPException(status_code=404, detail="Summary not found")
        
        return serialize_doc(summary)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching summary: {str(e)}")

# Get combined summary
@app.get("/api/combined/{inspection_type}/summary")
async def get_combined_summary(inspection_type: str):
    """
    Get combined summary for an inspection type
    """
    try:
        db = get_database()
        collection_name = f"combined_{inspection_type.lower().replace('-', '_')}_summary"
        
        if collection_name not in db.list_collection_names():
            raise HTTPException(status_code=404, detail=f"Summary {collection_name} not found")
        
        collection = db[collection_name]
        summary = collection.find_one({})
        
        if not summary:
            raise HTTPException(status_code=404, detail="Summary not found")
        
        return serialize_doc(summary)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching summary: {str(e)}")

# Get defect analysis
@app.get("/api/analysis/defects/{inspection_type}")
async def get_defect_analysis(
    inspection_type: str,
    line_number: Optional[int] = Query(None, description="Specific line (optional)"),
    top_n: Optional[int] = Query(10, description="Number of top defects to return")
):
    """
    Get defect analysis for an inspection type
    """
    try:
        db = get_database()
        
        if line_number:
            # Get data from specific line
            collection_name = f"line_{line_number}_{inspection_type.lower().replace('-', '_')}_data"
        else:
            # Get combined data
            collection_name = f"combined_{inspection_type.lower().replace('-', '_')}_data"
        
        if collection_name not in db.list_collection_names():
            raise HTTPException(status_code=404, detail=f"Collection {collection_name} not found")
        
        collection = db[collection_name]
        
        # Get one document to identify defect columns
        sample_doc = collection.find_one({})
        if not sample_doc:
            return {"defects": [], "total_defects": 0}
        
        # Identify defect columns (exclude metadata fields)
        metadata_fields = ['_id', 'Date', 'Total Production', 'Total rejection', 'Rejection %', 'Line', 
                          'import_timestamp', 'data_source', 'inspection_type', 'line_number']
        defect_columns = [key for key in sample_doc.keys() if key not in metadata_fields and isinstance(sample_doc[key], (int, float))]
        
        # Calculate total defects for each column
        defect_totals = {}
        for defect in defect_columns:
            pipeline = [
                {"$group": {"_id": None, "total": {"$sum": f"${defect}"}}}
            ]
            result = list(collection.aggregate(pipeline))
            if result:
                defect_totals[defect] = result[0]['total']
        
        # Sort defects by total (descending) and get top N
        sorted_defects = sorted(defect_totals.items(), key=lambda x: x[1], reverse=True)[:top_n]
        
        total_all_defects = sum(defect_totals.values())
        
        return {
            "inspection_type": inspection_type,
            "line_number": line_number,
            "total_defects": total_all_defects,
            "defects": [{"defect_name": defect, "total_count": count} for defect, count in sorted_defects]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing defects: {str(e)}")

# Get production statistics
@app.get("/api/analysis/production")
async def get_production_stats(
    inspection_type: Optional[str] = Query(None, description="Specific inspection type"),
    line_number: Optional[int] = Query(None, description="Specific line")
):
    """
    Get production statistics across all lines and inspection types
    """
    try:
        db = get_database()
        stats = {}
        
        inspection_types = ["Pre-EL", "Visual", "Lam-QC", "FQC"] if not inspection_type else [inspection_type]
        lines = [1, 2, 3, 4] if not line_number else [line_number]
        
        for insp_type in inspection_types:
            stats[insp_type] = {}
            
            for line in lines:
                collection_name = f"line_{line}_{insp_type.lower().replace('-', '_')}_summary"
                
                if collection_name in db.list_collection_names():
                    collection = db[collection_name]
                    summary = collection.find_one({})
                    
                    if summary:
                        stats[insp_type][f"line_{line}"] = {
                            "total_production": summary.get('production_stats', {}).get('total_production', 0),
                            "total_rejection": summary.get('production_stats', {}).get('total_rejection', 0),
                            "rejection_rate": summary.get('production_stats', {}).get('average_rejection_rate', 0)
                        }
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching production stats: {str(e)}")

# Get data by date range across all lines
@app.get("/api/data/date-range")
async def get_date_range_data(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    inspection_type: str = Query(..., description="Inspection type"),
    metric: str = Query("Total rejection", description="Metric to analyze")
):
    """
    Get data for a specific date range across all lines
    """
    try:
        db = get_database()
        
        start_date = datetime.strptime(date_from, "%Y-%m-%d")
        end_date = datetime.strptime(date_to, "%Y-%m-%d")
        
        result = {}
        
        for line in [1, 2, 3, 4]:
            collection_name = f"line_{line}_{inspection_type.lower().replace('-', '_')}_data"
            
            if collection_name in db.list_collection_names():
                collection = db[collection_name]
                
                query = {
                    "Date": {
                        "$gte": start_date.strftime("%Y-%m-%d"),
                        "$lte": end_date.strftime("%Y-%m-%d")
                    }
                }
                
                data = list(collection.find(query).sort("Date", 1))
                
                if data:
                    result[f"line_{line}"] = {
                        "dates": [doc.get("Date") for doc in data],
                        "metrics": [doc.get(metric, 0) for doc in data],
                        "total": sum([doc.get(metric, 0) for doc in data])
                    }
        
        return result
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching date range data: {str(e)}")

# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    try:
        db = get_database()
        # Test database connection
        db.command('ping')
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

# Get all available collections
@app.get("/api/collections")
async def get_available_collections():
    """
    Get all available collections in the database
    """
    try:
        db = get_database()
        collections = db.list_collection_names()
        
        # Categorize collections
        line_data = [col for col in collections if col.startswith('line_') and col.endswith('_data')]
        line_summaries = [col for col in collections if col.startswith('line_') and col.endswith('_summary')]
        combined_data = [col for col in collections if col.startswith('combined_') and col.endswith('_data')]
        combined_summaries = [col for col in collections if col.startswith('combined_') and col.endswith('_summary')]
        
        return {
            "line_data": sorted(line_data),
            "line_summaries": sorted(line_summaries),
            "combined_data": sorted(combined_data),
            "combined_summaries": sorted(combined_summaries),
            "total_collections": len(collections)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching collections: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="localhost",  # Allow external access
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )