import pandas as pd
import pymongo
from datetime import datetime
from paths import get_reference_file_key, download_from_s3
from constants import MONGODB_URI, MONGODB_DB_NAME_QUALITY_ANALYSIS

# ============================================
# PART 1: DATA EXTRACTION FROM EXCEL FILES
# ============================================

print("Starting data extraction from Excel files...")

# file_path_1 = get_reference_file_path("Rejection Report Fab-II,L-I September-2025.xlsx")
# file_path_2 = get_reference_file_path("Rejection Report Fab-II,L-II September-2025.xlsx")

file_key_1 = get_reference_file_key("Rejection Report Fab-II,L-I September-2025.xlsx")
file_key_2 = get_reference_file_key("Rejection Report Fab-II,L-II September-2025.xlsx")

file_path_1 = download_from_s3(file_key_1)
file_path_2 = download_from_s3(file_key_2)

all_lines_data = {}

for line_num in [1, 2, 3, 4]:
    sheet_name = f"Line - {line_num}"
    try:
        if line_num == 1 or line_num == 2:
            df = pd.read_excel(file_path_1, sheet_name=sheet_name, header=None)
        elif line_num == 3 or line_num == 4:
            df = pd.read_excel(file_path_2, sheet_name=sheet_name, header=None)
        
        dates = df.iloc[2, 2:].dropna().values
        inspection_datasets = {}
        section_info = []
        
        for i, row in df.iterrows():
            if i >= 1:
                cell_value = str(row[1]) if pd.notna(row[1]) else ""
                if "Pre-El Inspection" in cell_value:
                    section_info.append(("Pre-EL", i))
                elif "Visual Inspection" in cell_value:
                    section_info.append(("Visual", i))
                elif "Lam-QC Inspection" in cell_value:
                    section_info.append(("Lam-QC", i))
                elif "FQC Inspection" in cell_value:
                    section_info.append(("FQC", i))
        
        section_info_with_ends = []
        for i in range(len(section_info)):
            section_name, start_idx = section_info[i]
            end_idx = section_info[i+1][1] if i < len(section_info) - 1 else len(df)
            section_info_with_ends.append((section_name, start_idx, end_idx))
        
        for section_name, start_idx, end_idx in section_info_with_ends:
            metrics = []
            values_section = []
            for i in range(start_idx + 1, end_idx):
                metric_name = df.iloc[i, 1]
                if (pd.notna(metric_name) and 
                    metric_name not in ["", "Date"] and
                    not any(keyword in str(metric_name) for keyword in ["Inspection report"])):
                    metrics.append(metric_name)
                    values_section.append(df.iloc[i, 2:].values)
            
            if metrics:
                values = values_section
                temp_df = pd.DataFrame(values, columns=dates, index=metrics)
                section_df = temp_df.T.reset_index()
                section_df = section_df.rename(columns={"index": "Date"})
                section_df = section_df[section_df['Date'] != 'Month total']
                section_df["Line"] = line_num
                line_col_index = section_df.columns.get_loc("Line")
                columns_to_keep = section_df.columns[:line_col_index + 1]
                section_df = section_df[columns_to_keep]
                inspection_datasets[section_name] = section_df
        
        all_lines_data[f"Line_{line_num}"] = inspection_datasets
        print(f"Successfully processed Line-{line_num}")
    except Exception as e:
        print(f"Error processing Line-{line_num}: {e}")
        all_lines_data[f"Line_{line_num}"] = {}

# Convert numeric columns to numeric type
for line_num in [1, 2, 3, 4]:
    line_key = f"Line_{line_num}"
    if line_key in all_lines_data and all_lines_data[line_key]:
        print(f"\n=== Line-{line_num} ===")
        print(f"Available datasets: {list(all_lines_data[line_key].keys())}")
        for section_name, dataset in all_lines_data[line_key].items():
            for col in dataset.columns:
                if col not in ['Date', 'Line']:
                    dataset[col] = pd.to_numeric(dataset[col], errors='coerce').fillna(0)
    else:
        print(f"\n=== Line-{line_num} === No data available")

