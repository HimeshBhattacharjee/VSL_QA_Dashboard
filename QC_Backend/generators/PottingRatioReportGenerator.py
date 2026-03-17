from openpyxl import load_workbook
from openpyxl.styles import PatternFill
import io
from datetime import datetime
import calendar
from paths import get_template_key, download_from_s3

def fill_potting_data_in_sheet(worksheet, entries, date):
    """Fill potting ratio data for a specific date into a worksheet"""
    try:
        # Sort entries by shift
        shift_order = {'A': 0, 'B': 1, 'C': 2}
        sorted_entries = sorted(entries, key=lambda e: shift_order.get(e.get('shift', ''), 3))
        
        current_row = 6  # Start from row 6 as per template
        
        for entry in sorted_entries:
            shift = entry.get('shift', '')
            lines = entry.get('lines', {})
            entry_signatures = entry.get('signatures', {})
            
            # Set date in B column
            worksheet[f'B{current_row}'] = date
            worksheet[f'B{current_row+1}'] = date
            
            # Set shift in C column
            worksheet[f'C{current_row}'] = f"Shift {shift}"
            worksheet[f'C{current_row+1}'] = f"Shift {shift}"
            
            # Line 1 (first row)
            line1 = lines.get('1', {})
            worksheet[f'D{current_row}'] = '1'  # Line number
            worksheet[f'E{current_row}'] = line1.get('po', '')  # PO
            worksheet[f'F{current_row}'] = line1.get('pottingSupplier', '')
            worksheet[f'G{current_row}'] = line1.get('partA', '')
            worksheet[f'H{current_row}'] = line1.get('partB', '')
            worksheet[f'I{current_row}'] = line1.get('ratio', '')
            
            # Color code ratio based on allowable limit
            ratio_cell = worksheet[f'I{current_row}']
            try:
                if line1.get('ratio'):
                    ratio_val = float(line1['ratio'])
                    if 4 <= ratio_val <= 6:
                        ratio_cell.fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        ratio_cell.fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            worksheet[f'J{current_row}'] = line1.get('totalWeight', '')
            worksheet[f'K{current_row}'] = line1.get('remarks', '')
            
            # Line 2 (second row)
            line2 = lines.get('2', {})
            worksheet[f'D{current_row+1}'] = '2'  # Line number
            worksheet[f'E{current_row+1}'] = line2.get('po', '')  # PO
            worksheet[f'F{current_row+1}'] = line2.get('pottingSupplier', '')
            worksheet[f'G{current_row+1}'] = line2.get('partA', '')
            worksheet[f'H{current_row+1}'] = line2.get('partB', '')
            worksheet[f'I{current_row+1}'] = line2.get('ratio', '')
            
            # Color code ratio based on allowable limit
            ratio_cell = worksheet[f'I{current_row+1}']
            try:
                if line2.get('ratio'):
                    ratio_val = float(line2['ratio'])
                    if 4 <= ratio_val <= 6:
                        ratio_cell.fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        ratio_cell.fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            worksheet[f'J{current_row+1}'] = line2.get('totalWeight', '')
            worksheet[f'K{current_row+1}'] = line2.get('remarks', '')
            
            # Fill signatures at the bottom (one set per shift)
            if entry_signatures.get('preparedBy'):
                worksheet['D12'] = entry_signatures.get('preparedBy', '')
            if entry_signatures.get('verifiedBy'):
                worksheet['J12'] = entry_signatures.get('verifiedBy', '')
            
            # Move to next shift (2 rows down)
            current_row += 2
        
        print(f"Filled potting data for date {date}")
        
    except Exception as e:
        print(f"Error filling potting data in sheet: {str(e)}")
        raise


def generate_potting_report(potting_data):
    """Generate potting ratio report with multiple sheets - one sheet per day of the month"""
    try:
        if not potting_data:
            raise ValueError("No potting data provided")
        
        print("Received potting data for report generation")
        
        # Handle different input formats
        if isinstance(potting_data, list):
            entries = potting_data
            year = datetime.now().year
            month = datetime.now().month
        else:
            entries = potting_data.get('entries', [])
            year = potting_data.get('year', datetime.now().year)
            month = potting_data.get('month', datetime.now().month)
        
        print(f"Entries count: {len(entries)}")
        print(f"Year: {year}, Month: {month}")
        
        # Group entries by date
        entries_by_date = {}
        for entry in entries:
            date = entry.get('date', '')
            if date not in entries_by_date:
                entries_by_date[date] = []
            entries_by_date[date].append(entry)
        
        # Get days in month
        days_in_month = calendar.monthrange(year, month)[1]
        
        # Load template
        template_key = get_template_key('Blank Potting Ratio Measurement Report.xlsx')
        template_path = download_from_s3(template_key)
        
        # Load workbook
        wb = load_workbook(template_path)
        
        # Get the template sheet
        template_sheet = wb.active
        
        # Create sheets for each day of the month
        for day in range(1, days_in_month + 1):
            date_str = f"{year}-{month:02d}-{day:02d}"
            formatted_date = f"{day:02d}.{month:02d}.{year}"
            
            # Create new sheet by copying template
            new_sheet = wb.copy_worksheet(template_sheet)
            new_sheet.title = formatted_date
            
            # Get entries for this date
            date_entries = entries_by_date.get(date_str, [])
            
            if date_entries:
                # Fill data if entries exist
                fill_potting_data_in_sheet(new_sheet, date_entries, formatted_date)
        
        # Remove the original template sheet
        wb.remove(template_sheet)
        
        # Save to BytesIO
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        # Generate filename
        month_name = datetime(year, month, 1).strftime("%B")
        filename = f"Potting_Ratio_Measurement_{month_name}_{year}.xlsx"
        
        print(f"Potting report generated successfully: {filename}")
        return output, filename
        
    except Exception as e:
        print(f"Error generating potting report: {str(e)}")
        raise