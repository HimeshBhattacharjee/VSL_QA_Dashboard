from openpyxl import load_workbook
from openpyxl.styles import PatternFill
import io
from datetime import datetime
import calendar
from paths import get_template_key, download_from_s3

def fill_frame_data_in_sheet(worksheet, entries, date):
    """Fill frame sealant weight data for a specific date into a worksheet"""
    try:
        # Sort entries by shift
        shift_order = {'A': 0, 'B': 1, 'C': 2}
        sorted_entries = sorted(entries, key=lambda e: shift_order.get(e.get('shift', ''), 3))
        
        # Define row ranges for each shift
        shift_rows = {
            'A': {'start': 7, 'end': 10},    # A shift rows 7-10
            'B': {'start': 11, 'end': 14},   # B shift rows 11-14
            'C': {'start': 15, 'end': 18}    # C shift rows 15-18
        }
        
        # Create a dictionary to map shift to entry
        entry_by_shift = {}
        for entry in sorted_entries:
            shift = entry.get('shift', '')
            if shift:
                entry_by_shift[shift] = entry
        
        # Process all shifts in order
        for shift in ['A', 'B', 'C']:
            entry = entry_by_shift.get(shift)
            
            if entry:
                # Entry exists for this shift, fill data
                current_row = shift_rows[shift]['start']
                fill_shift_data(worksheet, entry, date, current_row)
            else:
                # No entry for this shift, leave rows empty
                # Optionally, you can clear the rows or leave them as is
                # The rows will remain empty from the template
                pass
        
        # Fill signatures at the bottom (using the first entry if available)
        if sorted_entries and sorted_entries[0].get('signatures'):
            signatures = sorted_entries[0]['signatures']
            if signatures.get('preparedBy'):
                worksheet['E19'] = signatures.get('preparedBy', '')
            if signatures.get('verifiedBy'):
                worksheet['M19'] = signatures.get('verifiedBy', '')
        
        print(f"Filled frame sealant data for date {date}")
        
    except Exception as e:
        print(f"Error filling frame sealant data in sheet: {str(e)}")
        raise


