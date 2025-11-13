from openpyxl import load_workbook
from openpyxl.styles import (Font, PatternFill, Alignment, Border, Side, NamedStyle, numbers)
from openpyxl.utils import get_column_letter
import io
import os

def setup_cell_styles(workbook):
    """Create and register custom named styles"""
    
    # Header style
    header_style = NamedStyle(name="header_style")
    header_style.font = Font(name='Arial', size=18, bold=True, color='FFFFFF')
    header_style.fill = PatternFill(start_color='366092', end_color='366092', fill_type='solid')
    header_style.alignment = Alignment(horizontal='center', vertical='center')
    header_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Data style
    data_style = NamedStyle(name="data_style")
    data_style.font = Font(name='Arial', size=16)
    data_style.alignment = Alignment(horizontal='center', vertical='center')
    data_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Important data style
    important_style = NamedStyle(name="important_style")
    important_style.font = Font(name='Arial', size=16, bold=True, color='000000')
    important_style.alignment = Alignment(horizontal='center', vertical='center')
    important_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Add styles to workbook
    for style in [header_style, data_style, important_style]:
        if style.name not in workbook.named_styles:
            workbook.add_named_style(style)

def apply_cell_formatting(cell, style_type='data', font_size=16, bold=False, 
                         text_color='000000', horizontal='center', vertical='center'):
    """
    Apply comprehensive formatting to a cell
    """
    # Font settings
    cell.font = Font(
        name='Calibri',
        size=font_size,
        bold=bold,
        color=text_color
    )
    
    # Alignment
    cell.alignment = Alignment(
        horizontal=horizontal,
        vertical=vertical,
        wrap_text=True
    )
    
    # Border
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    cell.border = thin_border

def fill_basic_info(worksheet, audit_data):
    """
    Fill basic information from audit data into the Excel worksheet with formatting
    """
    try:
        # Define cell mapping and formatting for each field
        field_config = {
            'line_number': {
                'cell': 'D3',
                'label': 'Line Number',
                'format': {'font_size': 16, 'bold': True}
            },
            'date': {
                'cell': 'C5', 
                'label': 'Date',
                'format': {'font_size': 16}
            },
            'shift': {
                'cell': 'E5',
                'label': 'Shift', 
                'format': {'font_size': 16}
            },
            'production_order': {
                'cell': 'J5',
                'label': 'Production Order No.',
                'format': {'font_size': 16, 'bold': True}
            },
            'module_type': {
                'cell': 'U5',
                'label': 'Module Type',
                'format': {'font_size': 16}
            },
            'customer_spec_available': {
                'cell': 'D6',
                'label': 'Customer Specification Available',
                'format': {'font_size': 16, 'bold': True}
            },
            'spec_signed_off': {
                'cell': 'M6',
                'label': 'Specification Signed Off',
                'format': {'font_size': 16, 'bold': True}
            }
        }
        
        # Fill basic information with formatting
        if audit_data.get('lineNumber'):
            cell_ref = field_config['line_number']['cell']
            # Get existing text and append line number
            existing_text = worksheet[cell_ref].value or ""
            worksheet[cell_ref] = f"{existing_text}{audit_data['lineNumber']}"
            apply_cell_formatting(worksheet[cell_ref], **field_config['line_number']['format'])
        
        if audit_data.get('date'):
            cell_ref = field_config['date']['cell']
            worksheet[cell_ref] = audit_data['date']
            apply_cell_formatting(worksheet[cell_ref], **field_config['date']['format'])
        
        if audit_data.get('shift'):
            cell_ref = field_config['shift']['cell']
            shift_map = {'A': 'A', 'B': 'B', 'C': 'C', 'G': 'G'}
            worksheet[cell_ref] = shift_map.get(audit_data['shift'], audit_data['shift'])
            apply_cell_formatting(worksheet[cell_ref], **field_config['shift']['format'])
        
        if audit_data.get('productionOrderNo'):
            cell_ref = field_config['production_order']['cell']
            worksheet[cell_ref] = audit_data['productionOrderNo']
            apply_cell_formatting(worksheet[cell_ref], **field_config['production_order']['format'])
        
        if audit_data.get('moduleType'):
            cell_ref = field_config['module_type']['cell']
            worksheet[cell_ref] = audit_data['moduleType']
            apply_cell_formatting(worksheet[cell_ref], **field_config['module_type']['format'])
        
        # Fill checkboxes
        customer_spec = 'Yes' if audit_data.get('customerSpecAvailable') else 'No'
        spec_signed = 'Yes' if audit_data.get('specificationSignedOff') else 'No'
        
        cell_ref = field_config['customer_spec_available']['cell']
        worksheet[cell_ref] = customer_spec
        apply_cell_formatting(worksheet[cell_ref], **field_config['customer_spec_available']['format'])
        
        cell_ref = field_config['spec_signed_off']['cell']
        worksheet[cell_ref] = spec_signed
        apply_cell_formatting(worksheet[cell_ref], **field_config['spec_signed_off']['format'])
        
        print("Basic information filled and formatted successfully")
        
    except Exception as e:
        print(f"Error filling basic info: {str(e)}")
        raise

