from openpyxl import load_workbook
from openpyxl.styles import (Font, PatternFill, Alignment, Border, Side, NamedStyle, numbers)
from openpyxl.utils import get_column_letter

import io
import os
from openpyxl.cell.cell import MergedCell
from paths import get_template_path

# Helper to get the writable cell (top-left of merged range)
def get_writable_cell(worksheet, cell_ref):
    cell = worksheet[cell_ref]
    if isinstance(cell, MergedCell):
        # Find the merged range this cell belongs to
        for merged_range in worksheet.merged_cells.ranges:
            if cell.coordinate in merged_range:
                # Return the top-left cell of the merged range
                return worksheet[merged_range.coord.split(":")[0]]
    return cell

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

def get_template_config(line_number):
    if line_number == 'I':
        template_path = get_template_path('Blank Audit Line-II.xlsx')
        # Cell mapping for Line I
        field_config = {
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
        # Observation mapping for Line I
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
            '3-7': { 'Line-3': 'G28', 'Line-4': 'S28' },
            '3-8': { 'Line-3': 'G29', 'Line-4': 'S29' },
            '3-9': { 'Line-3': 'G30', 'Line-4': 'S30' },
            '4-1': { 'Supplier': 'I31', 'WP': 'N31', 'Lot No.': 'S31', 'Expiry Date': 'AA31' },
            '4-2': { '4 hrs': 'G32', '8 hrs': 'S32' },
            '4-3': { '4 hrs': 'G33', '8 hrs': 'S33' },
            '4-4': { '4 hrs': 'G34', '8 hrs': 'S34' },
            '4-5': { '': 'G35' },
            '4-6': { 'Length': 'I36', 'Width': 'S36', 'Thickness': 'Z36' },
            '5-1': { 'Supplier': 'I37', 'Dimension': 'O37', 'Expiry Date': 'Y37' },
            '5-2': { '': 'G38' },
            '5-3': { 'Supplier': 'I39', 'Expiry Date': 'T39' },
            '5-8-tds': { 'TDS Value': 'G56' },
            '6-1': { '4 hrs': 'G132', '8 hrs': 'S132' },
            '9-1-humidity': { '2 hours': 'G185', '4 hours': 'M185', '6 hours': 'S185', '8 hours': 'Y185' },
            '9-2-temperature': { '2 hours': 'G186', '4 hours': 'M186', '6 hours': 'S186', '8 hours': 'Y186' },
            '9-3': { 'Supplier': 'I187', 'Type': 'N187', 'Lot No.': 'T187', 'Expiry Date': 'Z187' },
            '9-4': { 'Status': 'G188' },
            '9-9': { 'Length': 'I195', 'Width': 'V195' },
            '10-1': { 'Supplier': 'I196', 'Type': 'N196', 'Lot No.': 'T196', 'Expiry Date': 'Z196' },
            '10-2': { '': 'G197' },
            '11-1': { 'Supplier': 'I203', 'Type': 'N203', 'Lot No.': 'T203', 'Expiry Date': 'Z203' },
            '11-6': { '4 hours': 'G210', '8 hours': 'S210' },
            '13-1': { '4 hrs': 'G222', '8 hrs': 'S222' },
            '13-2': { '': 'G223' },
            '13-3-peel-strength': { 'Front': 'I224', 'Back': 'U224' },
            '13-4': { '4 hrs': 'G225', '8 hrs': 'S225' },
            '16-2': { '4 hours': 'G256', '8 hours': 'S256' },
            '16-3': { '4 hours': 'G257', '8 hours': 'S257' },
            '16-4': { '4 hours': 'G258', '8 hours': 'S258' },
            '16-5': { '4 hours': 'G259', '8 hours': 'S259' },
            '16-6': { '4 hours': 'G260', '8 hours': 'S260' },
            '25-1': { '4 hrs': 'G366', '8 hrs': 'S366' },
            '25-2': { '4 hrs': 'G367', '8 hrs': 'S367' },
            '28-1': { '4 hrs': 'G381', '8 hrs': 'S381' },
            '29-2': { '2 hours': 'G387', '4 hours': 'M387', '6 hours': 'S387', '8 hours': 'Y387' },
            '30-1': { '4 hrs': 'G388', '8 hrs': 'S388' },
            '30-2': { '4 hrs': 'G389', '8 hrs': 'S389' },
            '31-1': { 'Observation - 1': 'G391', 'Observation - 2': 'M391', 'Observation - 3': 'S391', 'Observation - 4': 'Y391' },
            '31-2': { 'Observation - 1': 'G392', 'Observation - 2': 'M392', 'Observation - 3': 'S392', 'Observation - 4': 'Y392' },
            '31-3': { 'Observation - 1': 'G393', 'Observation - 2': 'M393', 'Observation - 3': 'S393', 'Observation - 4': 'Y393' },
            '31-4': { 'Observation - 1': 'G394', 'Observation - 2': 'M394', 'Observation - 3': 'S394', 'Observation - 4': 'Y394' },
            '31-5': { 'Observation - 1': 'G395', 'Observation - 2': 'M395', 'Observation - 3': 'S395', 'Observation - 4': 'Y395' },
            '31-6': { 'Observation - 1': 'G396', 'Observation - 2': 'M396', 'Observation - 3': 'S396', 'Observation - 4': 'Y396' },
            '31-7': { 'Observation - 1': 'G397', 'Observation - 2': 'M397', 'Observation - 3': 'S397', 'Observation - 4': 'Y397' },
            '31-8': { 'Observation - 1': 'G398', 'Observation - 2': 'M398', 'Observation - 3': 'S398', 'Observation - 4': 'Y398' },
            '31-9': { 'Observation - 1': 'G399', 'Observation - 2': 'M399', 'Observation - 3': 'S399', 'Observation - 4': 'Y399' },
            '31-10': { 'Observation - 1': 'G400', 'Observation - 2': 'M400', 'Observation - 3': 'S400', 'Observation - 4': 'Y400' },
            '31-11': { 'Observation - 1': 'G401', 'Observation - 2': 'M401', 'Observation - 3': 'S401', 'Observation - 4': 'Y401' },
            '31-12': { 'Observation - 1': 'G402', 'Observation - 2': 'M402', 'Observation - 3': 'S402', 'Observation - 4': 'Y402' },
            '31-13': { 'Observation - 1': 'G403', 'Observation - 2': 'M403', 'Observation - 3': 'S403', 'Observation - 4': 'Y403' },
            
            # Complex parameter mappings
            '2-2': {
                '4 hrs': {
                    'Sample-1': 'G50', 'Sample-2': 'G51', 'Sample-3': 'G52', 
                    'Sample-4': 'G53', 'Sample-5': 'G54', 'Sample-6': 'G55'
                },
                '8 hrs': {
                    'Sample-1': 'S50', 'Sample-2': 'S51', 'Sample-3': 'S52',
                    'Sample-4': 'S53', 'Sample-5': 'S54', 'Sample-6': 'S55'
                }
            },
            '2-4': {
                'Line-3': {
                    'Sample-1': 'I60', 'Sample-2': 'I61', 'Sample-3': 'I62', 'Sample-4': 'I63'
                },
                'Line-4': {
                    'Sample-1': 'S60', 'Sample-2': 'S61', 'Sample-3': 'S62', 'Sample-4': 'S63'
                }
            },
            '2-5': {
                'Line-3': {
                    'Sample-1': 'I64', 'Sample-2': 'I65', 'Sample-3': 'I66', 'Sample-4': 'I67'
                },
                'Line-4': {
                    'Sample-1': 'S64', 'Sample-2': 'S65', 'Sample-3': 'S66', 'Sample-4': 'S67'
                }
            },
            '2-6': {
                'Line-3': {
                    'Sample-1': 'I68', 'Sample-2': 'I69', 'Sample-3': 'I70', 'Sample-4': 'I71'
                },
                'Line-4': {
                    'Sample-1': 'S68', 'Sample-2': 'S69', 'Sample-3': 'S70', 'Sample-4': 'S71'
                }
            },
            '3-6': {
                '4 hrs': {
                    'Sample-1': 'G72', 'Sample-2': 'G73', 'Sample-3': 'G74', 
                    'Sample-4': 'G75', 'Sample-5': 'G76', 'Sample-6': 'G77'
                },
                '8 hrs': {
                    'Sample-1': 'S72', 'Sample-2': 'S73', 'Sample-3': 'S74',
                    'Sample-4': 'S75', 'Sample-5': 'S76', 'Sample-6': 'S77'
                }
            },
            '5-4-laser-power': {
                'Stringer-7': {'Unit A': 'G100', 'Unit B': 'G101'},
                'Stringer-8': {'Unit A': 'G102', 'Unit B': 'G103'},
                'Stringer-9': {'Unit A': 'G104', 'Unit B': 'G105'},
                'Stringer-10': {'Unit A': 'G106', 'Unit B': 'G107'},
                'Stringer-11': {'Unit A': 'G108', 'Unit B': 'G109'},
                'Stringer-12': {'Unit A': 'G110', 'Unit B': 'G111'}
            },
            '5-5-cell-appearance': {
                'Stringer-7': {'Unit A': 'G112', 'Unit B': 'G113'},
                'Stringer-8': {'Unit A': 'G114', 'Unit B': 'G115'},
                'Stringer-9': {'Unit A': 'G116', 'Unit B': 'G117'},
                'Stringer-10': {'Unit A': 'G118', 'Unit B': 'G119'},
                'Stringer-11': {'Unit A': 'G120', 'Unit B': 'G121'},
                'Stringer-12': {'Unit A': 'G122', 'Unit B': 'G123'}
            },
            '5-6-cell-width': {
                'Stringer-7': {
                    'Upper-A-L': 'G124', 'Upper-A-R': 'G125', 'Lower-A-L': 'G126', 'Lower-A-R': 'G127',
                    'Upper-B-L': 'G128', 'Upper-B-R': 'G129', 'Lower-B-L': 'G130', 'Lower-B-R': 'G131'
                },
                'Stringer-8': {
                    'Upper-A-L': 'G132', 'Upper-A-R': 'G133', 'Lower-A-L': 'G134', 'Lower-A-R': 'G135',
                    'Upper-B-L': 'G136', 'Upper-B-R': 'G137', 'Lower-B-L': 'G138', 'Lower-B-R': 'G139'
                },
                'Stringer-9': {
                    'Upper-A-L': 'G140', 'Upper-A-R': 'G141', 'Lower-A-L': 'G142', 'Lower-A-R': 'G143',
                    'Upper-B-L': 'G144', 'Upper-B-R': 'G145', 'Lower-B-L': 'G146', 'Lower-B-R': 'G147'
                },
                'Stringer-10': {
                    'Upper-A-L': 'G148', 'Upper-A-R': 'G149', 'Lower-A-L': 'G150', 'Lower-A-R': 'G151',
                    'Upper-B-L': 'G152', 'Upper-B-R': 'G153', 'Lower-B-L': 'G154', 'Lower-B-R': 'G155'
                },
                'Stringer-11': {
                    'Upper-A-L': 'G156', 'Upper-A-R': 'G157', 'Lower-A-L': 'G158', 'Lower-A-R': 'G159',
                    'Upper-B-L': 'G160', 'Upper-B-R': 'G161', 'Lower-B-L': 'G162', 'Lower-B-R': 'G163'
                },
                'Stringer-12': {
                    'Upper-A-L': 'G164', 'Upper-A-R': 'G165', 'Lower-A-L': 'G166', 'Lower-A-R': 'G167',
                    'Upper-B-L': 'G168', 'Upper-B-R': 'G169', 'Lower-B-L': 'G170', 'Lower-B-R': 'G171'
                }
            },
            '5-7-groove-length': {
                'Stringer-7': {
                    'Unit A - Upper Half': 'G172', 'Unit A - Lower Half': 'G173',
                    'Unit B - Upper Half': 'G174', 'Unit B - Lower Half': 'G175'
                },
                'Stringer-8': {
                    'Unit A - Upper Half': 'G176', 'Unit A - Lower Half': 'G177',
                    'Unit B - Upper Half': 'G178', 'Unit B - Lower Half': 'G179'
                },
                'Stringer-9': {
                    'Unit A - Upper Half': 'G180', 'Unit A - Lower Half': 'G181',
                    'Unit B - Upper Half': 'G182', 'Unit B - Lower Half': 'G183'
                },
                'Stringer-10': {
                    'Unit A - Upper Half': 'G184', 'Unit A - Lower Half': 'G185',
                    'Unit B - Upper Half': 'G186', 'Unit B - Lower Half': 'G187'
                },
                'Stringer-11': {
                    'Unit A - Upper Half': 'G188', 'Unit A - Lower Half': 'G189',
                    'Unit B - Upper Half': 'G190', 'Unit B - Lower Half': 'G191'
                },
                'Stringer-12': {
                    'Unit A - Upper Half': 'G192', 'Unit A - Lower Half': 'G193',
                    'Unit B - Upper Half': 'G194', 'Unit B - Lower Half': 'G195'
                }
            },
            '5-9-machine-temp-setup': {
                'Stringer-7': {
                    'unitA': {
                        'fluxTemp': 'G196', 'preHeat1': 'G197', 'preHeat2': 'G198',
                        'solderPlate': 'G199', 'holdingPlate': 'G200', 'coolingPlate': 'G201',
                        'drying2': 'G202', 'drying3': 'G203', 'drying4': 'G204',
                        'drying5': 'G205', 'drying6': 'G206'
                    },
                    'unitB': {
                        'fluxTemp': 'G207', 'preHeat1': 'G208', 'preHeat2': 'G209',
                        'solderPlate': 'G210', 'holdingPlate': 'G211', 'coolingPlate': 'G212',
                        'drying2': 'G213', 'drying3': 'G214', 'drying4': 'G215',
                        'drying5': 'G216', 'drying6': 'G217'
                    }
                }
            },
            '5-10-light-intensity-time': {
                'Stringer-7': {
                    'unitA': {
                        'solderTime': 'G218', 'light1': 'G219', 'light2': 'G220', 'light3': 'G221',
                        'light4': 'G222', 'light5': 'G223', 'light6': 'G224', 'light7': 'G225',
                        'light8': 'G226', 'light9': 'G227', 'light10': 'G228', 'light11': 'G229',
                        'light12': 'G230', 'light13': 'G231', 'light14': 'G232', 'light15': 'G233',
                        'light16': 'G234', 'light17': 'G235', 'light18': 'G236', 'light19': 'G237',
                        'light20': 'G238', 'light21': 'G239'
                    },
                    'unitB': {
                        'solderTime': 'G240', 'light1': 'G241', 'light2': 'G242', 'light3': 'G243',
                        'light4': 'G244', 'light5': 'G245', 'light6': 'G246', 'light7': 'G247',
                        'light8': 'G248', 'light9': 'G249', 'light10': 'G250', 'light11': 'G251',
                        'light12': 'G252', 'light13': 'G253', 'light14': 'G254', 'light15': 'G255',
                        'light16': 'G256', 'light17': 'G257', 'light18': 'G258', 'light19': 'G259',
                        'light20': 'G260', 'light21': 'G261'
                    }
                }
            },
            '5-11-peel-strength': {
                'Stringer-7': {
                    'frontUnit': 'G262', 'backUnit': 'G263',
                    'frontSide': {
                        '1': 'G264', '2': 'G265', '3': 'G266', '4': 'G267', '5': 'G268',
                        '6': 'G269', '7': 'G270', '8': 'G271', '9': 'G272', '10': 'G273',
                        '11': 'G274', '12': 'G275', '13': 'G276', '14': 'G277', '15': 'G278',
                        '16': 'G279', '17': 'G280', '18': 'G281', '19': 'G282', '20': 'G283'
                    },
                    'backSide': {
                        '1': 'G284', '2': 'G285', '3': 'G286', '4': 'G287', '5': 'G288',
                        '6': 'G289', '7': 'G290', '8': 'G291', '9': 'G292', '10': 'G293',
                        '11': 'G294', '12': 'G295', '13': 'G296', '14': 'G297', '15': 'G298',
                        '16': 'G299', '17': 'G300', '18': 'G301', '19': 'G302', '20': 'G303'
                    }
                }
            },
            '5-12-ribbon-flatten': {
                'Stringer-7': 'G304', 'Stringer-8': 'G305', 'Stringer-9': 'G306',
                'Stringer-10': 'G307', 'Stringer-11': 'G308', 'Stringer-12': 'G309'
            },
            '5-13-string-length': {
                'Stringer-7': {'4 hours': 'G310', '8 hours': 'G311'},
                'Stringer-8': {'4 hours': 'G312', '8 hours': 'G313'},
                'Stringer-9': {'4 hours': 'G314', '8 hours': 'G315'},
                'Stringer-10': {'4 hours': 'G316', '8 hours': 'G317'},
                'Stringer-11': {'4 hours': 'G318', '8 hours': 'G319'},
                'Stringer-12': {'4 hours': 'G320', '8 hours': 'G321'}
            },
            '5-14-cell-to-cell-gap': {
                'Stringer-7': {'4 hours': 'G322', '8 hours': 'G323'},
                'Stringer-8': {'4 hours': 'G324', '8 hours': 'G325'},
                'Stringer-9': {'4 hours': 'G326', '8 hours': 'G327'},
                'Stringer-10': {'4 hours': 'G328', '8 hours': 'G329'},
                'Stringer-11': {'4 hours': 'G330', '8 hours': 'G331'},
                'Stringer-12': {'4 hours': 'G332', '8 hours': 'G333'}
            },
            '5-15-el-inspection': {
                'Stringer-7': {'4 hours': 'G334', '8 hours': 'G335'},
                'Stringer-8': {'4 hours': 'G336', '8 hours': 'G337'},
                'Stringer-9': {'4 hours': 'G338', '8 hours': 'G339'},
                'Stringer-10': {'4 hours': 'G340', '8 hours': 'G341'},
                'Stringer-11': {'4 hours': 'G342', '8 hours': 'G343'},
                'Stringer-12': {'4 hours': 'G344', '8 hours': 'G345'}
            },
            '7-1': {
                'Line-4-Supplier': 'G346', 'Line-4-Width': 'G347', 'Line-4-Thickness': 'G348', 'Line-4-Expiry Date': 'G349',
                'Line-5-Supplier': 'G350', 'Line-5-Width': 'G351', 'Line-5-Thickness': 'G352', 'Line-5-Expiry Date': 'G353'
            },
            '7-2': {
                'Line-4-Front TCA 1 L': 'G354', 'Line-4-Middle TCA 1 L': 'G355', 'Line-4-Back TCA 1 L': 'G356',
                'Line-4-Front TCA 1 R': 'G357', 'Line-4-Middle TCA 1 R': 'G358', 'Line-4-Back TCA 1 R': 'G359',
                'Line-5-Front TCA 1 L': 'G360', 'Line-5-Middle TCA 1 L': 'G361', 'Line-5-Back TCA 1 L': 'G362',
                'Line-5-Front TCA 1 R': 'G363', 'Line-5-Middle TCA 1 R': 'G364', 'Line-5-Back TCA 1 R': 'G365'
            },
            '7-3': {
                'Line-4-left': 'G366', 'Line-4-right': 'G367',
                'Line-5-left': 'G368', 'Line-5-right': 'G369'
            },
            '7-4': {
                'Line-4-4hrs': 'G370', 'Line-4-8hrs': 'G371',
                'Line-5-4hrs': 'G372', 'Line-5-8hrs': 'G373'
            },
            '7-5': {
                'Line-4': 'G374', 'Line-5': 'G375'
            },
            '7-6': {
                'Line-4-Top': 'G376', 'Line-4-Middle': 'G377', 'Line-4-Bottom': 'G378',
                'Line-5-Top': 'G379', 'Line-5-Middle': 'G380', 'Line-5-Bottom': 'G381'
            },
            '7-7': {
                'Line-4-I': 'G382', 'Line-4-Small L': 'G383', 'Line-4-Big L': 'G384', 'Line-4-Terminal': 'G385',
                'Line-5-I': 'G386', 'Line-5-Small L': 'G387', 'Line-5-Big L': 'G388', 'Line-5-Terminal': 'G389'
            },
            '7-8': {
                'Line-4-4hrs': 'G390', 'Line-4-8hrs': 'G391',
                'Line-5-4hrs': 'G392', 'Line-5-8hrs': 'G393'
            },
            '7-9': {
                'Line-4-Line': 'G394', 'Line-4-Position': 'G395', 'Line-4-Side': 'G396',
                'Line-4-Pos1': 'G397', 'Line-4-Pos2': 'G398', 'Line-4-Pos3': 'G399', 'Line-4-Pos4': 'G400',
                'Line-4-Pos5': 'G401', 'Line-4-Pos6': 'G402', 'Line-4-Pos7': 'G403', 'Line-4-Pos8': 'G404',
                'Line-4-Pos9': 'G405', 'Line-4-Pos10': 'G406', 'Line-4-Pos11': 'G407', 'Line-4-Pos12': 'G408',
                'Line-4-Pos13': 'G409', 'Line-4-Pos14': 'G410', 'Line-4-Pos15': 'G411', 'Line-4-Pos16': 'G412',
                'Line-4-Pos17': 'G413', 'Line-4-Pos18': 'G414', 'Line-4-Pos19': 'G415', 'Line-4-Pos20': 'G416',
                'Line-5-Line': 'G417', 'Line-5-Position': 'G418', 'Line-5-Side': 'G419',
                'Line-5-Pos1': 'G420', 'Line-5-Pos2': 'G421', 'Line-5-Pos3': 'G422', 'Line-5-Pos4': 'G423',
                'Line-5-Pos5': 'G424', 'Line-5-Pos6': 'G425', 'Line-5-Pos7': 'G426', 'Line-5-Pos8': 'G427',
                'Line-5-Pos9': 'G428', 'Line-5-Pos10': 'G429', 'Line-5-Pos11': 'G430', 'Line-5-Pos12': 'G431',
                'Line-5-Pos13': 'G432', 'Line-5-Pos14': 'G433', 'Line-5-Pos15': 'G434', 'Line-5-Pos16': 'G435',
                'Line-5-Pos17': 'G436', 'Line-5-Pos18': 'G437', 'Line-5-Pos19': 'G438', 'Line-5-Pos20': 'G439'
            },
            '8-1': {
                'Line-3-4hrs': 'G440', 'Line-3-8hrs': 'G441',
                'Line-4-4hrs': 'G442', 'Line-4-8hrs': 'G443'
            },
            '8-2': {
                'Line-3': 'G444', 'Line-4': 'G445'
            },
            '8-3': {
                'Line-3-4hrs': 'G446', 'Line-3-8hrs': 'G447',
                'Line-4-4hrs': 'G448', 'Line-4-8hrs': 'G449'
            },
            '8-4': {
                'Line-3-4hrs': 'G450', 'Line-3-8hrs': 'G451',
                'Line-4-4hrs': 'G452', 'Line-4-8hrs': 'G453'
            },
            '8-5': {
                'Line-3-4hrs': 'G454', 'Line-3-8hrs': 'G455',
                'Line-4-4hrs': 'G456', 'Line-4-8hrs': 'G457'
            },
            '8-6': {
                'Line-3-Supplier': 'G458', 'Line-3-Type': 'G459', 'Line-3-Quantity': 'G460',
                'Line-4-Supplier': 'G461', 'Line-4-Type': 'G462', 'Line-4-Quantity': 'G463'
            },
            '8-9': {
                'Line-3-4hrs': 'G464', 'Line-3-8hrs': 'G465',
                'Line-4-4hrs': 'G466', 'Line-4-8hrs': 'G467'
            },
            '8-10': {
                'Line-3-4hrs': 'G468', 'Line-3-8hrs': 'G469',
                'Line-4-4hrs': 'G470', 'Line-4-8hrs': 'G471'
            },
            '8-11': {
                'Line-3-4hrs': 'G472', 'Line-3-8hrs': 'G473',
                'Line-4-4hrs': 'G474', 'Line-4-8hrs': 'G475'
            },
            '8-12': {
                'Line-3-4hrs': 'G476', 'Line-3-8hrs': 'G477',
                'Line-4-4hrs': 'G478', 'Line-4-8hrs': 'G479'
            },
            '8-13': {
                'Line-3-4hrs': 'G480', 'Line-3-8hrs': 'G481',
                'Line-4-4hrs': 'G482', 'Line-4-8hrs': 'G483'
            },
            '8-14': {
                'Line-3-4hrs': 'G484', 'Line-3-8hrs': 'G485',
                'Line-4-4hrs': 'G486', 'Line-4-8hrs': 'G487'
            },
            '8-15': {
                'Line-3-4hrs': 'G488', 'Line-3-8hrs': 'G489',
                'Line-4-4hrs': 'G490', 'Line-4-8hrs': 'G491'
            },
            '8-16': {
                'Line-3-4hrs': 'G492', 'Line-3-8hrs': 'G493',
                'Line-4-4hrs': 'G494', 'Line-4-8hrs': 'G495'
            },
            '9-5': {
                '4 hours': {
                    'Sample-1': 'G496', 'Sample-2': 'G497', 'Sample-3': 'G498', 
                    'Sample-4': 'G499', 'Sample-5': 'G500', 'Sample-6': 'G501'
                },
                '8 hours': {
                    'Sample-1': 'S496', 'Sample-2': 'S497', 'Sample-3': 'S498',
                    'Sample-4': 'S499', 'Sample-5': 'S500', 'Sample-6': 'S501'
                }
            },
            '9-6': {
                'Line-3': {
                    'Sample-1': 'G502', 'Sample-2': 'G503', 'Sample-3': 'G504', 'Sample-4': 'G505'
                },
                'Line-4': {
                    'Sample-1': 'S502', 'Sample-2': 'S503', 'Sample-3': 'S504', 'Sample-4': 'S505'
                }
            },
            '9-7': {
                'Line-3': {
                    'Sample-1': 'G506', 'Sample-2': 'G507', 'Sample-3': 'G508', 'Sample-4': 'G509'
                },
                'Line-4': {
                    'Sample-1': 'S506', 'Sample-2': 'S507', 'Sample-3': 'S508', 'Sample-4': 'S509'
                }
            },
            '9-8': {
                'Line-3': {
                    'Sample-1': 'G510', 'Sample-2': 'G511', 'Sample-3': 'G512', 'Sample-4': 'G513'
                },
                'Line-4': {
                    'Sample-1': 'S510', 'Sample-2': 'S511', 'Sample-3': 'S512', 'Sample-4': 'S513'
                }
            },
            '10-4': {
                'Line-3': {
                    'Sample-1': 'G520', 'Sample-2': 'G521', 'Sample-3': 'G522', 'Sample-4': 'G523'
                },
                'Line-4': {
                    'Sample-1': 'S520', 'Sample-2': 'S521', 'Sample-3': 'S522', 'Sample-4': 'S523'
                }
            },
            '10-5': {
                'Line-3': {
                    'Sample-1': 'G524', 'Sample-2': 'G525', 'Sample-3': 'G526', 'Sample-4': 'G527'
                },
                'Line-4': {
                    'Sample-1': 'S524', 'Sample-2': 'S525', 'Sample-3': 'S526', 'Sample-4': 'S527'
                }
            },
            '10-6': {
                'Line-3': {
                    'Sample-1': 'G528', 'Sample-2': 'G529', 'Sample-3': 'G530', 'Sample-4': 'G531'
                },
                'Line-4': {
                    'Sample-1': 'S528', 'Sample-2': 'S529', 'Sample-3': 'S530', 'Sample-4': 'S531'
                }
            },
            '11-2': {
                '4 hours': {
                    'Sample-1': 'G532', 'Sample-2': 'G533', 'Sample-3': 'G534', 
                    'Sample-4': 'G535', 'Sample-5': 'G536', 'Sample-6': 'G537'
                },
                '8 hours': {
                    'Sample-1': 'S532', 'Sample-2': 'S533', 'Sample-3': 'S534',
                    'Sample-4': 'S535', 'Sample-5': 'S536', 'Sample-6': 'S537'
                }
            },
            '11-3': {
                'Line-3': {
                    'Sample-1': 'G538', 'Sample-2': 'G539', 'Sample-3': 'G540', 'Sample-4': 'G541'
                },
                'Line-4': {
                    'Sample-1': 'S538', 'Sample-2': 'S539', 'Sample-3': 'S540', 'Sample-4': 'S541'
                }
            },
            '11-4': {
                'Line-3': {
                    'Sample-1': 'G542', 'Sample-2': 'G543', 'Sample-3': 'G544', 'Sample-4': 'G545'
                },
                'Line-4': {
                    'Sample-1': 'S542', 'Sample-2': 'S543', 'Sample-3': 'S544', 'Sample-4': 'S545'
                }
            },
            '11-5': {
                'Line-3': {
                    'Sample-1': 'G546', 'Sample-2': 'G547', 'Sample-3': 'G548', 'Sample-4': 'G549'
                },
                'Line-4': {
                    'Sample-1': 'S546', 'Sample-2': 'S547', 'Sample-3': 'S548', 'Sample-4': 'S549'
                }
            },
            '12-1': {
                'Line-3': {
                    'Sample-1': 'G550', 'Sample-2': 'G551', 'Sample-3': 'G552', 'Sample-4': 'G553', 'Sample-5': 'G554',
                    'Sample-6': 'G555', 'Sample-7': 'G556', 'Sample-8': 'G557', 'Sample-9': 'G558', 'Sample-10': 'G559'
                },
                'Line-4': {
                    'Sample-1': 'S550', 'Sample-2': 'S551', 'Sample-3': 'S552', 'Sample-4': 'S553', 'Sample-5': 'S554',
                    'Sample-6': 'S555', 'Sample-7': 'S556', 'Sample-8': 'S557', 'Sample-9': 'S558', 'Sample-10': 'S559'
                }
            },
            '12-2': {
                'Line-3': {
                    'Sample-1': 'G560', 'Sample-2': 'G561', 'Sample-3': 'G562', 'Sample-4': 'G563', 'Sample-5': 'G564',
                    'Sample-6': 'G565', 'Sample-7': 'G566', 'Sample-8': 'G567', 'Sample-9': 'G568', 'Sample-10': 'G569'
                },
                'Line-4': {
                    'Sample-1': 'S560', 'Sample-2': 'S561', 'Sample-3': 'S562', 'Sample-4': 'S563', 'Sample-5': 'S564',
                    'Sample-6': 'S565', 'Sample-7': 'S566', 'Sample-8': 'S567', 'Sample-9': 'S568', 'Sample-10': 'S569'
                }
            },
            '14-1-laminator5': {
                'upper': {
                    'Chamber_1_Pumping': 'G570', 'Chamber_1_PressingCooling': 'G571', 'Chamber_1_Venting': 'G572',
                    'Chamber_1_LowerTemp': 'G573', 'Chamber_1_UpperTemp': 'G574', 'Chamber_2_Pumping': 'G575',
                    'Chamber_2_PressingCooling': 'G576', 'Chamber_2_Venting': 'G577', 'Chamber_2_LowerTemp': 'G578',
                    'Chamber_2_UpperTemp': 'G579', 'Chamber_3_Pumping': 'G580', 'Chamber_3_PressingCooling': 'G581',
                    'Chamber_3_Venting': 'G582', 'Chamber_3_LowerTemp': 'G583', 'Chamber_3_UpperTemp': 'G584'
                },
                'lower': {
                    'Chamber_1_Pumping': 'G585', 'Chamber_1_PressingCooling': 'G586', 'Chamber_1_Venting': 'G587',
                    'Chamber_1_LowerTemp': 'G588', 'Chamber_1_UpperTemp': 'G589', 'Chamber_2_Pumping': 'G590',
                    'Chamber_2_PressingCooling': 'G591', 'Chamber_2_Venting': 'G592', 'Chamber_2_LowerTemp': 'G593',
                    'Chamber_2_UpperTemp': 'G594', 'Chamber_3_Pumping': 'G595', 'Chamber_3_PressingCooling': 'G596',
                    'Chamber_3_Venting': 'G597', 'Chamber_3_LowerTemp': 'G598', 'Chamber_3_UpperTemp': 'G599'
                },
                'selectedRecipe': 'G600'
            },
            '15-1': {
                'Auto trimming - 3-4hrs': 'G601', 'Auto trimming - 3-8hrs': 'G602',
                'Auto trimming - 4-4hrs': 'G603', 'Auto trimming - 4-8hrs': 'G604'
            },
            '15-2': {
                'Auto trimming - 3': 'G605', 'Auto trimming - 4': 'G606'
            },
            '16-1': {
                'Line-3': {
                    'Sample-1': 'G607', 'Sample-2': 'G608', 'Sample-3': 'G609', 'Sample-4': 'G610', 'Sample-5': 'G611',
                    'Sample-6': 'G612', 'Sample-7': 'G613', 'Sample-8': 'G614', 'Sample-9': 'G615', 'Sample-10': 'G616'
                },
                'Line-4': {
                    'Sample-1': 'S607', 'Sample-2': 'S608', 'Sample-3': 'S609', 'Sample-4': 'S610', 'Sample-5': 'S611',
                    'Sample-6': 'S612', 'Sample-7': 'S613', 'Sample-8': 'S614', 'Sample-9': 'S615', 'Sample-10': 'S616'
                }
            },
            '17-1': {
                'Line-3-supplier': 'G617', 'Line-4-supplier': 'G618'
            },
            '17-2': {
                'Line-3-supplier': 'G619', 'Line-3-type': 'G620', 'Line-3-exp': 'G621',
                'Line-4-supplier': 'G622', 'Line-4-type': 'G623', 'Line-4-exp': 'G624'
            },
            '17-3': {
                'Line-3-4hrs': 'G625', 'Line-3-8hrs': 'G626',
                'Line-4-4hrs': 'G627', 'Line-4-8hrs': 'G628'
            },
            '17-4': {
                'Line-3-Sample-1-4hrs': 'G629', 'Line-3-Sample-1-8hrs': 'G630',
                'Line-3-Sample-2-4hrs': 'G631', 'Line-3-Sample-2-8hrs': 'G632',
                'Line-3-Sample-3-4hrs': 'G633', 'Line-3-Sample-3-8hrs': 'G634',
                'Line-3-Sample-4-4hrs': 'G635', 'Line-3-Sample-4-8hrs': 'G636',
                'Line-3-Sample-5-4hrs': 'G637', 'Line-3-Sample-5-8hrs': 'G638',
                'Line-3-Sample-6-4hrs': 'G639', 'Line-3-Sample-6-8hrs': 'G640',
                'Line-4-Sample-1-4hrs': 'G641', 'Line-4-Sample-1-8hrs': 'G642',
                'Line-4-Sample-2-4hrs': 'G643', 'Line-4-Sample-2-8hrs': 'G644',
                'Line-4-Sample-3-4hrs': 'G645', 'Line-4-Sample-3-8hrs': 'G646',
                'Line-4-Sample-4-4hrs': 'G647', 'Line-4-Sample-4-8hrs': 'G648',
                'Line-4-Sample-5-4hrs': 'G649', 'Line-4-Sample-5-8hrs': 'G650',
                'Line-4-Sample-6-4hrs': 'G651', 'Line-4-Sample-6-8hrs': 'G652'
            },
            '17-5': {
                'Line-3-Length1': 'G653', 'Line-3-Length2': 'G654', 'Line-3-Width1': 'G655', 'Line-3-Width2': 'G656',
                'Line-4-Length1': 'G657', 'Line-4-Length2': 'G658', 'Line-4-Width1': 'G659', 'Line-4-Width2': 'G660'
            },
            '17-6': {
                'Line-3-4hrs': 'G661', 'Line-3-8hrs': 'G662',
                'Line-4-4hrs': 'G663', 'Line-4-8hrs': 'G664'
            },
            '17-7': {
                'Line-3-Length': 'G665', 'Line-3-Width': 'G666',
                'Line-4-Length': 'G667', 'Line-4-Width': 'G668'
            },
            '17-8': {
                'Line-3-4hrs': 'G669', 'Line-3-8hrs': 'G670',
                'Line-4-4hrs': 'G671', 'Line-4-8hrs': 'G672'
            },
            '17-9': {
                'Line-3-4hrs': 'G673', 'Line-3-8hrs': 'G674',
                'Line-4-4hrs': 'G675', 'Line-4-8hrs': 'G676'
            },
            '17-10': {
                'Line-3-4hrs': 'G677', 'Line-3-8hrs': 'G678',
                'Line-4-4hrs': 'G679', 'Line-4-8hrs': 'G680'
            },
            '17-11': {
                'Line-3-4hrs': 'G681', 'Line-3-8hrs': 'G682',
                'Line-4-4hrs': 'G683', 'Line-4-8hrs': 'G684'
            },
            '17-12-coating-thickness': {
                'Line-3-4hrs': 'G685', 'Line-3-8hrs': 'G686',
                'Line-4-4hrs': 'G687', 'Line-4-8hrs': 'G688'
            },
            '18-1': {
                'Line-3-supplier': 'G689', 'Line-3-type': 'G690', 'Line-3-diode': 'G691', 'Line-3-maxVoltage': 'G692',
                'Line-3-maxCurrent': 'G693', 'Line-3-diodeType': 'G694', 'Line-4-supplier': 'G695', 'Line-4-type': 'G696',
                'Line-4-diode': 'G697', 'Line-4-maxVoltage': 'G698', 'Line-4-maxCurrent': 'G699', 'Line-4-diodeType': 'G700'
            },
            '18-2': {
                'Line-3-cableSupplier': 'G701', 'Line-3-connectorType': 'G702',
                'Line-4-cableSupplier': 'G703', 'Line-4-connectorType': 'G704'
            },
            '18-3': {
                'Line-3-supplier': 'G705', 'Line-3-type': 'G706', 'Line-3-exp': 'G707',
                'Line-4-supplier': 'G708', 'Line-4-type': 'G709', 'Line-4-exp': 'G710'
            },
            '18-4': {
                'Line-3-Sample-1-4hrs': 'G711', 'Line-3-Sample-1-8hrs': 'G712',
                'Line-3-Sample-2-4hrs': 'G713', 'Line-3-Sample-2-8hrs': 'G714',
                'Line-3-Sample-3-4hrs': 'G715', 'Line-3-Sample-3-8hrs': 'G716',
                'Line-3-Sample-4-4hrs': 'G717', 'Line-3-Sample-4-8hrs': 'G718',
                'Line-3-Sample-5-4hrs': 'G719', 'Line-3-Sample-5-8hrs': 'G720',
                'Line-3-Sample-6-4hrs': 'G721', 'Line-3-Sample-6-8hrs': 'G722',
                'Line-4-Sample-1-4hrs': 'G723', 'Line-4-Sample-1-8hrs': 'G724',
                'Line-4-Sample-2-4hrs': 'G725', 'Line-4-Sample-2-8hrs': 'G726',
                'Line-4-Sample-3-4hrs': 'G727', 'Line-4-Sample-3-8hrs': 'G728',
                'Line-4-Sample-4-4hrs': 'G729', 'Line-4-Sample-4-8hrs': 'G730',
                'Line-4-Sample-5-4hrs': 'G731', 'Line-4-Sample-5-8hrs': 'G732',
                'Line-4-Sample-6-4hrs': 'G733', 'Line-4-Sample-6-8hrs': 'G734'
            },
            '18-5': {
                'Line-3-positive': 'G735', 'Line-3-negative': 'G736',
                'Line-4-positive': 'G737', 'Line-4-negative': 'G738'
            },
            '18-6': {
                'Line-3-left': 'G739', 'Line-3-middle': 'G740', 'Line-3-right': 'G741',
                'Line-4-left': 'G742', 'Line-4-middle': 'G743', 'Line-4-right': 'G744'
            },
            '19-1': {
                'Line-3-4hrs': 'G745', 'Line-3-8hrs': 'G746',
                'Line-4-4hrs': 'G747', 'Line-4-8hrs': 'G748'
            },
            '19-2': {
                'Line-3-4hrs': 'G749', 'Line-3-8hrs': 'G750',
                'Line-4-4hrs': 'G751', 'Line-4-8hrs': 'G752'
            },
            '19-3': {
                'Line-3': 'G753', 'Line-4': 'G754'
            },
            '20-1': {
                'Line-3-SupplierA': 'G755', 'Line-3-TypeA': 'G756', 'Line-3-ExpA': 'G757',
                'Line-3-SupplierB': 'G758', 'Line-3-TypeB': 'G759', 'Line-3-ExpB': 'G760',
                'Line-4-SupplierA': 'G761', 'Line-4-TypeA': 'G762', 'Line-4-ExpA': 'G763',
                'Line-4-SupplierB': 'G764', 'Line-4-TypeB': 'G765', 'Line-4-ExpB': 'G766'
            },
            '20-2': {
                'Line-3-2hrs': 'G767', 'Line-3-4hrs': 'G768', 'Line-3-6hrs': 'G769', 'Line-3-8hrs': 'G770',
                'Line-4-2hrs': 'G771', 'Line-4-4hrs': 'G772', 'Line-4-6hrs': 'G773', 'Line-4-8hrs': 'G774'
            },
            '20-3': {
                'Line-3-PartA': 'G775', 'Line-3-PartB': 'G776', 'Line-3-Ratio': 'G777',
                'Line-4-PartA': 'G778', 'Line-4-PartB': 'G779', 'Line-4-Ratio': 'G780'
            },
            '20-4': {
                'Line-3-2hrs': 'G781', 'Line-3-4hrs': 'G782', 'Line-3-6hrs': 'G783', 'Line-3-8hrs': 'G784',
                'Line-4-2hrs': 'G785', 'Line-4-4hrs': 'G786', 'Line-4-6hrs': 'G787', 'Line-4-8hrs': 'G788'
            },
            '20-5': {
                'Line-3-4hrs': 'G789', 'Line-3-8hrs': 'G790',
                'Line-4-4hrs': 'G791', 'Line-4-8hrs': 'G792'
            },
            '21-1': {
                'Line-3-2hrs': 'G793', 'Line-3-4hrs': 'G794', 'Line-3-6hrs': 'G795', 'Line-3-8hrs': 'G796',
                'Line-4-2hrs': 'G797', 'Line-4-4hrs': 'G798', 'Line-4-6hrs': 'G799', 'Line-4-8hrs': 'G800'
            },
            '21-2': {
                'Line-3-2hrs': 'G801', 'Line-3-4hrs': 'G802', 'Line-3-6hrs': 'G803', 'Line-3-8hrs': 'G804',
                'Line-4-2hrs': 'G805', 'Line-4-4hrs': 'G806', 'Line-4-6hrs': 'G807', 'Line-4-8hrs': 'G808'
            },
            '21-3': {
                'Line-3-2hrs': 'G809', 'Line-3-4hrs': 'G810', 'Line-3-6hrs': 'G811', 'Line-3-8hrs': 'G812',
                'Line-4-2hrs': 'G813', 'Line-4-4hrs': 'G814', 'Line-4-6hrs': 'G815', 'Line-4-8hrs': 'G816'
            },
            '21-4': {
                'Line-3-2hrs': 'G817', 'Line-3-4hrs': 'G818', 'Line-3-6hrs': 'G819', 'Line-3-8hrs': 'G820',
                'Line-4-2hrs': 'G821', 'Line-4-4hrs': 'G822', 'Line-4-6hrs': 'G823', 'Line-4-8hrs': 'G824'
            },
            '21-5': {
                'Line-3-2hrs': 'G825', 'Line-3-4hrs': 'G826', 'Line-3-6hrs': 'G827', 'Line-3-8hrs': 'G828',
                'Line-4-2hrs': 'G829', 'Line-4-4hrs': 'G830', 'Line-4-6hrs': 'G831', 'Line-4-8hrs': 'G832'
            },
            '22-1': {
                'Line-3-2hrs': 'G833', 'Line-3-4hrs': 'G834', 'Line-3-6hrs': 'G835', 'Line-3-8hrs': 'G836',
                'Line-4-2hrs': 'G837', 'Line-4-4hrs': 'G838', 'Line-4-6hrs': 'G839', 'Line-4-8hrs': 'G840'
            },
            '22-2': {
                'Line-3': 'G841', 'Line-4': 'G842'
            },
            '23-1': {
                'Line-3': {
                    'Sample-1': 'G843', 'Sample-2': 'G844', 'Sample-3': 'G845', 'Sample-4': 'G846', 'Sample-5': 'G847',
                    'Sample-6': 'G848', 'Sample-7': 'G849', 'Sample-8': 'G850', 'Sample-9': 'G851', 'Sample-10': 'G852'
                },
                'Line-4': {
                    'Sample-1': 'S843', 'Sample-2': 'S844', 'Sample-3': 'S845', 'Sample-4': 'S846', 'Sample-5': 'S847',
                    'Sample-6': 'S848', 'Sample-7': 'S849', 'Sample-8': 'S850', 'Sample-9': 'S851', 'Sample-10': 'S852'
                }
            },
            '24-1': {
                'Line-3': 'G853', 'Line-4': 'G854'
            },
            '24-2': {
                'Line-3': 'G855', 'Line-4': 'G856'
            },
            '24-3': {
                'Line-3-2hrs': 'G857', 'Line-3-4hrs': 'G858', 'Line-3-6hrs': 'G859', 'Line-3-8hrs': 'G860',
                'Line-4-2hrs': 'G861', 'Line-4-4hrs': 'G862', 'Line-4-6hrs': 'G863', 'Line-4-8hrs': 'G864'
            },
            '24-4': {
                'Line-3-2hrs': 'G865', 'Line-3-4hrs': 'G866', 'Line-3-6hrs': 'G867', 'Line-3-8hrs': 'G868',
                'Line-4-2hrs': 'G869', 'Line-4-4hrs': 'G870', 'Line-4-6hrs': 'G871', 'Line-4-8hrs': 'G872'
            },
            '24-5': {
                'Line-3': 'G873', 'Line-4': 'G874'
            },
            '24-6': {
                'Line-3-2hrs-calibrationTime': 'G875', 'Line-3-2hrs-moduleId': 'G876', 'Line-3-2hrs-pmax': 'G877',
                'Line-3-2hrs-voc': 'G878', 'Line-3-2hrs-isc': 'G879', 'Line-3-2hrs-moduleTemp': 'G880', 'Line-3-2hrs-roomTemp': 'G881',
                'Line-3-4hrs-calibrationTime': 'G882', 'Line-3-4hrs-moduleId': 'G883', 'Line-3-4hrs-pmax': 'G884',
                'Line-3-4hrs-voc': 'G885', 'Line-3-4hrs-isc': 'G886', 'Line-3-4hrs-moduleTemp': 'G887', 'Line-3-4hrs-roomTemp': 'G888',
                'Line-3-6hrs-calibrationTime': 'G889', 'Line-3-6hrs-moduleId': 'G890', 'Line-3-6hrs-pmax': 'G891',
                'Line-3-6hrs-voc': 'G892', 'Line-3-6hrs-isc': 'G893', 'Line-3-6hrs-moduleTemp': 'G894', 'Line-3-6hrs-roomTemp': 'G895',
                'Line-3-8hrs-calibrationTime': 'G896', 'Line-3-8hrs-moduleId': 'G897', 'Line-3-8hrs-pmax': 'G898',
                'Line-3-8hrs-voc': 'G899', 'Line-3-8hrs-isc': 'G900', 'Line-3-8hrs-moduleTemp': 'G901', 'Line-3-8hrs-roomTemp': 'G902',
                'Line-4-2hrs-calibrationTime': 'G903', 'Line-4-2hrs-moduleId': 'G904', 'Line-4-2hrs-pmax': 'G905',
                'Line-4-2hrs-voc': 'G906', 'Line-4-2hrs-isc': 'G907', 'Line-4-2hrs-moduleTemp': 'G908', 'Line-4-2hrs-roomTemp': 'G909',
                'Line-4-4hrs-calibrationTime': 'G910', 'Line-4-4hrs-moduleId': 'G911', 'Line-4-4hrs-pmax': 'G912',
                'Line-4-4hrs-voc': 'G913', 'Line-4-4hrs-isc': 'G914', 'Line-4-4hrs-moduleTemp': 'G915', 'Line-4-4hrs-roomTemp': 'G916',
                'Line-4-6hrs-calibrationTime': 'G917', 'Line-4-6hrs-moduleId': 'G918', 'Line-4-6hrs-pmax': 'G919',
                'Line-4-6hrs-voc': 'G920', 'Line-4-6hrs-isc': 'G921', 'Line-4-6hrs-moduleTemp': 'G922', 'Line-4-6hrs-roomTemp': 'G923',
                'Line-4-8hrs-calibrationTime': 'G924', 'Line-4-8hrs-moduleId': 'G925', 'Line-4-8hrs-pmax': 'G926',
                'Line-4-8hrs-voc': 'G927', 'Line-4-8hrs-isc': 'G928', 'Line-4-8hrs-moduleTemp': 'G929', 'Line-4-8hrs-roomTemp': 'G930'
            },
            '24-7': {
                'Line-3': 'G931', 'Line-4': 'G932'
            },
            '24-8': {
                'Line-3': 'G933', 'Line-4': 'G934'
            },
            '24-9': {
                'Line-3-1-contact-block': 'G935', 'Line-3-1-positive': 'G936', 'Line-3-1-negative': 'G937',
                'Line-4-1-contact-block': 'G938', 'Line-4-1-positive': 'G939', 'Line-4-1-negative': 'G940',
                'Line-3-2-contact-block': 'G941', 'Line-3-2-positive': 'G942', 'Line-3-2-negative': 'G943',
                'Line-4-2-contact-block': 'G944', 'Line-4-2-positive': 'G945', 'Line-4-2-negative': 'G946'
            },
            '26-1': {
                'Line-3-4hrs': 'G947', 'Line-3-8hrs': 'G948',
                'Line-4-4hrs': 'G949', 'Line-4-8hrs': 'G950'
            },
            '26-2': {
                'Line-3-4hrs': 'G951', 'Line-3-8hrs': 'G952',
                'Line-4-4hrs': 'G953', 'Line-4-8hrs': 'G954'
            },
            '26-3': {
                'Line-3-4hrs': 'G955', 'Line-3-8hrs': 'G956',
                'Line-4-4hrs': 'G957', 'Line-4-8hrs': 'G958'
            },
            '27-1': {
                'Line-3': {
                    'Sample-1': 'G959', 'Sample-2': 'G960', 'Sample-3': 'G961', 'Sample-4': 'G962', 'Sample-5': 'G963',
                    'Sample-6': 'G964', 'Sample-7': 'G965', 'Sample-8': 'G966', 'Sample-9': 'G967', 'Sample-10': 'G968'
                },
                'Line-4': {
                    'Sample-1': 'S959', 'Sample-2': 'S960', 'Sample-3': 'S961', 'Sample-4': 'S962', 'Sample-5': 'S963',
                    'Sample-6': 'S964', 'Sample-7': 'S965', 'Sample-8': 'S966', 'Sample-9': 'S967', 'Sample-10': 'S968'
                }
            },
            '29-1': {
                'Line-3': {
                    'Sample-1': 'G969', 'Sample-2': 'G970', 'Sample-3': 'G971', 'Sample-4': 'G972', 'Sample-5': 'G973',
                    'Sample-6': 'G974', 'Sample-7': 'G975', 'Sample-8': 'G976', 'Sample-9': 'G977', 'Sample-10': 'G978'
                },
                'Line-4': {
                    'Sample-1': 'S969', 'Sample-2': 'S970', 'Sample-3': 'S971', 'Sample-4': 'S972', 'Sample-5': 'S973',
                    'Sample-6': 'S974', 'Sample-7': 'S975', 'Sample-8': 'S976', 'Sample-9': 'S977', 'Sample-10': 'S978'
                }
            }
        }
    elif line_number == 'II':
        template_path = get_template_path('Blank Audit Line-II.xlsx')
        # Cell mapping for Line II (adjust these based on your actual Line II template)
        field_config = {
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
            },
            'audit_by': {
                'cell': 'C402',
                'label': 'Audit By:',
                'format': {'font_size': 16, 'bold': True}
            },
            'reviewed_by': {
                'cell': 'O402',
                'label': 'Reviewed By:',
                'format': {'font_size': 16, 'bold': True}
            }
        }
        # Observation mapping for Line II (adjust these based on your actual Line II template)
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
            '3-7': { 'Line-3': 'G28', 'Line-4': 'S28' },
            '3-8': { 'Line-3': 'G29', 'Line-4': 'S29' },
            '3-9': { 'Line-3': 'G30', 'Line-4': 'S30' },
            '4-1': { 'Supplier': 'I31', 'WP': 'N31', 'Lot No.': 'S31', 'Expiry Date': 'AA31' },
            '4-2': { '4 hrs': 'G32', '8 hrs': 'S32' },
            '4-3': { '4 hrs': 'G33', '8 hrs': 'S33' },
            '4-4': { '4 hrs': 'G34', '8 hrs': 'S34' },
            '4-5': { '': 'G35' },
            '4-6': { 'Length': 'I36', 'Width': 'S36', 'Thickness': 'Z36' },
            '5-1': { 'Supplier': 'I37', 'Dimension': 'O37', 'Expiry Date': 'Y37' },
            '5-2': { '': 'G38' },
            '5-3': { 'Supplier': 'I39', 'Expiry Date': 'T39' },
            '5-8-tds': { 'TDS Value': 'G56' },
            '6-1': { '4 hrs': 'G132', '8 hrs': 'S132' },
            '9-1-humidity': { '2 hours': 'G185', '4 hours': 'M185', '6 hours': 'S185', '8 hours': 'Y185' },
            '9-2-temperature': { '2 hours': 'G186', '4 hours': 'M186', '6 hours': 'S186', '8 hours': 'Y186' },
            '9-3': { 'Supplier': 'I187', 'Type': 'N187', 'Lot No.': 'T187', 'Expiry Date': 'Z187' },
            '9-4': { 'Status': 'G188' },
            '9-9': { 'Length': 'I195', 'Width': 'V195' },
            '10-1': { 'Supplier': 'I196', 'Type': 'N196', 'Lot No.': 'T196', 'Expiry Date': 'Z196' },
            '10-2': { '': 'G197' },
            '10-3': { '4 hours': 'G198', '8 hours': 'S198' },
            '11-1': { 'Supplier': 'I203', 'Type': 'N203', 'Lot No.': 'T203', 'Expiry Date': 'Z203' },
            '11-6': { '4 hours': 'G210', '8 hours': 'S210' },
            '13-1': { '4 hrs': 'G222', '8 hrs': 'S222' },
            '13-2': { '': 'G223' },
            '13-3-peel-strength': { 'Front': 'I224', 'Back': 'U224' },
            '13-4': { '4 hrs': 'G225', '8 hrs': 'S225' },
            '16-2': { '4 hours': 'G256', '8 hours': 'S256' },
            '16-3': { '4 hours': 'G257', '8 hours': 'S257' },
            '16-4': { '4 hours': 'G258', '8 hours': 'S258' },
            '16-5': { '4 hours': 'G259', '8 hours': 'S259' },
            '16-6': { '4 hours': 'G260', '8 hours': 'S260' },
            '25-1': { '4 hrs': 'G364', '8 hrs': 'S364' },
            '25-2': { '4 hrs': 'G365', '8 hrs': 'S365' },
            '28-1': { '4 hrs': 'G379', '8 hrs': 'S379' },
            '29-2': { '2 hours': 'G385', '4 hours': 'M385', '6 hours': 'S385', '8 hours': 'Y385' },
            '30-1': { '4 hrs': 'G386', '8 hrs': 'S386' },
            '30-2': { '4 hrs': 'G387', '8 hrs': 'S387' },
            '31-1': { 'Observation - 1': 'G389', 'Observation - 2': 'M389', 'Observation - 3': 'S389', 'Observation - 4': 'Y389' },
            '31-2': { 'Observation - 1': 'G390', 'Observation - 2': 'M390', 'Observation - 3': 'S390', 'Observation - 4': 'Y390' },
            '31-3': { 'Observation - 1': 'G391', 'Observation - 2': 'M391', 'Observation - 3': 'S391', 'Observation - 4': 'Y391' },
            '31-4': { 'Observation - 1': 'G392', 'Observation - 2': 'M392', 'Observation - 3': 'S392', 'Observation - 4': 'Y392' },
            '31-5': { 'Observation - 1': 'G393', 'Observation - 2': 'M393', 'Observation - 3': 'S393', 'Observation - 4': 'Y393' },
            '31-6': { 'Observation - 1': 'G394', 'Observation - 2': 'M394', 'Observation - 3': 'S394', 'Observation - 4': 'Y394' },
            '31-7': { 'Observation - 1': 'G395', 'Observation - 2': 'M395', 'Observation - 3': 'S395', 'Observation - 4': 'Y395' },
            '31-8': { 'Observation - 1': 'G396', 'Observation - 2': 'M396', 'Observation - 3': 'S396', 'Observation - 4': 'Y396' },
            '31-9': { 'Observation - 1': 'G397', 'Observation - 2': 'M397', 'Observation - 3': 'S397', 'Observation - 4': 'Y397' },
            '31-10': { 'Observation - 1': 'G398', 'Observation - 2': 'M398', 'Observation - 3': 'S398', 'Observation - 4': 'Y398' },
            '31-11': { 'Observation - 1': 'G399', 'Observation - 2': 'M399', 'Observation - 3': 'S399', 'Observation - 4': 'Y399' },
            '31-12': { 'Observation - 1': 'G400', 'Observation - 2': 'M400', 'Observation - 3': 'S400', 'Observation - 4': 'Y400' },
            '31-13': { 'Observation - 1': 'G401', 'Observation - 2': 'M401', 'Observation - 3': 'S401', 'Observation - 4': 'Y401' },
            '2-2': {
                '4 hrs': {
                    'Sample-1': 'G14', 'Sample-2': 'I14', 'Sample-3': 'K14', 
                    'Sample-4': 'M14', 'Sample-5': 'O14', 'Sample-6': 'Q14'
                },
                '8 hrs': {
                    'Sample-1': 'S14', 'Sample-2': 'U14', 'Sample-3': 'W14',
                    'Sample-4': 'Y14', 'Sample-5': 'AA14', 'Sample-6': 'AC14'
                }
            },
            '2-4': {
                'Line-3': {
                    'Sample-1': 'G17', 'Sample-2': 'J17', 'Sample-3': 'M17', 'Sample-4': 'P17'
                },
                'Line-4': {
                    'Sample-1': 'S17', 'Sample-2': 'V17', 'Sample-3': 'Y17', 'Sample-4': 'AB17'
                }
            },
            '2-5': {
                'Line-3': {
                    'Sample-1': 'G18', 'Sample-2': 'J18', 'Sample-3': 'M18', 'Sample-4': 'P18'
                },
                'Line-4': {
                    'Sample-1': 'S18', 'Sample-2': 'V18', 'Sample-3': 'Y18', 'Sample-4': 'AB18'
                }
            },
            '2-6': {
                'Line-3': {
                    'Sample-1': 'G19', 'Sample-2': 'J19', 'Sample-3': 'M19', 'Sample-4': 'P19'
                },
                'Line-4': {
                    'Sample-1': 'S19', 'Sample-2': 'V19', 'Sample-3': 'Y19', 'Sample-4': 'AB19'
                }
            },
            '3-6': {
                '4 hrs': {
                    'Sample-1': 'G26', 'Sample-2': 'I26', 'Sample-3': 'K26', 
                    'Sample-4': 'M26', 'Sample-5': 'O26', 'Sample-6': 'Q26'
                },
                '8 hrs': {
                    'Sample-1': 'S26', 'Sample-2': 'U26', 'Sample-3': 'W26',
                    'Sample-4': 'Y26', 'Sample-5': 'AA26', 'Sample-6': 'AC26'
                }
            },
            '5-4-laser-power': {
                'Stringer-7': {'Unit A': 'G42', 'Unit B': 'K42'},
                'Stringer-8': {'Unit A': 'O42', 'Unit B': 'S42'},
                'Stringer-9': {'Unit A': 'W42', 'Unit B': 'AA42'},
                'Stringer-10': {'Unit A': 'G50', 'Unit B': 'K50'},
                'Stringer-11': {'Unit A': 'O50', 'Unit B': 'S50'},
                'Stringer-12': {'Unit A': 'W50', 'Unit B': 'AA50'},
            },
            '5-5-cell-appearance': {
                'Stringer-7': {'Unit A': 'G43', 'Unit B': 'K43'},
                'Stringer-8': {'Unit A': 'O43', 'Unit B': 'S43'},
                'Stringer-9': {'Unit A': 'W43', 'Unit B': 'AA43'},
                'Stringer-10': {'Unit A': 'G51', 'Unit B': 'K51'},
                'Stringer-11': {'Unit A': 'O51', 'Unit B': 'S51'},
                'Stringer-12': {'Unit A': 'W51', 'Unit B': 'AA51'},
            },
            '5-6-cell-width': {
                'Stringer-7': {
                    'Upper-A-L': 'H45', 'Upper-A-R': 'H46', 'Lower-A-L': 'J45', 'Lower-A-R': 'J46',
                    'Upper-B-L': 'L45', 'Upper-B-R': 'L46', 'Lower-B-L': 'N45', 'Lower-B-R': 'N46'
                },
                'Stringer-8': {
                    'Upper-A-L': 'P45', 'Upper-A-R': 'P46', 'Lower-A-L': 'R45', 'Lower-A-R': 'R46',
                    'Upper-B-L': 'T45', 'Upper-B-R': 'T46', 'Lower-B-L': 'V45', 'Lower-B-R': 'V46'
                },
                'Stringer-9': {
                    'Upper-A-L': 'X45', 'Upper-A-R': 'X46', 'Lower-A-L': 'Z45', 'Lower-A-R': 'Z46',
                    'Upper-B-L': 'AB45', 'Upper-B-R': 'AB46', 'Lower-B-L': 'AD45', 'Lower-B-R': 'AD46'
                },
                'Stringer-10': {
                    'Upper-A-L': 'H53', 'Upper-A-R': 'H54', 'Lower-A-L': 'J53', 'Lower-A-R': 'J54',
                    'Upper-B-L': 'L53', 'Upper-B-R': 'L54', 'Lower-B-L': 'N53', 'Lower-B-R': 'N54'
                },
                'Stringer-11': {
                    'Upper-A-L': 'P53', 'Upper-A-R': 'P54', 'Lower-A-L': 'R53', 'Lower-A-R': 'R54',
                    'Upper-B-L': 'T53', 'Upper-B-R': 'T54', 'Lower-B-L': 'V53', 'Lower-B-R': 'V54'
                },
                'Stringer-12': {
                    'Upper-A-L': 'X53', 'Upper-A-R': 'X54', 'Lower-A-L': 'Z53', 'Lower-A-R': 'Z54',
                    'Upper-B-L': 'AB53', 'Upper-B-R': 'AB54', 'Lower-B-L': 'AD53', 'Lower-B-R': 'AD54'
                }
            },
            '5-7-groove-length': {
                'Stringer-7': {
                    'Unit A - Upper Half': 'H47', 'Unit A - Lower Half': 'J47',
                    'Unit B - Upper Half': 'L47', 'Unit B - Lower Half': 'N47'
                },
                'Stringer-8': {
                    'Unit A - Upper Half': 'P47', 'Unit A - Lower Half': 'R47',
                    'Unit B - Upper Half': 'T47', 'Unit B - Lower Half': 'V47'
                },
                'Stringer-9': {
                    'Unit A - Upper Half': 'X47', 'Unit A - Lower Half': 'Z47',
                    'Unit B - Upper Half': 'AB47', 'Unit B - Lower Half': 'AD47'
                },
                'Stringer-10': {
                    'Unit A - Upper Half': 'H55', 'Unit A - Lower Half': 'J55',
                    'Unit B - Upper Half': 'L55', 'Unit B - Lower Half': 'N55'
                },
                'Stringer-11': {
                    'Unit A - Upper Half': 'P55', 'Unit A - Lower Half': 'R55',
                    'Unit B - Upper Half': 'T55', 'Unit B - Lower Half': 'V55'
                },
                'Stringer-12': {
                    'Unit A - Upper Half': 'X55', 'Unit A - Lower Half': 'Z55',
                    'Unit B - Upper Half': 'AB55', 'Unit B - Lower Half': 'AD55'
                }
            },
            '5-9-machine-temp-setup': {
                'Stringer-7': {
                    'unitA': {
                        'fluxTemp': 'I58', 'preHeat1': 'K58', 'preHeat2': 'M58',
                        'solderPlate': 'O58', 'holdingPlate': 'Q58', 'coolingPlate': 'S58',
                        'drying2': 'U58', 'drying3': 'W58', 'drying4': 'Y58',
                        'drying5': 'AA58', 'drying6': 'AC58'
                    },
                    'unitB': {
                        'fluxTemp': 'I59', 'preHeat1': 'K59', 'preHeat2': 'M59',
                        'solderPlate': 'O59', 'holdingPlate': 'Q59', 'coolingPlate': 'S59',
                        'drying2': 'U59', 'drying3': 'W59', 'drying4': 'Y59',
                        'drying5': 'AA59', 'drying6': 'AC59'
                    }
                },
                'Stringer-8': {
                    'unitA': {
                        'fluxTemp': 'I60', 'preHeat1': 'K60', 'preHeat2': 'M60',
                        'solderPlate': 'O60', 'holdingPlate': 'Q60', 'coolingPlate': 'S60',
                        'drying2': 'U60', 'drying3': 'W60', 'drying4': 'Y60',
                        'drying5': 'AA60', 'drying6': 'AC60'
                    },
                    'unitB': {
                        'fluxTemp': 'I61', 'preHeat1': 'K61', 'preHeat2': 'M61',
                        'solderPlate': 'O61', 'holdingPlate': 'Q61', 'coolingPlate': 'S61',
                        'drying2': 'U61', 'drying3': 'W61', 'drying4': 'Y61',
                        'drying5': 'AA61', 'drying6': 'AC61'
                    }
                },
                'Stringer-9': {
                    'unitA': {
                        'fluxTemp': 'I62', 'preHeat1': 'K62', 'preHeat2': 'M62',
                        'solderPlate': 'O62', 'holdingPlate': 'Q62', 'coolingPlate': 'S62',
                        'drying2': 'U62', 'drying3': 'W62', 'drying4': 'Y62',
                        'drying5': 'AA62', 'drying6': 'AC62'
                    },
                    'unitB': {
                        'fluxTemp': 'I63', 'preHeat1': 'K63', 'preHeat2': 'M63',
                        'solderPlate': 'O63', 'holdingPlate': 'Q63', 'coolingPlate': 'S63',
                        'drying2': 'U63', 'drying3': 'W63', 'drying4': 'Y63',
                        'drying5': 'AA63', 'drying6': 'AC63'
                    }
                },
                'Stringer-10': {
                    'unitA': {
                        'fluxTemp': 'I64', 'preHeat1': 'K64', 'preHeat2': 'M64',
                        'solderPlate': 'O64', 'holdingPlate': 'Q64', 'coolingPlate': 'S64',
                        'drying2': 'U64', 'drying3': 'W64', 'drying4': 'Y64',
                        'drying5': 'AA64', 'drying6': 'AC64'
                    },
                    'unitB': {
                        'fluxTemp': 'I65', 'preHeat1': 'K65', 'preHeat2': 'M65',
                        'solderPlate': 'O65', 'holdingPlate': 'Q65', 'coolingPlate': 'S65',
                        'drying2': 'U65', 'drying3': 'W65', 'drying4': 'Y65',
                        'drying5': 'AA65', 'drying6': 'AC65'
                    }
                },
                'Stringer-11': {
                    'unitA': {
                        'fluxTemp': 'I66', 'preHeat1': 'K66', 'preHeat2': 'M66',
                        'solderPlate': 'O66', 'holdingPlate': 'Q66', 'coolingPlate': 'S66',
                        'drying2': 'U66', 'drying3': 'W66', 'drying4': 'Y66',
                        'drying5': 'AA66', 'drying6': 'AC66'
                    },
                    'unitB': {
                        'fluxTemp': 'I67', 'preHeat1': 'K67', 'preHeat2': 'M67',
                        'solderPlate': 'O67', 'holdingPlate': 'Q67', 'coolingPlate': 'S67',
                        'drying2': 'U67', 'drying3': 'W67', 'drying4': 'Y67',
                        'drying5': 'AA67', 'drying6': 'AC67'
                    }
                },
                'Stringer-12': {
                    'unitA': {
                        'fluxTemp': 'I68', 'preHeat1': 'K68', 'preHeat2': 'M68',
                        'solderPlate': 'O68', 'holdingPlate': 'Q68', 'coolingPlate': 'S68',
                        'drying2': 'U68', 'drying3': 'W68', 'drying4': 'Y68',
                        'drying5': 'AA68', 'drying6': 'AC68'
                    },
                    'unitB': {
                        'fluxTemp': 'I69', 'preHeat1': 'K69', 'preHeat2': 'M69',
                        'solderPlate': 'O69', 'holdingPlate': 'Q69', 'coolingPlate': 'S69',
                        'drying2': 'U69', 'drying3': 'W69', 'drying4': 'Y69',
                        'drying5': 'AA69', 'drying6': 'AC69'
                    }
                }
            },
            '5-10-light-intensity-time': {
                'Stringer-7': {
                    'unitA': {
                        'solderTime': 'I72', 'light1': 'J72', 'light2': 'K72', 'light3': 'L72',
                        'light4': 'M72', 'light5': 'N72', 'light6': 'O72', 'light7': 'P72',
                        'light8': 'Q72', 'light9': 'R72', 'light10': 'S72', 'light11': 'T72',
                        'light12': 'U72', 'light13': 'V72', 'light14': 'W72', 'light15': 'X72',
                        'light16': 'Y72', 'light17': 'Z72', 'light18': 'AA72', 'light19': 'AB72',
                        'light20': 'AC72', 'light21': 'AD72'
                    },
                    'unitB': {
                        'solderTime': 'I73', 'light1': 'J73', 'light2': 'K73', 'light3': 'L73',
                        'light4': 'M73', 'light5': 'N73', 'light6': 'O73', 'light7': 'P73',
                        'light8': 'Q73', 'light9': 'R73', 'light10': 'S73', 'light11': 'T73',
                        'light12': 'U73', 'light13': 'V73', 'light14': 'W73', 'light15': 'X73',
                        'light16': 'Y73', 'light17': 'Z73', 'light18': 'AA73', 'light19': 'AB73',
                        'light20': 'AC73', 'light21': 'AD73'
                    }
                },
                'Stringer-8': {
                    'unitA': {
                        'solderTime': 'I74', 'light1': 'J74', 'light2': 'K74', 'light3': 'L74',
                        'light4': 'M74', 'light5': 'N74', 'light6': 'O74', 'light7': 'P74',
                        'light8': 'Q74', 'light9': 'R74', 'light10': 'S74', 'light11': 'T74',
                        'light12': 'U74', 'light13': 'V74', 'light14': 'W74', 'light15': 'X74',
                        'light16': 'Y74', 'light17': 'Z74', 'light18': 'AA74', 'light19': 'AB74',
                        'light20': 'AC74', 'light21': 'AD74'
                    },
                    'unitB': {
                        'solderTime': 'I75', 'light1': 'J75', 'light2': 'K75', 'light3': 'L75',
                        'light4': 'M75', 'light5': 'N75', 'light6': 'O75', 'light7': 'P75',
                        'light8': 'Q75', 'light9': 'R75', 'light10': 'S75', 'light11': 'T75',
                        'light12': 'U75', 'light13': 'V75', 'light14': 'W75', 'light15': 'X75',
                        'light16': 'Y75', 'light17': 'Z75', 'light18': 'AA75', 'light19': 'AB75',
                        'light20': 'AC75', 'light21': 'AD75'
                    }
                },
                'Stringer-9': {
                    'unitA': {
                        'solderTime': 'I76', 'light1': 'J76', 'light2': 'K76', 'light3': 'L76',
                        'light4': 'M76', 'light5': 'N76', 'light6': 'O76', 'light7': 'P76',
                        'light8': 'Q76', 'light9': 'R76', 'light10': 'S76', 'light11': 'T76',
                        'light12': 'U76', 'light13': 'V76', 'light14': 'W76', 'light15': 'X76',
                        'light16': 'Y76', 'light17': 'Z76', 'light18': 'AA76', 'light19': 'AB76',
                        'light20': 'AC76', 'light21': 'AD76'
                    },
                    'unitB': {
                        'solderTime': 'I77', 'light1': 'J77', 'light2': 'K77', 'light3': 'L77',
                        'light4': 'M77', 'light5': 'N77', 'light6': 'O77', 'light7': 'P77',
                        'light8': 'Q77', 'light9': 'R77', 'light10': 'S77', 'light11': 'T77',
                        'light12': 'U77', 'light13': 'V77', 'light14': 'W77', 'light15': 'X77',
                        'light16': 'Y77', 'light17': 'Z77', 'light18': 'AA77', 'light19': 'AB77',
                        'light20': 'AC77', 'light21': 'AD77'
                    }
                },
                'Stringer-10': {
                    'unitA': {
                        'solderTime': 'I78', 'light1': 'J78', 'light2': 'K78', 'light3': 'L78',
                        'light4': 'M78', 'light5': 'N78', 'light6': 'O78', 'light7': 'P78',
                        'light8': 'Q78', 'light9': 'R78', 'light10': 'S78', 'light11': 'T78',
                        'light12': 'U78', 'light13': 'V78', 'light14': 'W78', 'light15': 'X78',
                        'light16': 'Y78', 'light17': 'Z78', 'light18': 'AA78', 'light19': 'AB78',
                        'light20': 'AC78', 'light21': 'AD78'
                    },
                    'unitB': {
                        'solderTime': 'I79', 'light1': 'J79', 'light2': 'K79', 'light3': 'L79',
                        'light4': 'M79', 'light5': 'N79', 'light6': 'O79', 'light7': 'P79',
                        'light8': 'Q79', 'light9': 'R79', 'light10': 'S79', 'light11': 'T79',
                        'light12': 'U79', 'light13': 'V79', 'light14': 'W79', 'light15': 'X79',
                        'light16': 'Y79', 'light17': 'Z79', 'light18': 'AA79', 'light19': 'AB79',
                        'light20': 'AC79', 'light21': 'AD79'
                    }
                },
                'Stringer-11': {
                    'unitA': {
                        'solderTime': 'I80', 'light1': 'J80', 'light2': 'K80', 'light3': 'L80',
                        'light4': 'M80', 'light5': 'N80', 'light6': 'O80', 'light7': 'P80',
                        'light8': 'Q80', 'light9': 'R80', 'light10': 'S80', 'light11': 'T80',
                        'light12': 'U80', 'light13': 'V80', 'light14': 'W80', 'light15': 'X80',
                        'light16': 'Y80', 'light17': 'Z80', 'light18': 'AA80', 'light19': 'AB80',
                        'light20': 'AC80', 'light21': 'AD80'
                    },
                    'unitB': {
                        'solderTime': 'I81', 'light1': 'J81', 'light2': 'K81', 'light3': 'L81',
                        'light4': 'M81', 'light5': 'N81', 'light6': 'O81', 'light7': 'P81',
                        'light8': 'Q81', 'light9': 'R81', 'light10': 'S81', 'light11': 'T81',
                        'light12': 'U81', 'light13': 'V81', 'light14': 'W81', 'light15': 'X81',
                        'light16': 'Y81', 'light17': 'Z81', 'light18': 'AA81', 'light19': 'AB81',
                        'light20': 'AC81', 'light21': 'AD81'
                    }
                },
                'Stringer-12': {
                    'unitA': {
                        'solderTime': 'I82', 'light1': 'J82', 'light2': 'K82', 'light3': 'L82',
                        'light4': 'M82', 'light5': 'N82', 'light6': 'O82', 'light7': 'P82',
                        'light8': 'Q82', 'light9': 'R82', 'light10': 'S82', 'light11': 'T82',
                        'light12': 'U82', 'light13': 'V82', 'light14': 'W82', 'light15': 'X82',
                        'light16': 'Y82', 'light17': 'Z82', 'light18': 'AA82', 'light19': 'AB82',
                        'light20': 'AC82', 'light21': 'AD82'
                    },
                    'unitB': {
                        'solderTime': 'I83', 'light1': 'J83', 'light2': 'K83', 'light3': 'L83',
                        'light4': 'M83', 'light5': 'N83', 'light6': 'O83', 'light7': 'P83',
                        'light8': 'Q83', 'light9': 'R83', 'light10': 'S83', 'light11': 'T83',
                        'light12': 'U83', 'light13': 'V83', 'light14': 'W83', 'light15': 'X83',
                        'light16': 'Y83', 'light17': 'Z83', 'light18': 'AA83', 'light19': 'AB83',
                        'light20': 'AC83', 'light21': 'AD83'
                    }
                },
            },
            '5-11-peel-strength': {
                'Stringer-7': {
                    'frontUnit': 'H84', 'backUnit': 'H86',
                    'frontSide': {
                        '1': 'K85', '2': 'L85', '3': 'M85', '4': 'N85', '5': 'O85',
                        '6': 'P85', '7': 'Q85', '8': 'R85', '9': 'S85', '10': 'T85',
                        '11': 'U85', '12': 'V85', '13': 'W85', '14': 'X85', '15': 'Y85',
                        '16': 'Z85', '17': 'AA85', '18': 'AB85', '19': 'AC85', '20': 'AD85'
                    },
                    'backSide': {
                        '1': 'K87', '2': 'L87', '3': 'M87', '4': 'N87', '5': 'O87',
                        '6': 'P87', '7': 'Q87', '8': 'R87', '9': 'S87', '10': 'T87',
                        '11': 'U87', '12': 'V87', '13': 'W87', '14': 'X87', '15': 'Y87',
                        '16': 'Z87', '17': 'AA87', '18': 'AB87', '19': 'AC87', '20': 'AD87'
                    }
                },
                'Stringer-8': {
                    'frontUnit': 'H92', 'backUnit': 'H94',
                    'frontSide': {
                        '1': 'K93', '2': 'L93', '3': 'M93', '4': 'N93', '5': 'O93',
                        '6': 'P93', '7': 'Q93', '8': 'R93', '9': 'S93', '10': 'T93',
                        '11': 'U93', '12': 'V93', '13': 'W93', '14': 'X93', '15': 'Y93',
                        '16': 'Z93', '17': 'AA93', '18': 'AB93', '19': 'AC93', '20': 'AD93'
                    },
                    'backSide': {
                        '1': 'K95', '2': 'L95', '3': 'M95', '4': 'N95', '5': 'O95',
                        '6': 'P95', '7': 'Q95', '8': 'R95', '9': 'S95', '10': 'T95',
                        '11': 'U95', '12': 'V95', '13': 'W95', '14': 'X95', '15': 'Y95',
                        '16': 'Z95', '17': 'AA95', '18': 'AB95', '19': 'AC95', '20': 'AD95'
                    }
                },
                'Stringer-9': {
                    'frontUnit': 'H100', 'backUnit': 'H102',
                    'frontSide': {
                        '1': 'K101', '2': 'L101', '3': 'M101', '4': 'N101', '5': 'O101',
                        '6': 'P101', '7': 'Q101', '8': 'R101', '9': 'S101', '10': 'T101',
                        '11': 'U101', '12': 'V101', '13': 'W101', '14': 'X101', '15': 'Y101',
                        '16': 'Z101', '17': 'AA101', '18': 'AB101', '19': 'AC101', '20': 'AD101'
                    },
                    'backSide': {
                        '1': 'K103', '2': 'L103', '3': 'M103', '4': 'N103', '5': 'O103',
                        '6': 'P103', '7': 'Q103', '8': 'R103', '9': 'S103', '10': 'T103',
                        '11': 'U103', '12': 'V103', '13': 'W103', '14': 'X103', '15': 'Y103',
                        '16': 'Z103', '17': 'AA103', '18': 'AB103', '19': 'AC103', '20': 'AD103'
                    }
                },
                'Stringer-10': {
                    'frontUnit': 'H108', 'backUnit': 'H110',
                    'frontSide': {
                        '1': 'K109', '2': 'L109', '3': 'M109', '4': 'N109', '5': 'O109',
                        '6': 'P109', '7': 'Q109', '8': 'R109', '9': 'S109', '10': 'T109',
                        '11': 'U109', '12': 'V109', '13': 'W109', '14': 'X109', '15': 'Y109',
                        '16': 'Z109', '17': 'AA109', '18': 'AB109', '19': 'AC109', '20': 'AD109'
                    },
                    'backSide': {
                        '1': 'K111', '2': 'L111', '3': 'M111', '4': 'N111', '5': 'O111',
                        '6': 'P111', '7': 'Q111', '8': 'R111', '9': 'S111', '10': 'T111',
                        '11': 'U111', '12': 'V111', '13': 'W111', '14': 'X111', '15': 'Y111',
                        '16': 'Z111', '17': 'AA111', '18': 'AB111', '19': 'AC111', '20': 'AD111'
                    }
                },
                'Stringer-11': {
                    'frontUnit': 'H116', 'backUnit': 'H118',
                    'frontSide': {
                        '1': 'K117', '2': 'L117', '3': 'M117', '4': 'N117', '5': 'O117',
                        '6': 'P117', '7': 'Q117', '8': 'R117', '9': 'S117', '10': 'T117',
                        '11': 'U117', '12': 'V117', '13': 'W117', '14': 'X117', '15': 'Y117',
                        '16': 'Z117', '17': 'AA117', '18': 'AB117', '19': 'AC117', '20': 'AD117'
                    },
                    'backSide': {
                        '1': 'K119', '2': 'L119', '3': 'M119', '4': 'N119', '5': 'O119',
                        '6': 'P119', '7': 'Q119', '8': 'R119', '9': 'S119', '10': 'T119',
                        '11': 'U119', '12': 'V119', '13': 'W119', '14': 'X119', '15': 'Y119',
                        '16': 'Z119', '17': 'AA119', '18': 'AB119', '19': 'AC119', '20': 'AD119'
                    }
                },
                'Stringer-12': {
                    'frontUnit': 'H124', 'backUnit': 'H126',
                    'frontSide': {
                        '1': 'K125', '2': 'L125', '3': 'M125', '4': 'N125', '5': 'O125',
                        '6': 'P125', '7': 'Q125', '8': 'R125', '9': 'S125', '10': 'T125',
                        '11': 'U125', '12': 'V125', '13': 'W125', '14': 'X125', '15': 'Y125',
                        '16': 'Z125', '17': 'AA125', '18': 'AB125', '19': 'AC125', '20': 'AD125'
                    },
                    'backSide': {
                        '1': 'K127', '2': 'L127', '3': 'M127', '4': 'N127', '5': 'O127',
                        '6': 'P127', '7': 'Q127', '8': 'R127', '9': 'S127', '10': 'T127',
                        '11': 'U127', '12': 'V127', '13': 'W127', '14': 'X127', '15': 'Y127',
                        '16': 'Z127', '17': 'AA127', '18': 'AB127', '19': 'AC127', '20': 'AD127'
                    }
                },
            },
            '5-12-ribbon-flatten': {
                'Stringer-7': 'G88', 'Stringer-8': 'G96', 'Stringer-9': 'G104',
                'Stringer-10': 'G112', 'Stringer-11': 'G120', 'Stringer-12': 'G128'
            },
            '5-13-string-length': {
                'Stringer-7': {'4 hours': 'G89', '8 hours': 'S89'},
                'Stringer-8': {'4 hours': 'G97', '8 hours': 'S97'},
                'Stringer-9': {'4 hours': 'G105', '8 hours': 'S105'},
                'Stringer-10': {'4 hours': 'G113', '8 hours': 'S113'},
                'Stringer-11': {'4 hours': 'G121', '8 hours': 'S121'},
                'Stringer-12': {'4 hours': 'G129', '8 hours': 'S129'},
            },
            '5-14-cell-to-cell-gap': {
                'Stringer-7': {'4 hours': 'G90', '8 hours': 'S90'},
                'Stringer-8': {'4 hours': 'G98', '8 hours': 'S98'},
                'Stringer-9': {'4 hours': 'G106', '8 hours': 'S106'},
                'Stringer-10': {'4 hours': 'G114', '8 hours': 'S114'},
                'Stringer-11': {'4 hours': 'G122', '8 hours': 'S122'},
                'Stringer-12': {'4 hours': 'G130', '8 hours': 'S130'},
            },
            '5-15-el-inspection': {
                'Stringer-7': {'4 hours': 'G91', '8 hours': 'S91'},
                'Stringer-8': {'4 hours': 'G99', '8 hours': 'S99'},
                'Stringer-9': {'4 hours': 'G107', '8 hours': 'S107'},
                'Stringer-10': {'4 hours': 'G115', '8 hours': 'S115'},
                'Stringer-11': {'4 hours': 'G123', '8 hours': 'S123'},
                'Stringer-12': {'4 hours': 'G131', '8 hours': 'S131'},
            },
            '7-1': {
                'Line-4-Supplier': 'I133', 'Line-4-Width': 'O133', 'Line-4-Thickness': 'U133', 'Line-4-Expiry Date': 'AA133',
                'Line-5-Supplier': 'I145', 'Line-5-Width': 'O145', 'Line-5-Thickness': 'U145', 'Line-5-Expiry Date': 'AA145'
            },
            '7-2': {
                'Line-4-Front TCA 1 L': 'I134', 'Line-4-Middle TCA 1 L': 'M134', 'Line-4-Back TCA 1 L': 'Q134',
                'Line-4-Front TCA 1 R': 'U134', 'Line-4-Middle TCA 1 R': 'Y134', 'Line-4-Back TCA 1 R': 'AC134',
                'Line-5-Front TCA 1 L': 'I146', 'Line-5-Middle TCA 1 L': 'M146', 'Line-5-Back TCA 1 L': 'Q146',
                'Line-5-Front TCA 1 R': 'U146', 'Line-5-Middle TCA 1 R': 'Y146', 'Line-5-Back TCA 1 R': 'AC146'
            },
            '7-3': {
                'Line-4-left': 'G135', 'Line-4-right': 'S135',
                'Line-5-left': 'G147', 'Line-5-right': 'S147'
            },
            '7-4': {
                'Line-4-4hrs': 'G136', 'Line-4-8hrs': 'S136',
                'Line-5-4hrs': 'G148', 'Line-5-8hrs': 'S148'
            },
            '7-5': {
                'Line-4': 'G137', 'Line-5': 'G149'
            },
            '7-6': {
                'Line-4-Top': 'I138', 'Line-4-Middle': 'Q138', 'Line-4-Bottom': 'Y138',
                'Line-5-Top': 'I150', 'Line-5-Middle': 'Q150', 'Line-5-Bottom': 'Y150'
            },
            '7-7': {
                'Line-4-I': 'J139', 'Line-4-Small L': 'V139', 'Line-4-Big L': 'J140', 'Line-4-Terminal': 'V140',
                'Line-5-I': 'J151', 'Line-5-Small L': 'V151', 'Line-5-Big L': 'J152', 'Line-5-Terminal': 'V152'
            },
            '7-8': {
                'Line-4-4hrs': 'G141', 'Line-4-8hrs': 'S141',
                'Line-5-4hrs': 'G153', 'Line-5-8hrs': 'S153'
            },
            '7-9': {
                'Line-4-Line': 'I142', 'Line-4-Position': 'O142', 'Line-4-Side': 'V142',
                'Line-4-Pos1': 'K143', 'Line-4-Pos2': 'L143', 'Line-4-Pos3': 'M143', 'Line-4-Pos4': 'N143',
                'Line-4-Pos5': 'O143', 'Line-4-Pos6': 'P143', 'Line-4-Pos7': 'Q143', 'Line-4-Pos8': 'R143',
                'Line-4-Pos9': 'S143', 'Line-4-Pos10': 'T143', 'Line-4-Pos11': 'U143', 'Line-4-Pos12': 'V143',
                'Line-4-Pos13': 'W143', 'Line-4-Pos14': 'X143', 'Line-4-Pos15': 'Y143', 'Line-4-Pos16': 'Z143',
                'Line-4-Pos17': 'AA143', 'Line-4-Pos18': 'AB143', 'Line-4-Pos19': 'AC143', 'Line-4-Pos20': 'AD143',
                'Line-4-Pos21': 'K144', 'Line-4-Pos22': 'L144', 'Line-4-Pos23': 'M144', 'Line-4-Pos24': 'N144',
                'Line-4-Pos25': 'O144', 'Line-4-Pos26': 'P144', 'Line-4-Pos27': 'Q144', 'Line-4-Pos28': 'R144',
                'Line-4-Pos29': 'S144', 'Line-4-Pos30': 'T144', 'Line-4-Pos31': 'U144', 'Line-4-Pos32': 'V144',
                'Line-4-Pos33': 'W144', 'Line-4-Pos34': 'X144', 'Line-4-Pos35': 'Y144', 'Line-4-Pos36': 'Z144',
                'Line-4-Pos37': 'AA144', 'Line-4-Pos38': 'AB144', 'Line-4-Pos39': 'AC144', 'Line-4-Pos40': 'AD144',
                'Line-5-Line': 'I154', 'Line-5-Position': 'O154', 'Line-5-Side': 'V154',
                'Line-5-Pos1': 'K155', 'Line-5-Pos2': 'L155', 'Line-5-Pos3': 'M155', 'Line-5-Pos4': 'N155',
                'Line-5-Pos5': 'O155', 'Line-5-Pos6': 'P155', 'Line-5-Pos7': 'Q155', 'Line-5-Pos8': 'R155',
                'Line-5-Pos9': 'S155', 'Line-5-Pos10': 'T155', 'Line-5-Pos11': 'U155', 'Line-5-Pos12': 'V155',
                'Line-5-Pos13': 'W155', 'Line-5-Pos14': 'X155', 'Line-5-Pos15': 'Y155', 'Line-5-Pos16': 'Z155',
                'Line-5-Pos17': 'AA155', 'Line-5-Pos18': 'AB155', 'Line-5-Pos19': 'AC155', 'Line-5-Pos20': 'AD155',
                'Line-5-Pos21': 'K156', 'Line-5-Pos22': 'L156', 'Line-5-Pos23': 'M156', 'Line-5-Pos24': 'N156',
                'Line-5-Pos25': 'O156', 'Line-5-Pos26': 'P156', 'Line-5-Pos27': 'Q156', 'Line-5-Pos28': 'R156',
                'Line-5-Pos29': 'S156', 'Line-5-Pos30': 'T156', 'Line-5-Pos31': 'U156', 'Line-5-Pos32': 'V156',
                'Line-5-Pos33': 'W156', 'Line-5-Pos34': 'X156', 'Line-5-Pos35': 'Y156', 'Line-5-Pos36': 'Z156',
                'Line-5-Pos37': 'AA156', 'Line-5-Pos38': 'AB156', 'Line-5-Pos39': 'AC156', 'Line-5-Pos40': 'AD156'
            },
            '8-1': {
                'Line-3-4hrs': 'G157', 'Line-3-8hrs': 'S157',
                'Line-4-4hrs': 'G171', 'Line-4-8hrs': 'S171'
            },
            '8-2': {
                'Line-3-4hrs': 'G158', 'Line-3-8hrs': 'S158',
                'Line-4-4hrs': 'G172', 'Line-4-8hrs': 'S172'
            },
            '8-3': {
                'Line-3-4hrs': 'G159', 'Line-3-8hrs': 'S159',
                'Line-4-4hrs': 'G173', 'Line-4-8hrs': 'S173'
            },
            '8-4': {
                'Line-3-4hrs': 'G160', 'Line-3-8hrs': 'S160',
                'Line-4-4hrs': 'G174', 'Line-4-8hrs': 'S174'
            },
            '8-5': {
                'Line-3-4hrs': 'G161', 'Line-3-8hrs': 'S161',
                'Line-4-4hrs': 'G175', 'Line-4-8hrs': 'S175'
            },
            '8-6': {
                'Line-3-Supplier': 'I162', 'Line-3-Type': 'P162', 'Line-3-Quantity': 'Y162',
                'Line-4-Supplier': 'I176', 'Line-4-Type': 'P176', 'Line-4-Quantity': 'Y176'
            },
            '8-9': {
                'Line-3-4hrs': 'G163', 'Line-3-8hrs': 'S163',
                'Line-4-4hrs': 'G177', 'Line-4-8hrs': 'S177'
            },
            '8-10': {
                'Line-3-4hrs': 'G164', 'Line-3-8hrs': 'S164',
                'Line-4-4hrs': 'G178', 'Line-4-8hrs': 'S178'
            },
            '8-11': {
                'Line-3-4hrs': 'G165', 'Line-3-8hrs': 'S165',
                'Line-4-4hrs': 'G179', 'Line-4-8hrs': 'S179'
            },
            '8-12': {
                'Line-3-4hrs': 'G166', 'Line-3-8hrs': 'S166',
                'Line-4-4hrs': 'G180', 'Line-4-8hrs': 'S180'
            },
            '8-13': {
                'Line-3-4hrs': 'G167', 'Line-3-8hrs': 'S167',
                'Line-4-4hrs': 'G181', 'Line-4-8hrs': 'S181'
            },
            '8-14': {
                'Line-3-4hrs': 'G168', 'Line-3-8hrs': 'S168',
                'Line-4-4hrs': 'G182', 'Line-4-8hrs': 'S182'
            },
            '8-15': {
                'Line-3-4hrs': 'G169', 'Line-3-8hrs': 'S169',
                'Line-4-4hrs': 'G183', 'Line-4-8hrs': 'S183'
            },
            '8-16': {
                'Line-3-4hrs': 'G170', 'Line-3-8hrs': 'S170',
                'Line-4-4hrs': 'G184', 'Line-4-8hrs': 'S184'
            },
            '9-5': {
                '4 hours': {
                    'Sample-1': 'G190', 'Sample-2': 'I190', 'Sample-3': 'K190', 
                    'Sample-4': 'M190', 'Sample-5': 'O190', 'Sample-6': 'Q190'
                },
                '8 hours': {
                    'Sample-1': 'S190', 'Sample-2': 'U190', 'Sample-3': 'W190',
                    'Sample-4': 'Y190', 'Sample-5': 'AA190', 'Sample-6': 'AC190'
                }
            },
            '9-6': {
                'Line-3': {
                    'Sample-1': 'G192', 'Sample-2': 'J192', 'Sample-3': 'M192', 'Sample-4': 'P192'
                },
                'Line-4': {
                    'Sample-1': 'S192', 'Sample-2': 'V192', 'Sample-3': 'Y192', 'Sample-4': 'AB192'
                }
            },
            '9-7': {
                'Line-3': {
                    'Sample-1': 'G193', 'Sample-2': 'J193', 'Sample-3': 'M193', 'Sample-4': 'P193'
                },
                'Line-4': {
                    'Sample-1': 'S193', 'Sample-2': 'V193', 'Sample-3': 'Y193', 'Sample-4': 'AB193'
                }
            },
            '9-8': {
                'Line-3': {
                    'Sample-1': 'G194', 'Sample-2': 'J194', 'Sample-3': 'M194', 'Sample-4': 'P194'
                },
                'Line-4': {
                    'Sample-1': 'S194', 'Sample-2': 'V194', 'Sample-3': 'Y194', 'Sample-4': 'AB194'
                }
            },
            '10-4': {
                'Line-3': {
                    'Sample-1': 'G200', 'Sample-2': 'J200', 'Sample-3': 'M200', 'Sample-4': 'P200'
                },
                'Line-4': {
                    'Sample-1': 'S200', 'Sample-2': 'V200', 'Sample-3': 'Y200', 'Sample-4': 'AB200'
                }
            },
            '10-5': {
                'Line-3': {
                    'Sample-1': 'G201', 'Sample-2': 'J201', 'Sample-3': 'M201', 'Sample-4': 'P201'
                },
                'Line-4': {
                    'Sample-1': 'S201', 'Sample-2': 'V201', 'Sample-3': 'Y201', 'Sample-4': 'AB201'
                }
            },
            '10-6': {
                'Line-3': {
                    'Sample-1': 'G202', 'Sample-2': 'J202', 'Sample-3': 'M202', 'Sample-4': 'P202'
                },
                'Line-4': {
                    'Sample-1': 'S202', 'Sample-2': 'V202', 'Sample-3': 'Y202', 'Sample-4': 'AB202'
                }
            },
            '11-2': {
                '4 hours': {
                    'Sample-1': 'G206', 'Sample-2': 'I206', 'Sample-3': 'K206', 
                    'Sample-4': 'M206', 'Sample-5': 'O206', 'Sample-6': 'Q206'
                },
                '8 hours': {
                    'Sample-1': 'S206', 'Sample-2': 'U206', 'Sample-3': 'W206',
                    'Sample-4': 'Y206', 'Sample-5': 'AA206', 'Sample-6': 'AC206'
                }
            },
            '11-3': {
                'Line-3': {
                    'Sample-1': 'G207', 'Sample-2': 'J207', 'Sample-3': 'M207', 'Sample-4': 'P207'
                },
                'Line-4': {
                    'Sample-1': 'S207', 'Sample-2': 'V207', 'Sample-3': 'Y207', 'Sample-4': 'AB207'
                }
            },
            '11-4': {
                'Line-3': {
                    'Sample-1': 'G208', 'Sample-2': 'J208', 'Sample-3': 'M208', 'Sample-4': 'P208'
                },
                'Line-4': {
                    'Sample-1': 'S208', 'Sample-2': 'V208', 'Sample-3': 'Y208', 'Sample-4': 'AB208'
                }
            },
            '11-5': {
                'Line-3': {
                    'Sample-1': 'G209', 'Sample-2': 'J209', 'Sample-3': 'M209', 'Sample-4': 'P209'
                },
                'Line-4': {
                    'Sample-1': 'S209', 'Sample-2': 'V209', 'Sample-3': 'Y209', 'Sample-4': 'AB209'
                }
            },
            '12-1': {
                'Line-3': {
                    'Sample-1': 'G212', 'Sample-2': 'G213', 'Sample-3': 'G214', 'Sample-4': 'G215', 'Sample-5': 'G216',
                    'Sample-6': 'M212', 'Sample-7': 'M213', 'Sample-8': 'M214', 'Sample-9': 'M215', 'Sample-10': 'M216'
                },
                'Line-4': {
                    'Sample-1': 'S212', 'Sample-2': 'S213', 'Sample-3': 'S214', 'Sample-4': 'S215', 'Sample-5': 'S216',
                    'Sample-6': 'Y212', 'Sample-7': 'Y213', 'Sample-8': 'Y214', 'Sample-9': 'Y215', 'Sample-10': 'Y216'
                }
            },
            '12-2': {
                'Line-3': {
                    'Sample-1': 'G217', 'Sample-2': 'G218', 'Sample-3': 'G219', 'Sample-4': 'G220', 'Sample-5': 'G221',
                    'Sample-6': 'M217', 'Sample-7': 'M218', 'Sample-8': 'M219', 'Sample-9': 'M220', 'Sample-10': 'M221'
                },
                'Line-4': {
                    'Sample-1': 'S217', 'Sample-2': 'S218', 'Sample-3': 'S219', 'Sample-4': 'S220', 'Sample-5': 'S221',
                    'Sample-6': 'Y217', 'Sample-7': 'Y218', 'Sample-8': 'Y219', 'Sample-9': 'Y220', 'Sample-10': 'Y221'
                }
            },
            '14-1-laminator5': {
                'upper': {
                    'Chamber_1_Pumping': 'I228', 'Chamber_1_PressingCooling': 'K228', 'Chamber_1_Venting': 'M228',
                    'Chamber_1_LowerTemp': 'O228', 'Chamber_1_UpperTemp': 'Q228', 'Chamber_2_Pumping': 'I229',
                    'Chamber_2_PressingCooling': 'K229', 'Chamber_2_Venting': 'M229', 'Chamber_2_LowerTemp': 'O229',
                    'Chamber_2_UpperTemp': 'Q229', 'Chamber_3_Pumping': 'I230', 'Chamber_3_PressingCooling': 'K230',
                    'Chamber_3_Venting': 'M230', 'Chamber_3_LowerTemp': 'O230', 'Chamber_3_UpperTemp': 'Q230',
                    'selectedRecipeUpper': 'I226'
                },
                'lower': {
                    'Chamber_1_Pumping': 'U228', 'Chamber_1_PressingCooling': 'W228', 'Chamber_1_Venting': 'Y228',
                    'Chamber_1_LowerTemp': 'AA228', 'Chamber_1_UpperTemp': 'AC228', 'Chamber_2_Pumping': 'U229',
                    'Chamber_2_PressingCooling': 'W229', 'Chamber_2_Venting': 'Y229', 'Chamber_2_LowerTemp': 'AA229',
                    'Chamber_2_UpperTemp': 'AC229', 'Chamber_3_Pumping': 'U230', 'Chamber_3_PressingCooling': 'W230',
                    'Chamber_3_Venting': 'Y230', 'Chamber_3_LowerTemp': 'AA230', 'Chamber_3_UpperTemp': 'AC230',
                    'selectedRecipeLower': 'U226'
                }
            },
            '14-2-laminator6': {
                'upper': {
                    'Chamber_1_Pumping': 'I233', 'Chamber_1_PressingCooling': 'K233', 'Chamber_1_Venting': 'M233',
                    'Chamber_1_LowerTemp': 'O233', 'Chamber_1_UpperTemp': 'Q233', 'Chamber_2_Pumping': 'I234',
                    'Chamber_2_PressingCooling': 'K234', 'Chamber_2_Venting': 'M234', 'Chamber_2_LowerTemp': 'O234',
                    'Chamber_2_UpperTemp': 'Q234', 'Chamber_3_Pumping': 'I235', 'Chamber_3_PressingCooling': 'K235',
                    'Chamber_3_Venting': 'M235', 'Chamber_3_LowerTemp': 'O235', 'Chamber_3_UpperTemp': 'Q235',
                    'selectedRecipeUpper': 'I231'
                },
                'lower': {
                    'Chamber_1_Pumping': 'U233', 'Chamber_1_PressingCooling': 'W233', 'Chamber_1_Venting': 'Y233',
                    'Chamber_1_LowerTemp': 'AA233', 'Chamber_1_UpperTemp': 'AC233', 'Chamber_2_Pumping': 'U234',
                    'Chamber_2_PressingCooling': 'W234', 'Chamber_2_Venting': 'Y234', 'Chamber_2_LowerTemp': 'AA234',
                    'Chamber_2_UpperTemp': 'AC234', 'Chamber_3_Pumping': 'U235', 'Chamber_3_PressingCooling': 'W235',
                    'Chamber_3_Venting': 'Y235', 'Chamber_3_LowerTemp': 'AA235', 'Chamber_3_UpperTemp': 'AC235',
                    'selectedRecipeLower': 'U231'
                }
            },
            '14-3-laminator7': {
                'upper': {
                    'Chamber_1_Pumping': 'I238', 'Chamber_1_PressingCooling': 'K238', 'Chamber_1_Venting': 'M238',
                    'Chamber_1_LowerTemp': 'O238', 'Chamber_1_UpperTemp': 'Q238', 'Chamber_2_Pumping': 'I239',
                    'Chamber_2_PressingCooling': 'K239', 'Chamber_2_Venting': 'M239', 'Chamber_2_LowerTemp': 'O239',
                    'Chamber_2_UpperTemp': 'Q239', 'Chamber_3_Pumping': 'I240', 'Chamber_3_PressingCooling': 'K240',
                    'Chamber_3_Venting': 'M240', 'Chamber_3_LowerTemp': 'O240', 'Chamber_3_UpperTemp': 'Q240',
                    'selectedRecipeUpper': 'I236'
                },
                'lower': {
                    'Chamber_1_Pumping': 'U238', 'Chamber_1_PressingCooling': 'W238', 'Chamber_1_Venting': 'Y238',
                    'Chamber_1_LowerTemp': 'AA238', 'Chamber_1_UpperTemp': 'AC238', 'Chamber_2_Pumping': 'U239',
                    'Chamber_2_PressingCooling': 'W239', 'Chamber_2_Venting': 'Y239', 'Chamber_2_LowerTemp': 'AA239',
                    'Chamber_2_UpperTemp': 'AC239', 'Chamber_3_Pumping': 'U240', 'Chamber_3_PressingCooling': 'W240',
                    'Chamber_3_Venting': 'Y240', 'Chamber_3_LowerTemp': 'AA240', 'Chamber_3_UpperTemp': 'AC240',
                    'selectedRecipeLower': 'U236'
                }
            },
            '14-4-laminator8': {
                'upper': {
                    'Chamber_1_Pumping': 'I243', 'Chamber_1_PressingCooling': 'K243', 'Chamber_1_Venting': 'M243',
                    'Chamber_1_LowerTemp': 'O243', 'Chamber_1_UpperTemp': 'Q243', 'Chamber_2_Pumping': 'I244',
                    'Chamber_2_PressingCooling': 'K244', 'Chamber_2_Venting': 'M244', 'Chamber_2_LowerTemp': 'O244',
                    'Chamber_2_UpperTemp': 'Q244', 'Chamber_3_Pumping': 'I245', 'Chamber_3_PressingCooling': 'K245',
                    'Chamber_3_Venting': 'M245', 'Chamber_3_LowerTemp': 'O245', 'Chamber_3_UpperTemp': 'Q245',
                    'selectedRecipeUpper': 'I241'
                },
                'lower': {
                    'Chamber_1_Pumping': 'U243', 'Chamber_1_PressingCooling': 'W243', 'Chamber_1_Venting': 'Y243',
                    'Chamber_1_LowerTemp': 'AA243', 'Chamber_1_UpperTemp': 'AC243', 'Chamber_2_Pumping': 'U244',
                    'Chamber_2_PressingCooling': 'W244', 'Chamber_2_Venting': 'Y244', 'Chamber_2_LowerTemp': 'AA244',
                    'Chamber_2_UpperTemp': 'AC244', 'Chamber_3_Pumping': 'U245', 'Chamber_3_PressingCooling': 'W245',
                    'Chamber_3_Venting': 'Y245', 'Chamber_3_LowerTemp': 'AA245', 'Chamber_3_UpperTemp': 'AC245',
                    'selectedRecipeLower': 'U241'
                }
            },
            '15-1': {
                'Auto trimming - 3-4hrs': 'G246', 'Auto trimming - 3-8hrs': 'S246',
                'Auto trimming - 4-4hrs': 'G248', 'Auto trimming - 4-8hrs': 'S248'
            },
            '15-2': {
                'Auto trimming - 3': 'G247', 'Auto trimming - 4': 'G249'
            },
            '16-1': {
                'Line-3': {
                    'Sample-1': 'G251', 'Sample-2': 'G252', 'Sample-3': 'G253', 'Sample-4': 'G254', 'Sample-5': 'G255',
                    'Sample-6': 'M251', 'Sample-7': 'M252', 'Sample-8': 'M253', 'Sample-9': 'M254', 'Sample-10': 'M255'
                },
                'Line-4': {
                    'Sample-1': 'S251', 'Sample-2': 'S252', 'Sample-3': 'S253', 'Sample-4': 'S254', 'Sample-5': 'S255',
                    'Sample-6': 'Y251', 'Sample-7': 'Y252', 'Sample-8': 'Y253', 'Sample-9': 'Y254', 'Sample-10': 'Y255'
                }
            },
            '17-1': {
                'Line-3-supplier': 'I261', 'Line-4-supplier': 'I275'
            },
            '17-2': {
                'Line-3-supplier': 'I262', 'Line-3-type': 'S262', 'Line-3-exp': 'Y62',
                'Line-4-supplier': 'I276', 'Line-4-type': 'S276', 'Line-4-exp': 'Y276'
            },
            '17-3': {
                'Line-3-4hrs': 'G263', 'Line-3-8hrs': 'S263',
                'Line-4-4hrs': 'G277', 'Line-4-8hrs': 'S277'
            },
            '17-4': {
                'Line-3-Sample-1-4hrs': 'G266', 'Line-3-Sample-1-8hrs': 'G279',
                'Line-3-Sample-2-4hrs': 'I266', 'Line-3-Sample-2-8hrs': 'I279',
                'Line-3-Sample-3-4hrs': 'K266', 'Line-3-Sample-3-8hrs': 'K279',
                'Line-3-Sample-4-4hrs': 'M266', 'Line-3-Sample-4-8hrs': 'M279',
                'Line-3-Sample-5-4hrs': 'O266', 'Line-3-Sample-5-8hrs': 'O279',
                'Line-3-Sample-6-4hrs': 'Q266', 'Line-3-Sample-6-8hrs': 'Q279',
                'Line-4-Sample-1-4hrs': 'S266', 'Line-4-Sample-1-8hrs': 'S279',
                'Line-4-Sample-2-4hrs': 'U266', 'Line-4-Sample-2-8hrs': 'U279',
                'Line-4-Sample-3-4hrs': 'W266', 'Line-4-Sample-3-8hrs': 'W279',
                'Line-4-Sample-4-4hrs': 'Y266', 'Line-4-Sample-4-8hrs': 'Y279',
                'Line-4-Sample-5-4hrs': 'AA266', 'Line-4-Sample-5-8hrs': 'AA279',
                'Line-4-Sample-6-4hrs': 'AC266', 'Line-4-Sample-6-8hrs': 'AC279'
            },
            '17-5': {
                'Line-3-Length1': 'I267', 'Line-3-Length2': 'O267', 'Line-3-Width1': 'U267', 'Line-3-Width2': 'AA267',
                'Line-4-Length1': 'I280', 'Line-4-Length2': 'O280', 'Line-4-Width1': 'U280', 'Line-4-Width2': 'AA280'
            },
            '17-6': {
                'Line-3-4hrs': 'G268', 'Line-3-8hrs': 'S268',
                'Line-4-4hrs': 'G281', 'Line-4-8hrs': 'S281'
            },
            '17-7': {
                'Line-3-4hrs-Length': 'I269', 'Line-3-4hrs-Width': 'O269', 'Line-3-8hrs-Length': 'U269', 'Line-3-8hrs-Width': 'AA269',
                'Line-4-4hrs-Length': 'I282', 'Line-4-4hrs-Width': 'O282', 'Line-4-8hrs-Length': 'U282', 'Line-4-8hrs-Width': 'AA282'
            },
            '17-8': {
                'Line-3-4hrs': 'G270', 'Line-3-8hrs': 'S270',
                'Line-4-4hrs': 'G283', 'Line-4-8hrs': 'S283'
            },
            '17-9': {
                'Line-3-4hrs': 'G271', 'Line-3-8hrs': 'S271',
                'Line-4-4hrs': 'G284', 'Line-4-8hrs': 'S284'
            },
            '17-10': {
                'Line-3-4hrs': 'G272', 'Line-3-8hrs': 'S272',
                'Line-4-4hrs': 'G285', 'Line-4-8hrs': 'S285'
            },
            '17-11': {
                'Line-3-4hrs': 'G273', 'Line-3-8hrs': 'S273',
                'Line-4-4hrs': 'G286', 'Line-4-8hrs': 'S286'
            },
            '17-12-coating-thickness': {
                'Line-3-4hrs': 'G274', 'Line-3-8hrs': 'S274',
                'Line-4-4hrs': 'G287', 'Line-4-8hrs': 'S287'
            },
            '18-1': {
                'Line-3-supplier': 'I288', 'Line-3-type': 'L288', 'Line-3-diode': 'R288', 'Line-3-maxVoltage': 'U288',
                'Line-3-maxCurrent': 'Y288', 'Line-3-diodeType': 'AB288', 'Line-4-supplier': 'I295', 'Line-4-type': 'L295',
                'Line-4-diode': 'R295', 'Line-4-maxVoltage': 'U295', 'Line-4-maxCurrent': 'Y295', 'Line-4-diodeType': 'AB295'
            },
            '18-2': {
                'Line-3-cableSupplier': 'J289', 'Line-3-connectorType': 'Z289',
                'Line-4-cableSupplier': 'J296', 'Line-4-connectorType': 'Z296'
            },
            '18-3': {
                'Line-3-supplier': 'I290', 'Line-3-type': 'S290', 'Line-3-exp': 'Y290',
                'Line-4-supplier': 'I297', 'Line-4-type': 'S297', 'Line-4-exp': 'Y297'
            },
            '18-4': {
                'Line-3-Sample-1-4hrs': 'G292', 'Line-3-Sample-1-8hrs': 'G299',
                'Line-3-Sample-2-4hrs': 'I292', 'Line-3-Sample-2-8hrs': 'I299',
                'Line-3-Sample-3-4hrs': 'K292', 'Line-3-Sample-3-8hrs': 'K299',
                'Line-3-Sample-4-4hrs': 'M292', 'Line-3-Sample-4-8hrs': 'M299',
                'Line-3-Sample-5-4hrs': 'O292', 'Line-3-Sample-5-8hrs': 'O299',
                'Line-3-Sample-6-4hrs': 'Q292', 'Line-3-Sample-6-8hrs': 'Q299',
                'Line-4-Sample-1-4hrs': 'S292', 'Line-4-Sample-1-8hrs': 'S299',
                'Line-4-Sample-2-4hrs': 'U292', 'Line-4-Sample-2-8hrs': 'U299',
                'Line-4-Sample-3-4hrs': 'W292', 'Line-4-Sample-3-8hrs': 'W299',
                'Line-4-Sample-4-4hrs': 'Y292', 'Line-4-Sample-4-8hrs': 'Y299',
                'Line-4-Sample-5-4hrs': 'AA292', 'Line-4-Sample-5-8hrs': 'AA299',
                'Line-4-Sample-6-4hrs': 'AC292', 'Line-4-Sample-6-8hrs': 'AC299'
            },
            '18-5': {
                'Line-3-positive': 'J293', 'Line-3-negative': 'V293',
                'Line-4-positive': 'J300', 'Line-4-negative': 'V300'
            },
            '18-6': {
                'Line-3-left': 'J294', 'Line-3-middle': 'S294', 'Line-3-right': 'AA294',
                'Line-4-left': 'J301', 'Line-4-middle': 'S301', 'Line-4-right': 'AA301'
            },
            '19-1': {
                'Line-3-4hrs': 'G302', 'Line-3-8hrs': 'S302',
                'Line-4-4hrs': 'G305', 'Line-4-8hrs': 'S305'
            },
            '19-2': {
                'Line-3-4hrs': 'G303', 'Line-3-8hrs': 'S303',
                'Line-4-4hrs': 'G306', 'Line-4-8hrs': 'S306'
            },
            '19-3': {
                'Line-3': 'G304', 'Line-4': 'G307'
            },
            '20-1': {
                'Line-3-SupplierA': 'I308', 'Line-3-TypeA': 'L308', 'Line-3-ExpA': 'Q308',
                'Line-3-SupplierB': 'U308', 'Line-3-TypeB': 'X308', 'Line-3-ExpB': 'AC308',
                'Line-4-SupplierA': 'I313', 'Line-4-TypeA': 'L313', 'Line-4-ExpA': 'Q313',
                'Line-4-SupplierB': 'U313', 'Line-4-TypeB': 'X313', 'Line-4-ExpB': 'AC313'
            },
            '20-2': {
                'Line-3-2hrs': 'G309', 'Line-3-4hrs': 'M309', 'Line-3-6hrs': 'S309', 'Line-3-8hrs': 'Y309',
                'Line-4-2hrs': 'G314', 'Line-4-4hrs': 'M314', 'Line-4-6hrs': 'S314', 'Line-4-8hrs': 'Y314'
            },
            '20-3': {
                'Line-3-PartA': 'I310', 'Line-3-PartB': 'Q310', 'Line-3-Ratio': 'Z310',
                'Line-4-PartA': 'I315', 'Line-4-PartB': 'Q315', 'Line-4-Ratio': 'Z315'
            },
            '20-4': {
                'Line-3-2hrs': 'G311', 'Line-3-4hrs': 'M311', 'Line-3-6hrs': 'S311', 'Line-3-8hrs': 'Y311',
                'Line-4-2hrs': 'G316', 'Line-4-4hrs': 'M316', 'Line-4-6hrs': 'S316', 'Line-4-8hrs': 'Y316'
            },
            '20-5': {
                'Line-3-4hrs': 'G312', 'Line-3-8hrs': 'S312',
                'Line-4-4hrs': 'G317', 'Line-4-8hrs': 'S317'
            },
            '21-1': {
                'Line-3-2hrs': 'G318', 'Line-3-4hrs': 'M318', 'Line-3-6hrs': 'S318', 'Line-3-8hrs': 'Y318',
                'Line-4-2hrs': 'G323', 'Line-4-4hrs': 'M323', 'Line-4-6hrs': 'S323', 'Line-4-8hrs': 'Y323'
            },
            '21-2': {
                'Line-3-2hrs': 'G319', 'Line-3-4hrs': 'M319', 'Line-3-6hrs': 'S319', 'Line-3-8hrs': 'Y319',
                'Line-4-2hrs': 'G324', 'Line-4-4hrs': 'M324', 'Line-4-6hrs': 'S324', 'Line-4-8hrs': 'Y324'
            },
            '21-3': {
                'Line-3-2hrs': 'G320', 'Line-3-4hrs': 'M320', 'Line-3-6hrs': 'S320', 'Line-3-8hrs': 'Y320',
                'Line-4-2hrs': 'G325', 'Line-4-4hrs': 'M325', 'Line-4-6hrs': 'S325', 'Line-4-8hrs': 'Y325'
            },
            '21-4': {
                'Line-3-2hrs': 'G321', 'Line-3-4hrs': 'M321', 'Line-3-6hrs': 'S321', 'Line-3-8hrs': 'Y321',
                'Line-4-2hrs': 'G326', 'Line-4-4hrs': 'M326', 'Line-4-6hrs': 'S326', 'Line-4-8hrs': 'Y326'
            },
            '21-5': {
                'Line-3-2hrs': 'G322', 'Line-3-4hrs': 'M322', 'Line-3-6hrs': 'S322', 'Line-3-8hrs': 'Y322',
                'Line-4-2hrs': 'G327', 'Line-4-4hrs': 'M327', 'Line-4-6hrs': 'S327', 'Line-4-8hrs': 'Y327'
            },
            '22-1': {
                'Line-3-2hrs': 'G328', 'Line-3-4hrs': 'M328', 'Line-3-6hrs': 'S328', 'Line-3-8hrs': 'Y328',
                'Line-4-2hrs': 'G330', 'Line-4-4hrs': 'M330', 'Line-4-6hrs': 'S330', 'Line-4-8hrs': 'Y330'
            },
            '22-2': {
                'Line-3': 'G329', 'Line-4': 'G331'
            },
            '23-1': {
                'Line-3': {
                    'Sample-1': 'G333', 'Sample-2': 'G334', 'Sample-3': 'G335', 'Sample-4': 'G336', 'Sample-5': 'G337',
                    'Sample-6': 'M333', 'Sample-7': 'M334', 'Sample-8': 'M335', 'Sample-9': 'M336', 'Sample-10': 'M337'
                },
                'Line-4': {
                    'Sample-1': 'S333', 'Sample-2': 'S334', 'Sample-3': 'S335', 'Sample-4': 'S336', 'Sample-5': 'S337',
                    'Sample-6': 'Y333', 'Sample-7': 'Y334', 'Sample-8': 'Y335', 'Sample-9': 'Y336', 'Sample-10': 'Y337'
                }
            },
            '24-1': {
                'Line-3': 'G338', 'Line-4': 'G351'
            },
            '24-2': {
                'Line-3': 'G339', 'Line-4': 'G352'
            },
            '24-3': {
                'Line-3-2hrs': 'G340', 'Line-3-4hrs': 'M340', 'Line-3-6hrs': 'S340', 'Line-3-8hrs': 'Y340',
                'Line-4-2hrs': 'G353', 'Line-4-4hrs': 'M353', 'Line-4-6hrs': 'S353', 'Line-4-8hrs': 'Y353'
            },
            '24-4': {
                'Line-3-2hrs': 'G341', 'Line-3-4hrs': 'M341', 'Line-3-6hrs': 'S341', 'Line-3-8hrs': 'Y341',
                'Line-4-2hrs': 'G354', 'Line-4-4hrs': 'M354', 'Line-4-6hrs': 'S354', 'Line-4-8hrs': 'Y354'
            },
            '24-5': {
                'Line-3': 'G342', 'Line-4': 'G355'
            },
            '24-6': {
                'Line-3-2hrs-calibrationTime': 'G344', 'Line-3-2hrs-moduleId': 'L344', 'Line-3-2hrs-pmax': 'Q344',
                'Line-3-2hrs-voc': 'S344', 'Line-3-2hrs-isc': 'V344', 'Line-3-2hrs-moduleTemp': 'Y344', 'Line-3-2hrs-roomTemp': 'AB344',
                'Line-3-4hrs-calibrationTime': 'G345', 'Line-3-4hrs-moduleId': 'L345', 'Line-3-4hrs-pmax': 'Q345',
                'Line-3-4hrs-voc': 'S345', 'Line-3-4hrs-isc': 'V345', 'Line-3-4hrs-moduleTemp': 'Y345', 'Line-3-4hrs-roomTemp': 'AB345',
                'Line-3-6hrs-calibrationTime': 'G346', 'Line-3-6hrs-moduleId': 'L346', 'Line-3-6hrs-pmax': 'Q346',
                'Line-3-6hrs-voc': 'S346', 'Line-3-6hrs-isc': 'V346', 'Line-3-6hrs-moduleTemp': 'Y346', 'Line-3-6hrs-roomTemp': 'AB346',
                'Line-3-8hrs-calibrationTime': 'G347', 'Line-3-8hrs-moduleId': 'L347', 'Line-3-8hrs-pmax': 'Q347',
                'Line-3-8hrs-voc': 'S347', 'Line-3-8hrs-isc': 'V347', 'Line-3-8hrs-moduleTemp': 'Y347', 'Line-3-8hrs-roomTemp': 'AB347',
                'Line-4-2hrs-calibrationTime': 'G357', 'Line-4-2hrs-moduleId': 'L357', 'Line-4-2hrs-pmax': 'Q357',
                'Line-4-2hrs-voc': 'S357', 'Line-4-2hrs-isc': 'V357', 'Line-4-2hrs-moduleTemp': 'Y357', 'Line-4-2hrs-roomTemp': 'AB357',
                'Line-4-4hrs-calibrationTime': 'G358', 'Line-4-4hrs-moduleId': 'L358', 'Line-4-4hrs-pmax': 'Q358',
                'Line-4-4hrs-voc': 'S358', 'Line-4-4hrs-isc': 'V358', 'Line-4-4hrs-moduleTemp': 'Y358', 'Line-4-4hrs-roomTemp': 'AB358',
                'Line-4-6hrs-calibrationTime': 'G359', 'Line-4-6hrs-moduleId': 'L359', 'Line-4-6hrs-pmax': 'Q359',
                'Line-4-6hrs-voc': 'S359', 'Line-4-6hrs-isc': 'V359', 'Line-4-6hrs-moduleTemp': 'Y359', 'Line-4-6hrs-roomTemp': 'AB359',
                'Line-4-8hrs-calibrationTime': 'G360', 'Line-4-8hrs-moduleId': 'L360', 'Line-4-8hrs-pmax': 'Q360',
                'Line-4-8hrs-voc': 'S360', 'Line-4-8hrs-isc': 'V360', 'Line-4-8hrs-moduleTemp': 'Y360', 'Line-4-8hrs-roomTemp': 'AB360'
            },
            '24-7': {
                'Line-3': 'G348', 'Line-4': 'G361'
            },
            '24-8': {
                'Line-3': 'G349', 'Line-4': 'G362'
            },
            '24-9': {
                'Line-3-1-contact-block': 'J350', 'Line-3-1-positive': 'N350', 'Line-3-1-negative': 'R350',
                'Line-4-1-contact-block': 'J363', 'Line-4-1-positive': 'N363', 'Line-4-1-negative': 'R363',
                'Line-3-2-contact-block': 'V350', 'Line-3-2-positive': 'Z350', 'Line-3-2-negative': 'AD350',
                'Line-4-2-contact-block': 'V363', 'Line-4-2-positive': 'Z363', 'Line-4-2-negative': 'AD363'
            },
            '26-1': {
                'Line-3-4hrs': 'G367', 'Line-3-8hrs': 'S367',
                'Line-4-4hrs': 'G370', 'Line-4-8hrs': 'S370'
            },
            '26-2': {
                'Line-3-4hrs': 'G368', 'Line-3-8hrs': 'S368',
                'Line-4-4hrs': 'G371', 'Line-4-8hrs': 'S371'
            },
            '26-3': {
                'Line-3-4hrs': 'G369', 'Line-3-8hrs': 'S369',
                'Line-4-4hrs': 'G372', 'Line-4-8hrs': 'S372'
            },
            '27-1': {
                'Line-3': {
                    'Sample-1': 'G374', 'Sample-2': 'G375', 'Sample-3': 'G376', 'Sample-4': 'G377', 'Sample-5': 'G378',
                    'Sample-6': 'M374', 'Sample-7': 'M375', 'Sample-8': 'M376', 'Sample-9': 'M377', 'Sample-10': 'M378'
                },
                'Line-4': {
                    'Sample-1': 'S374', 'Sample-2': 'S375', 'Sample-3': 'S376', 'Sample-4': 'S377', 'Sample-5': 'S378',
                    'Sample-6': 'Y374', 'Sample-7': 'Y375', 'Sample-8': 'Y376', 'Sample-9': 'Y377', 'Sample-10': 'Y378'
                }
            },
            '29-1': {
                'Line-3': {
                    'Sample-1': 'G380', 'Sample-2': 'G381', 'Sample-3': 'G382', 'Sample-4': 'G383', 'Sample-5': 'G384',
                    'Sample-6': 'M380', 'Sample-7': 'M381', 'Sample-8': 'M382', 'Sample-9': 'M383', 'Sample-10': 'M384'
                },
                'Line-4': {
                    'Sample-1': 'S380', 'Sample-2': 'S381', 'Sample-3': 'S382', 'Sample-4': 'S383', 'Sample-5': 'S384',
                    'Sample-6': 'Y380', 'Sample-7': 'Y381', 'Sample-8': 'Y382', 'Sample-9': 'Y383', 'Sample-10': 'Y384'
                }
            }
        }
    else:
        raise ValueError(f"Unsupported line number: {line_number}")
    
    return template_path, field_config, observation_cell_mapping

