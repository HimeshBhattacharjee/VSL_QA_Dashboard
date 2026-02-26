from openpyxl import load_workbook
from openpyxl.styles import (Font, PatternFill, Alignment, Border, Side, NamedStyle)
import io
from paths import get_template_key, download_from_s3

def setup_adhesion_cell_styles(workbook):
    # Data style
    data_style = NamedStyle(name="adhesion_data_style")
    data_style.font = Font(name='Arial', size=11)
    data_style.alignment = Alignment(horizontal='center', vertical='center')
    data_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Header style
    header_style = NamedStyle(name="adhesion_header_style")
    header_style.font = Font(name='Arial', size=11, bold=True)
    header_style.fill = PatternFill(start_color='D9D9D9', end_color='D9D9D9', fill_type='solid')
    header_style.alignment = Alignment(horizontal='center', vertical='center')
    header_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Text style for multi-line content
    multiline_style = NamedStyle(name="multiline_style")
    multiline_style.font = Font(name='Arial', size=11)
    multiline_style.alignment = Alignment(vertical='top', wrap_text=True)
    
    # Add styles to workbook
    for style in [data_style, header_style, multiline_style]:
        if style.name not in workbook.named_styles:
            workbook.add_named_style(style)

def fill_adhesion_basic_info(worksheet, adhesion_data):
    try:
        form_data = adhesion_data.get('form_data', {})
        basic_info_mapping = {
            'editable_0': 'E5',
            'editable_1': 'C6',
            'editable_2': 'C7',
            'editable_3': 'C8',
            'editable_4': 'C9',
            'editable_5': 'C10',
            'editable_6': 'C11',
            'editable_7': 'C12',
            'editable_8': 'C15',
            'editable_9': 'D15',
            'editable_10': 'E15',
            'editable_11': 'C16',
            'editable_12': 'D16',
            'editable_13': 'E16',
            'editable_14': 'C17',
            'editable_15': 'D17',
            'editable_16': 'E17',
            'editable_17': 'C18',
            'editable_18': 'D18',
            'editable_19': 'E18',
            'editable_20': 'C19',
            'editable_21': 'D19',
            'editable_22': 'E19',
            'editable_23': 'C21',
            'editable_24': 'C22',
            'editable_25': 'C23',
            'editable_26': 'C24',
            'editable_27': 'C25',
            'editable_28': 'C26',
            'editable_29': 'C27',
            'preparedBySignature': 'B38',
            'verifiedBySignature': 'D38'
        }
        for field, cell_ref in basic_info_mapping.items():
            if field in form_data and form_data[field]:
                worksheet[cell_ref] = form_data[field]
                apply_adhesion_cell_formatting(worksheet[cell_ref], font_size=11, horizontal='center')
        
        print("Basic adhesion test information filled successfully")
        
    except Exception as e:
        print(f"Error filling basic adhesion test info: {str(e)}")
        raise

def fill_adhesion_test_data(worksheet, adhesion_data):
    try:
        form_data = adhesion_data.get('form_data', {})
        averages = adhesion_data.get('averages', {})
        test_data_mapping = {
            'data_0': 'B31',
            'data_1': 'C31',
            'data_2': 'D31',
            'data_3': 'E31',
            'data_4': 'B32',
            'data_5': 'C32',
            'data_6': 'D32',
            'data_7': 'E32',
            'data_8': 'B33',
            'data_9': 'C33',
            'data_10': 'D33',
            'data_11': 'E33',
            'data_12': 'B34',
            'data_13': 'C34',
            'data_14': 'D34',
            'data_15': 'E34',
            'data_16': 'B35',
            'data_17': 'C35',
            'data_18': 'D35',
            'data_19': 'E35',
        }
        for field, cell_ref in test_data_mapping.items():
            if field in form_data and form_data[field]:
                worksheet[cell_ref] = form_data[field]
                apply_adhesion_cell_formatting(worksheet[cell_ref], font_size=11, horizontal='center')
        averages_mapping = {
            'frontMinAvg': 'B36',
            'frontMaxAvg': 'C36',
            'backMinAvg': 'D36',
            'backMaxAvg': 'E36'
        }
        for field, cell_ref in averages_mapping.items():
            if field in averages and averages[field]:
                worksheet[cell_ref] = averages[field]
                apply_adhesion_cell_formatting(worksheet[cell_ref], font_size=11, bold=True, horizontal='center')
        
        print("Adhesion test data filled successfully")
        
    except Exception as e:
        print(f"Error filling adhesion test data: {str(e)}")
        raise

def apply_adhesion_cell_formatting(cell, font_size=11, bold=False, 
                             text_color='000000', horizontal='center', vertical='center',
                             is_checkbox=False, wrap_text=True):
    """
    Apply comprehensive formatting to an adhesion test cell
    """
    # Font settings
    cell.font = Font(
        name='Arial',
        size=font_size,
        bold=bold,
        color=text_color
    )
    
    # Alignment
    cell.alignment = Alignment(
        horizontal=horizontal,
        vertical=vertical,
        wrap_text=wrap_text
    )
    
    # Border
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    cell.border = thin_border

def generate_adhesion_filename(adhesion_data):
    """
    Generate filename for adhesion test report
    """
    report_name = adhesion_data.get('name', 'Adhesion_Test_Report')
    timestamp = adhesion_data.get('timestamp', '').split('T')[0] if adhesion_data.get('timestamp') else ''
    
    # Clean filename
    clean_name = "".join(c for c in report_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
    clean_name = clean_name.replace(' ', '_')
    
    if timestamp:
        return f"Adhesion_Test_{clean_name}_{timestamp}.xlsx"
    else:
        return f"Adhesion_Test_{clean_name}.xlsx"

def generate_adhesion_report(adhesion_data):
    """
    Main function to generate adhesion test report - called from FastAPI
    """
    try:
        if not adhesion_data:
            raise ValueError("No adhesion test data provided")
        
        print("Received adhesion test data for report generation")
        print(f"Report name: {adhesion_data.get('name', 'N/A')}")
        print(f"Form data keys: {list(adhesion_data.get('form_data', {}).keys())}")
        print(f"Averages keys: {list(adhesion_data.get('averages', {}).keys())}")
        
        # Template path - Update with your actual template filename
        template_key = get_template_key('Blank Adhesion Test Report.xlsx')
        template_path = download_from_s3(template_key)
        
        # Load workbook
        wb = load_workbook(template_path)
        ws = wb.active
        
        # Setup styles
        setup_adhesion_cell_styles(wb)
        
        # Fill all data sections
        fill_adhesion_basic_info(ws, adhesion_data)
        fill_adhesion_test_data(ws, adhesion_data)
        
        # Set row heights for better text display
        ws.row_dimensions[9].height = 25   # Date row
        ws.row_dimensions[32].height = 20  # Data rows
        ws.row_dimensions[33].height = 20
        ws.row_dimensions[34].height = 20
        ws.row_dimensions[35].height = 20
        ws.row_dimensions[36].height = 20
        
        # Save to bytes buffer
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)  # Reset pointer to start of stream
        
        filename = generate_adhesion_filename(adhesion_data)
        
        print(f"Adhesion test report generated successfully: {filename}")
        return output, filename
        
    except Exception as e:
        print(f"Error generating adhesion test report: {str(e)}")
        raise