def fill_observations_data(worksheet, audit_data):
    try:
        stages = audit_data.get('stages', [])
        if not stages:
            print("No stages data found for observations")
            return
        observation_cell_mapping = {
            '1-1': { '4 hrs': 'G9', '8 hrs': 'S9' },
            '1-2': { '4 hrs': 'G10', '8 hrs': 'S10' },
            '1-3': { '': 'G11' },
            '2-1': { 'Supplier': 'I12', 'Lot No.': 'O12', 'Expiry Date': 'Y12' },
            '2-3': { '4 hrs': 'G15', '8 hrs': 'S15' },
            '3-1': { '2 hrs': 'G20', '4 hrs': 'M20', '6 hrs': 'S20', '8 hrs': 'Y20' },
            '3-2': { '2 hrs': 'G21', '4 hrs': 'M21', '6 hrs': 'S21', '8 hrs': 'Y21' },
            '3-3': { 'Supplier': 'I22', 'Type': 'N22', 'Lot No.': 'T22', 'Expiry Date': 'Z22' },
            '3-4': { '': 'G23' },
            '3-5': { '4 hrs': 'G24', '8 hrs': 'S24' },
            '3-7': { 'Line-1': 'G28', 'Line-2': 'S28' },
            '3-8': { 'Line-1': 'G29', 'Line-2': 'S29' },
            '3-9': { 'Line-1': 'G30', 'Line-2': 'S30' },
            '4-1': { 'Supplier': 'I31', 'WP': 'N31', 'Lot No.': 'S31', 'Expiry Date': 'AA31' },
            '4-2': { '4 hrs': 'G32', '8 hrs': 'S32' },
            '4-3': { '4 hrs': 'G33', '8 hrs': 'S33' },
            '4-4': { '4 hrs': 'G34', '8 hrs': 'S34' },
            '4-5': { '': 'G35' },
            '4-6': { 'Length': 'I36', 'Width': 'S36', 'Thickness': 'Z36' },
            '5-1': { 'Supplier': 'I37', 'Dimension': 'O37', 'Expiry Date': 'Y37' },
            '5-2': { '': 'G38' },
            '5-3': { 'Supplier': 'I39', 'Expiry Date': 'T39' },
            '5-8': { 'TDS Value': 'G56' },
            '6-1': { '4 hrs': 'G132', '8 hrs': 'S132' },
        }
        for stage in stages:
            parameters = stage.get('parameters', [])
            for parameter in parameters:
                param_id = parameter.get('id')
                observations = parameter.get('observations', [])
                if param_id in observation_cell_mapping:
                    param_mapping = observation_cell_mapping[param_id]
                    for observation in observations:
                        time_slot = observation.get('timeSlot', '')
                        value = observation.get('value', '')
                        if time_slot in param_mapping:
                            cell_ref = param_mapping[time_slot]
                            worksheet[cell_ref] = value
                            apply_cell_formatting(worksheet[cell_ref], font_size=16, horizontal='center')
                            print(f"Filled observation {value} for parameter {param_id} at {time_slot} in cell {cell_ref}")
        print("Observations data filled successfully")
    except Exception as e:
        print(f"Error filling observations data: {str(e)}")
        raise