def fill_basic_info(worksheet, audit_data, field_config):
    """
    Fill basic information from audit data into the Excel worksheet with formatting
    """
    try:
        if audit_data.get('date'):
            cell_ref = field_config['date']['cell']
            cell = get_writable_cell(worksheet, cell_ref)
            cell.value = audit_data['date']
            apply_cell_formatting(cell, **field_config['date']['format'])

        if audit_data.get('shift'):
            cell_ref = field_config['shift']['cell']
            shift_map = {'A': 'A', 'B': 'B', 'C': 'C', 'G': 'G'}
            cell = get_writable_cell(worksheet, cell_ref)
            cell.value = shift_map.get(audit_data['shift'], audit_data['shift'])
            apply_cell_formatting(cell, **field_config['shift']['format'])

        if audit_data.get('productionOrderNo'):
            cell_ref = field_config['production_order']['cell']
            cell = get_writable_cell(worksheet, cell_ref)
            cell.value = audit_data['productionOrderNo']
            apply_cell_formatting(cell, **field_config['production_order']['format'])

        if audit_data.get('moduleType'):
            cell_ref = field_config['module_type']['cell']
            cell = get_writable_cell(worksheet, cell_ref)
            cell.value = audit_data['moduleType']
            apply_cell_formatting(cell, **field_config['module_type']['format'])

        if audit_data.get('signatures', {}).get('auditBy'):
            cell_ref = field_config['audit_by']['cell']
            cell = get_writable_cell(worksheet, cell_ref)
            cell.value = audit_data['signatures']['auditBy']
            apply_cell_formatting(cell, **field_config['audit_by']['format'])

        if audit_data.get('signatures', {}).get('reviewedBy'):
            cell_ref = field_config['reviewed_by']['cell']
            cell = get_writable_cell(worksheet, cell_ref)
            cell.value = audit_data['signatures']['reviewedBy']
            apply_cell_formatting(cell, **field_config['reviewed_by']['format'])

        # Fill checkboxes
        customer_spec = 'Yes' if audit_data.get('customerSpecAvailable') else 'No'
        spec_signed = 'Yes' if audit_data.get('specificationSignedOff') else 'No'

        cell_ref = field_config['customer_spec_available']['cell']
        cell = get_writable_cell(worksheet, cell_ref)
        cell.value = customer_spec
        apply_cell_formatting(cell, **field_config['customer_spec_available']['format'])

        cell_ref = field_config['spec_signed_off']['cell']
        cell = get_writable_cell(worksheet, cell_ref)
        cell.value = spec_signed
        apply_cell_formatting(cell, **field_config['spec_signed_off']['format'])

        print("Basic information filled and formatted successfully")
        
    except Exception as e:
        print(f"Error filling basic info: {str(e)}")
        raise

