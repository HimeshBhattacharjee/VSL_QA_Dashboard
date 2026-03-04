from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
import io
from datetime import datetime
import re
from paths import get_template_key, download_from_s3

def setup_ssh_cell_styles(workbook):
    """Setup cell styles for SSH report"""
    # Data style
    if "ssh_data_style" not in workbook.named_styles:
        data_style = NamedStyle(name="ssh_data_style")
        data_style.font = Font(name='Calibri', size=11)
        data_style.alignment = Alignment(horizontal='center', vertical='center')
        data_style.border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        workbook.add_named_style(data_style)
    
    # Header style
    if "ssh_header_style" not in workbook.named_styles:
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
        workbook.add_named_style(header_style)

def parse_financial_data_format(data_string):
    """Parse data from the format shown in your image"""
    entries = []
    
    # Split by date blocks (assuming multiple dates)
    date_blocks = re.split(r'Date[:]\s*([0-9-]+)', data_string)
    
    if len(date_blocks) > 1:
        # Process each date block
        for i in range(1, len(date_blocks), 2):
            date = date_blocks[i].strip()
            block_content = date_blocks[i+1]
            
            # Split by shifts within the date
            shift_blocks = re.split(r'Shift[:]\s*([A-C])', block_content)
            
            if len(shift_blocks) > 1:
                for j in range(1, len(shift_blocks), 2):
                    shift = shift_blocks[j].strip()
                    shift_data = shift_blocks[j+1]
                    
                    # Parse the key-value pairs
                    entry = parse_key_value_pairs(shift_data)
                    entry['date'] = date
                    entry['shift'] = shift
                    entries.append(entry)
    
    return entries

def parse_key_value_pairs(text):
    """Parse key-value pairs from text"""
    entry = {}
    
    # Define mappings from the format to our expected keys
    key_mapping = {
        'Total revenue': 'totalRevenue',
        'Cost of revenue': 'costOfRevenue',
        'Gross profit': 'grossProfit',
        'Depreciation and amortization expense': 'depreciationExpense',
        'Operating income': 'operatingIncome',
    }
    
    # Extract each value using regex
    patterns = {
        'sealantSupplier': r'Sealant Supplier[:\s]+([^\n$]+)',
        'sealantExpDate': r'Sealant Expiry Date[:\s]+([^\n$]+)',
        'sampleTakingTime': r'Sample Taking Time[:\s]+([^\n$]+)',
        'sampleTestingTime': r'Sample Testing Time[:\s]+([^\n$]+)',
        'result': r'Test Result[:\s]+([^\n$]+)',
        'checkedBy': r'Checked By[:\s]+([^\n$]+)',
        'remarks': r'Remarks[:\s]+([^\n$]+)',
        'po': r'P\.O\.?[:\s]+([^\n$]+)',
        'line': r'Line[:\s]+([^\n$]+)',
    }
    
    for key, pattern in patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            entry[key] = match.group(1).strip()
    
    return entry

