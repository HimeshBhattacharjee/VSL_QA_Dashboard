from openpyxl import load_workbook
from openpyxl.styles import PatternFill
import io
from datetime import datetime
import calendar
from paths import get_template_key, download_from_s3

def fill_jb_data_in_sheet(worksheet, entries, date):
    """Fill JB sealant weight data for a specific date into a worksheet"""
    try:
        # Sort entries by shift
        shift_order = {'A': 0, 'B': 1, 'C': 2}
        sorted_entries = sorted(entries, key=lambda e: shift_order.get(e.get('shift', ''), 3))
        
        current_row = 5  # Start from row 5 as per template
        
        for entry in sorted_entries:
            shift = entry.get('shift', '')
            lines = entry.get('lines', {})
            entry_signatures = entry.get('signatures', {})
            
            # Set date in B column
            worksheet[f'B{current_row}'] = date
            worksheet[f'B{current_row+1}'] = date
            worksheet[f'B{current_row+2}'] = date
            
            # Set shift in C column
            worksheet[f'C{current_row}'] = f"Shift {shift}"
            worksheet[f'C{current_row+1}'] = f"Shift {shift}"
            worksheet[f'C{current_row+2}'] = f"Shift {shift}"
            
            # Line 1 (first row) - Positive JB
            line1 = lines.get('1', {})
            worksheet[f'D{current_row}'] = '1'  # Line number
            worksheet[f'E{current_row}'] = line1.get('po', '')  # PO
            worksheet[f'F{current_row}'] = line1.get('jbSupplier', '')
            worksheet[f'G{current_row}'] = line1.get('sealantSupplier', '')
            worksheet[f'H{current_row}'] = line1.get('sealantExpiry', '')
            worksheet[f'I{current_row}'] = '+ Ve JB'  # Junction Box type
            worksheet[f'J{current_row}'] = line1.get('jbWeight', '')
            worksheet[f'K{current_row}'] = line1.get('jbWeightWithSealant', '')
            worksheet[f'L{current_row}'] = line1.get('netSealantWeight', '')
            
            # Color code net sealant weight based on allowable limit
            weight_cell = worksheet[f'L{current_row}']
            try:
                if line1.get('netSealantWeight'):
                    weight_val = float(line1['netSealantWeight'])
                    if 4 <= weight_val <= 8:
                        weight_cell.fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        weight_cell.fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            # Line 1 Middle JB (second row)
            worksheet[f'D{current_row+1}'] = '1'  # Line number
            worksheet[f'E{current_row+1}'] = line1.get('po', '')
            worksheet[f'F{current_row+1}'] = line1.get('jbSupplier', '')
            worksheet[f'G{current_row+1}'] = line1.get('sealantSupplier', '')
            worksheet[f'H{current_row+1}'] = line1.get('sealantExpiry', '')
            worksheet[f'I{current_row+1}'] = 'Middle JB'
            worksheet[f'J{current_row+1}'] = '14'  # Default Middle JB weight
            worksheet[f'K{current_row+1}'] = ''  # Will be calculated by formula
            worksheet[f'L{current_row+1}'] = f'=K{current_row+1}-J{current_row+1}'
            
            # Line 1 Negative JB (third row)
            worksheet[f'D{current_row+2}'] = '1'  # Line number
            worksheet[f'E{current_row+2}'] = line1.get('po', '')
            worksheet[f'F{current_row+2}'] = line1.get('jbSupplier', '')
            worksheet[f'G{current_row+2}'] = line1.get('sealantSupplier', '')
            worksheet[f'H{current_row+2}'] = line1.get('sealantExpiry', '')
            worksheet[f'I{current_row+2}'] = '- Ve JB'
            worksheet[f'J{current_row+2}'] = line1.get('jbWeight', '')
            worksheet[f'K{current_row+2}'] = line1.get('jbWeightWithSealant', '')
            worksheet[f'L{current_row+2}'] = line1.get('netSealantWeight', '')
            
            # Total Module Weight formula
            worksheet[f'M{current_row}'] = f'=SUM(L{current_row}:L{current_row+2})'
            worksheet[f'M{current_row+1}'] = ''
            worksheet[f'M{current_row+2}'] = ''
            
            # Color code net sealant weight for negative JB
            weight_cell = worksheet[f'L{current_row+2}']
            try:
                if line1.get('netSealantWeight'):
                    weight_val = float(line1['netSealantWeight'])
                    if 4 <= weight_val <= 8:
                        weight_cell.fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        weight_cell.fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            # Remarks
            worksheet[f'N{current_row}'] = line1.get('remarks', '')
            
            # Move to Line 2 (3 rows down)
            current_row += 3
            
            # Line 2 (next three rows)
            line2 = lines.get('2', {})
            
            # Line 2 Positive JB
            worksheet[f'D{current_row}'] = '2'
            worksheet[f'E{current_row}'] = line2.get('po', '')
            worksheet[f'F{current_row}'] = line2.get('jbSupplier', '')
            worksheet[f'G{current_row}'] = line2.get('sealantSupplier', '')
            worksheet[f'H{current_row}'] = line2.get('sealantExpiry', '')
            worksheet[f'I{current_row}'] = '+ Ve JB'
            worksheet[f'J{current_row}'] = line2.get('jbWeight', '')
            worksheet[f'K{current_row}'] = line2.get('jbWeightWithSealant', '')
            worksheet[f'L{current_row}'] = line2.get('netSealantWeight', '')
            
            # Color code
            weight_cell = worksheet[f'L{current_row}']
            try:
                if line2.get('netSealantWeight'):
                    weight_val = float(line2['netSealantWeight'])
                    if 4 <= weight_val <= 8:
                        weight_cell.fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        weight_cell.fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            # Line 2 Middle JB
            worksheet[f'D{current_row+1}'] = '2'
            worksheet[f'E{current_row+1}'] = line2.get('po', '')
            worksheet[f'F{current_row+1}'] = line2.get('jbSupplier', '')
            worksheet[f'G{current_row+1}'] = line2.get('sealantSupplier', '')
            worksheet[f'H{current_row+1}'] = line2.get('sealantExpiry', '')
            worksheet[f'I{current_row+1}'] = 'Middle JB'
            worksheet[f'J{current_row+1}'] = '14'
            worksheet[f'K{current_row+1}'] = ''
            worksheet[f'L{current_row+1}'] = f'=K{current_row+1}-J{current_row+1}'
            
            # Line 2 Negative JB
            worksheet[f'D{current_row+2}'] = '2'
            worksheet[f'E{current_row+2}'] = line2.get('po', '')
            worksheet[f'F{current_row+2}'] = line2.get('jbSupplier', '')
            worksheet[f'G{current_row+2}'] = line2.get('sealantSupplier', '')
            worksheet[f'H{current_row+2}'] = line2.get('sealantExpiry', '')
            worksheet[f'I{current_row+2}'] = '- Ve JB'
            worksheet[f'J{current_row+2}'] = line2.get('jbWeight', '')
            worksheet[f'K{current_row+2}'] = line2.get('jbWeightWithSealant', '')
            worksheet[f'L{current_row+2}'] = line2.get('netSealantWeight', '')
            
            # Total Module Weight formula for Line 2
            worksheet[f'M{current_row}'] = f'=SUM(L{current_row}:L{current_row+2})'
            
            # Color code net sealant weight for negative JB
            weight_cell = worksheet[f'L{current_row+2}']
            try:
                if line2.get('netSealantWeight'):
                    weight_val = float(line2['netSealantWeight'])
                    if 4 <= weight_val <= 8:
                        weight_cell.fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        weight_cell.fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            # Remarks
            worksheet[f'N{current_row}'] = line2.get('remarks', '')
            
            # Move to next shift (3 rows down)
            current_row += 3
        
        # Fill signatures at the bottom
        if sorted_entries and sorted_entries[0].get('signatures'):
            signatures = sorted_entries[0]['signatures']
            if signatures.get('preparedBy'):
                worksheet['B28'] = signatures.get('preparedBy', '')
            if signatures.get('verifiedBy'):
                worksheet['H28'] = signatures.get('verifiedBy', '')
        
        print(f"Filled JB sealant data for date {date}")
        
    except Exception as e:
        print(f"Error filling JB sealant data in sheet: {str(e)}")
        raise


