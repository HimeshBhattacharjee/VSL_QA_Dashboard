from fastapi import APIRouter, HTTPException, Query
from pymongo import MongoClient
from datetime import datetime, time
import pandas as pd
import numpy as np
from constants import MONGODB_URI

bgrade_router = APIRouter(prefix="/bgrade", tags=["B-Grade Trend"])

class BMongoDBManager:
    def __init__(self, db_name="b_grade_trend"):
        self.client = MongoClient(MONGODB_URI)
        self.db = self.client[db_name]
    
    def convert_to_mongo_compatible(self, obj):
        if obj is None:
            return None
        elif isinstance(obj, (int, float, str, bool)):
            return obj
        elif isinstance(obj, datetime):
            return obj
        elif isinstance(obj, time):
            return obj.isoformat()
        elif isinstance(obj, pd.Timestamp):
            return obj.to_pydatetime()
        elif pd.isna(obj):
            return None
        elif isinstance(obj, (np.integer, np.floating)):
            return float(obj) if isinstance(obj, np.floating) else int(obj)
        else:
            return str(obj)
    
    def get_collection_name(self, date_str):
        try:
            if isinstance(date_str, datetime):
                date_obj = date_str
            elif isinstance(date_str, pd.Timestamp):
                date_obj = date_str.to_pydatetime()
            else:
                date_obj = datetime.strptime(str(date_str), '%Y-%m-%d %H:%M:%S')
        except:
            try:
                date_obj = datetime.strptime(str(date_str), '%Y-%m-%d')
            except:
                print(f"Warning: Could not parse date: {date_str}")
                return None
        
        month_abbr = date_obj.strftime('%b').lower()
        year = date_obj.year
        return f"{month_abbr}_{year}"
    
    def get_all_collections(self):
        return self.db.list_collection_names()
    
    def get_collection_data(self, collection_name: str, limit: int = 100, skip: int = 0):
        if collection_name not in self.db.list_collection_names():
            return []
        collection = self.db[collection_name]
        cursor = collection.find().skip(skip).limit(limit)
        results = []
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            for key, value in doc.items():
                if isinstance(value, datetime):
                    doc[key] = value.isoformat()
            results.append(doc)
        return results
    
    def get_data_by_date_range(self, start_date: str, end_date: str):
        all_results = []
        for collection_name in self.get_all_collections():
            collection = self.db[collection_name]
            start_dt = datetime.fromisoformat(start_date) if 'T' in start_date else datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.fromisoformat(end_date) if 'T' in end_date else datetime.strptime(end_date, '%Y-%m-%d')
            query = {
                "posting_date": {
                    "$gte": start_dt,
                    "$lte": end_dt
                }
            }
            cursor = collection.find(query)
            for doc in cursor:
                doc['_id'] = str(doc['_id'])
                doc['collection_name'] = collection_name
                for key, value in doc.items():
                    if isinstance(value, datetime):
                        doc[key] = value.isoformat()
                all_results.append(doc)
        return all_results

mongo_manager = BMongoDBManager()

@bgrade_router.get("/")
async def bgrade_root():
    return {
        "message": "B-Grade Trend API", 
        "status": "active",
        "endpoints": {
            "collections": "/api/collections",
            "collection_data": "/api/data/{collection_name}",
            "date_range": "/api/data/date-range"
        }
    }

