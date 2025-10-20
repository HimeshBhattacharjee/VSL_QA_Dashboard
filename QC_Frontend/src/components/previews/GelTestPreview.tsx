import React, { useEffect, useState } from 'react';

interface GelTestReport {
    name: string;
    timestamp: string;
    formData: { [key: string]: string | boolean };
}

interface PreviewReportProps { report: GelTestReport }

interface Averages {
    [key: string]: string;
    mean: string;
}

export const GelTestPreview: React.FC<PreviewReportProps> = ({ report }) => {
    const [averages, setAverages] = useState<Averages>({ mean: '0' });

    useEffect(() => {
        const calculatedAverages = calculateAveragesFromReportData(report);
        setAverages(calculatedAverages);
    }, [report]);

    const calculateAveragesFromReportData = (reportData: GelTestReport): Averages => {
        const averages: Averages = { mean: '0' };
        const rowData: { [key: string]: string[] } = {
            rowA: ['editable_31', 'editable_32', 'editable_33', 'editable_34', 'editable_35'],
            rowB: ['editable_36', 'editable_37', 'editable_38', 'editable_39', 'editable_40'],
            rowC: ['editable_42', 'editable_43', 'editable_44', 'editable_45', 'editable_46'],
            rowD: ['editable_47', 'editable_48', 'editable_49', 'editable_50', 'editable_51'],
            rowE: ['editable_52', 'editable_53', 'editable_54', 'editable_55', 'editable_56'],
            rowF: ['editable_58', 'editable_59', 'editable_60', 'editable_61', 'editable_62'],
            rowG: ['editable_63', 'editable_64', 'editable_65', 'editable_66', 'editable_67']
        };
        const rowAverages: number[] = [];
        Object.entries(rowData).forEach(([rowKey, cellKeys]) => {
            let sum = 0;
            let count = 0;
            let hasPercentage = false;
            cellKeys.forEach(key => {
                const value = reportData.formData[key] as string;
                if (value && value.trim()) {
                    if (value.includes('%')) {
                        hasPercentage = true;
                        const numericValue = parseFloat(value.replace('%', ''));
                        if (!isNaN(numericValue)) {
                            sum += numericValue;
                            count++;
                        }
                    } else {
                        const numericValue = parseFloat(value);
                        if (!isNaN(numericValue)) {
                            sum += numericValue;
                            count++;
                        }
                    }
                }
            });
            let average = 0;
            if (count > 0) average = sum / count;
            let averageDisplay = average.toFixed(2);
            if (hasPercentage && count > 0) averageDisplay += '%';
            averages[rowKey] = averageDisplay;
            if (count > 0) rowAverages.push(average);
        });
        if (rowAverages.length > 0) {
            const mean = rowAverages.reduce((sum, avg) => sum + avg, 0) / rowAverages.length;
            averages.mean = mean.toFixed(2);
        }
        return averages;
    };

    return (
        <div className="preview-report-content">
            <table className="w-full border-collapse border border-gray-300 text-sm">
                <tbody>
                    <tr>
                        <td colSpan={2} rowSpan={3}>
                            <img src="../LOGOS/VSL_Logo (1).png" height="70" alt="VSL Logo" />
                        </td>
                        <td colSpan={8} rowSpan={2} className="section-title text-2xl font-bold bg-gray-100 text-center">
                            VIKRAM SOLAR LIMITED
                        </td>
                        <td colSpan={3} className="section-title font-bold bg-gray-100 text-center">
                            Doc. No.: VSL/QAD/FM/90
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            Issue Date: 11.01.2023
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={8} className="section-title text-xl font-bold bg-gray-100 text-center">
                            Gel Content Test Report
                        </td>
                        <td colSpan={3} className="section-title font-bold bg-gray-100 text-center">
                            Rev. No./ Date: 03/ 25.02.2025
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={10} rowSpan={3}>
                            <div className="allowable-limit p-2 bg-gray-50 border-l-4 border-l-blue-500 text-left">
                                <strong className="px-2">Allowable Limit:</strong>
                                <div className="checkbox-container">
                                    <div className="checkbox-item flex items-center mt-1">
                                        <label>1. Gel Content should be: 75 to 95% for EVA & EPE</label>
                                        <input
                                            type="checkbox"
                                            checked={!!report.formData.checkbox_0}
                                            disabled
                                            className="ml-2"
                                        />
                                    </div>
                                </div>
                                <div className="checkbox-container">
                                    <div className="checkbox-item flex items-center mt-1">
                                        <label>2. Gel Content should be: ≥ 60% for POE</label>
                                        <input
                                            type="checkbox"
                                            checked={!!report.formData.checkbox_1}
                                            disabled
                                            className="ml-2"
                                        />
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td>Inv. No./ Date:</td>
                        <td colSpan={2}>{report.formData.editable_0 as string || ''}</td>
                    </tr>
                    <tr>
                        <td>P.O. No.:</td>
                        <td colSpan={2}>{report.formData.editable_1 as string || ''}</td>
                    </tr>
                    <tr>
                        <td>Type of Test:</td>
                        <td colSpan={2}>{report.formData.editable_2 as string || ''}</td>
                    </tr>
                    <tr>
                        <td colSpan={10} className="section-title font-bold bg-gray-100 text-center">
                            Laminator Parameter
                        </td>
                        <td>Laminator Details:</td>
                        <td colSpan={2}>{report.formData.editable_3 as string || ''}</td>
                    </tr>
                    <tr>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            Process Name
                        </td>
                        <td colSpan={2}>Lam - 1</td>
                        <td colSpan={3}>Lam - 2</td>
                        <td colSpan={3}>Lam - 3 (CP)</td>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            MATERIAL INFORMATION (S)
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            Pumping Time (Sec)
                        </td>
                        <td colSpan={2}>{report.formData.editable_4 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_5 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_6 as string || ''}</td>
                        <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">
                            Encapsulant Types:
                        </td>
                        <td colSpan={2}>
                            <div className="checkbox-container flex flex-wrap">
                                <div className="checkbox-item flex items-center mr-4">
                                    <label>EVA</label>
                                    <input
                                        type="checkbox"
                                        checked={!!report.formData.checkbox_2}
                                        disabled
                                        className="ml-1"
                                    />
                                </div>
                                <div className="checkbox-item flex items-center mr-4">
                                    <label>EPE</label>
                                    <input
                                        type="checkbox"
                                        checked={!!report.formData.checkbox_3}
                                        disabled
                                        className="ml-1"
                                    />
                                </div>
                                <div className="checkbox-item flex items-center">
                                    <label>POE</label>
                                    <input
                                        type="checkbox"
                                        checked={!!report.formData.checkbox_4}
                                        disabled
                                        className="ml-1"
                                    />
                                </div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            Pressing/Cooling Time (Sec)
                        </td>
                        <td colSpan={2}>{report.formData.editable_7 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_8 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_9 as string || ''}</td>
                        <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">
                            Encapsulant Supplier:
                        </td>
                        <td colSpan={2}>FIRST</td>
                    </tr>
                    <tr>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            Venting Time (Sec)
                        </td>
                        <td colSpan={2}>{report.formData.editable_10 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_11 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_12 as string || ''}</td>
                        <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">
                            Category:
                        </td>
                        <td colSpan={2}>{report.formData.editable_13 as string || ''}</td>
                    </tr>
                    <tr>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            Lower Heating (˚C)
                        </td>
                        <td colSpan={2}>{report.formData.editable_14 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_15 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_16 as string || ''}</td>
                        <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">
                            Batch/Lot No.:
                        </td>
                        <td colSpan={2}>{report.formData.editable_17 as string || ''}</td>
                    </tr>
                    <tr>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            Upper Heating (˚C)
                        </td>
                        <td colSpan={2}>{report.formData.editable_18 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_19 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_20 as string || ''}</td>
                        <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">
                            MFG. Date:
                        </td>
                        <td colSpan={2}>{report.formData.editable_21 as string || ''}</td>
                    </tr>
                    <tr>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            Upper Pressure (Kpa)
                        </td>
                        <td colSpan={2}>{report.formData.editable_22 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_23 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_24 as string || ''}</td>
                        <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">
                            Exp. Date:
                        </td>
                        <td colSpan={2}>{report.formData.editable_25 as string || ''}</td>
                    </tr>
                    <tr>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            Lower Pressure (Kpa)
                        </td>
                        <td colSpan={2}>{report.formData.editable_26 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_27 as string || ''}</td>
                        <td colSpan={3}>{report.formData.editable_28 as string || ''}</td>
                        <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">
                            Glass Size:
                        </td>
                        <td colSpan={2}>{report.formData.editable_29 as string || ''}</td>
                    </tr>
                    <tr>
                        <td colSpan={13}>
                            <img src="../IMAGES/GelTest.jpg" width="100%" alt="Gel Test" />
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            Date, Shift, & Time
                        </td>
                        <td className="section-title font-bold bg-gray-100 text-center">
                            Workshop
                        </td>
                        <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">
                            Platen Position (A/B/C/D/E/F/G)
                        </td>
                        <td className="section-title font-bold bg-gray-100 text-center">#1</td>
                        <td className="section-title font-bold bg-gray-100 text-center">#2</td>
                        <td className="section-title font-bold bg-gray-100 text-center">#3</td>
                        <td className="section-title font-bold bg-gray-100 text-center">#4</td>
                        <td className="section-title font-bold bg-gray-100 text-center">#5</td>
                        <td className="section-title font-bold bg-gray-100 text-center">
                            Average (A/B/C/D/E/F/G)
                        </td>
                        <td className="section-title font-bold bg-gray-100 text-center">Mean</td>
                    </tr>
                    <tr>
                        <td colSpan={2} rowSpan={2}>{report.formData.editable_30 as string || ''}</td>
                        <td rowSpan={7} className="text-center">VSL FAB-II</td>
                        <td colSpan={2}>A</td>
                        <td className="text-center">{report.formData.editable_31 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_32 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_33 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_34 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_35 as string || ''}</td>
                        <td className="average-cell font-bold bg-gray-50 text-center">{averages.rowA || '0'}</td>
                        <td rowSpan={7} className="mean-cell font-bold bg-gray-50 text-center">{averages.mean}</td>
                    </tr>
                    <tr>
                        <td colSpan={2}>B</td>
                        <td className="text-center">{report.formData.editable_36 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_37 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_38 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_39 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_40 as string || ''}</td>
                        <td className="average-cell font-bold bg-gray-50 text-center">{averages.rowB || '0'}</td>
                    </tr>
                    <tr>
                        <td colSpan={2} rowSpan={3}>{report.formData.editable_41 as string || ''}</td>
                        <td colSpan={2}>C</td>
                        <td className="text-center">{report.formData.editable_42 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_43 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_44 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_45 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_46 as string || ''}</td>
                        <td className="average-cell font-bold bg-gray-50 text-center">{averages.rowC || '0'}</td>
                    </tr>
                    <tr>
                        <td colSpan={2}>D</td>
                        <td className="text-center">{report.formData.editable_47 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_48 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_49 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_50 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_51 as string || ''}</td>
                        <td className="average-cell font-bold bg-gray-50 text-center">{averages.rowD || '0'}</td>
                    </tr>
                    <tr>
                        <td colSpan={2}>E</td>
                        <td className="text-center">{report.formData.editable_52 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_53 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_54 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_55 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_56 as string || ''}</td>
                        <td className="average-cell font-bold bg-gray-50 text-center">{averages.rowE || '0'}</td>
                    </tr>
                    <tr>
                        <td colSpan={2} rowSpan={2}>{report.formData.editable_57 as string || ''}</td>
                        <td colSpan={2}>F</td>
                        <td className="text-center">{report.formData.editable_58 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_59 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_60 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_61 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_62 as string || ''}</td>
                        <td className="average-cell font-bold bg-gray-50 text-center">{averages.rowF || '0'}</td>
                    </tr>
                    <tr>
                        <td colSpan={2}>G</td>
                        <td className="text-center">{report.formData.editable_63 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_64 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_65 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_66 as string || ''}</td>
                        <td className="text-center">{report.formData.editable_67 as string || ''}</td>
                        <td className="average-cell font-bold bg-gray-50 text-center">{averages.rowG || '0'}</td>
                    </tr>
                    <tr>
                        <td colSpan={4} className="section-title font-bold bg-gray-100 text-center">
                            Tested By
                        </td>
                        <td colSpan={5} className="section-title font-bold bg-gray-100 text-center">
                            Reviewed By
                        </td>
                        <td colSpan={4} className="section-title font-bold bg-gray-100 text-center">
                            Approved By
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={4} className="text-center p-2 border-b border-gray-300">
                            {report.formData.editable_68 as string || ''}
                        </td>
                        <td colSpan={5} className="text-center p-2 border-b border-gray-300">
                            {report.formData.editable_69 as string || ''}
                        </td>
                        <td colSpan={4} className="text-center p-2 border-b border-gray-300">
                            {report.formData.editable_70 as string || ''}
                        </td>
                    </tr>
                </tbody>
            </table>
            <div className="controlled-copy text-center mt-2 text-md text-red-500">
                <p>(Controlled Copy)</p>
            </div>
        </div>
    );
};