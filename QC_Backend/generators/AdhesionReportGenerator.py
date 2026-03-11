from openpyxl import load_workbook
import io
from paths import get_template_key, download_from_s3

def fill_adhesion_basic_info(worksheet, adhesion_data):
    try:
        form_data = adhesion_data.get('form_data', {})
        basic_info_mapping = {
            'adhesion_editable_0': 'E5',
            'adhesion_editable_1': 'C6',
            'adhesion_editable_2': 'C7',
            'adhesion_editable_3': 'C8',
            'adhesion_editable_4': 'C9',
            'adhesion_editable_5': 'C10',
            'adhesion_editable_6': 'C11',
            'adhesion_editable_7': 'C12',
            'adhesion_editable_8': 'C15',
            'adhesion_editable_9': 'D15',
            'adhesion_editable_10': 'E15',
            'adhesion_editable_11': 'C16',
            'adhesion_editable_12': 'D16',
            'adhesion_editable_13': 'E16',
            'adhesion_editable_14': 'C17',
            'adhesion_editable_15': 'D17',
            'adhesion_editable_16': 'E17',
            'adhesion_editable_17': 'C18',
            'adhesion_editable_18': 'D18',
            'adhesion_editable_19': 'E18',
            'adhesion_editable_20': 'C19',
            'adhesion_editable_21': 'D19',
            'adhesion_editable_22': 'E19',
            'adhesion_editable_23': 'C21',
            'adhesion_editable_24': 'C22',
            'adhesion_editable_25': 'C23',
            'adhesion_editable_26': 'C24',
            'adhesion_editable_27': 'C25',
            'adhesion_editable_28': 'C26',
            'adhesion_editable_29': 'C27',
            'preparedBySignature': 'B38',
            'verifiedBySignature': 'E38'
        }
        for field, cell_ref in basic_info_mapping.items():
            if field in form_data and form_data[field]:
                worksheet[cell_ref] = form_data[field]
        print("Basic adhesion test information filled successfully")
    except Exception as e:
        print(f"Error filling basic adhesion test info: {str(e)}")
        raise

def fill_adhesion_test_data(worksheet, adhesion_data):
    try:
        form_data = adhesion_data.get('form_data', {})
        averages = adhesion_data.get('averages', {})
        test_data_mapping = {
            'adhesion_data_0': 'B31',
            'adhesion_data_1': 'C31',
            'adhesion_data_2': 'D31',
            'adhesion_data_3': 'E31',
            'adhesion_data_4': 'B32',
            'adhesion_data_5': 'C32',
            'adhesion_data_6': 'D32',
            'adhesion_data_7': 'E32',
            'adhesion_data_8': 'B33',
            'adhesion_data_9': 'C33',
            'adhesion_data_10': 'D33',
            'adhesion_data_11': 'E33',
            'adhesion_data_12': 'B34',
            'adhesion_data_13': 'C34',
            'adhesion_data_14': 'D34',
            'adhesion_data_15': 'E34',
            'adhesion_data_16': 'B35',
            'adhesion_data_17': 'C35',
            'adhesion_data_18': 'D35',
            'adhesion_data_19': 'E35',
        }
        for field, cell_ref in test_data_mapping.items():
            if field in form_data and form_data[field]:
                worksheet[cell_ref] = form_data[field]
        averages_mapping = {
            'frontMinAvg': 'B36',
            'frontMaxAvg': 'C36',
            'backMinAvg': 'D36',
            'backMaxAvg': 'E36'
        }
        for field, cell_ref in averages_mapping.items():
            if field in averages and averages[field]:
                worksheet[cell_ref] = averages[field]
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