# Create combined datasets
combined_datasets = {}

for inspection_type in ["Pre-EL", "Visual", "Lam-QC", "FQC"]:
    combined_data = []
    for line_num in [1, 2, 3, 4]:
        line_key = f"Line_{line_num}"
        if line_key in all_lines_data and inspection_type in all_lines_data[line_key]:
            line_data = all_lines_data[line_key][inspection_type]
            line_data = line_data[line_data['Date'] != 'Month total']
            combined_data.append(line_data)
    
    if combined_data:
        combined_datasets[inspection_type] = pd.concat(combined_data, ignore_index=True)
        if "Line" in combined_datasets[inspection_type].columns:
            line_col_index = combined_datasets[inspection_type].columns.get_loc("Line")
            columns_to_keep = combined_datasets[inspection_type].columns[:line_col_index + 1]
            combined_datasets[inspection_type] = combined_datasets[inspection_type][columns_to_keep]
        
        print(f"\nCombined {inspection_type} Dataset (All Lines):")
        for col in combined_datasets[inspection_type].columns:
            if col not in ['Date', 'Line']:
                combined_datasets[inspection_type][col] = pd.to_numeric(
                    combined_datasets[inspection_type][col], errors='coerce').fillna(0)
        
        print(combined_datasets[inspection_type].head())

# ============================================
# PART 2: DATA ACCESS FUNCTIONS
# ============================================

def get_line_data(line_number, inspection_type):
    """Get data for a specific line and inspection type."""
    line_key = f"Line_{line_number}"
    if line_key in all_lines_data and inspection_type in all_lines_data[line_key]:
        return all_lines_data[line_key][inspection_type].copy()
    else:
        print(f"Data not available for Line {line_number}, {inspection_type}")
        return None

def get_all_line_data(line_number):
    """Get all data for a specific line."""
    line_key = f"Line_{line_number}"
    if line_key in all_lines_data:
        return all_lines_data[line_key].copy()
    else:
        print(f"No data available for Line {line_number}")
        return None

# Display separate line data availability
print("=== SEPARATE LINE DATA AVAILABILITY ===")

for line_num in [1, 2, 3, 4]:
    line_data = get_all_line_data(line_num)
    if line_data:
        print(f"\nLine {line_num}:")
        for inspection_type, dataset in line_data.items():
            print(f"  {inspection_type}:")
            print(dataset.head(3))
    else:
        print(f"\nLine {line_num}: No data available")

# ============================================
# PART 3: DATABASE SETUP FUNCTIONS
# ============================================

def dataframe_to_documents(df, line, inspection_type):
    """Convert DataFrame to MongoDB documents."""
    documents = []
    if df is None or df.empty:
        print(f"⚠ Warning: Empty DataFrame for line {line}, inspection {inspection_type}")
        return documents
    
    try:
        for _, row in df.iterrows():
            doc = {}
            for col in df.columns:
                value = row[col]
                if pd.isna(value):
                    doc[col] = 0
                elif isinstance(value, (int, float)):
                    doc[col] = int(value) if value == int(value) else float(value)
                elif isinstance(value, (datetime, pd.Timestamp)):
                    doc[col] = value.strftime('%Y-%m-%d')
                else:
                    doc[col] = str(value)
            
            doc['import_timestamp'] = datetime.now()
            doc['data_source'] = 'excel_import'
            doc['inspection_type'] = inspection_type
            if line != "combined":
                doc['line_number'] = line
            
            documents.append(doc)
        
        print(f"  Created {len(documents)} documents from DataFrame with {len(df.columns)} columns")
    except Exception as e:
        print(f"✗ Error converting DataFrame to documents: {e}")
    
    return documents

