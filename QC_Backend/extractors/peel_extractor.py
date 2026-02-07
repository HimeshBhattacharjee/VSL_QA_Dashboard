import os
import pandas as pd
import re
from datetime import datetime
from fuzzywuzzy import fuzz, process
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, DuplicateKeyError, OperationFailure
from constants import MONGODB_URI, MONGODB_DB_NAME
from paths import get_qc_data_key, download_folder_from_s3

class FuzzyFolderMatcher:
    """Fuzzy matching for folder and file names"""
    
    def __init__(self, threshold=80):
        self.threshold = threshold
    
    def find_best_match(self, target, choices):
        """Find the best fuzzy match for a target string among choices"""
        if not choices:
            return None
        best_match, score = process.extractOne(target, choices, scorer=fuzz.token_sort_ratio)
        if score >= self.threshold:
            return best_match
        return None
    
    def find_files_fuzzy(self, folder_path, target_filename):
        """Find files using fuzzy matching in a folder"""
        if not os.path.exists(folder_path):
            return None
        
        files = os.listdir(folder_path)
        
        # Exact match check
        if target_filename in files:
            return os.path.join(folder_path, target_filename)
        
        # Fuzzy match
        best_match = self.find_best_match(target_filename, files)
        if best_match:
            print(f"  Fuzzy match: '{target_filename}' -> '{best_match}'")
            return os.path.join(folder_path, best_match)
        
        # Check without extensions
        for file in files:
            name_without_ext = os.path.splitext(file)[0]
            if fuzz.token_sort_ratio(target_filename, name_without_ext) >= self.threshold:
                return os.path.join(folder_path, file)
        
        return None


def extract_data_from_excel(file_path, sheet_type):
    """Extract peel test data from Excel files"""
    try:
        df = pd.read_excel(file_path, sheet_name='Sheet1', header=None)
        
        # Find start of data (where 'No.' appears)
        data_start_row = None
        for idx, row in df.iterrows():
            if row[0] == 'No.':
                data_start_row = idx + 1
                break
        
        if data_start_row is None:
            return {}
        
        # Extract data
        data_dict = {}
        for idx in range(data_start_row, len(df)):
            row = df.iloc[idx]
            sample_id = str(row[0]).strip()
            
            # Skip invalid rows
            if pd.isna(sample_id) or 'Gragh' in sample_id or not sample_id:
                continue
            
            # Process sample data
            if '_' in sample_id:
                bus_pad_position = int(sample_id.split('_')[-1])
                ribbon_data = {}
                
                # Extract ribbon measurements (columns 1-6)
                for ribbon_idx in range(1, 7):
                    value = row[ribbon_idx]
                    if pd.notna(value):
                        key = f"{sheet_type}_{bus_pad_position}_{ribbon_idx}"
                        ribbon_data[key] = float(value)
                
                data_dict.update(ribbon_data)
        
        return data_dict
    
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return {}