@bgrade_router.get("/api/collections")
async def get_bgrade_collections():
    try:
        collections = mongo_manager.get_all_collections()
        return {
            "success": True,
            "collections": collections,
            "count": len(collections)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching collections: {str(e)}")

@bgrade_router.get("/api/data/{collection_name}")
async def get_bgrade_collection_data(
    collection_name: str,
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0)
):
    try:
        data = mongo_manager.get_collection_data(collection_name, limit, skip)
        return {
            "success": True,
            "collection": collection_name,
            "data": data,
            "count": len(data),
            "limit": limit,
            "skip": skip
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")

@bgrade_router.get("/api/data/date-range")
async def get_bgrade_data_by_date_range(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)")
):
    try:
        data = mongo_manager.get_data_by_date_range(start_date, end_date)
        return {
            "success": True,
            "start_date": start_date,
            "end_date": end_date,
            "data": data,
            "count": len(data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")

@bgrade_router.get("/health")
async def bgrade_health_check():
    try:
        collections = mongo_manager.get_all_collections()
        return {
            "status": "healthy",
            "database": "b_grade_trend connected",
            "collections_count": len(collections),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@bgrade_router.get("/api/aggregated/grade-analysis")
async def get_aggregated_grade_analysis(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)")
):
    try:
        # Use MongoDB aggregation for efficient data processing
        pipeline = [
            {
                "$match": {
                    "posting_date": {
                        "$gte": datetime.strptime(start_date, '%Y-%m-%d'),
                        "$lte": datetime.strptime(end_date, '%Y-%m-%d')
                    }
                }
            },
            {
                "$group": {
                    "_id": "$grade",
                    "count": {"$sum": 1}
                }
            },
            {
                "$project": {
                    "grade": "$_id",
                    "count": 1,
                    "_id": 0
                }
            }
        ]
        
        aggregated_data = []
        total_production = 0
        
        for collection_name in mongo_manager.get_all_collections():
            collection = mongo_manager.db[collection_name]
            result = list(collection.aggregate(pipeline))
            aggregated_data.extend(result)
            
            # Get total count for this collection in date range
            total_count = collection.count_documents({
                "posting_date": {
                    "$gte": datetime.strptime(start_date, '%Y-%m-%d'),
                    "$lte": datetime.strptime(end_date, '%Y-%m-%d')
                }
            })
            total_production += total_count
        
        # Process aggregated results
        grade_counts = {'O': 0, 'E': 0, 'D': 0, 'B': 0}
        for item in aggregated_data:
            grade = item.get('grade', 'UNKNOWN')
            if grade in grade_counts:
                grade_counts[grade] += item['count']
        
        return {
            "success": True,
            "start_date": start_date,
            "end_date": end_date,
            "grade_counts": grade_counts,
            "total_production": total_production,
            "total_defects": grade_counts['B'],
            "defect_rate": round((grade_counts['B'] / total_production * 100), 2) if total_production > 0 else 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in grade analysis: {str(e)}")

@bgrade_router.get("/api/aggregated/defect-analysis")
async def get_aggregated_defect_analysis(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    top_n: int = Query(10, description="Top N defect reasons to return")
):
    try:
        # Aggregation pipeline for defect reasons
        pipeline = [
            {
                "$match": {
                    "posting_date": {
                        "$gte": datetime.strptime(start_date, '%Y-%m-%d'),
                        "$lte": datetime.strptime(end_date, '%Y-%m-%d')
                    },
                    "grade": "B"
                }
            },
            {
                "$group": {
                    "_id": "$reason",
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"count": -1}
            },
            {
                "$limit": top_n
            },
            {
                "$project": {
                    "reason": "$_id",
                    "count": 1,
                    "_id": 0
                }
            }
        ]
        
        aggregated_data = []
        total_b_grade = 0
        
        for collection_name in mongo_manager.get_all_collections():
            collection = mongo_manager.db[collection_name]
            result = list(collection.aggregate(pipeline))
            aggregated_data.extend(result)
            
            # Get total B-grade count for this collection
            b_grade_count = collection.count_documents({
                "posting_date": {
                    "$gte": datetime.strptime(start_date, '%Y-%m-%d'),
                    "$lte": datetime.strptime(end_date, '%Y-%m-%d')
                },
                "grade": "B"
            })
            total_b_grade += b_grade_count
        
        # Merge results from different collections
        reason_counts = {}
        for item in aggregated_data:
            reason = item.get('reason', 'UNKNOWN')
            reason_counts[reason] = reason_counts.get(reason, 0) + item['count']
        
        # Sort by count and limit to top_n
        sorted_reasons = sorted(reason_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]
        
        return {
            "success": True,
            "start_date": start_date,
            "end_date": end_date,
            "defect_reasons": dict(sorted_reasons),
            "total_b_grade": total_b_grade,
            "total_production": await get_total_production_count(start_date, end_date)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in defect analysis: {str(e)}")

# Helper function to get total production count
async def get_total_production_count(start_date: str, end_date: str):
    total_count = 0
    for collection_name in mongo_manager.get_all_collections():
        collection = mongo_manager.db[collection_name]
        count = collection.count_documents({
            "posting_date": {
                "$gte": datetime.strptime(start_date, '%Y-%m-%d'),
                "$lte": datetime.strptime(end_date, '%Y-%m-%d')
            }
        })
        total_count += count
    return total_count

@bgrade_router.get("/api/aggregated/daily-trend")
async def get_daily_trend(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    analysis_type: str = Query("b-grade", description="Analysis type: b-grade or defect")
):
    try:
        if analysis_type == "b-grade":
            pipeline = [
                {
                    "$match": {
                        "posting_date": {
                            "$gte": datetime.strptime(start_date, '%Y-%m-%d'),
                            "$lte": datetime.strptime(end_date, '%Y-%m-%d')
                        }
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$posting_date"}},
                            "grade": "$grade"
                        },
                        "count": {"$sum": 1}
                    }
                },
                {
                    "$sort": {"_id.date": 1}
                }
            ]
        else:
            pipeline = [
                {
                    "$match": {
                        "posting_date": {
                            "$gte": datetime.strptime(start_date, '%Y-%m-%d'),
                            "$lte": datetime.strptime(end_date, '%Y-%m-%d')
                        },
                        "grade": "B"
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$posting_date"}},
                            "reason": "$reason"
                        },
                        "count": {"$sum": 1}
                    }
                },
                {
                    "$sort": {"_id.date": 1}
                }
            ]
        
        daily_data = []
        for collection_name in mongo_manager.get_all_collections():
            collection = mongo_manager.db[collection_name]
            result = list(collection.aggregate(pipeline))
            daily_data.extend(result)
        
        return {
            "success": True,
            "analysis_type": analysis_type,
            "daily_data": daily_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching daily trend: {str(e)}")