def create_summary_document(df, line, inspection_type, data_type):
    """Create summary document for a dataset."""
    try:
        if df is None or df.empty:
            print(f"⚠ Cannot create summary for empty DataFrame: line {line}, {inspection_type}")
            return None
        
        # Date range calculation
        if 'Date' in df.columns:
            dates = pd.to_datetime(df['Date'], errors='coerce')
            valid_dates = dates.dropna()
            if not valid_dates.empty:
                start_date = valid_dates.min().strftime('%Y-%m-%d')
                end_date = valid_dates.max().strftime('%Y-%m-%d')
                days_covered = len(valid_dates)
            else:
                start_date = "Unknown"
                end_date = "Unknown"
                days_covered = 0
        else:
            start_date = "Unknown"
            end_date = "Unknown"
            days_covered = 0
        
        # Metadata and defect columns
        metadata_columns = ['Date', 'Total Production', 'Total rejection', 'Rejection %', 'Line']
        defect_columns = [col for col in df.columns if col not in metadata_columns]
        
        # Calculate totals
        total_production = 0
        total_rejection = 0
        
        if 'Total Production' in df.columns:
            total_production = df['Total Production'].sum()
        if 'Total rejection' in df.columns:
            total_rejection = df['Total rejection'].sum()
        
        avg_rejection_rate = (total_rejection / total_production * 100) if total_production > 0 else 0
        
        # Create summary document
        summary = {
            'line': line if data_type == "individual" else "combined",
            'inspection_type': inspection_type,
            'data_type': data_type,
            'total_records': len(df),
            'date_range': {
                'start_date': start_date,
                'end_date': end_date,
                'days_covered': days_covered
            },
            'production_stats': {
                'total_production': int(total_production),
                'total_rejection': int(total_rejection),
                'average_rejection_rate': round(avg_rejection_rate, 4)
            },
            'defect_columns': defect_columns,
            'defect_counts': {},
            'created_at': datetime.now(),
            'data_source': 'excel_import'
        }
        
        # Add defect counts
        for defect in defect_columns:
            if defect in df.columns:
                total_defects = df[defect].sum()
                summary['defect_counts'][defect] = int(total_defects)
        
        print(f"  Summary created: {len(df)} records, {len(defect_columns)} defect types")
        return summary
        
    except Exception as e:
        print(f"✗ Error creating summary document: {e}")
        return None

def create_collections(db):
    """Create all necessary collections in MongoDB."""
    print("\n=== Creating Collections ===\n")
    
    collections = [
        'line_1_pre_el_data', 'line_1_visual_data', 'line_1_lam_qc_data', 'line_1_fqc_data',
        'line_2_pre_el_data', 'line_2_visual_data', 'line_2_lam_qc_data', 'line_2_fqc_data',
        'line_3_pre_el_data', 'line_3_visual_data', 'line_3_lam_qc_data', 'line_3_fqc_data',
        'line_4_pre_el_data', 'line_4_visual_data', 'line_4_lam_qc_data', 'line_4_fqc_data',
        
        'line_1_pre_el_summary', 'line_1_visual_summary', 'line_1_lam_qc_summary', 'line_1_fqc_summary',
        'line_2_pre_el_summary', 'line_2_visual_summary', 'line_2_lam_qc_summary', 'line_2_fqc_summary',
        'line_3_pre_el_summary', 'line_3_visual_summary', 'line_3_lam_qc_summary', 'line_3_fqc_summary',
        'line_4_pre_el_summary', 'line_4_visual_summary', 'line_4_lam_qc_summary', 'line_4_fqc_summary',
        
        'combined_pre_el_data', 'combined_visual_data', 'combined_lam_qc_data', 'combined_fqc_data',
        
        'combined_pre_el_summary', 'combined_visual_summary', 'combined_lam_qc_summary', 'combined_fqc_summary'
    ]
    
    existing_collections = db.list_collection_names()
    created_count = 0
    
    for collection in collections:
        if collection not in existing_collections:
            db.create_collection(collection)
            print(f"✓ Created collection: {collection}")
            created_count += 1
        else:
            print(f"✓ Collection already exists: {collection}")
    
    print(f"\nTotal collections: {len(collections)}")
    print(f"New collections created: {created_count}")
    
    return True

