from openpyxl import load_workbook
from openpyxl.styles import (Font, PatternFill, Alignment, Border, Side, NamedStyle)
import io
import os

def setup_peel_cell_styles(workbook):
    # Data style
    data_style = NamedStyle(name="peel_data_style")
    data_style.font = Font(name='Arial', size=9)
    data_style.alignment = Alignment(horizontal='center', vertical='center')
    data_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Header style
    header_style = NamedStyle(name="peel_header_style")
    header_style.font = Font(name='Arial', size=9, bold=True)
    header_style.fill = PatternFill(start_color='D9D9D9', end_color='D9D9D9', fill_type='solid')
    header_style.alignment = Alignment(horizontal='center', vertical='center')
    header_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Highlight style for low values
    highlight_style = NamedStyle(name="peel_highlight_style")
    highlight_style.font = Font(name='Arial', size=9, color='FF0000')
    highlight_style.fill = PatternFill(start_color='FFCCCC', end_color='FFCCCC', fill_type='solid')
    highlight_style.alignment = Alignment(horizontal='center', vertical='center')
    highlight_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Add styles to workbook
    for style in [data_style, header_style, highlight_style]:
        if style.name not in workbook.named_styles:
            workbook.add_named_style(style)

def fill_peel_basic_info(worksheet, peel_data):
    try:
        form_data = peel_data.get('form_data', {})
        
        # Define cell mapping for basic information
        basic_info_mapping = {
            'preparedBy': 'E415',  # Prepared By signature
            'verifiedBy': 'N415',  # Verified By signature
        }
        
        # Fill basic information
        for field, cell_ref in basic_info_mapping.items():
            if field in form_data and form_data[field]:
                worksheet[cell_ref] = form_data[field]
                apply_peel_cell_formatting(worksheet[cell_ref], font_size=10, horizontal='center')
        
        print("Basic peel test information filled successfully")
        
    except Exception as e:
        print(f"Error filling basic peel test info: {str(e)}")
        raise

def fill_peel_test_data(worksheet, peel_data):
    try:
        form_data = peel_data.get('form_data', {})
        
        # Define cell mapping for test data - 24 repetitions with front and back sections
        # Each repetition has: Date, Shift, Stringer, Unit, PO, Cell Vendor + Front(16x7) + Back(16x7)
        test_data_mapping = {}
        
        # Base row for each repetition (each repetition takes 34 rows)
        for rep in range(12):
            base_row = 7 + (rep * 34)  # Starting from row 7, each rep takes 34 rows
            
            # Basic info for each repetition (rowspan cells)
            test_data_mapping[f'row_{rep}_cell_0'] = f'B{base_row}'  # Date
            test_data_mapping[f'row_{rep}_cell_1'] = f'C{base_row}'  # Shift
            test_data_mapping[f'row_{rep}_cell_2'] = f'D{base_row}'  # Stringer
            test_data_mapping[f'row_{rep}_cell_3'] = f'E{base_row}'  # Unit
            test_data_mapping[f'row_{rep}_cell_4'] = f'F{base_row}'  # PO
            test_data_mapping[f'row_{rep}_cell_5'] = f'G{base_row}'  # Cell Vendor
            
            # Front section data (positions 1-16, ribbons 1-7)
            for position in range(1, 17):
                row_offset = position  # Front data starts at base_row + 1
                for ribbon in range(1, 8):
                    cell_index = 6 + (position - 1) * 7 + (ribbon - 1)
                    col_offset = 8 + ribbon  # Columns I(9) to O(15) for ribbons 1-7
                    test_data_mapping[f'row_{rep}_cell_{cell_index}'] = f'{get_column_letter(col_offset)}{base_row + row_offset}'
            
            # Back section data (positions 1-16, ribbons 1-7)
            for position in range(1, 17):
                row_offset = 17 + position  # Back data starts at base_row + 19 (after front section + header)
                for ribbon in range(1, 8):
                    cell_index = 118 + (position - 1) * 7 + (ribbon - 1)
                    col_offset = 8 + ribbon
                    test_data_mapping[f'row_{rep}_cell_{cell_index}'] = f'{get_column_letter(col_offset)}{base_row + row_offset}'
            
        #     # Average cells for front section
            for position in range(1, 17):
                row_offset = position
                test_data_mapping[f'front_avg_{rep}_{position}'] = f'P{base_row + row_offset}'  # Column P for averages
            
        # #     # Average cells for back section  
            for position in range(1, 17):
                row_offset = 17 + position
                test_data_mapping[f'back_avg_{rep}_{position}'] = f'P{base_row + row_offset}'  # Column P for averages
        
        # # Fill test data measurements
        for field, cell_ref in test_data_mapping.items():
            if field in form_data and form_data[field]:
                worksheet[cell_ref] = form_data[field]
                
                # Apply highlighting for values < 1.0
                try:
                    value = float(form_data[field])
                    if value < 1.0:
                        apply_peel_cell_formatting(worksheet[cell_ref], font_size=9, horizontal='center', 
                                                 text_color='FF0000', fill_color='FFCCCC')
                    else:
                        apply_peel_cell_formatting(worksheet[cell_ref], font_size=9, horizontal='center')
                except (ValueError, TypeError):
                    apply_peel_cell_formatting(worksheet[cell_ref], font_size=9, horizontal='center')
        
        print("Peel test data filled successfully")
        
    except Exception as e:
        print(f"Error filling peel test data: {str(e)}")
        raise

