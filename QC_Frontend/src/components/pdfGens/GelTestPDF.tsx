import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Create styles that match your Tailwind CSS table
const styles = StyleSheet.create({
    page: {
        padding: 15,
        fontSize: 8,
        fontFamily: 'Helvetica',
    },
    title: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 8,
        fontWeight: 'bold',
    },
    date: {
        fontSize: 8,
        textAlign: 'center',
        marginBottom: 8,
    },
    table: {
        display: 'flex',
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#d1d5db',
    },
    tableRow: {
        flexDirection: 'row',
        minHeight: 25,
    },
    tableCol: {
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#d1d5db',
        padding: 3,
    },
    tableCell: {
        fontSize: 7,
        textAlign: 'center',
    },
    tableCellLeft: {
        fontSize: 7,
        textAlign: 'left',
    },
    sectionTitle: {
        fontSize: 9,
        fontWeight: 'bold',
        textAlign: 'center',
        backgroundColor: '#f3f4f6',
    },
    sectionTitleLarge: {
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        backgroundColor: '#f3f4f6',
    },
    sectionTitleXLarge: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        backgroundColor: '#f3f4f6',
    },
    boldText: {
        fontWeight: 'bold',
    },
    bgGray100: {
        backgroundColor: '#f3f4f6',
    },
    bgGray50: {
        backgroundColor: '#f9fafb',
    },
    allowableLimit: {
        backgroundColor: '#f9fafb',
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6',
        padding: 5,
        textAlign: 'left',
    },
    averageCell: {
        fontWeight: 'bold',
        backgroundColor: '#f9fafb',
    },
    meanCell: {
        fontWeight: 'bold',
        backgroundColor: '#f9fafb',
    },
    controlledCopy: {
        textAlign: 'center',
        fontSize: 12,
        color: '#ef4444',
        marginTop: 10,
    },
    // Width styles for different column spans
    w1: { width: '8.33%' },   // 1/12
    w2: { width: '16.66%' },  // 2/12
    w3: { width: '25%' },     // 3/12
    w4: { width: '33.33%' },  // 4/12
    w5: { width: '41.66%' },  // 5/12
    w8: { width: '66.66%' },  // 8/12
    w10: { width: '83.33%' }, // 10/12
    w13: { width: '100%' },   // 13/12
});

interface GelTestPDFProps {
    reportName: string;
    tableData: {
        [key: string]: string | boolean;
    };
    averages?: {
        [key: string]: string;
    };
}