def parse_folder_structure(root_path):
    """Parse folder structure to extract peel test data"""
    all_data = []
    matcher = FuzzyFolderMatcher(threshold=75)
    
    # Regular expressions for folder name patterns
    month_year_patterns = [
        re.compile(r'^[A-Z]{3}-\d{4}$'),
    ]
    
    date_patterns = [
        re.compile(r'^\d{2}\.\d{2}\.\d{4}$'),
        re.compile(r'^\d{2}-\d{2}-\d{4}$'),
        re.compile(r'^\d{2}/\d{2}/\d{4}$'),
    ]
    
    shift_patterns = [
        re.compile(r'^SHIFT-[ABC]$', re.IGNORECASE),
        re.compile(r'^SHIFT\s+-[ABC]$', re.IGNORECASE),
        re.compile(r'^SHIFT-\s+[ABC]$', re.IGNORECASE),
        re.compile(r'^SHIFT\s+-\s+[ABC]$', re.IGNORECASE),
    ]
    
    stringer_unit_patterns = [
        re.compile(r'^STRINGER-(\d+)\s+UNIT-([AB])$', re.IGNORECASE),
        re.compile(r'^STRINGER-(\d+)\s+UNIT\s+-([AB])$', re.IGNORECASE),
        re.compile(r'^STRINGER-(\d+)\s+UNIT-\s+([AB])$', re.IGNORECASE),
        re.compile(r'^STRINGER-(\d+)\s+UNIT\s+-\s+([AB])$', re.IGNORECASE),
        re.compile(r'^STRINGER\s+-(\d+)\s+UNIT-([AB])$', re.IGNORECASE),
        re.compile(r'^STRINGER-\s+(\d+)\s+UNIT-([AB])$', re.IGNORECASE),
        re.compile(r'^STRINGER\s+-\s+(\d+)\s+UNIT-([AB])$', re.IGNORECASE),
    ]
    
    def matches_any_pattern(name, patterns):
        """Check if a name matches any of the given patterns"""
        for pattern in patterns:
            if pattern.match(name):
                return True
        return False
    
    def extract_from_stringer_unit_folder(folder_name, patterns):
        """Extract stringer number and unit from folder name"""
        for pattern in patterns:
            match = pattern.match(folder_name)
            if match:
                return int(match.group(1)), match.group(2).upper()
        return None, None
    
    # Walk through directory structure
    for root, dirs, files in os.walk(root_path):
        current_path = os.path.relpath(root, root_path)
        path_parts = current_path.split(os.sep)
        
        if current_path == '.':
            continue
        
        # Check if we have a valid 4-level folder structure
        if len(path_parts) >= 4:
            month_year_folder = path_parts[0]
            date_folder = path_parts[1]
            shift_folder = path_parts[2]
            stringer_unit_folder = path_parts[3]
            
            # Validate folder structure patterns
            valid_structure = (
                matches_any_pattern(month_year_folder, month_year_patterns) and
                matches_any_pattern(date_folder, date_patterns) and
                matches_any_pattern(shift_folder, shift_patterns)
            )
            
            if valid_structure:
                # Extract stringer number and unit
                stringer_num, unit = extract_from_stringer_unit_folder(
                    stringer_unit_folder, stringer_unit_patterns
                )
                
                if stringer_num is not None and unit is not None:
                    # Extract shift
                    shift = shift_folder.split('-')[-1].upper() if '-' in shift_folder else shift_folder[-1].upper()
                    
                    # Parse date
                    date_formats = ['%d.%m.%Y', '%d-%m-%Y', '%d/%m/%Y']
                    date_str = None
                    
                    for date_format in date_formats:
                        try:
                            date_obj = datetime.strptime(date_folder, date_format)
                            date_str = date_obj.strftime('%Y-%m-%d')
                            break
                        except ValueError:
                            continue
                    
                    if date_str is None:
                        print(f"Could not parse date: {date_folder}")
                        continue
                    
                    # Find FRONT and BACK Excel files
                    front_file = matcher.find_files_fuzzy(root, 'FRONT')
                    back_file = matcher.find_files_fuzzy(root, 'BACK')
                    
                    if not front_file:
                        front_file = matcher.find_files_fuzzy(root, 'FRONT.xlsx')
                    if not back_file:
                        back_file = matcher.find_files_fuzzy(root, 'BACK.xlsx')
                    
                    # Process files if both are found
                    if front_file and back_file:
                        front_data = extract_data_from_excel(front_file, 'Front')
                        back_data = extract_data_from_excel(back_file, 'Back')
                        
                        if front_data and back_data:
                            # Create record
                            record = {
                                'Date': date_str,
                                'Shift': shift,
                                'Stringer': stringer_num,
                                'Unit': unit,
                                'PO': '?PO?',  # Placeholder
                                'Cell_Vendor': '?Cell_Vendor?'  # Placeholder
                            }
                            
                            # Add peel test measurements
                            record.update(front_data)
                            record.update(back_data)
                            all_data.append(record)
                    else:
                        print(f"  Could not find both Excel files in: {root}")
    
    return all_data