def import_individual_line_data(db, all_lines_data):
    """Import individual line data into MongoDB."""
    print("\n=== Importing Individual Line Data ===\n")
    
    for line_num in [1, 2, 3, 4]:
        line_key = f"Line_{line_num}"
        
        if line_key in all_lines_data and all_lines_data[line_key]:
            print(f"--- Processing Line {line_num} ---")
            
            for inspection_type in ["Pre-EL", "Visual", "Lam-QC", "FQC"]:
                if inspection_type in all_lines_data[line_key]:
                    data_df = all_lines_data[line_key][inspection_type]
                    
                    if data_df is not None and not data_df.empty:
                        collection_name = f"line_{line_num}_{inspection_type.lower().replace('-', '_')}_data"
                        db[collection_name].delete_many({})
                        documents = dataframe_to_documents(data_df, line_num, inspection_type)
                        
                        if documents:
                            result = db[collection_name].insert_many(documents)
                            print(f"  ✓ {inspection_type}: {len(result.inserted_ids)} records")
                        else:
                            print(f"  ⚠ {inspection_type}: No documents created from DataFrame")
                    else:
                        print(f"  ✗ {inspection_type}: DataFrame is empty or None")
                else:
                    print(f"  ✗ {inspection_type}: Data not found in all_lines_data")
        else:
            print(f"✗ No data available for Line {line_num}")

def import_combined_data(db, combined_datasets):
    """Import combined data into MongoDB."""
    print("\n=== Importing Combined Data ===\n")
    
    for inspection_type in ["Pre-EL", "Visual", "Lam-QC", "FQC"]:
        if inspection_type in combined_datasets:
            data_df = combined_datasets[inspection_type]
            
            if data_df is not None and not data_df.empty:
                collection_name = f"combined_{inspection_type.lower().replace('-', '_')}_data"
                db[collection_name].delete_many({})
                documents = dataframe_to_documents(data_df, "combined", inspection_type)
                
                if documents:
                    result = db[collection_name].insert_many(documents)
                    print(f"✓ {inspection_type}: {len(result.inserted_ids)} records")
                else:
                    print(f"⚠ {inspection_type}: No documents created from DataFrame")
            else:
                print(f"✗ {inspection_type}: Combined DataFrame is empty or None")
        else:
            print(f"✗ {inspection_type}: Combined data not found")

def create_summaries(db, all_lines_data, combined_datasets):
    """Create summary collections in MongoDB."""
    print("\n=== Creating Summary Collections ===\n")
    
    # Create individual line summaries
    for line_num in [1, 2, 3, 4]:
        line_key = f"Line_{line_num}"
        
        if line_key in all_lines_data and all_lines_data[line_key]:
            print(f"--- Creating summaries for Line {line_num} ---")
            
            for inspection_type in ["Pre-EL", "Visual", "Lam-QC", "FQC"]:
                if inspection_type in all_lines_data[line_key]:
                    data_df = all_lines_data[line_key][inspection_type]
                    
                    if data_df is not None and not data_df.empty:
                        collection_name = f"line_{line_num}_{inspection_type.lower().replace('-', '_')}_summary"
                        db[collection_name].delete_many({})
                        summary = create_summary_document(data_df, line_num, inspection_type, "individual")
                        
                        if summary:
                            db[collection_name].insert_one(summary)
                            print(f"  ✓ {inspection_type} summary created")
                        else:
                            print(f"  ✗ {inspection_type}: Failed to create summary")
                    else:
                        print(f"  ✗ {inspection_type}: Cannot create summary - DataFrame is empty")
    
    # Create combined summaries
    print("\n--- Creating combined summaries ---")
    for inspection_type in ["Pre-EL", "Visual", "Lam-QC", "FQC"]:
        if inspection_type in combined_datasets:
            data_df = combined_datasets[inspection_type]
            
            if data_df is not None and not data_df.empty:
                collection_name = f"combined_{inspection_type.lower().replace('-', '_')}_summary"
                db[collection_name].delete_many({})
                summary = create_summary_document(data_df, "combined", inspection_type, "combined")
                
                if summary:
                    db[collection_name].insert_one(summary)
                    print(f"✓ {inspection_type} summary created")
                else:
                    print(f"✗ {inspection_type}: Failed to create summary")
            else:
                print(f"✗ {inspection_type}: Cannot create summary - DataFrame is empty")

