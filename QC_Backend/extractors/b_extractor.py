import pandas as pd
import numpy as np
import warnings
from pymongo import MongoClient
from datetime import datetime, time
from constants import MONGODB_URI
from paths import get_reference_file_key, download_from_s3

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
            'processing_date': datetime.now(),
            'data_source': 'excel_import'
        }
        return document
    
    def create_unique_index(self, collection_name):
        """Create unique index on key fields to prevent duplicates"""
        collection = self.db[collection_name]
        
        # Define unique fields for B-grade data
        unique_fields = [
            ('posting_date', 1),
            ('order_no', 1),
            ('serial_number', 1)
        ]
        
        # Check if index already exists
        existing_indexes = collection.index_information()
        index_name = 'unique_posting_order_serial'
        
        if index_name not in existing_indexes:
            try:
                collection.create_index(unique_fields, unique=True, name=index_name)
                print(f"  Created unique index on collection '{collection_name}'")
            except Exception as e:
                print(f"  Warning: Could not create unique index: {e}")
        else:
            print(f"  Unique index already exists on '{collection_name}'")
    
    def is_duplicate_record(self, collection, document):
        """Check if a record already exists in the collection"""
        # Define the unique key fields for duplicate checking
        query_filter = {
            'posting_date': document.get('posting_date'),
            'order_no': document.get('order_no'),
            'serial_number': document.get('serial_number')
        }
        
        # Remove None values from filter
        query_filter = {k: v for k, v in query_filter.items() if v is not None}
        
        # Check if record exists
        existing_record = collection.find_one(query_filter)
        
        if existing_record:
            # Check if data has changed
            needs_update = False
            for key, value in document.items():
                if key not in ['_id', 'processing_date']:  # Exclude metadata fields
                    if key in existing_record and existing_record[key] != value:
                        needs_update = True
                        break
                elif key not in existing_record:  # New field added
                    needs_update = True
                    break
            
            return True, needs_update, existing_record.get('_id')
        
        return False, False, None
    
    def insert_dataframe_to_mongo(self, dataframe):
        """Insert dataframe records into MongoDB collections, avoiding duplicates"""
        records_processed = 0
        records_inserted = 0
        records_updated = 0
        records_skipped = 0
        collections_used = set()
        errors = []
        
        print("\nProcessing records (checking for duplicates)...")
        
        for index, row in dataframe.iterrows():
            try:
                document = self.prepare_document(row)
                collection_name = self.get_collection_name(row.get('Posting Date'))
                
                if not collection_name:
                    errors.append(f"Row {index}: Invalid date format")
                    continue
                
                collection = self.db[collection_name]
                
                # Ensure unique index exists
                self.create_unique_index(collection_name)
                
                # Check for duplicates
                is_duplicate, needs_update, existing_id = self.is_duplicate_record(collection, document)
                
                if is_duplicate:
                    if needs_update:
                        # Update existing record
                        collection.update_one({'_id': existing_id}, {'$set': document})
                        records_updated += 1
                        print(f"  ✓ Row {index}: Updated existing record")
                    else:
                        # Skip duplicate (no changes needed)
                        records_skipped += 1
                        print(f"  ⚠ Row {index}: Skipped duplicate (no changes)")
                else:
                    # Insert new record
                    result = collection.insert_one(document)
                    if result.inserted_id:
                        records_inserted += 1
                        print(f"  ✓ Row {index}: Inserted new record")
                
                records_processed += 1
                collections_used.add(collection_name)
                    
            except Exception as e:
                error_msg = f"Error processing row {index}: {e}"
                errors.append(error_msg)
                print(f"  ✗ {error_msg}")
                continue
        
        print(f"\nMongoDB Storage Summary:")
        print(f"Total records processed: {records_processed}")
        print(f"New records inserted: {records_inserted}")
        print(f"Existing records updated: {records_updated}")
        print(f"Duplicate records skipped: {records_skipped}")
        print(f"Collections used: {list(collections_used)}")
        
        if errors:
            print(f"\nErrors encountered: {len(errors)}")
            for error in errors[:5]:
                print(f"  - {error}")
            if len(errors) > 5:
                print(f"  ... and {len(errors) - 5} more errors")
        
        return {
            'total_processed': records_processed,
            'inserted': records_inserted,
            'updated': records_updated,
            'skipped': records_skipped,
            'collections': list(collections_used),
            'errors': errors
        }
    
    def clear_collection_data(self, collection_name):
        """Clear all data from a collection (for testing/reset)"""
        if collection_name in self.db.list_collection_names():
            collection = self.db[collection_name]
            count = collection.count_documents({})
            collection.delete_many({})
            print(f"Cleared {count} documents from '{collection_name}'")
            return count
        return 0
    
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
    
    if not collections_list:
        print("No collections to display")
        return
    
    for collection_name in collections_list:
        count, sample_docs = mongo_manager.get_collection_stats(collection_name)
        print(f"Collection '{collection_name}': {count} documents")
        
        if sample_docs:
            print(f"Sample document from {collection_name}:")
            for doc in sample_docs:
                doc_display = doc.copy()
                doc_display['_id'] = str(doc_display['_id'])
                # Truncate for display
                for key in doc_display:
                    if isinstance(doc_display[key], str) and len(doc_display[key]) > 50:
                        doc_display[key] = doc_display[key][:50] + "..."
                print(f"  - {doc_display}")
        print()


def main():
    """Main function to execute the data processing and storage pipeline"""
    
    # File path to the Excel file
    file_key = get_reference_file_key("UD Report_Sep-25.XLSX")
    file_path = download_from_s3(file_key)
    
    # Step 1: Process the Excel file
    print("=" * 60)
    print("STEP 1: Processing Excel Data")
    print("=" * 60)
    processed_df = filter_and_process_excel(file_path)
    
    # Step 2: Store data in MongoDB (with duplicate checking)
    print("\n" + "=" * 60)
    print("STEP 2: Storing Data in MongoDB (with duplicate prevention)")
    print("=" * 60)
    
    mongo_manager = BMongoDBManager()
    result = mongo_manager.insert_dataframe_to_mongo(processed_df)
    
    # Step 3: Display database statistics
    print("\n" + "=" * 60)
    print("STEP 3: Database Statistics")
    print("=" * 60)
    display_database_stats(mongo_manager, result['collections'])
    
    # Summary
    print("=" * 60)
    print("PROCESSING COMPLETE")
    print("=" * 60)
    print(f"Total records processed: {result['total_processed']}")
    print(f"New records inserted: {result['inserted']}")
    print(f"Existing records updated: {result['updated']}")
    print(f"Duplicate records skipped: {result['skipped']}")
    print(f"Collections updated: {len(result['collections'])}")
    print(f"Errors encountered: {len(result['errors'])}")


if __name__ == "__main__":
    main()