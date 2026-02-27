from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
import io
from datetime import datetime
from paths import get_template_key, download_from_s3

def setup_ssh_cell_styles(workbook):
    """Setup cell styles for SSH test report"""
    data_style = NamedStyle(name="ssh_data_style")
    data_style.font = Font(name='Calibri', size=11)
    data_style.alignment = Alignment(horizontal='center', vertical='center')
    data_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    header_style = NamedStyle(name="ssh_header_style")
    header_style.font = Font(name='Calibri', size=11, bold=True)
    header_style.fill = PatternFill(start_color='D9D9D9', end_color='D9D9D9', fill_type='solid')
    header_style.alignment = Alignment(horizontal='center', vertical='center')
    header_style.border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    for style in [data_style, header_style]:
        if style.name not in workbook.named_styles:
            workbook.add_named_style(style)

def fill_ssh_test_data(worksheet, entries):
    """Fill SSH test data into the worksheet, organizing by date and shift"""
    try:
        # Sort entries by date and shift (A, B, C)
        def sort_key(entry):
            date = entry.get('testingDate', '')
            shift = entry.get('shift', '')
            shift_order = {'A': 0, 'B': 1, 'C': 2}
            return (date, shift_order.get(shift, 3))
        
        sorted_entries = sorted(entries, key=sort_key)
        
        # Group entries by date
        entries_by_date = {}
        for entry in sorted_entries:
            date = entry.get('testingDate', '')
            if date not in entries_by_date:
                entries_by_date[date] = []
            entries_by_date[date].append(entry)
        
        # Start row for data (adjust based on template)
        start_row = 7
        max_rows = 31  # Maximum number of rows in template
        
        print(f"Filling {len(sorted_entries)} test data rows starting at row {start_row}")
        
        # Clear existing data in the range
        for row in range(start_row, start_row + max_rows):
            for col in ['B', 'C', 'D', 'F', 'G', 'H', 'I', 'J', 'K', 'L']:
                cell = worksheet[f'{col}{row}']
                cell.value = ''
                thin_border = Border(
                    left=Side(style='thin'),
                    right=Side(style='thin'),
                    top=Side(style='thin'),
                    bottom=Side(style='thin')
                )
                cell.border = thin_border
        
        # Fill data row by row
        row_idx = 0
        for date, date_entries in entries_by_date.items():
            for entry in date_entries[:3]:  # Max 3 shifts per day
                if row_idx >= max_rows:
                    break
                    
                row = start_row + row_idx
                
                # Date
                testing_date = entry.get('testingDate', '')
                if testing_date:
                    try:
                        if 'T' in testing_date:
                            date_obj = datetime.fromisoformat(testing_date.replace('Z', '+00:00'))
                            worksheet[f'B{row}'] = date_obj.strftime("%d.%m.%Y")
                        else:
                            for fmt in ['%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y']:
                                try:
                                    date_obj = datetime.strptime(testing_date, fmt)
                                    worksheet[f'B{row}'] = date_obj.strftime("%d.%m.%Y")
                                    break
                                except:
                                    continue
                            else:
                                worksheet[f'B{row}'] = testing_date
                    except:
                        worksheet[f'B{row}'] = testing_date
                
                # Shift
                worksheet[f'C{row}'] = entry.get('shift', '')
                
                # PO Number
                worksheet[f'D{row}'] = entry.get('po', '')
                
                # Module Type
                worksheet[f'F{row}'] = entry.get('moduleType', '')
                
                # Module Serial
                worksheet[f'G{row}'] = entry.get('moduleSerial', '')
                
                # JB Supplier
                worksheet[f'H{row}'] = entry.get('jbSupplier', '')
                
                # Sealant Supplier
                worksheet[f'I{row}'] = entry.get('sealantSupplier', '')
                
                # Backsheet Supplier
                worksheet[f'J{row}'] = entry.get('backsheetSupplier', '')
                
                # Result
                result = entry.get('result', '')
                worksheet[f'K{row}'] = result
                if result == 'Pass':
                    worksheet[f'K{row}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                elif result == 'Fail':
                    worksheet[f'K{row}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
                
                # Test Done By
                worksheet[f'L{row}'] = entry.get('testDoneBy', '')
                
                # Apply styles to all cells in this row
                for col in ['B', 'C', 'D', 'F', 'G', 'H', 'I', 'J', 'K', 'L']:
                    cell = worksheet[f'{col}{row}']
                    cell.font = Font(name='Calibri', size=11)
                    cell.alignment = Alignment(horizontal='center', vertical='center')
                    thin_border = Border(
                        left=Side(style='thin'),
                        right=Side(style='thin'),
                        top=Side(style='thin'),
                        bottom=Side(style='thin')
                    )
                    cell.border = thin_border
                
                row_idx += 1
        
        print(f"Filled {row_idx} test data rows successfully")
        
    except Exception as e:
        print(f"Error filling SSH test data: {str(e)}")
        raise

def fill_ssh_signatures(worksheet, form_data):
    """Fill signature data into the worksheet"""
    try:
        prepared_by = form_data.get('preparedBySignature', '')
        if prepared_by:
            worksheet['D38'] = prepared_by
            worksheet['D38'].font = Font(name='Calibri', size=11, bold=True)
            worksheet['D38'].alignment = Alignment(horizontal='center', vertical='center')
        
        reviewed_by = form_data.get('reviewedBySignature', '')
        if reviewed_by:
            worksheet['G38'] = reviewed_by
            worksheet['G38'].font = Font(name='Calibri', size=11, bold=True)
            worksheet['G38'].alignment = Alignment(horizontal='center', vertical='center')
        
        approved_by = form_data.get('approvedBySignature', '')
        if approved_by:
            worksheet['J38'] = approved_by
            worksheet['J38'].font = Font(name='Calibri', size=11, bold=True)
            worksheet['J38'].alignment = Alignment(horizontal='center', vertical='center')
        
        print("SSH signatures filled successfully")
    except Exception as e:
        print(f"Error filling SSH signatures: {str(e)}")
        raise

def generate_ssh_report(ssh_data):
    """Generate SSH test report Excel file"""
    try:
        if not ssh_data:
            raise ValueError("No SSH test data provided")
        
        print("Received SSH test data for report generation")
        print(f"Report name: {ssh_data.get('name', 'N/A')}")
        print(f"Entries count: {len(ssh_data.get('entries', []))}")
        print(f"Form data keys: {list(ssh_data.get('form_data', {}).keys())}")
        
        entries = ssh_data.get('entries', [])
        form_data = ssh_data.get('form_data', {})
        
        # Get template from S3
        template_key = get_template_key('Blank Sealant Shore Hardness Test Report.xlsx')
        template_path = download_from_s3(template_key)
        
        # Load workbook
        wb = load_workbook(template_path)
        ws = wb.active
        
        # Setup styles
        setup_ssh_cell_styles(wb)
        
        # Fill data
        fill_ssh_test_data(ws, entries)
        fill_ssh_signatures(ws, form_data)
        
        # Save to BytesIO
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        # Generate filename
        report_name = ssh_data.get('name', ssh_data.get('report_name', 'SSH_Test_Report'))
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        clean_name = "".join(c for c in report_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        clean_name = clean_name.replace(' ', '_')
        filename = f"{clean_name}_{timestamp}.xlsx"
        
        print(f"SSH test report generated successfully: {filename}")
        return output, filename
        
    except Exception as e:
        print(f"Error generating SSH test report: {str(e)}")
        raise