def display_database_stats(db):
    """Display database statistics."""
    print("\n=== Database Statistics ===\n")
    
    total_documents = 0
    collection_stats = []
    
    for collection_name in sorted(db.list_collection_names()):
        count = db[collection_name].count_documents({})
        total_documents += count
        collection_stats.append((collection_name, count))
    
    print("Collection Details:")
    print("-" * 50)
    
    for collection_name, count in collection_stats:
        status = "✓ DATA" if count > 0 else "✗ EMPTY"
        print(f"{collection_name:<35} : {count:>5} documents {status}")
    
    print("-" * 50)
    print(f"{'TOTAL':<35} : {total_documents:>5} documents")
    
    print("\nData Overview:")
    print("-" * 30)
    
    individual_data = sum(count for name, count in collection_stats if 'line_' in name and '_data' in name)
    individual_summary = sum(count for name, count in collection_stats if 'line_' in name and '_summary' in name)
    combined_data = sum(count for name, count in collection_stats if 'combined_' in name and '_data' in name)
    combined_summary = sum(count for name, count in collection_stats if 'combined_' in name and '_summary' in name)
    
    print(f"Individual Line Data Records : {individual_data}")
    print(f"Individual Line Summary Records : {individual_summary}")
    print(f"Combined Data Records : {combined_data}")
    print(f"Combined Summary Records : {combined_summary}")
    
    empty_collections = [name for name, count in collection_stats if count == 0]
    if empty_collections:
        print(f"\n⚠ Empty Collections ({len(empty_collections)}):")
        for empty_coll in empty_collections:
            print(f"  - {empty_coll}")
    
    return total_documents

# ============================================
# PART 4: DATABASE QUERY FUNCTIONS
# ============================================

def get_collection_names(db):
    """Get all collection names in the database."""
    return sorted(db.list_collection_names())

def get_line_data_from_db(db, line_num, inspection_type):
    """Get data for a specific line and inspection type from database."""
    collection_name = f"line_{line_num}_{inspection_type.lower().replace('-', '_')}_data"
    if collection_name in db.list_collection_names():
        return list(db[collection_name].find({}))
    else:
        print(f"Collection {collection_name} not found")
        return []

def get_line_summary_from_db(db, line_num, inspection_type):
    """Get summary for a specific line and inspection type from database."""
    collection_name = f"line_{line_num}_{inspection_type.lower().replace('-', '_')}_summary"
    if collection_name in db.list_collection_names():
        return db[collection_name].find_one({})
    else:
        print(f"Collection {collection_name} not found")
        return None

def get_combined_data_from_db(db, inspection_type):
    """Get combined data for an inspection type from database."""
    collection_name = f"combined_{inspection_type.lower().replace('-', '_')}_data"
    if collection_name in db.list_collection_names():
        return list(db[collection_name].find({}))
    else:
        print(f"Collection {collection_name} not found")
        return []

def get_combined_summary_from_db(db, inspection_type):
    """Get combined summary for an inspection type from database."""
    collection_name = f"combined_{inspection_type.lower().replace('-', '_')}_summary"
    if collection_name in db.list_collection_names():
        return db[collection_name].find_one({})
    else:
        print(f"Collection {collection_name} not found")
        return None

def get_all_data_by_inspection_type(db, inspection_type):
    """Get all data for an inspection type from database."""
    result = {}
    
    for line_num in [1, 2, 3, 4]:
        line_data = get_line_data_from_db(db, line_num, inspection_type)
        result[f'line_{line_num}'] = line_data
    
    combined_data = get_combined_data_from_db(db, inspection_type)
    result['combined'] = combined_data
    
    return result