def adjust_column_widths(worksheet, min_width=8, max_width=50):
    """
    Automatically adjust column widths based on content
    """
    for column in worksheet.columns:
        max_length = 0
        column_letter = get_column_letter(column[0].column)
        
        for cell in column:
            try:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            except:
                pass
        
        adjusted_width = min(max_length + 2, max_width)
        adjusted_width = max(adjusted_width, min_width)
        
        worksheet.column_dimensions[column_letter].width = adjusted_width

def create_summary_section(worksheet, audit_data, start_row=10):
    """
    Create a formatted summary section
    """
    try:
        # Summary header
        summary_cell = f'A{start_row}'
        worksheet[summary_cell] = "AUDIT SUMMARY"
        apply_cell_formatting(
            worksheet[summary_cell],
            font_size=16,
            bold=True,
            text_color='FFFFFF',
            horizontal='center'
        )
        
        # Merge cells for header if needed
        worksheet.merge_cells(f'A{start_row}:D{start_row}')
        
        # Summary data
        summary_data = [
            ("Total Stages", len(audit_data.get('stages', []))),
            ("Completed Stages", "0"),  # You can calculate this based on your data
            ("Audit Date", audit_data.get('date', 'N/A')),
            ("Line", audit_data.get('lineNumber', 'N/A'))
        ]
        
        for i, (label, value) in enumerate(summary_data):
            row = start_row + 1 + i
            
            # Label cell
            label_cell = f'A{row}'
            worksheet[label_cell] = label
            apply_cell_formatting(
                worksheet[label_cell],
                font_size=16,
                bold=True,
                horizontal='left'
            )
            
            # Value cell
            value_cell = f'B{row}'
            worksheet[value_cell] = value
            apply_cell_formatting(
                worksheet[value_cell],
                font_size=16,
                horizontal='center'
            )
            
    except Exception as e:
        print(f"Error creating summary section: {str(e)}")

def generate_filename(audit_data):
    line_number = audit_data.get('lineNumber', 'Unknown')
    date = audit_data.get('date', 'Unknown')
    shift = audit_data.get('shift', 'Unknown')
    formatted_date = date.replace('-', '')
    return f"Quality_Audit_Line{line_number}_{formatted_date}_Shift{shift}.xlsx"

# Main function to generate report (this will be called from main.py)
def generate_audit_report(audit_data):
    """
    Main function to generate audit report - called from FastAPI
    """
    try:
        if not audit_data:
            raise ValueError("No audit data provided")
        
        print("Received audit data for report generation")
        
        template_path = 'D:\\WorkingFolder\\OneDrive - vikramsolar.com\\Desktop\\VSL Projects\\QC\\QC_Data\\Blank Audit Line-II.xlsx'
        
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template file not found at: {template_path}")
        
        # Load workbook and setup styles
        wb = load_workbook(template_path)
        setup_cell_styles(wb)
        ws = wb.active
        
        # Fill and format basic information
        fill_basic_info(ws, audit_data)
        
        # Create summary section
        create_summary_section(ws, audit_data)
        
        # Fill observation values only
        fill_observations_data(ws, audit_data)
        
        # Save to bytes buffer
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)  # Important: reset pointer to start of stream
        
        filename = generate_filename(audit_data)
        
        return output, filename
        
    except Exception as e:
        print(f"Error generating audit report: {str(e)}")
        raise