def fill_observations_data(worksheet, audit_data, observation_cell_mapping):
    try:
        stages = audit_data.get('stages', [])
        if not stages:
            print("No stages data found for observations")
            return
        
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
                        
                        # Handle different parameter types based on their structure
                        if param_id in ['2-2', '3-6', '9-5', '11-2']:
                            # Sample-based parameters (Sample-1, Sample-2, etc.)
                            handle_sample_based_parameter(worksheet, param_id, time_slot, value, param_mapping)
                        
                        elif param_id in ['2-4', '2-5', '2-6', '9-6', '9-7', '9-8', '10-4', '10-5', '10-6', 
                                         '11-3', '11-4', '11-5', '12-1', '12-2', '16-1', '23-1', '27-1', '29-1']:
                            # Line-based sample parameters
                            handle_line_sample_parameter(worksheet, param_id, time_slot, value, param_mapping)
                        
                        elif param_id in ['5-4-laser-power', '5-5-cell-appearance']:
                            # Stringer unit parameters
                            handle_stringer_unit_parameter(worksheet, param_id, value, param_mapping)
                        
                        elif param_id == '5-6-cell-width':
                            # Cell width measurements
                            handle_cell_width_parameter(worksheet, value, param_mapping)
                        
                        elif param_id == '5-7-groove-length':
                            # Groove length measurements
                            handle_groove_length_parameter(worksheet, value, param_mapping)
                        
                        elif param_id == '5-9-machine-temp-setup':
                            # Machine temperature setup
                            handle_machine_temp_parameter(worksheet, value, param_mapping)
                        
                        elif param_id == '5-10-light-intensity-time':
                            # Light intensity and time
                            handle_light_intensity_parameter(worksheet, value, param_mapping)
                        
                        elif param_id == '5-11-peel-strength':
                            # Peel strength parameter
                            handle_peel_strength_parameter(worksheet, value, param_mapping)
                        
                        elif param_id in ['5-12-ribbon-flatten', '5-13-string-length', '5-14-cell-to-cell-gap', '5-15-el-inspection',
                                          '15-2', '19-3', '22-2', '24-1', '24-2', '24-5', '24-7', '24-8']:
                            # Stringer-based parameters
                            handle_stringer_based_parameter(worksheet, param_id, value, param_mapping)
                        
                        elif param_id == '7-1':
                            # BUS ribbon status
                            handle_bus_ribbon_status(worksheet, value, param_mapping)
                        
                        elif param_id == '7-2':
                            # Soldering time
                            handle_soldering_time(worksheet, value, param_mapping)
                        
                        elif param_id in ['7-3', '7-4', '7-5', '7-6', '7-7', '7-8']:
                            # Line-based measurements
                            handle_line_measurements(worksheet, param_id, value, param_mapping)
                        
                        elif param_id == '7-9':
                            # Peel strength bus ribbon
                            handle_bus_peel_strength(worksheet, value, param_mapping)
                        
                        elif param_id in ['8-1', '8-2', '8-3', '8-4', '8-5', '8-9', '8-10', '8-11', '8-12', '8-13', 
                                         '8-14', '8-15', '8-16', '15-1', '17-3', '17-6', '17-7', '17-8', '17-9', 
                                         '17-10', '17-11', '17-12-coating-thickness', '19-1', '19-2', '20-5', '26-1',
                                         '26-2', '26-3']:
                            # Time-based line parameters
                            handle_time_based_line_parameter(worksheet, param_id, value, param_mapping)
                        
                        elif param_id in ['8-6', '17-1', '17-2', '18-1', '18-2', '18-3', '20-1']:
                            # Component status parameters
                            handle_component_status(worksheet, param_id, value, param_mapping)
                        
                        elif param_id in ['14-1-laminator5', '14-2-laminator6', '14-3-laminator7', '14-4-laminator8']:
                            # Laminator parameters
                            handle_laminator_parameter(worksheet, param_id, value, param_mapping)
                        
                        elif param_id in ['17-4', '18-4']:
                            # Sample-based line parameters
                            handle_sample_line_parameter(worksheet, param_id, value, param_mapping)
                        
                        elif param_id == '17-5':
                            # Frame sealant weight
                            handle_frame_sealant_weight(worksheet, value, param_mapping)
                        
                        elif param_id in ['18-5', '18-6']:
                            # JB measurements
                            handle_jb_measurements(worksheet, param_id, value, param_mapping)
                        
                        elif param_id in ['20-3', '24-6', '24-9']:
                            # Complex measurement parameters
                            handle_complex_measurements(worksheet, param_id, value, param_mapping)
                        
                        elif param_id in ['20-2', '20-4', '21-1', '21-2', '21-3', '21-4', '21-5', '22-1', '24-3', '24-4']:
                            # Time-based environmental parameters
                            handle_environmental_parameters(worksheet, param_id, value, param_mapping)
                        
                        elif param_id in ['5-8-tds', '9-9']:
                            # Simple value parameters
                            if time_slot in param_mapping:
                                cell_ref = param_mapping[time_slot]
                                cell = get_writable_cell(worksheet, cell_ref)
                                cell.value = value
                                apply_cell_formatting(cell, font_size=16, horizontal='center')
                        
                        else:
                            # Default handling for simple timeSlot-value pairs
                            if time_slot in param_mapping:
                                cell_ref = param_mapping[time_slot]
                                cell = get_writable_cell(worksheet, cell_ref)
                                cell.value = value
                                apply_cell_formatting(cell, font_size=16, horizontal='center')
                                print(f"Filled observation {value} for parameter {param_id} at {time_slot} in cell {cell_ref}")
        
        print("Observations data filled successfully")
        
    except Exception as e:
        print(f"Error filling observations data: {str(e)}")
        raise