def demonstrate_usage(db):
    """Demonstrate database usage."""
    print("\n=== Usage Examples ===\n")
    
    collections = get_collection_names(db)
    print(f"1. Total collections in database: {len(collections)}")
    
    print(f"\n2. Data Availability Check:")
    for line_num in [1, 2, 3, 4]:
        for inspection_type in ["Pre-EL", "Visual", "Lam-QC", "FQC"]:
            data = get_line_data_from_db(db, line_num, inspection_type)
            if data:
                print(f"   Line {line_num} {inspection_type}: {len(data)} records")
    
    print(f"\n3. Line 1 Detailed Information:")
    for inspection_type in ["Pre-EL", "Visual", "Lam-QC", "FQC"]:
        summary = get_line_summary_from_db(db, 1, inspection_type)
        if summary:
            print(f"   {inspection_type}:")
            print(f"     - Records: {summary.get('total_records', 'N/A')}")
            print(f"     - Production: {summary.get('production_stats', {}).get('total_production', 'N/A')}")
            print(f"     - Rejection Rate: {summary.get('production_stats', {}).get('average_rejection_rate', 'N/A')}%")
    
    print(f"\n4. Combined Data Overview:")
    for inspection_type in ["Pre-EL", "Visual", "Lam-QC", "FQC"]:
        summary = get_combined_summary_from_db(db, inspection_type)
        if summary:
            print(f"   {inspection_type}: {summary.get('total_records', 'N/A')} total records")

# ============================================
# PART 5: MAIN DATABASE SETUP FUNCTION
# ============================================

def create_quality_analysis_database(all_lines_data, combined_datasets):
    """Main function to create quality analysis database."""
    print("=== Creating Quality Analysis Database ===\n")
    
    try:
        # Connect to MongoDB
        client = pymongo.MongoClient(MONGODB_URI)
        client.admin.command('ping')
        print("✓ Successfully connected to MongoDB")
        
        db = client[MONGODB_DB_NAME_QUALITY_ANALYSIS]
        print(f"✓ Using database: {MONGODB_DB_NAME_QUALITY_ANALYSIS}")
    except Exception as e:
        print(f"✗ Error connecting to MongoDB: {e}")
        return None
    
    # Create collections
    create_collections(db)
    
    # Import data
    import_individual_line_data(db, all_lines_data)
    import_combined_data(db, combined_datasets)
    
    # Create summaries
    create_summaries(db, all_lines_data, combined_datasets)
    
    # Display statistics
    display_database_stats(db)
    
    return db

def setup_quality_analysis_database(all_lines_data, combined_datasets):
    """Setup quality analysis database with verification."""
    print("🚀 Starting Quality Analysis Database Setup")
    print("=" * 50)
    print("\n=== Verifying Input Data ===")
    
    print(f"All Lines Data Keys: {list(all_lines_data.keys())}")
    for line_key in all_lines_data:
        if all_lines_data[line_key]:
            print(f"{line_key}: {list(all_lines_data[line_key].keys())}")
        else:
            print(f"{line_key}: EMPTY")
    
    print(f"Combined Datasets Keys: {list(combined_datasets.keys())}")
    
    # Create database
    db = create_quality_analysis_database(all_lines_data, combined_datasets)
    
    if db is not None:
        demonstrate_usage(db)
        print("\n" + "=" * 50)
        print("✅ Quality Analysis Database Setup Complete!")
        print("📊 Database ready for analysis and reporting")
        return db
    else:
        print("❌ Database setup failed")
        return None

# ============================================
# PART 6: MAIN EXECUTION
# ============================================

def main():
    # Setup and run the database
    db = setup_quality_analysis_database(all_lines_data, combined_datasets)
    
    if db is not None:
        print("\nDatabase setup completed successfully!")
        print(f"Available collections: {len(get_collection_names(db))}")
    else:
        print("\nDatabase setup failed!")

if __name__ == "__main__":
    main()