def fill_shift_data(worksheet, entry, date, current_row):
    """Helper function to fill data for a single shift at the specified starting row"""
    shift = entry.get('shift', '')
    lines = entry.get('lines', {})
    
    # Process Line 1 (first 2 rows - length and width)
    line1_data = lines.get('1', {})
    line1_po = line1_data.get('po', '')
    
    # Get frame data for Line 1
    length_data = line1_data.get('length', {})
    width_data = line1_data.get('width', {})
    
    # Row 1: Frame Length Division
    row_idx = current_row
    worksheet[f'A{row_idx}'] = date
    worksheet[f'B{row_idx}'] = f"Shift {shift}"
    worksheet[f'C{row_idx}'] = "1"  # Line number
    worksheet[f'D{row_idx}'] = line1_po
    worksheet[f'E{row_idx}'] = length_data.get('frameSupplier', '')
    worksheet[f'F{row_idx}'] = f"Length - {length_data.get('frameSize', '')}"
    worksheet[f'G{row_idx}'] = length_data.get('sealantSupplier', '')
    worksheet[f'H{row_idx}'] = length_data.get('sealantExpiry', '')
    worksheet[f'I{row_idx}'] = length_data.get('frameWithoutSealant1', '')
    worksheet[f'J{row_idx}'] = length_data.get('frameWithoutSealant2', '')
    worksheet[f'K{row_idx}'] = length_data.get('frameWithSealant1', '')
    worksheet[f'L{row_idx}'] = length_data.get('frameWithSealant2', '')
    worksheet[f'M{row_idx}'] = length_data.get('netSealantWeight1', '')
    worksheet[f'N{row_idx}'] = length_data.get('netSealantWeight2', '')
    
    # Color code net sealant weight for Frame 1 (Length)
    try:
        if length_data.get('netSealantWeight1'):
            weight_val = float(length_data['netSealantWeight1'])
            if 33 <= weight_val <= 56:
                worksheet[f'M{row_idx}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
            else:
                worksheet[f'M{row_idx}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
    except (ValueError, TypeError):
        pass
    
    # Color code net sealant weight for Frame 2 (Length)
    try:
        if length_data.get('netSealantWeight2'):
            weight_val = float(length_data['netSealantWeight2'])
            if 33 <= weight_val <= 56:
                worksheet[f'N{row_idx}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
            else:
                worksheet[f'N{row_idx}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
    except (ValueError, TypeError):
        pass
    
    # Row 2: Frame Width Division
    row_idx = current_row + 1
    worksheet[f'A{row_idx}'] = date
    worksheet[f'B{row_idx}'] = f"Shift {shift}"
    worksheet[f'C{row_idx}'] = "1"  # Line number
    worksheet[f'D{row_idx}'] = line1_po
    worksheet[f'E{row_idx}'] = width_data.get('frameSupplier', '')
    worksheet[f'F{row_idx}'] = f"Width - {width_data.get('frameSize', '')}"
    worksheet[f'G{row_idx}'] = width_data.get('sealantSupplier', '')
    worksheet[f'H{row_idx}'] = width_data.get('sealantExpiry', '')
    worksheet[f'I{row_idx}'] = width_data.get('frameWithoutSealant1', '')
    worksheet[f'J{row_idx}'] = width_data.get('frameWithoutSealant2', '')
    worksheet[f'K{row_idx}'] = width_data.get('frameWithSealant1', '')
    worksheet[f'L{row_idx}'] = width_data.get('frameWithSealant2', '')
    worksheet[f'M{row_idx}'] = width_data.get('netSealantWeight1', '')
    worksheet[f'N{row_idx}'] = width_data.get('netSealantWeight2', '')
    
    # Color code net sealant weight for Frame 1 (Width)
    try:
        if width_data.get('netSealantWeight1'):
            weight_val = float(width_data['netSealantWeight1'])
            if 33 <= weight_val <= 56:
                worksheet[f'M{row_idx}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
            else:
                worksheet[f'M{row_idx}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
    except (ValueError, TypeError):
        pass
    
    # Color code net sealant weight for Frame 2 (Width)
    try:
        if width_data.get('netSealantWeight2'):
            weight_val = float(width_data['netSealantWeight2'])
            if 33 <= weight_val <= 56:
                worksheet[f'N{row_idx}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
            else:
                worksheet[f'N{row_idx}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
    except (ValueError, TypeError):
        pass
    
    # Sealant Weight/Module (gm) and (gm/m) for Line 1
    worksheet[f'O{current_row}'] = line1_data.get('totalSealantWeightPerModule', '')
    worksheet[f'P{current_row}'] = line1_data.get('sealantWeightPerModulePerMeter', '')
    worksheet[f'Q{current_row}'] = line1_data.get('remarks', '')
    
    # Process Line 2 (next 2 rows)
    line2_data = lines.get('2', {})
    line2_po = line2_data.get('po', '')
    
    # Get frame data for Line 2
    length_data2 = line2_data.get('length', {})
    width_data2 = line2_data.get('width', {})
    
    # Row 3: Frame Length Division - Line 2
    row_idx = current_row + 2
    worksheet[f'A{row_idx}'] = date
    worksheet[f'B{row_idx}'] = f"Shift {shift}"
    worksheet[f'C{row_idx}'] = "2"  # Line number
    worksheet[f'D{row_idx}'] = line2_po
    worksheet[f'E{row_idx}'] = length_data2.get('frameSupplier', '')
    worksheet[f'F{row_idx}'] = f"Length - {length_data2.get('frameSize', '')}"
    worksheet[f'G{row_idx}'] = length_data2.get('sealantSupplier', '')
    worksheet[f'H{row_idx}'] = length_data2.get('sealantExpiry', '')
    worksheet[f'I{row_idx}'] = length_data2.get('frameWithoutSealant1', '')
    worksheet[f'J{row_idx}'] = length_data2.get('frameWithoutSealant2', '')
    worksheet[f'K{row_idx}'] = length_data2.get('frameWithSealant1', '')
    worksheet[f'L{row_idx}'] = length_data2.get('frameWithSealant2', '')
    worksheet[f'M{row_idx}'] = length_data2.get('netSealantWeight1', '')
    worksheet[f'N{row_idx}'] = length_data2.get('netSealantWeight2', '')
    
    # Color code net sealant weight for Frame 1 (Length - Line 2)
    try:
        if length_data2.get('netSealantWeight1'):
            weight_val = float(length_data2['netSealantWeight1'])
            if 33 <= weight_val <= 56:
                worksheet[f'M{row_idx}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
            else:
                worksheet[f'M{row_idx}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
    except (ValueError, TypeError):
        pass
    
    # Color code net sealant weight for Frame 2 (Length - Line 2)
    try:
        if length_data2.get('netSealantWeight2'):
            weight_val = float(length_data2['netSealantWeight2'])
            if 33 <= weight_val <= 56:
                worksheet[f'N{row_idx}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
            else:
                worksheet[f'N{row_idx}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
    except (ValueError, TypeError):
        pass
    
    # Row 4: Frame Width Division - Line 2
    row_idx = current_row + 3
    worksheet[f'A{row_idx}'] = date
    worksheet[f'B{row_idx}'] = f"Shift {shift}"
    worksheet[f'C{row_idx}'] = "2"  # Line number
    worksheet[f'D{row_idx}'] = line2_po
    worksheet[f'E{row_idx}'] = width_data2.get('frameSupplier', '')
    worksheet[f'F{row_idx}'] = f"Width - {width_data2.get('frameSize', '')}"
    worksheet[f'G{row_idx}'] = width_data2.get('sealantSupplier', '')
    worksheet[f'H{row_idx}'] = width_data2.get('sealantExpiry', '')
    worksheet[f'I{row_idx}'] = width_data2.get('frameWithoutSealant1', '')
    worksheet[f'J{row_idx}'] = width_data2.get('frameWithoutSealant2', '')
    worksheet[f'K{row_idx}'] = width_data2.get('frameWithSealant1', '')
    worksheet[f'L{row_idx}'] = width_data2.get('frameWithSealant2', '')
    worksheet[f'M{row_idx}'] = width_data2.get('netSealantWeight1', '')
    worksheet[f'N{row_idx}'] = width_data2.get('netSealantWeight2', '')
    
    # Color code net sealant weight for Frame 1 (Width - Line 2)
    try:
        if width_data2.get('netSealantWeight1'):
            weight_val = float(width_data2['netSealantWeight1'])
            if 33 <= weight_val <= 56:
                worksheet[f'M{row_idx}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
            else:
                worksheet[f'M{row_idx}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
    except (ValueError, TypeError):
        pass
    
    # Color code net sealant weight for Frame 2 (Width - Line 2)
    try:
        if width_data2.get('netSealantWeight2'):
            weight_val = float(width_data2['netSealantWeight2'])
            if 33 <= weight_val <= 56:
                worksheet[f'N{row_idx}'].fill = PatternFill(start_color='92D050', end_color='92D050', fill_type='solid')
            else:
                worksheet[f'N{row_idx}'].fill = PatternFill(start_color='FF9999', end_color='FF9999', fill_type='solid')
    except (ValueError, TypeError):
        pass
    
    # Sealant Weight/Module (gm) and (gm/m) for Line 2
    worksheet[f'O{current_row + 2}'] = line2_data.get('totalSealantWeightPerModule', '')
    worksheet[f'P{current_row + 2}'] = line2_data.get('sealantWeightPerModulePerMeter', '')
    worksheet[f'Q{current_row + 2}'] = line2_data.get('remarks', '')

def generate_frame_sealant_report(frame_data):
    """Generate frame sealant weight report with multiple sheets - one sheet per day of the month"""
    try:
        if not frame_data:
            raise ValueError("No frame sealant data provided")
        
        print("Received frame sealant data for report generation")
        
        # Handle different input formats
        if isinstance(frame_data, list):
            entries = frame_data
            year = datetime.now().year
            month = datetime.now().month
        else:
            entries = frame_data.get('entries', [])
            year = frame_data.get('year', datetime.now().year)
            month = frame_data.get('month', datetime.now().month)
        
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
        template_key = get_template_key('Blank Frame Sealant Weight Report.xlsx')
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
                fill_frame_data_in_sheet(new_sheet, date_entries, formatted_date)
        
        # Remove the original template sheet (first sheet)
        if len(wb.worksheets) > 1:
            wb.remove(wb.worksheets[0])
        
        # Save to BytesIO
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        # Generate filename
        month_name = datetime(year, month, 1).strftime("%B")
        filename = f"Frame_Sealant_Weight_{month_name}_{year}.xlsx"
        
        print(f"Frame sealant report generated successfully: {filename}")
        return output, filename
        
    except Exception as e:
        print(f"Error generating frame sealant report: {str(e)}")
        raise