# Helper functions for different parameter types
def handle_sample_based_parameter(worksheet, param_id, time_slot, value, param_mapping):
    """Handle parameters with Sample-1, Sample-2, etc. structure"""
    if isinstance(value, dict):
        for sample_key, sample_value in value.items():
            if sample_key in param_mapping.get(time_slot, {}):
                cell_ref = param_mapping[time_slot][sample_key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = sample_value
                apply_cell_formatting(cell, font_size=16, horizontal='center')
                print(f"Filled observation {sample_value} for parameter {param_id} at {sample_key} in cell {cell_ref}")

def handle_line_sample_parameter(worksheet, param_id, time_slot, value, param_mapping):
    """Handle line-based sample parameters"""
    if isinstance(value, dict):
        for sample_key, sample_value in value.items():
            if time_slot in param_mapping and sample_key in param_mapping[time_slot]:
                cell_ref = param_mapping[time_slot][sample_key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = sample_value
                apply_cell_formatting(cell, font_size=16, horizontal='center')
                print(f"Filled observation {sample_value} for parameter {param_id} at {sample_key} in cell {cell_ref}")

def handle_stringer_unit_parameter(worksheet, param_id, value, param_mapping):
    """Handle stringer unit parameters"""
    if isinstance(value, dict):
        for stringer_key, stringer_value in value.items():
            if stringer_key in param_mapping:
                for unit_key, unit_value in stringer_value.items():
                    if unit_key in param_mapping[stringer_key]:
                        cell_ref = param_mapping[stringer_key][unit_key]
                        cell = get_writable_cell(worksheet, cell_ref)
                        cell.value = unit_value
                        apply_cell_formatting(cell, font_size=16, horizontal='center')
                        print(f"Filled observation {unit_value} for parameter {param_id} at {stringer_key}_{unit_key} in cell {cell_ref}")

def handle_cell_width_parameter(worksheet, value, param_mapping):
    """Handle cell width measurements"""
    if isinstance(value, dict):
        for stringer_key, stringer_value in value.items():
            if stringer_key in param_mapping:
                for position_key, position_value in stringer_value.items():
                    if position_key in param_mapping[stringer_key]:
                        cell_ref = param_mapping[stringer_key][position_key]
                        cell = get_writable_cell(worksheet, cell_ref)
                        cell.value = position_value
                        apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_groove_length_parameter(worksheet, value, param_mapping):
    """Handle groove length measurements"""
    if isinstance(value, dict):
        for stringer_key, stringer_value in value.items():
            if stringer_key in param_mapping:
                for groove_key, groove_value in stringer_value.items():
                    if groove_key in param_mapping[stringer_key]:
                        cell_ref = param_mapping[stringer_key][groove_key]
                        cell = get_writable_cell(worksheet, cell_ref)
                        cell.value = groove_value
                        apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_machine_temp_parameter(worksheet, value, param_mapping):
    """Handle machine temperature setup"""
    if isinstance(value, dict):
        for stringer_key, stringer_value in value.items():
            if stringer_key in param_mapping:
                for unit_key, unit_value in stringer_value.items():
                    if unit_key in param_mapping[stringer_key]:
                        for temp_key, temp_value in unit_value.items():
                            if temp_key in param_mapping[stringer_key][unit_key]:
                                cell_ref = param_mapping[stringer_key][unit_key][temp_key]
                                cell = get_writable_cell(worksheet, cell_ref)
                                cell.value = temp_value
                                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_light_intensity_parameter(worksheet, value, param_mapping):
    """Handle light intensity and time parameters"""
    if isinstance(value, dict):
        for stringer_key, stringer_value in value.items():
            if stringer_key in param_mapping:
                for unit_key, unit_value in stringer_value.items():
                    if unit_key in param_mapping[stringer_key]:
                        for light_key, light_value in unit_value.items():
                            if light_key in param_mapping[stringer_key][unit_key]:
                                cell_ref = param_mapping[stringer_key][unit_key][light_key]
                                cell = get_writable_cell(worksheet, cell_ref)
                                cell.value = light_value
                                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_peel_strength_parameter(worksheet, value, param_mapping):
    """Handle peel strength parameters"""
    if isinstance(value, dict):
        for stringer_key, stringer_value in value.items():
            if stringer_key in param_mapping:
                # Handle frontUnit and backUnit
                if 'frontUnit' in param_mapping[stringer_key]:
                    cell_ref = param_mapping[stringer_key]['frontUnit']
                    cell = get_writable_cell(worksheet, cell_ref)
                    cell.value = stringer_value.get('frontUnit', '')
                    apply_cell_formatting(cell, font_size=16, horizontal='center')

                if 'backUnit' in param_mapping[stringer_key]:
                    cell_ref = param_mapping[stringer_key]['backUnit']
                    cell = get_writable_cell(worksheet, cell_ref)
                    cell.value = stringer_value.get('backUnit', '')
                    apply_cell_formatting(cell, font_size=16, horizontal='center')

                # Handle frontSide measurements
                front_side = stringer_value.get('frontSide', {})
                for pos_key, pos_value in front_side.items():
                    if pos_key in param_mapping[stringer_key].get('frontSide', {}):
                        cell_ref = param_mapping[stringer_key]['frontSide'][pos_key]
                        cell = get_writable_cell(worksheet, cell_ref)
                        cell.value = pos_value
                        apply_cell_formatting(cell, font_size=16, horizontal='center')

                # Handle backSide measurements
                back_side = stringer_value.get('backSide', {})
                for pos_key, pos_value in back_side.items():
                    if pos_key in param_mapping[stringer_key].get('backSide', {}):
                        cell_ref = param_mapping[stringer_key]['backSide'][pos_key]
                        cell = get_writable_cell(worksheet, cell_ref)
                        cell.value = pos_value
                        apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_stringer_based_parameter(worksheet, param_id, value, param_mapping):
    """Handle stringer-based parameters"""
    if isinstance(value, dict):
        for stringer_key, stringer_value in value.items():
            if stringer_key in param_mapping:
                if isinstance(stringer_value, dict):
                    # For parameters with time-based values
                    for time_key, time_value in stringer_value.items():
                        if time_key in param_mapping[stringer_key]:
                            cell_ref = param_mapping[stringer_key][time_key]
                            cell = get_writable_cell(worksheet, cell_ref)
                            cell.value = time_value
                            apply_cell_formatting(cell, font_size=16, horizontal='center')
                else:
                    # For simple stringer values
                    cell_ref = param_mapping[stringer_key]
                    cell = get_writable_cell(worksheet, cell_ref)
                    cell.value = stringer_value
                    apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_bus_ribbon_status(worksheet, value, param_mapping):
    """Handle BUS ribbon status"""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in param_mapping:
                cell_ref = param_mapping[key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_soldering_time(worksheet, value, param_mapping):
    """Handle soldering time parameters"""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in param_mapping:
                cell_ref = param_mapping[key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_line_measurements(worksheet, param_id, value, param_mapping):
    """Handle line-based measurement parameters"""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in param_mapping:
                cell_ref = param_mapping[key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_bus_peel_strength(worksheet, value, param_mapping):
    """Handle bus ribbon peel strength"""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in param_mapping:
                cell_ref = param_mapping[key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_time_based_line_parameter(worksheet, param_id, value, param_mapping):
    """Handle time-based line parameters"""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in param_mapping:
                cell_ref = param_mapping[key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_component_status(worksheet, param_id, value, param_mapping):
    """Handle component status parameters"""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in param_mapping:
                cell_ref = param_mapping[key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_laminator_parameter(worksheet, param_id, value, param_mapping):
    """Handle laminator parameters"""
    if isinstance(value, dict):
        # Handle upper chamber
        upper_data = value.get('upper', {})
        for key, val in upper_data.items():
            if key in param_mapping.get('upper', {}):
                cell_ref = param_mapping['upper'][key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

        # Handle lower chamber
        lower_data = value.get('lower', {})
        for key, val in lower_data.items():
            if key in param_mapping.get('lower', {}):
                cell_ref = param_mapping['lower'][key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

        # Handle selected recipe
        if 'selectedRecipe' in param_mapping:
            cell_ref = param_mapping['selectedRecipe']
            cell = get_writable_cell(worksheet, cell_ref)
            cell.value = value.get('selectedRecipe', '')
            apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_sample_line_parameter(worksheet, param_id, value, param_mapping):
    """Handle sample-based line parameters"""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in param_mapping:
                cell_ref = param_mapping[key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_frame_sealant_weight(worksheet, value, param_mapping):
    """Handle frame sealant weight"""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in param_mapping:
                cell_ref = param_mapping[key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_jb_measurements(worksheet, param_id, value, param_mapping):
    """Handle junction box measurements"""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in param_mapping:
                cell_ref = param_mapping[key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_complex_measurements(worksheet, param_id, value, param_mapping):
    """Handle complex measurement parameters"""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in param_mapping:
                cell_ref = param_mapping[key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

def handle_environmental_parameters(worksheet, param_id, value, param_mapping):
    """Handle environmental parameters"""
    if isinstance(value, dict):
        for key, val in value.items():
            if key in param_mapping:
                cell_ref = param_mapping[key]
                cell = get_writable_cell(worksheet, cell_ref)
                cell.value = val
                apply_cell_formatting(cell, font_size=16, horizontal='center')

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

def generate_filename(audit_data):
    line_number = audit_data.get('lineNumber', 'Unknown')
    date = audit_data.get('date', 'Unknown')
    shift = audit_data.get('shift', 'Unknown')
    formatted_date = date.replace('-', '')
    return f"Quality_Audit_Line{line_number}_{formatted_date}_Shift{shift}.xlsx"

# Main function to generate report (this will be called from main.py)
def generate_audit_report(audit_data):
    try:
        if not audit_data:
            raise ValueError("No audit data provided")
        print("Received audit data for report generation")
        line_number = audit_data.get('lineNumber', 'I')
        template_path, field_config, observation_cell_mapping = get_template_config(line_number)
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template file not found at: {template_path}")
        wb = load_workbook(template_path)
        setup_cell_styles(wb)
        ws = wb.active
        fill_basic_info(ws, audit_data, field_config)
        fill_observations_data(ws, audit_data, observation_cell_mapping)
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        filename = generate_filename(audit_data)
        return output, filename
        
    except Exception as e:
        print(f"Error generating audit report: {str(e)}")
        raise