// PeelTestPreview.tsx
import React from 'react';

interface ReportData {
    name: string;
    timestamp: string;
    formData: Record<string, string>;
    rowData: any[];
}

interface PeelTestPreviewProps {
    report: ReportData;
}

export const PeelTestPreview: React.FC<PeelTestPreviewProps> = ({ report }) => {
    // Calculate averages for a specific row and position
    const calculateAverage = (rowIndex: number, startCell: number, count: number): string => {
        let sum = 0;
        let validCount = 0;

        for (let i = 0; i < count; i++) {
            const cellId = `row_${rowIndex}_cell_${startCell + i}`;
            const value = report.formData[cellId];
            if (value && !isNaN(parseFloat(value))) {
                sum += parseFloat(value);
                validCount++;
            }
        }

        return validCount > 0 ? (sum / validCount).toFixed(2) : '0.00';
    };

    // Check if cell should be highlighted
    const shouldHighlightCell = (value: string): boolean => {
        return value === '' || (parseFloat(value) < 1.0 && !isNaN(parseFloat(value)));
    };

    // Generate table rows for the preview
    const generateTableRows = () => {
        const repetitions = 24;
        const tableRows = [];

        for (let rep = 0; rep < repetitions; rep++) {
            // Front section header
            tableRows.push(
                <tr key={`front-header-${rep}`}>
                    <td rowSpan={34} className="border border-gray-300 p-1 text-center align-middle">
                        {report.formData[`row_${rep}_cell_0`] || ''}
                    </td>
                    <td rowSpan={34} className="border border-gray-300 p-1 text-center align-middle">
                        {report.formData[`row_${rep}_cell_1`] || ''}
                    </td>
                    <td rowSpan={34} className="border border-gray-300 p-1 text-center align-middle">
                        {report.formData[`row_${rep}_cell_2`] || ''}
                    </td>
                    <td rowSpan={34} className="border border-gray-300 p-1 text-center align-middle">
                        {report.formData[`row_${rep}_cell_3`] || ''}
                    </td>
                    <td rowSpan={34} className="border border-gray-300 p-1 text-center align-middle">
                        {report.formData[`row_${rep}_cell_4`] || ''}
                    </td>
                    <td rowSpan={34} className="border border-gray-300 p-1 text-center align-middle">
                        {report.formData[`row_${rep}_cell_5`] || ''}
                    </td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">Front</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">1</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">2</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">3</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">4</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">5</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">6</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">7</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">Avg. Value (N/mm)</td>
                </tr>
            );

            // Front data rows (16 rows)
            for (let i = 1; i <= 16; i++) {
                const startCell = 6 + (i - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);

                tableRows.push(
                    <tr key={`front-data-${rep}-${i}`}>
                        <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">{i}</td>
                        {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                            const cellIndex = startCell + offset;
                            const value = report.formData[`row_${rep}_cell_${cellIndex}`] || '';
                            const isHighlighted = shouldHighlightCell(value);

                            return (
                                <td
                                    key={`front-${rep}-${i}-${offset}`}
                                    className={`border border-gray-300 p-1 text-center ${isHighlighted ? 'bg-red-200' : ''}`}
                                >
                                    {value}
                                </td>
                            );
                        })}
                        <td className="border border-gray-300 p-1 font-semibold text-center">
                            {average}
                        </td>
                    </tr>
                );
            }

            // Back section header
            tableRows.push(
                <tr key={`back-header-${rep}`}>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">Back</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">1</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">2</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">3</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">4</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">5</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">6</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">7</td>
                    <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">Avg. Value (N/mm)</td>
                </tr>
            );

            // Back data rows (16 rows)
            for (let i = 1; i <= 16; i++) {
                const startCell = 118 + (i - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);

                tableRows.push(
                    <tr key={`back-data-${rep}-${i}`}>
                        <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">{i}</td>
                        {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                            const cellIndex = startCell + offset;
                            const value = report.formData[`row_${rep}_cell_${cellIndex}`] || '';
                            const isHighlighted = shouldHighlightCell(value);

                            return (
                                <td
                                    key={`back-${rep}-${i}-${offset}`}
                                    className={`border border-gray-300 p-1 text-center ${isHighlighted ? 'bg-red-200' : ''}`}
                                >
                                    {value}
                                </td>
                            );
                        })}
                        <td className="border border-gray-300 p-1 font-semibold text-center">
                            {average}
                        </td>
                    </tr>
                );
            }
        }

        return tableRows;
    };

    return (
        <div className="test-report-container bg-white p-4">
            <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                    <tr>
                        <td colSpan={2} rowSpan={3} className="border border-gray-300 p-2">
                            <img src="/LOGOS/VSL_Logo (1).png" height="70" alt="VSL Logo" />
                        </td>
                        <td colSpan={10} rowSpan={2} className="border border-gray-300 p-2 text-center text-2xl font-bold">
                            VIKRAM SOLAR LIMITED
                        </td>
                        <td colSpan={3} rowSpan={1} className="border border-gray-300 p-2">
                            Doc. No.: VSL/QAD/FM/104
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={3} className="border border-gray-300 p-2">
                            Issue Date: 04.09.2024
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={10} className="border border-gray-300 p-2 text-center text-xl font-bold">
                            Solar Cell Peel Strength Test Report
                        </td>
                        <td colSpan={3} className="border border-gray-300 p-2">
                            Rev. No./ Date: 01/ 25.09.2024
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={15} className="border border-gray-300 p-2 bg-gray-100 text-center">
                            <strong>Allowable Limit: Peel strength average ≥ 1.0 N/mm</strong>
                        </td>
                    </tr>
                    <tr>
                        <th className="border border-gray-300 p-2">Date</th>
                        <th className="border border-gray-300 p-2">Shift</th>
                        <th className="border border-gray-300 p-2">Stringer</th>
                        <th className="border border-gray-300 p-2">Unit</th>
                        <th className="border border-gray-300 p-2">PO</th>
                        <th className="border border-gray-300 p-2">Cell Vendor</th>
                        <th colSpan={8} className="border border-gray-300 p-2 text-center">
                            Bus Pad Position Wise Ribbon Peel Strength
                        </th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {generateTableRows()}
                </tbody>
            </table>

            {/* Footer Signatures */}
            <div className="footer flex justify-between mt-8 pt-4 border-t border-gray-300">
                <div className="signature flex-1 text-center">
                    <p><strong>PREPARED BY :</strong></p>
                    <div className="min-h-10 border-b border-gray-400 text-center py-2">
                        {report.formData['prepared-by'] || report.formData['preparedBy'] || ''}
                    </div>
                </div>
                <div className="signature flex-1 text-center">
                    <p><strong>ACCEPTED BY :</strong></p>
                    <div className="min-h-10 border-b border-gray-400 text-center py-2">
                        {report.formData['accepted-by'] || report.formData['acceptedBy'] || ''}
                    </div>
                </div>
                <div className="signature flex-1 text-center">
                    <p><strong>VERIFIED BY :</strong></p>
                    <div className="min-h-10 border-b border-gray-400 text-center py-2">
                        {report.formData['verified-by'] || report.formData['verifiedBy'] || ''}
                    </div>
                </div>
            </div>
        </div>
    );
};