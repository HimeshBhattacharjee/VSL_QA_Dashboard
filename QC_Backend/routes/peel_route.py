from fastapi import APIRouter, HTTPException, Query
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from typing import Optional
from datetime import datetime
import os

peel_router = APIRouter(prefix="/peel", tags=["Peel Test Data"], responses={404: {"description": "Not found"}})

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DB_NAME = "peel_test"

def get_mongodb_client():
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        return client
    except ConnectionFailure as e:
        raise HTTPException(status_code=503, detail=f"Could not connect to MongoDB: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MongoDB connection error: {str(e)}")

def get_collection_name(date_str):
    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        month_name = date_obj.strftime('%b').lower()
        year = date_obj.strftime('%Y')
        return f"{month_name}_{year}"
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

@peel_router.get("/")
async def peel_root():
    return {
        "message": "Peel Test Data API",
        "version": "1.0.0",
        "endpoints": {
            "/collections": "List all available collections (months)",
            "/data": "Get peel test data by date and/or shift",
            "/date/{date}": "Get all data for a specific date",
            "/date/{date}/shift/{shift}": "Get data for specific date and shift",
            "/month/{month}/{year}": "Get all data for a specific month and year",
            "/graph-data": "Get processed data for graphing by month, year, stringer, and cell face"
        }
    }

