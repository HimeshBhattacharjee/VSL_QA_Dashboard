from openpyxl import load_workbook
import io
from paths import get_template_key, download_from_s3

def fill_adhesion_basic_info(worksheet, adhesion_data):
    try:
        form_data = adhesion_data.get('form_data', {})
        basic_info_mapping = {
            'adhesion_editable_0': 'E5',
            'adhesion_editable_1': 'C8',
            'adhesion_editable_2': 'C9',
            'adhesion_editable_3': 'C10',
            'adhesion_editable_4': 'C15',
            'adhesion_editable_5': 'D15',
            'adhesion_editable_6': 'E15',
            'adhesion_editable_19': 'C21',
            'adhesion_editable_20': 'C22',
            'adhesion_editable_21': 'C23',
            'adhesion_editable_22': 'C24',
            'adhesion_editable_23': 'C25',
            'adhesion_editable_24': 'C26',
            'adhesion_editable_25': 'C27',
            'preparedBySignature': 'B38',
            'verifiedBySignature': 'E38'
        }
        
        # Fill basic info fields
        for field, cell_ref in basic_info_mapping.items():
            if field in form_data and form_data[field]:
                worksheet[cell_ref] = form_data[field]
        
        # Handle date field separately
        if 'testDate' in form_data and form_data['testDate']:
            worksheet['C6'] = form_data['testDate']
            print(f"Date filled: {form_data['testDate']}")
        
        # Handle shift field separately
        if 'shift' in form_data and form_data['shift']:
            worksheet['C7'] = form_data['shift']
            print(f"Shift filled: {form_data['shift']}")
        
        # Handle laminator field separately
        if 'laminator' in form_data and form_data['laminator']:
            worksheet['C11'] = form_data['laminator']
            print(f"Laminator filled: {form_data['laminator']}")
        
        # Handle lamination position field separately
        if 'laminationPosition' in form_data and form_data['laminationPosition']:
            worksheet['C12'] = form_data['laminationPosition']
            print(f"Lamination Position filled: {form_data['laminationPosition']}")
        
        # Handle lamination parameters from JSON
        if 'lamParams' in form_data and form_data['lamParams']:
            import json
            lam_params = json.loads(form_data['lamParams'])
            
            # Mapping for lamination parameters to Excel cells
            # Adjust these cell references based on your actual Excel template
            lam_params_mapping = {
                # Lam1 parameters
                'lam1_pumpingTime': 'C16',    # Adjust cell reference as needed
                'lam1_pressingTime': 'C17',   # Adjust cell reference as needed
                'lam1_ventingTime': 'C18',    # Adjust cell reference as needed
                'lam1_processTime': 'C19',    # Adjust cell reference as needed
                
                # Lam2 parameters
                'lam2_pumpingTime': 'D16',    # Adjust cell reference as needed
                'lam2_pressingTime': 'D17',   # Adjust cell reference as needed
                'lam2_ventingTime': 'D18',    # Adjust cell reference as needed
                'lam2_processTime': 'D19',    # Adjust cell reference as needed
                
                # Lam3 parameters
                'lam3_pumpingTime': 'E16',    # Adjust cell reference as needed
                'lam3_pressingTime': 'E17',   # Adjust cell reference as needed
                'lam3_ventingTime': 'E18',    # Adjust cell reference as needed
                'lam3_processTime': 'E19',    # Adjust cell reference as needed
            }
            
            # Fill lamination parameters
            for lam_key, lam_data in lam_params.items():
                if lam_key == 'lam1':
                    if 'pumpingTime' in lam_data:
                        worksheet[lam_params_mapping['lam1_pumpingTime']] = lam_data['pumpingTime']
                    if 'pressingTime' in lam_data:
                        worksheet[lam_params_mapping['lam1_pressingTime']] = lam_data['pressingTime']
                    if 'ventingTime' in lam_data:
                        worksheet[lam_params_mapping['lam1_ventingTime']] = lam_data['ventingTime']
                    if 'processTime' in lam_data:
                        worksheet[lam_params_mapping['lam1_processTime']] = lam_data['processTime']
                        
                elif lam_key == 'lam2':
                    if 'pumpingTime' in lam_data:
                        worksheet[lam_params_mapping['lam2_pumpingTime']] = lam_data['pumpingTime']
                    if 'pressingTime' in lam_data:
                        worksheet[lam_params_mapping['lam2_pressingTime']] = lam_data['pressingTime']
                    if 'ventingTime' in lam_data:
                        worksheet[lam_params_mapping['lam2_ventingTime']] = lam_data['ventingTime']
                    if 'processTime' in lam_data:
                        worksheet[lam_params_mapping['lam2_processTime']] = lam_data['processTime']
                        
                elif lam_key == 'lam3':
                    if 'pumpingTime' in lam_data:
                        worksheet[lam_params_mapping['lam3_pumpingTime']] = lam_data['pumpingTime']
                    if 'pressingTime' in lam_data:
                        worksheet[lam_params_mapping['lam3_pressingTime']] = lam_data['pressingTime']
                    if 'ventingTime' in lam_data:
                        worksheet[lam_params_mapping['lam3_ventingTime']] = lam_data['ventingTime']
                    if 'processTime' in lam_data:
                        worksheet[lam_params_mapping['lam3_processTime']] = lam_data['processTime']
            
            print(f"Lamination parameters filled successfully")
            
        print("Basic adhesion test information filled successfully")
    except Exception as e:
        print(f"Error filling basic adhesion test info: {str(e)}")
        raise

