import pandas as pd
import numpy as np
import warnings
from pymongo import MongoClient
from datetime import datetime, time
from constants import MONGODB_URI
from paths import get_reference_file_path

warnings.filterwarnings('ignore')

def filter_and_process_excel(file_path):
    """Filter and process Excel data based on Order No. criteria"""
    df = pd.read_excel(file_path)
    print(f"Original data shape: {df.shape}")
    print("Columns:", df.columns.tolist())
    
    order_column = 'Order No.'
    df[order_column] = df[order_column].astype(str)
    
    # Filter rows where Order No. starts with '00000007' or '00000009'
    filtered_df = df[
        df[order_column].str.startswith('00000007') | 
        df[order_column].str.startswith('00000009')
    ].copy()
    
    print(f"Filtered data shape: {filtered_df.shape}")
    print(f"Rows removed: {len(df) - len(filtered_df)}")
    
    # Clean and sort data
    filtered_df = filtered_df.dropna(subset=['Posting Date', 'Order No.'])
    filtered_df = filtered_df.sort_values('Posting Date', ascending=True)
    filtered_df = filtered_df.reset_index(drop=True)
    filtered_df = filtered_df.replace({np.nan: None})
    
    # Display first and last few rows
    print("\nFirst 5 rows:")
    print(filtered_df.head())
    print("\nLast 5 rows:")
    print(filtered_df.tail())
    
    return filtered_df


class BMongoDBManager:
    """MongoDB manager for storing and retrieving B-grade data"""
    
    def __init__(self, db_name="b_grade_trend"):
        self.client = MongoClient(MONGODB_URI)
        self.db = self.client[db_name]
    
    def convert_to_mongo_compatible(self, obj):
        """Convert various data types to MongoDB-compatible formats"""
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
        """Generate collection name based on date (format: month_year)"""
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
    
    def prepare_document(self, row):
        """Prepare a MongoDB document from a dataframe row"""
        document = {
            'posting_date': self.convert_to_mongo_compatible(row.get('Posting Date')),
            'creation_time': self.convert_to_mongo_compatible(row.get('Creation Time')),
            'order_no': self.convert_to_mongo_compatible(row.get('Order No.')),
            'material_desc': self.convert_to_mongo_compatible(row.get('Material Desc.')),
            'serial_number': self.convert_to_mongo_compatible(row.get('Serial Number')),
            'created_by': self.convert_to_mongo_compatible(row.get('Created By')),
            'grade': self.convert_to_mongo_compatible(row.get('Grade.')),
            'reason': self.convert_to_mongo_compatible(row.get('Reason')),
            'processing_date': datetime.now()
        }
        return document
    
    def insert_dataframe_to_mongo(self, dataframe):
        """Insert dataframe records into MongoDB collections"""
        records_processed = 0
        collections_used = set()
        errors = []
        
        for index, row in dataframe.iterrows():
            try:
                document = self.prepare_document(row)
                collection_name = self.get_collection_name(row.get('Posting Date'))
                
                if not collection_name:
                    errors.append(f"Row {index}: Invalid date format")
                    continue
                
                collection = self.db[collection_name]
                result = collection.insert_one(document)
                
                if result.inserted_id:
                    records_processed += 1
                    collections_used.add(collection_name)
                    
            except Exception as e:
                error_msg = f"Error processing row {index}: {e}"
                errors.append(error_msg)
                print(error_msg)
                continue
        
        print(f"\nMongoDB Storage Summary:")
        print(f"Records successfully processed: {records_processed}")
        print(f"Collections updated/created: {list(collections_used)}")
        
        if errors:
            print(f"\nErrors encountered: {len(errors)}")
            for error in errors[:5]:
                print(f"  - {error}")
            if len(errors) > 5:
                print(f"  ... and {len(errors) - 5} more errors")
        
        return records_processed, collections_used, errors
    
    def get_monthly_data(self, month_abbr, year):
        """Retrieve data for a specific month and year"""
        collection_name = f"{month_abbr.lower()}_{year}"
        if collection_name in self.db.list_collection_names():
            collection = self.db[collection_name]
            return list(collection.find({}, {'_id': 0}))
        else:
            return []
    
    def list_all_collections(self):
        """List all collections in the database"""
        return self.db.list_collection_names()
    
    def get_collection_stats(self, collection_name):
        """Get statistics and sample documents from a collection"""
        if collection_name in self.db.list_collection_names():
            collection = self.db[collection_name]
            count = collection.count_documents({})
            sample_docs = list(collection.find().limit(2))
            return count, sample_docs
        return 0, []


def display_database_stats(mongo_manager, collections_list):
    """Display statistics for MongoDB collections"""
    print("\nCollection Statistics:")
    print("-" * 50)
    
    for collection_name in collections_list:
        count, sample_docs = mongo_manager.get_collection_stats(collection_name)
        print(f"Collection '{collection_name}': {count} documents")
        
        if sample_docs:
            print(f"Sample document from {collection_name}:")
            for doc in sample_docs:
                doc_display = doc.copy()
                doc_display['_id'] = str(doc_display['_id'])
                print(f"  - {doc_display}")
        print()


def main():
    """Main function to execute the data processing and storage pipeline"""
    
    # File path to the Excel file
    file_path = get_reference_file_path("UD Report_Sep-25.XLSX")
    
    # Step 1: Process the Excel file
    print("=" * 60)
    print("STEP 1: Processing Excel Data")
    print("=" * 60)
    processed_df = filter_and_process_excel(file_path)
    
    # Step 2: Store data in MongoDB
    print("\n" + "=" * 60)
    print("STEP 2: Storing Data in MongoDB")
    print("=" * 60)
    
    mongo_manager = BMongoDBManager()
    records_processed, collections_used, errors = mongo_manager.insert_dataframe_to_mongo(processed_df)
    
    # Step 3: Display database statistics
    display_database_stats(mongo_manager, collections_used)
    
    # Summary
    print("=" * 60)
    print("PROCESSING COMPLETE")
    print("=" * 60)
    print(f"Total records processed: {records_processed}")
    print(f"Collections updated: {len(collections_used)}")
    print(f"Errors encountered: {len(errors) if errors else 0}")


if __name__ == "__main__":
    main()