def apply_peel_cell_formatting(cell, font_size=9, bold=False, 
                             text_color='000000', fill_color=None, 
                             horizontal='center', vertical='center'):
    """
    Apply comprehensive formatting to a peel test cell
    """
    # Font settings
    cell.font = Font(
        name='Arial',
        size=font_size,
        bold=bold,
        color=text_color
    )
    
    # Fill color
    if fill_color:
        cell.fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type='solid')
    
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

def get_column_letter(col_idx):
    """Convert column index to letter (1->A, 2->B, ..., 27->AA, etc.)"""
    letters = []
    while col_idx > 0:
        col_idx, remainder = divmod(col_idx - 1, 26)
        letters.append(chr(65 + remainder))
    return ''.join(reversed(letters))

def generate_peel_filename(peel_data):
    """
    Generate filename for peel test report
    """
    report_name = peel_data.get('report_name', 'Peel_Test_Report')
    timestamp = peel_data.get('timestamp', '').split('T')[0] if peel_data.get('timestamp') else ''
    
    # Clean filename
    clean_name = "".join(c for c in report_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
    clean_name = clean_name.replace(' ', '_')
    
    if timestamp:
        return f"Peel_Test_{clean_name}_{timestamp}.xlsx"
    else:
        return f"Peel_Test_{clean_name}.xlsx"

def generate_peel_report(peel_data):
    """
    Main function to generate peel test report - called from FastAPI
    """
    try:
        if not peel_data:
            raise ValueError("No peel test data provided")
        
        print("Received peel test data for report generation")
        print(f"Report name: {peel_data.get('report_name', 'N/A')}")
        print(f"Form data keys: {list(peel_data.get('form_data', {}).keys())}")
        
        # Template path
        template_path = 'D:\\WorkingFolder\\OneDrive - vikramsolar.com\\Desktop\\VSL Projects\\QC\\QC_Data\\Blank Solar Cell Peel Strength Test Report.xlsx'
        
        if not os.path.exists(template_path):
            # Fallback template path
            template_path = './templates/Blank Peel Strength Test Report.xlsx'
            if not os.path.exists(template_path):
                raise FileNotFoundError(f"Peel test template file not found at: {template_path}")
        
        # Load workbook
        wb = load_workbook(template_path)
        ws = wb.active
        
        # Setup styles
        setup_peel_cell_styles(wb)
        
        # Fill all data sections
        fill_peel_basic_info(ws, peel_data)
        fill_peel_test_data(ws, peel_data)
        
        # Save to bytes buffer
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)  # Reset pointer to start of stream
        
        filename = generate_peel_filename(peel_data)
        
        print(f"Peel test report generated successfully: {filename}")
        return output, filename
        
    except Exception as e:
        print(f"Error generating peel test report: {str(e)}")
        raise