def fill_ssh_test_data(worksheet, entries):
    """Fill test data into the worksheet"""
    try:
        # Sort entries by date and shift
        def sort_key(entry):
            date = entry.get('date', '')
            shift = entry.get('shift', '')
            shift_order = {'A': 0, 'B': 1, 'C': 2}
            return (date, shift_order.get(shift, 3))
        
        sorted_entries = sorted(entries, key=sort_key)
        
        # Data starts from row 7
        start_row = 6
        current_row = start_row
        
        print(f"Filling {len(sorted_entries)} test data rows starting at row {start_row}")
        
        # Fill data row by row
        for entry in sorted_entries:
            # Date
            date_value = entry.get('date', '')
            if date_value:
                try:
                    # Try to format date consistently
                    for fmt in ['%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y']:
                        try:
                            date_obj = datetime.strptime(date_value, fmt)
                            worksheet[f'C{current_row}'] = date_obj.strftime("%d.%m.%Y")
                            break
                        except:
                            continue
                    else:
                        worksheet[f'C{current_row}'] = date_value
                except:
                    worksheet[f'C{current_row}'] = date_value
            
            # Shift
            worksheet[f'D{current_row}'] = entry.get('shift', '')
            
            # P.O.
            worksheet[f'E{current_row}'] = entry.get('po', '')
            
            # Line
            worksheet[f'F{current_row}'] = entry.get('line', '')
            
            # Sealant Supplier
            worksheet[f'G{current_row}'] = entry.get('sealantSupplier', '')
            
            # Sealant Expiry Date
            exp_date = entry.get('sealantExpDate', '')
            if exp_date:
                try:
                    # Format expiry date consistently
                    for fmt in ['%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y']:
                        try:
                            date_obj = datetime.strptime(exp_date, fmt)
                            worksheet[f'H{current_row}'] = date_obj.strftime("%d.%m.%Y")
                            break
                        except:
                            continue
                    else:
                        worksheet[f'H{current_row}'] = exp_date
                except:
                    worksheet[f'H{current_row}'] = exp_date
            
            # Sample Taking Time
            worksheet[f'I{current_row}'] = entry.get('sampleTakingTime', '')
            
            # Sample Testing Time
            worksheet[f'J{current_row}'] = entry.get('sampleTestingTime', '')
            
            # Test Result with color coding
            result = entry.get('result', entry.get('testResult', ''))
            worksheet[f'K{current_row}'] = result
            
            # Apply color coding based on result
            try:
                # Try to convert to float for numeric comparison
                result_float = float(result) if result else 0
                if result_float >= 39:
                    worksheet[f'K{current_row}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                elif result_float < 39 and result_float > 0:
                    worksheet[f'K{current_row}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                # Handle non-numeric results
                if result and result.lower() == 'pass':
                    worksheet[f'K{current_row}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                elif result and result.lower() == 'fail':
                    worksheet[f'K{current_row}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            
            # Checked By
            worksheet[f'L{current_row}'] = entry.get('checkedBy', '')
            
            # Remarks
            worksheet[f'M{current_row}'] = entry.get('remarks', '')
            
            # Apply data style
            for col in ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']:
                cell = worksheet[f'{col}{current_row}']
                cell.style = "ssh_data_style"
            
            current_row += 1
        
        print(f"Filled {current_row - start_row} test data rows successfully")
        
    except Exception as e:
        print(f"Error filling SSH test data: {str(e)}")
        raise

def generate_ssh_report_from_financial_format(raw_data, form_data=None):
    """Generate SSH report from data in the financial format"""
    try:
        # Parse the raw data
        if isinstance(raw_data, str):
            entries = parse_financial_data_format(raw_data)
        elif isinstance(raw_data, list):
            entries = raw_data
        else:
            entries = raw_data.get('entries', [])
        
        if not entries:
            raise ValueError("No entries parsed from the data")
        
        # Load template
        template_key = get_template_key('Blank Sealant Shore Hardness Test Report.xlsx')
        template_path = download_from_s3(template_key)
        
        # Load workbook
        wb = load_workbook(template_path)
        ws = wb.active
        
        # Setup styles
        setup_ssh_cell_styles(wb)
        
        # Fill data
        fill_ssh_test_data(ws, entries)
        
        # Fill signatures if provided
        if form_data:
            fill_ssh_signatures(ws, form_data)
        
        # Save to BytesIO
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"SSH_Test_Report_{timestamp}.xlsx"
        
        print(f"SSH test report generated successfully: {filename}")
        return output, filename
        
    except Exception as e:
        print(f"Error generating SSH test report: {str(e)}")
        raise

def fill_ssh_signatures(worksheet, form_data):
    """Fill signature data into the worksheet"""
    try:
        # Fill Prepared By (at column E, row 193)
        prepared_by = form_data.get('preparedBy', '')
        if prepared_by:
            worksheet['E193'] = prepared_by
            worksheet['E193'].font = Font(name='Calibri', size=11, bold=True)
            worksheet['E193'].alignment = Alignment(horizontal='center', vertical='center')
        
        # Fill Approved By (at column K, row 193)
        approved_by = form_data.get('approvedBy', '')
        if approved_by:
            worksheet['K193'] = approved_by
            worksheet['K193'].font = Font(name='Calibri', size=11, bold=True)
            worksheet['K193'].alignment = Alignment(horizontal='center', vertical='center')
        
        print("SSH signatures filled successfully")
        
    except Exception as e:
        print(f"Error filling SSH signatures: {str(e)}")
        raise

def generate_ssh_report(ssh_data):
    """Generate SSH test report"""
    try:
        if not ssh_data:
            raise ValueError("No SSH test data provided")
        
        print("Received SSH test data for report generation")
        entries = ssh_data.get('entries', [])
        form_data = ssh_data.get('form_data', {})
        
        print(f"Entries count: {len(entries)}")
        print(f"Form data keys: {list(form_data.keys())}")
        
        # Load template
        template_key = get_template_key('Blank Sealant Shore Hardness Test Report.xlsx')
        template_path = download_from_s3(template_key)
        
        # Load workbook
        wb = load_workbook(template_path)
        ws = wb.active
        
        # Setup styles
        setup_ssh_cell_styles(wb)
        
        # Fill data
        if entries:
            fill_ssh_test_data(ws, entries)
        
        # Fill signatures
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