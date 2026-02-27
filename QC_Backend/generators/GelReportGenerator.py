from openpyxl import load_workbook
from openpyxl.styles import (Font, PatternFill, Alignment, Border, Side, NamedStyle)
import io
from paths import get_template_key, download_from_s3

def setup_gel_cell_styles(workbook):
    data_style = NamedStyle(name="gel_data_style")
    data_style.font = Font(name='Arial', size=11)
    data_style.alignment = Alignment(horizontal='center', vertical='center')
    data_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    header_style = NamedStyle(name="gel_header_style")
    header_style.font = Font(name='Arial', size=11, bold=True)
    header_style.fill = PatternFill(start_color='D9D9D9', end_color='D9D9D9', fill_type='solid')
    header_style.alignment = Alignment(horizontal='center', vertical='center')
    header_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    multiline_style = NamedStyle(name="multiline_style")
    multiline_style.font = Font(name='Arial', size=11)
    multiline_style.alignment = Alignment(vertical='top', wrap_text=True)
    for style in [data_style, header_style, multiline_style]:
        if style.name not in workbook.named_styles:
            workbook.add_named_style(style)

def fill_allowable_limit_with_checkboxes(worksheet, gel_data):
    try:
        form_data = gel_data.get('form_data', {})
        checkbox_0 = form_data.get('checkbox_0', False)
        checkbox_1 = form_data.get('checkbox_1', False)
        eva_epe_symbol = "✓" if checkbox_0 else "✕"
        poe_symbol = "✓" if checkbox_1 else "✕"
        allowable_limit_text = (
            f"Allowable Limit:     1. Gel Content should be: 75 to 95% for EVA & EPE {eva_epe_symbol}\n"
            f"                                2. Gel Content should be: ≥ 60% for POE {poe_symbol}"
        )
        worksheet['B5'] = allowable_limit_text
        worksheet['B5'].alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
        worksheet['B5'].font = Font(name='Arial', size=11)
        print("Allowable limit with checkboxes filled successfully in cell B5")
    except Exception as e:
        print(f"Error filling allowable limit with checkboxes: {str(e)}")
        raise

def fill_encapsulant_types_with_checkboxes(worksheet, gel_data):
    try:
        form_data = gel_data.get('form_data', {})
        checkbox_2 = form_data.get('checkbox_2', False)
        checkbox_3 = form_data.get('checkbox_3', False)
        checkbox_4 = form_data.get('checkbox_4', False)
        eva_symbol = "✓" if checkbox_2 else "✕"
        epe_symbol = "✓" if checkbox_3 else "✕"
        poe_symbol = "✓" if checkbox_4 else "✕"
        encapsulant_text = f"EVA {eva_symbol}           EPE {epe_symbol}           POE {poe_symbol}"
        worksheet['I10'] = encapsulant_text
        worksheet['I10'].alignment = Alignment(horizontal='center', vertical='center')
        worksheet['I10'].font = Font(name='Arial', size=11)
        print("Encapsulant types with checkboxes filled successfully in cell I10")
    except Exception as e:
        print(f"Error filling encapsulant types with checkboxes: {str(e)}")
        raise

def fill_gel_basic_info(worksheet, gel_data):
    try:
        form_data = gel_data.get('form_data', {})
        basic_info_mapping = {
            'editable_0': 'I5',
            'editable_1': 'J6',
            'editable_2': 'J7',
            'editable_3': 'I8',
            'editable_4': 'C10',
            'editable_5': 'D10',
            'editable_6': 'E10',
            'editable_7': 'C11',
            'editable_8': 'D11',
            'editable_9': 'E11',
            'editable_10': 'C12',
            'editable_11': 'D12',
            'editable_12': 'E12',
            'editable_14': 'C13',
            'editable_15': 'D13',
            'editable_16': 'E13',
            'editable_18': 'C14',
            'editable_19': 'D14',
            'editable_20': 'E14',
            'editable_22': 'C15',
            'editable_23': 'D15',
            'editable_24': 'E15',
            'editable_26': 'C16',
            'editable_27': 'D16',
            'editable_28': 'E16',
            'editable_13': 'I12',
            'editable_17': 'I13',
            'editable_21': 'I14',
            'editable_25': 'I15',
            'editable_29': 'I16',
            'editable_30': 'B19',
            'editable_41': 'B21',
            'editable_57': 'B23',
            'preparedBySignature': 'C27',
            'acceptedBySignature': 'E27',
            'verifiedBySignature': 'J27'
        }
        for field, cell_ref in basic_info_mapping.items():
            if field in form_data and form_data[field]:
                worksheet[cell_ref] = form_data[field]
                apply_gel_cell_formatting(worksheet[cell_ref], font_size=11, horizontal='center')
        fill_allowable_limit_with_checkboxes(worksheet, gel_data)
        fill_encapsulant_types_with_checkboxes(worksheet, gel_data)
        print("Basic gel test information filled successfully")
    except Exception as e:
        print(f"Error filling basic gel test info: {str(e)}")
        raise

