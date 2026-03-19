from openpyxl import load_workbook
from openpyxl.styles import PatternFill
import io
from datetime import datetime
import calendar
from paths import get_template_key, download_from_s3

def fill_cell_data_in_sheet(worksheet, entries, date):
    """Fill cell sealant weight data for a specific date into a worksheet"""
    try:
        # Sort entries by shift
        shift_order = {'A': 0, 'B': 1, 'C': 2}
        sorted_entries = sorted(entries, key=lambda e: shift_order.get(e.get('shift', ''), 3))
        
        current_row = 5  # Start from row 5 as per template
        
        for entry in sorted_entries:
            shift = entry.get('shift', '')
            lines = entry.get('lines', {})
            
            # Set date and shift for the 6 rows that will be filled for this shift (3 rows per line)
            for i in range(6):
                worksheet[f'A{current_row + i}'] = date
                worksheet[f'B{current_row + i}'] = f"Shift {shift}"
            
            # Process Line 1 (first 3 rows)
            line1_data = lines.get('1', {})
            line1_number = line1_data.get('line', '1')
            
            # Get cell position data for Line 1
            line1_cell1 = line1_data.get('cell1', {})
            line1_cell2 = line1_data.get('cell2', {})
            line1_cell3 = line1_data.get('cell3', {})
            
            # Fill Line 1 - Cell 1 row
            line1_cell1_row = current_row
            worksheet[f'C{line1_cell1_row}'] = line1_number
            worksheet[f'D{line1_cell1_row}'] = line1_data.get('po', '')
            worksheet[f'E{line1_cell1_row}'] = line1_data.get('cellSupplier', '')
            worksheet[f'F{line1_cell1_row}'] = line1_data.get('sealantSupplier', '')
            worksheet[f'G{line1_cell1_row}'] = line1_data.get('sealantExpiry', '')
            worksheet[f'H{line1_cell1_row}'] = 'Cell 1'
            worksheet[f'I{line1_cell1_row}'] = line1_cell1.get('cellWeight', '')
            worksheet[f'J{line1_cell1_row}'] = line1_cell1.get('cellWeightWithSealant', '')
            worksheet[f'K{line1_cell1_row}'] = line1_cell1.get('netSealantWeight', '')
            
            # Color code net sealant weight for Line 1 Cell 1
            try:
                if line1_cell1.get('netSealantWeight'):
                    weight_val = float(line1_cell1['netSealantWeight'])
                    if 3 <= weight_val <= 7:
                        worksheet[f'K{line1_cell1_row}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        worksheet[f'K{line1_cell1_row}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            # Fill Line 1 - Cell 2 row
            line1_cell2_row = current_row + 1
            worksheet[f'C{line1_cell2_row}'] = line1_number
            worksheet[f'D{line1_cell2_row}'] = line1_data.get('po', '')
            worksheet[f'E{line1_cell2_row}'] = line1_data.get('cellSupplier', '')
            worksheet[f'F{line1_cell2_row}'] = line1_data.get('sealantSupplier', '')
            worksheet[f'G{line1_cell2_row}'] = line1_data.get('sealantExpiry', '')
            worksheet[f'H{line1_cell2_row}'] = 'Cell 2'
            worksheet[f'I{line1_cell2_row}'] = line1_cell2.get('cellWeight', '')
            worksheet[f'J{line1_cell2_row}'] = line1_cell2.get('cellWeightWithSealant', '')
            worksheet[f'K{line1_cell2_row}'] = line1_cell2.get('netSealantWeight', '')
            
            # Color code net sealant weight for Line 1 Cell 2
            try:
                if line1_cell2.get('netSealantWeight'):
                    weight_val = float(line1_cell2['netSealantWeight'])
                    if 3 <= weight_val <= 7:
                        worksheet[f'K{line1_cell2_row}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        worksheet[f'K{line1_cell2_row}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            # Fill Line 1 - Cell 3 row
            line1_cell3_row = current_row + 2
            worksheet[f'C{line1_cell3_row}'] = line1_number
            worksheet[f'D{line1_cell3_row}'] = line1_data.get('po', '')
            worksheet[f'E{line1_cell3_row}'] = line1_data.get('cellSupplier', '')
            worksheet[f'F{line1_cell3_row}'] = line1_data.get('sealantSupplier', '')
            worksheet[f'G{line1_cell3_row}'] = line1_data.get('sealantExpiry', '')
            worksheet[f'H{line1_cell3_row}'] = 'Cell 3'
            worksheet[f'I{line1_cell3_row}'] = line1_cell3.get('cellWeight', '')
            worksheet[f'J{line1_cell3_row}'] = line1_cell3.get('cellWeightWithSealant', '')
            worksheet[f'K{line1_cell3_row}'] = line1_cell3.get('netSealantWeight', '')
            
            # Color code net sealant weight for Line 1 Cell 3
            try:
                if line1_cell3.get('netSealantWeight'):
                    weight_val = float(line1_cell3['netSealantWeight'])
                    if 3 <= weight_val <= 7:
                        worksheet[f'K{line1_cell3_row}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        worksheet[f'K{line1_cell3_row}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            # Total Module Weight for Line 1 - place it in the first row of Line 1
            worksheet[f'L{line1_cell1_row}'] = line1_data.get('totalModuleWeight', '')
            
            # Add remarks for Line 1
            worksheet[f'M{line1_cell1_row}'] = line1_data.get('remarks', '')
            
            # Process Line 2 (next 3 rows)
            line2_data = lines.get('2', {})
            line2_number = line2_data.get('line', '2')
            
            # Get cell position data for Line 2
            line2_cell1 = line2_data.get('cell1', {})
            line2_cell2 = line2_data.get('cell2', {})
            line2_cell3 = line2_data.get('cell3', {})
            
            # Fill Line 2 - Cell 1 row
            line2_cell1_row = current_row + 3
            worksheet[f'C{line2_cell1_row}'] = line2_number
            worksheet[f'D{line2_cell1_row}'] = line2_data.get('po', '')
            worksheet[f'E{line2_cell1_row}'] = line2_data.get('cellSupplier', '')
            worksheet[f'F{line2_cell1_row}'] = line2_data.get('sealantSupplier', '')
            worksheet[f'G{line2_cell1_row}'] = line2_data.get('sealantExpiry', '')
            worksheet[f'H{line2_cell1_row}'] = 'Cell 1'
            worksheet[f'I{line2_cell1_row}'] = line2_cell1.get('cellWeight', '')
            worksheet[f'J{line2_cell1_row}'] = line2_cell1.get('cellWeightWithSealant', '')
            worksheet[f'K{line2_cell1_row}'] = line2_cell1.get('netSealantWeight', '')
            
            # Color code net sealant weight for Line 2 Cell 1
            try:
                if line2_cell1.get('netSealantWeight'):
                    weight_val = float(line2_cell1['netSealantWeight'])
                    if 3 <= weight_val <= 7:
                        worksheet[f'K{line2_cell1_row}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        worksheet[f'K{line2_cell1_row}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            # Fill Line 2 - Cell 2 row
            line2_cell2_row = current_row + 4
            worksheet[f'C{line2_cell2_row}'] = line2_number
            worksheet[f'D{line2_cell2_row}'] = line2_data.get('po', '')
            worksheet[f'E{line2_cell2_row}'] = line2_data.get('cellSupplier', '')
            worksheet[f'F{line2_cell2_row}'] = line2_data.get('sealantSupplier', '')
            worksheet[f'G{line2_cell2_row}'] = line2_data.get('sealantExpiry', '')
            worksheet[f'H{line2_cell2_row}'] = 'Cell 2'
            worksheet[f'I{line2_cell2_row}'] = line2_cell2.get('cellWeight', '')
            worksheet[f'J{line2_cell2_row}'] = line2_cell2.get('cellWeightWithSealant', '')
            worksheet[f'K{line2_cell2_row}'] = line2_cell2.get('netSealantWeight', '')
            
            # Color code net sealant weight for Line 2 Cell 2
            try:
                if line2_cell2.get('netSealantWeight'):
                    weight_val = float(line2_cell2['netSealantWeight'])
                    if 3 <= weight_val <= 7:
                        worksheet[f'K{line2_cell2_row}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        worksheet[f'K{line2_cell2_row}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            # Fill Line 2 - Cell 3 row
            line2_cell3_row = current_row + 5
            worksheet[f'C{line2_cell3_row}'] = line2_number
            worksheet[f'D{line2_cell3_row}'] = line2_data.get('po', '')
            worksheet[f'E{line2_cell3_row}'] = line2_data.get('cellSupplier', '')
            worksheet[f'F{line2_cell3_row}'] = line2_data.get('sealantSupplier', '')
            worksheet[f'G{line2_cell3_row}'] = line2_data.get('sealantExpiry', '')
            worksheet[f'H{line2_cell3_row}'] = 'Cell 3'
            worksheet[f'I{line2_cell3_row}'] = line2_cell3.get('cellWeight', '')
            worksheet[f'J{line2_cell3_row}'] = line2_cell3.get('cellWeightWithSealant', '')
            worksheet[f'K{line2_cell3_row}'] = line2_cell3.get('netSealantWeight', '')
            
            # Color code net sealant weight for Line 2 Cell 3
            try:
                if line2_cell3.get('netSealantWeight'):
                    weight_val = float(line2_cell3['netSealantWeight'])
                    if 3 <= weight_val <= 7:
                        worksheet[f'K{line2_cell3_row}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
                    else:
                        worksheet[f'K{line2_cell3_row}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
            except (ValueError, TypeError):
                pass
            
            # Total Module Weight for Line 2 - place it in the first row of Line 2
            worksheet[f'L{line2_cell1_row}'] = line2_data.get('totalModuleWeight', '')
            
            # Add remarks for Line 2
            worksheet[f'M{line2_cell1_row}'] = line2_data.get('remarks', '')
            
            # Move to next shift (6 rows down - 3 rows per line)
            current_row += 6
        
        # Fill signatures at the bottom
        if sorted_entries and sorted_entries[0].get('signatures'):
            signatures = sorted_entries[0]['signatures']
            if signatures.get('preparedBy'):
                worksheet['C23'] = signatures.get('preparedBy', '')
            if signatures.get('verifiedBy'):
                worksheet['J23'] = signatures.get('verifiedBy', '')
        
        print(f"Filled cell sealant data for date {date}")
        
    except Exception as e:
        print(f"Error filling cell sealant data in sheet: {str(e)}")
        raise


def generate_cell_sealant_report(cell_data):
    """Generate cell sealant weight report with multiple sheets - one sheet per day of the month"""
    try:
        if not cell_data:
            raise ValueError("No cell sealant data provided")
        
        print("Received cell sealant data for report generation")
        
        # Handle different input formats
        if isinstance(cell_data, list):
            entries = cell_data
            year = datetime.now().year
            month = datetime.now().month
        else:
            entries = cell_data.get('entries', [])
            year = cell_data.get('year', datetime.now().year)
            month = cell_data.get('month', datetime.now().month)
        
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
        template_key = get_template_key('Blank Cell Sealant Weight Report.xlsx')
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
                fill_cell_data_in_sheet(new_sheet, date_entries, formatted_date)
        
        # Remove the original template sheet (first sheet)
        if len(wb.worksheets) > 1:
            wb.remove(wb.worksheets[0])
        
        # Save to BytesIO
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        # Generate filename
        month_name = datetime(year, month, 1).strftime("%B")
        filename = f"Cell_Sealant_Weight_{month_name}_{year}.xlsx"
        
        print(f"Cell sealant report generated successfully: {filename}")
        return output, filename
        
    except Exception as e:
        print(f"Error generating cell sealant report: {str(e)}")
        raise