def fill_adhesion_test_data(worksheet, adhesion_data):
    try:
        form_data = adhesion_data.get('form_data', {})
        averages = adhesion_data.get('averages', {})
        
        test_data_mapping = {
            'adhesion_data_0': 'B31',  # Position 1 Front Min
            'adhesion_data_1': 'C31',  # Position 1 Front Max
            'adhesion_data_2': 'D31',  # Position 1 Back Min
            'adhesion_data_3': 'E31',  # Position 1 Back Max
            'adhesion_data_4': 'B32',  # Position 2 Front Min
            'adhesion_data_5': 'C32',  # Position 2 Front Max
            'adhesion_data_6': 'D32',  # Position 2 Back Min
            'adhesion_data_7': 'E32',  # Position 2 Back Max
            'adhesion_data_8': 'B33',  # Position 3 Front Min
            'adhesion_data_9': 'C33',  # Position 3 Front Max
            'adhesion_data_10': 'D33', # Position 3 Back Min
            'adhesion_data_11': 'E33', # Position 3 Back Max
            'adhesion_data_12': 'B34', # Position 4 Front Min
            'adhesion_data_13': 'C34', # Position 4 Front Max
            'adhesion_data_14': 'D34', # Position 4 Back Min
            'adhesion_data_15': 'E34', # Position 4 Back Max
            'adhesion_data_16': 'B35', # Position 5 Front Min
            'adhesion_data_17': 'C35', # Position 5 Front Max
            'adhesion_data_18': 'D35', # Position 5 Back Min
            'adhesion_data_19': 'E35', # Position 5 Back Max
        }
        
        for field, cell_ref in test_data_mapping.items():
            if field in form_data:
                value = form_data[field]
                # Handle hyphenated values
                if value == '-' or value == '':
                    worksheet[cell_ref] = '-'  # Keep hyphen for empty values
                else:
                    worksheet[cell_ref] = value
        
        averages_mapping = {
            'frontMinAvg': 'B36',
            'frontMaxAvg': 'C36',
            'backMinAvg': 'D36',
            'backMaxAvg': 'E36'
        }
        
        for field, cell_ref in averages_mapping.items():
            if field in averages and averages[field]:
                value = averages[field]
                # Handle hyphenated average values
                if value == '-' or value == '':
                    worksheet[cell_ref] = '-'
                else:
                    worksheet[cell_ref] = value
        
        print("Adhesion test data filled successfully")
    except Exception as e:
        print(f"Error filling adhesion test data: {str(e)}")
        raise

def generate_adhesion_filename(adhesion_data):
    report_name = adhesion_data.get('name', 'Adhesion_Test_Report')
    timestamp = adhesion_data.get('timestamp', '').split('T')[0] if adhesion_data.get('timestamp') else ''
    clean_name = "".join(c for c in report_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
    clean_name = clean_name.replace(' ', '_')
    if timestamp:
        return f"Adhesion_Test_{clean_name}_{timestamp}.xlsx"
    else:
        return f"Adhesion_Test_{clean_name}.xlsx"

def generate_adhesion_report(adhesion_data):
    try:
        if not adhesion_data:
            raise ValueError("No adhesion test data provided")
        print("Received adhesion test data for report generation")
        print(f"Report name: {adhesion_data.get('name', 'N/A')}")
        print(f"Form data keys: {list(adhesion_data.get('form_data', {}).keys())}")
        print(f"Averages keys: {list(adhesion_data.get('averages', {}).keys())}")
        
        template_key = get_template_key('Blank Adhesion Test Report.xlsx')
        template_path = download_from_s3(template_key)
        wb = load_workbook(template_path)
        ws = wb.active
        
        fill_adhesion_basic_info(ws, adhesion_data)
        fill_adhesion_test_data(ws, adhesion_data)
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        filename = generate_adhesion_filename(adhesion_data)
        print(f"Adhesion test report generated successfully: {filename}")
        return output, filename
    except Exception as e:
        print(f"Error generating adhesion test report: {str(e)}")
        raise