def fill_gel_test_data(worksheet, gel_data):
    try:
        form_data = gel_data.get('form_data', {})
        averages = gel_data.get('averages', {})
        test_data_mapping = {
            'editable_31': 'E19', 'editable_32': 'F19', 'editable_33': 'G19', 'editable_34': 'H19', 'editable_35': 'I19', 
            'editable_36': 'E20', 'editable_37': 'F20', 'editable_38': 'G20', 'editable_39': 'H20', 'editable_40': 'I20',
            'editable_42': 'E21', 'editable_43': 'F21', 'editable_44': 'G21', 'editable_45': 'H21', 'editable_46': 'I21',
            'editable_47': 'E22', 'editable_48': 'F22', 'editable_49': 'G22', 'editable_50': 'H22', 'editable_51': 'I22',
            'editable_52': 'E23', 'editable_53': 'F23', 'editable_54': 'G23', 'editable_55': 'H23', 'editable_56': 'I23',
            'editable_58': 'E24', 'editable_59': 'F24', 'editable_60': 'G24', 'editable_61': 'H24', 'editable_62': 'I24',
            'editable_63': 'E25', 'editable_64': 'F25', 'editable_65': 'G25', 'editable_66': 'H25', 'editable_67': 'I25'
        }
        for field, cell_ref in test_data_mapping.items():
            if field in form_data and form_data[field]:
                worksheet[cell_ref] = form_data[field]
                apply_gel_cell_formatting(worksheet[cell_ref], font_size=11, horizontal='center')
        averages_mapping = {
            'average_0': 'J19',
            'average_1': 'J20',
            'average_2': 'J21',
            'average_3': 'J22',
            'average_4': 'J23',
            'average_5': 'J24',
            'average_6': 'J25' 
        }
        for field, cell_ref in averages_mapping.items():
            if field in averages and averages[field]:
                worksheet[cell_ref] = averages[field]
                apply_gel_cell_formatting(worksheet[cell_ref], font_size=11, bold=True, horizontal='center')
        if 'mean' in averages and averages['mean']:
            worksheet.merge_cells('K19:K25')
            worksheet['K19'] = averages['mean']
            apply_gel_cell_formatting(worksheet['K19'], font_size=11, bold=True, horizontal='center', vertical='center')
        print("Gel test data filled successfully")
    except Exception as e:
        print(f"Error filling gel test data: {str(e)}")
        raise

def apply_gel_cell_formatting(cell, font_size=11, bold=False, 
                             text_color='000000', horizontal='center', vertical='center',
                             is_checkbox=False, wrap_text=True):
    cell.font = Font(
        name='Arial',
        size=font_size,
        bold=bold,
        color=text_color
    )
    cell.alignment = Alignment(
        horizontal=horizontal,
        vertical=vertical,
        wrap_text=wrap_text
    )
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    cell.border = thin_border

def generate_gel_filename(gel_data):
    report_name = gel_data.get('report_name', 'Gel_Test_Report')
    timestamp = gel_data.get('timestamp', '').split('T')[0] if gel_data.get('timestamp') else ''
    clean_name = "".join(c for c in report_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
    clean_name = clean_name.replace(' ', '_')
    if timestamp:
        return f"Gel_Test_{clean_name}_{timestamp}.xlsx"
    else:
        return f"Gel_Test_{clean_name}.xlsx"

def generate_gel_report(gel_data):
    try:
        if not gel_data:
            raise ValueError("No gel test data provided")
        print("Received gel test data for report generation")
        print(f"Report name: {gel_data.get('report_name', 'N/A')}")
        print(f"Form data keys: {list(gel_data.get('form_data', {}).keys())}")
        print(f"Averages keys: {list(gel_data.get('averages', {}).keys())}")
        template_key = get_template_key('Blank Gel Content Test Report.xlsx')
        template_path = download_from_s3(template_key)
        wb = load_workbook(template_path)
        ws = wb.active
        setup_gel_cell_styles(wb)
        fill_gel_basic_info(ws, gel_data)
        fill_gel_test_data(ws, gel_data)
        ws.row_dimensions[5].height = 40
        ws.row_dimensions[10].height = 25
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        filename = generate_gel_filename(gel_data)
        print(f"Gel test report generated successfully: {filename}")
        print("Text with inline checkboxes have been added to single cells")
        return output, filename
    except Exception as e:
        print(f"Error generating gel test report: {str(e)}")
        raise