def create_structured_dataframe(root_path):
    """Create a structured DataFrame from the extracted data"""
    print("Starting data extraction...")
    data_records = parse_folder_structure(root_path)
    
    if not data_records:
        print("No data found!")
        return pd.DataFrame()
    
    # Create DataFrame
    df = pd.DataFrame(data_records)
    
    # Define column order
    base_columns = ['Date', 'Shift', 'Stringer', 'Unit', 'PO', 'Cell_Vendor']
    
    def sort_peel_columns(column_name):
        """Custom sorting function for peel test columns"""
        if column_name.startswith('Front_') or column_name.startswith('Back_'):
            parts = column_name.split('_')
            col_type = parts[0]
            bus_pad = int(parts[1])
            ribbon = int(parts[2])
            return (0 if col_type == 'Front' else 1, bus_pad, ribbon)
        else:
            return (-1, 0, 0)
    
    # Sort peel test columns
    peel_columns = [col for col in df.columns if col not in base_columns]
    sorted_peel_columns = sorted(peel_columns, key=sort_peel_columns)
    final_columns = base_columns + sorted_peel_columns
    
    # Reorder columns
    df = df[final_columns]
    
    # Convert data types
    df['Date'] = pd.to_datetime(df['Date'])
    df['Shift'] = pd.Categorical(df['Shift'], categories=['A', 'B', 'C'], ordered=True)
    df['Unit'] = pd.Categorical(df['Unit'], categories=['A', 'B'], ordered=True)
    
    # Sort data
    df = df.sort_values(['Date', 'Shift', 'Stringer', 'Unit']).reset_index(drop=True)
    df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
    
    print(f"Successfully extracted {len(df)} records")
    return df


def connect_to_mongodb(connection_string):
    """Connect to MongoDB"""
    try:
        client = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        print("Successfully connected to MongoDB!")
        return client
    except ConnectionFailure as e:
        print(f"Failed to connect to MongoDB: {e}")
        return None
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return None


def get_collection_name(date_str):
    """Generate MongoDB collection name from date (format: peel_month_year)"""
    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    month_name = date_obj.strftime('%b').lower()
    year = date_obj.strftime('%Y')
    return f"peel_{month_name}_{year}"


def ensure_collection_index(collection):
    """Ensure unique index exists on the collection"""
    try:
        existing_indexes = collection.index_information()
        index_name = 'unique_date_shift_stringer_unit'
        index_exists = False
        
        # Check if index already exists
        for idx_name, idx_info in existing_indexes.items():
            if idx_name == index_name:
                index_exists = True
                break
        
        # Create index if it doesn't exist
        if not index_exists:
            collection.create_index(
                [
                    ('Date', ASCENDING),
                    ('Shift', ASCENDING),
                    ('Stringer', ASCENDING),
                    ('Unit', ASCENDING)
                ],
                unique=True,
                name=index_name
            )
            print(f"  Created unique index on collection '{collection.name}'")
        else:
            print(f"  Index already exists on collection '{collection.name}'")
            
    except OperationFailure as e:
        print(f"  Warning: Could not create index on '{collection.name}': {e}")
    except Exception as e:
        print(f"  Warning: Unexpected error while creating index: {e}")