def generate_jb_sealant_report(jb_data):
    """Generate JB sealant weight report with multiple sheets - one sheet per day of the month"""
    try:
        if not jb_data:
            raise ValueError("No JB sealant data provided")
        
        print("Received JB sealant data for report generation")
        
        # Handle different input formats
        if isinstance(jb_data, list):
            entries = jb_data
            year = datetime.now().year
            month = datetime.now().month
        else:
            entries = jb_data.get('entries', [])
            year = jb_data.get('year', datetime.now().year)
            month = jb_data.get('month', datetime.now().month)
        
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
        template_key = get_template_key('VSL_QAD_FM_103 JB Sealant Weight Report.xlsx')
        template_path = download_from_s3(template_key)
        
        # Load workbook
        wb = load_workbook(template_path)
        
        # Create sheets for each day of the month
        for day in range(1, days_in_month + 1):
            date_str = f"{year}-{month:02d}-{day:02d}"
            formatted_date = f"{day:02d}.{month:02d}.{year}"
            
            # Create new sheet by copying template
            new_sheet = wb.copy_worksheet(wb.active)
            new_sheet.title = formatted_date
            
            # Get entries for this date
            date_entries = entries_by_date.get(date_str, [])
            
            if date_entries:
                # Fill data if entries exist
                fill_jb_data_in_sheet(new_sheet, date_entries, formatted_date)
        
        # Remove the original template sheet (first sheet)
        if len(wb.worksheets) > 1:
            wb.remove(wb.worksheets[0])
        
        # Save to BytesIO
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        # Generate filename
        month_name = datetime(year, month, 1).strftime("%B")
        filename = f"JB_Sealant_Weight_{month_name}_{year}.xlsx"
        
        print(f"JB sealant report generated successfully: {filename}")
        return output, filename
        
    except Exception as e:
        print(f"Error generating JB sealant report: {str(e)}")
        raise