export default function GelTestPDF({ reportName, tableData, averages = {} }: GelTestPDFProps) {
    // Helper function to get cell content
    const getCellContent = (key: string): string => {
        const value = tableData[key];
        if (typeof value === 'boolean') {
            return value ? '✓' : '';
        }
        return value?.toString() || '';
    };

    // Helper function to get average value
    const getAverage = (key: string): string => {
        return averages[key] || '0';
    };

    return (
        <Document>
            <Page size="A4" style={styles.page} orientation="landscape">
                <Text style={styles.title}>{reportName || 'Gel Test Report'}</Text>
                <Text style={styles.date}>
                    Generated on: {new Date().toLocaleDateString()}
                </Text>

                {/* Main Table */}
                <View style={styles.table}>
                    {/* Row 1: Logo, Company Name, Doc No */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.w2, { height: 50 }]}>
                            <Text>Vikram Solar Limited</Text></View>
                        <View style={[styles.tableCol, styles.sectionTitleXLarge, styles.w8]}></View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w3]}></View>
                    </View>

                    {/* Row 2: Logo, Company Name, Issue Date */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.w2, { height: 30 }]}></View>
                        <View style={[styles.tableCol, styles.sectionTitleXLarge, styles.w8]}></View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}></View>
                        <View style={[styles.tableCol, styles.w1]}></View>
                    </View>

                    {/* Row 3: Logo, Report Title, Rev No */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.w2, { height: 30 }]}></View>
                        <View style={[styles.tableCol, styles.sectionTitleLarge, styles.w8]}>
                            <Text>Gel Content Test Report</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w3]}>
                            <Text>Rev. No./ Date: 03/ 25.02.2025</Text>
                        </View>
                    </View>

                    {/* Row 4: Allowable Limit, Inv No */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.allowableLimit, styles.w10, { height: 60 }]}>
                            <Text style={styles.boldText}>Allowable Limit:</Text>
                            <Text>1. Gel Content should be: 75 to 95% for EVA & EPE {getCellContent('checkbox_0') ? '✓' : ''}</Text>
                            <Text>2. Gel Content should be: ≥ 60% for POE {getCellContent('checkbox_1') ? '✓' : ''}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w1]}>
                            <Text>Inv. No./ Date:</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_0')}</Text>
                        </View>
                    </View>

                    {/* Row 5: Allowable Limit (cont.), P.O. No */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.allowableLimit, styles.w10, { height: 30 }]}></View>
                        <View style={[styles.tableCol, styles.w1]}>
                            <Text>P.O. No.:</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_1')}</Text>
                        </View>
                    </View>

                    {/* Row 6: Allowable Limit (cont.), Type of Test */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.allowableLimit, styles.w10, { height: 30 }]}></View>
                        <View style={[styles.tableCol, styles.w1]}>
                            <Text>Type of Test:</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_2')}</Text>
                        </View>
                    </View>

                    {/* Row 7: Laminator Parameter, Laminator Details */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w10]}>
                            <Text>Laminator Parameter</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w1]}>
                            <Text>Laminator Details:</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_3')}</Text>
                        </View>
                    </View>

                    {/* Row 8: Process Name, Material Info */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}>
                            <Text>Process Name</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>Lam - 1</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>Lam - 2</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>Lam - 3 (CP)</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}>
                            <Text>MATERIAL INFORMATION (S)</Text>
                        </View>
                    </View>

                    {/* Row 9: Pumping Time, Encapsulant Types */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}>
                            <Text>Pumping Time (Sec)</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_4')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_5')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_6')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>Encapsulant Types:</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w1]}>
                            <Text>EVA {getCellContent('checkbox_2') ? '✓' : ''}</Text>
                            <Text>EPE {getCellContent('checkbox_3') ? '✓' : ''}</Text>
                            <Text>POE {getCellContent('checkbox_4') ? '✓' : ''}</Text>
                        </View>
                    </View>

                    {/* Continue with all the other rows following the same pattern */}
                    {/* Row 10: Pressing/Cooling Time, Encapsulant Supplier */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}>
                            <Text>Pressing/Cooling Time (Sec)</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_7')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_8')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_9')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>Encapsulant Supplier:</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>FIRST</Text>
                        </View>
                    </View>

                    {/* Row 11: Venting Time, Category */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}>
                            <Text>Venting Time (Sec)</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_10')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_11')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_12')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>Category:</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_13')}</Text>
                        </View>
                    </View>

                    {/* Row 12: Lower Heating, Batch/Lot No */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}>
                            <Text>Lower Heating (˚C)</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_14')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_15')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_16')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>Batch/Lot No.:</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_17')}</Text>
                        </View>
                    </View>

                    {/* Row 13: Upper Heating, MFG Date */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}>
                            <Text>Upper Heating (˚C)</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_18')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_19')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_20')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>MFG. Date:</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_21')}</Text>
                        </View>
                    </View>

                    {/* Row 14: Upper Pressure, Exp Date */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}>
                            <Text>Upper Pressure (Kpa)</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_22')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_23')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_24')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>Exp. Date:</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_25')}</Text>
                        </View>
                    </View>

                    {/* Row 15: Lower Pressure, Glass Size */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}>
                            <Text>Lower Pressure (Kpa)</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_26')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_27')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w3]}>
                            <Text>{getCellContent('editable_28')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>Glass Size:</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w2]}>
                            <Text>{getCellContent('editable_29')}</Text>
                        </View>
                    </View>

                    {/* Row 16: Image */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.w13, { height: 80 }]}>
                            <Text>[Gel Test Image]</Text>
                        </View>
                    </View>

                    {/* Row 17: Data Table Headers */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}>
                            <Text>Date, Shift, & Time</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>Workshop</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w2]}>
                            <Text>Platen Position (A/B/C/D/E/F/G)</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>#1</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>#2</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>#3</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>#4</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>#5</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>Average (A/B/C/D/E/F/G)</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w1]}>
                            <Text>Mean</Text>
                        </View>
                    </View>

                    {/* Data Rows A-G */}
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((position, index) => (
                        <View key={position} style={styles.tableRow}>
                            {index === 0 && (
                                <View style={[styles.tableCol, styles.w2, { height: 50 }]}>
                                    <Text>{getCellContent('editable_30')}</Text>
                                </View>
                            )}
                            {index === 2 && (
                                <View style={[styles.tableCol, styles.w2, { height: 75 }]}>
                                    <Text>{getCellContent('editable_31')}</Text>
                                </View>
                            )}
                            {index === 5 && (
                                <View style={[styles.tableCol, styles.w2, { height: 50 }]}>
                                    <Text>{getCellContent('editable_32')}</Text>
                                </View>
                            )}
                            {index !== 0 && index !== 2 && index !== 5 && (
                                <View style={[styles.tableCol, styles.w2]}></View>
                            )}

                            <View style={[styles.tableCol, styles.w1]}>
                                <Text>{index === 0 ? 'VSL FAB-II' : ''}</Text>
                            </View>

                            <View style={[styles.tableCol, styles.w2]}>
                                <Text>{position}</Text>
                            </View>

                            {/* Data cells 1-5 */}
                            {[1, 2, 3, 4, 5].map((num) => (
                                <View key={num} style={[styles.tableCol, styles.w1]}>
                                    <Text>{getCellContent(`data_${position}_${num}`)}</Text>
                                </View>
                            ))}

                            <View style={[styles.tableCol, styles.averageCell, styles.w1]}>
                                <Text>{getAverage(`average_${position}`)}</Text>
                            </View>

                            {index === 0 && (
                                <View style={[styles.tableCol, styles.meanCell, styles.w1, { height: 175 }]}>
                                    <Text>{getAverage('mean')}</Text>
                                </View>
                            )}
                        </View>
                    ))}

                    {/* Row 25: Tested By, Reviewed By, Approved By Headers */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w4]}>
                            <Text>Tested By</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w5]}>
                            <Text>Reviewed By</Text>
                        </View>
                        <View style={[styles.tableCol, styles.sectionTitle, styles.w4]}>
                            <Text>Approved By</Text>
                        </View>
                    </View>

                    {/* Row 26: Tested By, Reviewed By, Approved By Data */}
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, styles.w4]}>
                            <Text>{getCellContent('editable_33')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w5]}>
                            <Text>{getCellContent('editable_34')}</Text>
                        </View>
                        <View style={[styles.tableCol, styles.w4]}>
                            <Text>{getCellContent('editable_35')}</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.controlledCopy}>(Controlled Copy)</Text>
            </Page>
        </Document>
    );
}