@peel_router.get("/health")
async def peel_health_check():
    try:
        client = get_mongodb_client()
        db = client[DB_NAME]
        collections = db.list_collection_names()
        client.close()        
        return {
            "status": "healthy",
            "database": DB_NAME,
            "collections_count": len(collections),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@peel_router.get("/collections")
async def get_collections():
    try:
        client = get_mongodb_client()
        db = client[DB_NAME]
        collections = db.list_collection_names()        
        collection_info = []
        for col in collections:
            count = db[col].count_documents({})
            collection_info.append({
                "collection_name": col,
                "document_count": count
            })
        client.close()
        return {
            "status": "success",
            "total_collections": len(collections),
            "collections": collection_info
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching collections: {str(e)}")

@peel_router.get("/data")
async def get_peel_data(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    shift: Optional[str] = Query(None, description="Shift (A, B, or C)"),
    stringer: Optional[int] = Query(None, description="Stringer number"),
    unit: Optional[str] = Query(None, description="Unit (A or B)")
):
    try:
        client = get_mongodb_client()
        db = client[DB_NAME]
        query_filter = {}
        if date:
            query_filter['Date'] = date
            collection_name = get_collection_name(date)
            if collection_name not in db.list_collection_names():
                client.close()
                return {
                    "status": "success",
                    "message": f"No data available for {date}",
                    "data": []
                }
            collection = db[collection_name]
        else:
            client.close()
            raise HTTPException(status_code=400, detail="Date parameter is required")
        if shift:
            shift = shift.upper()
            if shift not in ['A', 'B', 'C']:
                raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
            query_filter['Shift'] = shift
        if stringer:
            query_filter['Stringer'] = stringer
        if unit:
            unit = unit.upper()
            if unit not in ['A', 'B']:
                raise HTTPException(status_code=400, detail="Unit must be A or B")
            query_filter['Unit'] = unit
        results = list(collection.find(query_filter, {'_id': 0}))
        client.close()
        return {
            "status": "success",
            "filters": query_filter,
            "count": len(results),
            "data": results
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")

@peel_router.get("/date/{date}/shift/{shift}")
async def get_data_by_date_and_shift(date: str, shift: str):
    try:
        shift = shift.upper()
        if shift not in ['A', 'B', 'C']:
            raise HTTPException(status_code=400, detail="Shift must be A, B, or C")
        client = get_mongodb_client()
        db = client[DB_NAME]
        collection_name = get_collection_name(date)
        if collection_name not in db.list_collection_names():
            client.close()
            return {
                "status": "success",
                "message": f"No data available for {date} - Shift {shift}",
                "date": date,
                "shift": shift,
                "data": []
            }
        collection = db[collection_name]
        results = list(collection.find(
            {'Date': date, 'Shift': shift},
            {'_id': 0}
        ))
        client.close()
        return {
            "status": "success",
            "date": date,
            "shift": shift,
            "count": len(results),
            "data": results
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")
    
@peel_router.get("/graph-data")
async def get_graph_data(
    month: str = Query(..., description="Three-letter month abbreviation (jan, feb, mar, etc.)"),
    year: int = Query(..., description="Four-digit year (e.g., 2024)"),
    stringer: int = Query(..., description="Stringer number from 1 to 12"),
    cell_face: str = Query(..., description="Cell face: 'front', 'back', or 'both'")
):
    try:
        month = month.lower()
        valid_months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                       'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
        if month not in valid_months:
            raise HTTPException(status_code=400, detail="Invalid month. Use three-letter abbreviation (jan, feb, etc.)")
        if stringer < 1 or stringer > 12:
            raise HTTPException(status_code=400, detail="Stringer must be between 1 and 12")
        cell_face = cell_face.lower()
        if cell_face not in ['front', 'back', 'both']:
            raise HTTPException(status_code=400, detail="Cell face must be 'front', 'back', or 'both'")
        
        collection_name = f"{month}_{year}"
        client = get_mongodb_client()
        db = client[DB_NAME]
        
        if collection_name not in db.list_collection_names():
            client.close()
            return {
                "status": "success",
                "message": f"No data available for {month.capitalize()} {year}",
                "month": month,
                "year": year,
                "stringer": stringer,
                "cell_face": cell_face,
                "data": []
            }
        
        collection = db[collection_name]
        query_filter = {'Stringer': stringer}
        results = list(collection.find(query_filter, {'_id': 0}))
        
        if not results:
            client.close()
            return {
                "status": "success",
                "message": f"No data available for stringer {stringer} in {month.capitalize()} {year}",
                "month": month,
                "year": year,
                "stringer": stringer,
                "cell_face": cell_face,
                "data": []
            }
        
        date_data = {}
        for record in results:
            date = record.get('Date')
            if date not in date_data:
                date_data[date] = []
            date_data[date].append(record)
        
        graph_data = []
        for date, records in sorted(date_data.items()):
            daily_averages = []
            max_values = []
            min_values = []
            
            for record in records:
                row_averages = []
                front_row_averages = []
                back_row_averages = []
                
                # Process front side data
                if cell_face in ['front', 'both']:
                    front_values = []
                    # Group front values by position (assuming positions 1-16, ribbons 1-7)
                    front_positions = {}
                    for key, value in record.items():
                        if (key.startswith('Front_') or key.startswith('front_')) and isinstance(value, (int, float)):
                            # Extract position from key (e.g., Front_1_1 -> position 1)
                            try:
                                parts = key.split('_')
                                if len(parts) >= 3:
                                    position = int(parts[1])
                                    if position not in front_positions:
                                        front_positions[position] = []
                                    front_positions[position].append(value)
                            except (ValueError, IndexError):
                                front_values.append(value)
                    
                    # Calculate row averages for front
                    for position, values in front_positions.items():
                        if values:
                            row_avg = sum(values) / len(values)
                            front_row_averages.append(row_avg)
                            row_averages.append(row_avg)
                    
                    # Also include individual front values if position parsing failed
                    if front_values and not front_row_averages:
                        front_avg = sum(front_values) / len(front_values)
                        front_row_averages.append(front_avg)
                        row_averages.append(front_avg)
                
                # Process back side data
                if cell_face in ['back', 'both']:
                    back_values = []
                    # Group back values by position
                    back_positions = {}
                    for key, value in record.items():
                        if (key.startswith('Back_') or key.startswith('back_')) and isinstance(value, (int, float)):
                            # Extract position from key (e.g., Back_1_1 -> position 1)
                            try:
                                parts = key.split('_')
                                if len(parts) >= 3:
                                    position = int(parts[1])
                                    if position not in back_positions:
                                        back_positions[position] = []
                                    back_positions[position].append(value)
                            except (ValueError, IndexError):
                                back_values.append(value)
                    
                    # Calculate row averages for back
                    for position, values in back_positions.items():
                        if values:
                            row_avg = sum(values) / len(values)
                            back_row_averages.append(row_avg)
                            row_averages.append(row_avg)
                    
                    # Also include individual back values if position parsing failed
                    if back_values and not back_row_averages:
                        back_avg = sum(back_values) / len(back_values)
                        back_row_averages.append(back_avg)
                        row_averages.append(back_avg)
                
                # Calculate max and min for this record
                if row_averages:
                    record_avg = sum(row_averages) / len(row_averages)
                    daily_averages.append(record_avg)
                    
                    # For max and min calculations
                    if cell_face == 'both' and front_row_averages and back_row_averages:
                        # For both faces: average of max front and max back
                        max_front = max(front_row_averages) if front_row_averages else 0
                        max_back = max(back_row_averages) if back_row_averages else 0
                        max_both = (max_front + max_back) / 2
                        
                        min_front = min(front_row_averages) if front_row_averages else 0
                        min_back = min(back_row_averages) if back_row_averages else 0
                        min_both = (min_front + min_back) / 2
                        
                        max_values.append(max_both)
                        min_values.append(min_both)
                    
                    elif cell_face == 'front' and front_row_averages:
                        # For front only: max of all front row averages
                        max_values.append(max(front_row_averages))
                        min_values.append(min(front_row_averages))
                    
                    elif cell_face == 'back' and back_row_averages:
                        # For back only: max of all back row averages
                        max_values.append(max(back_row_averages))
                        min_values.append(min(back_row_averages))
            
            if daily_averages:
                daily_avg = sum(daily_averages) / len(daily_averages)
                
                # Calculate overall max and min for the day
                daily_max = round(max(max_values), 2) if max_values else None
                daily_min = round(min(min_values), 2) if min_values else None
                
                graph_data.append({
                    "date": date,
                    "average_value": round(daily_avg, 2),
                    "max_value": daily_max,
                    "min_value": daily_min,
                    "record_count": len(records),
                    "unit_count": len(set(record.get('Unit', '') for record in records))
                })
            else:
                graph_data.append({
                    "date": date,
                    "average_value": None,
                    "max_value": None,
                    "min_value": None,
                    "record_count": len(records),
                    "unit_count": len(set(record.get('Unit', '') for record in records)),
                    "message": "No valid data for selected cell face"
                })
        
        client.close()
        return {
            "status": "success",
            "month": month,
            "year": year,
            "stringer": stringer,
            "cell_face": cell_face,
            "total_days": len(graph_data),
            "data": graph_data
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching graph data: {str(e)}")