def store_in_mongodb(df, mongo_client, db_name=None):
    """Store DataFrame data in MongoDB"""
    if db_name is None:
        db_name = MONGODB_DB_NAME
    if df.empty:
        print("No data to store in MongoDB")
        return
    
    db = mongo_client[db_name]
    print(f"\nWorking with database: '{db_name}'")
    
    # Add collection name to each record
    df_copy = df.copy()
    df_copy['collection_name'] = df_copy['Date'].apply(get_collection_name)
    
    # Group by collection name
    grouped = df_copy.groupby('collection_name')
    
    total_inserted = 0
    total_updated = 0
    total_errors = 0
    
    for collection_name, group_df in grouped:
        print(f"\nProcessing collection: '{collection_name}'")
        collection = db[collection_name]
        
        # Ensure unique index
        ensure_collection_index(collection)
        
        # Prepare records
        group_df = group_df.drop('collection_name', axis=1)
        records = group_df.to_dict('records')
        
        inserted = 0
        updated = 0
        errors = 0
        
        # Insert/update each record
        for record in records:
            try:
                filter_query = {
                    'Date': record['Date'],
                    'Shift': record['Shift'],
                    'Stringer': record['Stringer'],
                    'Unit': record['Unit']
                }
                
                # Check if record exists
                existing_record = collection.find_one(filter_query)
                
                if existing_record:
                    # Check if update is needed
                    needs_update = False
                    
                    # Check for changed values
                    for key, value in record.items():
                        if key in existing_record and existing_record[key] != value:
                            needs_update = True
                            break
                    
                    # Check for new keys
                    for key in record.keys():
                        if key not in existing_record:
                            needs_update = True
                            break
                    
                    # Update if needed
                    if needs_update:
                        collection.update_one(filter_query, {'$set': record})
                        updated += 1
                else:
                    # Insert new record
                    collection.insert_one(record)
                    inserted += 1
                    
            except DuplicateKeyError:
                # Handle duplicates
                try:
                    collection.update_one(filter_query, {'$set': record})
                    updated += 1
                except Exception as e:
                    print(f"  Error updating duplicate record: {e}")
                    errors += 1
                    
            except Exception as e:
                print(f"  Error processing record: {e}")
                errors += 1
        
        # Update totals
        total_inserted += inserted
        total_updated += updated
        total_errors += errors
        
        print(f"  ✓ {inserted} new records inserted")
        print(f"  ✓ {updated} existing records updated")
        if errors > 0:
            print(f"  ✗ {errors} errors occurred")
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"SUMMARY:")
    print(f"  Total new records inserted: {total_inserted}")
    print(f"  Total records updated: {total_updated}")
    print(f"  Total errors: {total_errors}")
    print(f"{'='*60}")


def list_mongodb_collections(mongo_client, db_name=None):
    """List all collections in the database"""
    if db_name is None:
        db_name = MONGODB_DB_NAME
    try:
        db = mongo_client[db_name]
        collections = db.list_collection_names()
        
        if collections:
            print(f"\nCollections in database '{db_name}':")
            for col in collections:
                count = db[col].count_documents({})
                print(f"  - {col}: {count} documents")
        else:
            print(f"\nNo collections found in database '{db_name}'")
        
        return collections
        
    except Exception as e:
        print(f"Error listing collections: {e}")
        return []


def query_mongodb_example(mongo_client, db_name=None, collection_name='peel_jan_2024'):
    """Query MongoDB for example data"""
    if db_name is None:
        db_name = MONGODB_DB_NAME
    try:
        db = mongo_client[db_name]
        
        if collection_name not in db.list_collection_names():
            print(f"Collection '{collection_name}' does not exist in database '{db_name}'")
            return []
        
        collection = db[collection_name]
        all_records = list(collection.find())
        
        print(f"\nTotal records in '{collection_name}': {len(all_records)}")
        
        if all_records:
            print(f"\nExample record:")
            print(all_records[0])
        
        return all_records
        
    except Exception as e:
        print(f"Error querying MongoDB: {e}")
        return []


def main():
    """Main function to run the peel test data extraction pipeline"""
    
    # Define root path for peel test data
    s3_prefix = get_qc_data_key("Auto Peel Test Result")
    root_path = download_folder_from_s3(s3_prefix)
    
    print(f"Downloaded to: {root_path}")
    
    # Step 1: Extract data from folder structure
    df = create_structured_dataframe(root_path)
    
    if not df.empty:
        print(f"\nDataFrame shape: {df.shape}")
        print(f"\nFirst few records:")
        print(df.head())
        
        # Step 2: Connect to MongoDB
        mongo_client = connect_to_mongodb(MONGODB_URI)
        
        if mongo_client:
            # Step 3: Store data in MongoDB
            store_in_mongodb(df, mongo_client)
            
            # Step 4: List collections
            list_mongodb_collections(mongo_client)
            
            # Step 5: Close connection
            mongo_client.close()
            print("\n✓ MongoDB connection closed successfully")
        else:
            print("\n✗ Could not connect to MongoDB. Data saved to files only.")
    else:
        print("No data was extracted. Please check the folder structure and file paths.")


if __name__ == "__main__":
    main()