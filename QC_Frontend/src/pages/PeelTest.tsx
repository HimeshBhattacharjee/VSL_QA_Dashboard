import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';

type ReportData = {
    name: string;
    timestamp: string;
    formData: Record<string, string>;
    rowData: any[];
};

type TabType = 'edit-report' | 'saved-reports' | 'report-analysis';

const STORAGE_KEY = 'peelTestReports';
const PEEL_API_BASE_URL = 'http://localhost:8000/peel';

export default function PeelTest() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('edit-report');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [currentEditingReport, setCurrentEditingReport] = useState<string | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewReport, setPreviewReport] = useState<ReportData | null>(null);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();

    // Edit Report Tab States
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedShift, setSelectedShift] = useState('');
    const [showReportEditor, setShowReportEditor] = useState(false);
    const [formData, setFormData] = useState<Record<string, string>>({});

    // Analysis Tab States
    const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7));
    const [stringer, setStringer] = useState('1');
    const [cellFace, setCellFace] = useState('');
    const [showChart, setShowChart] = useState(false);
    const chartRef = useRef<HTMLCanvasElement>(null);

    // Navigation functions
    const handleBackToTests = () => {
        if (hasUnsavedChanges) {
            showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
                type: 'warning',
                confirmText: 'Leave',
                cancelText: 'Stay',
                onConfirm: () => {
                    clearFormData();
                    navigate('/quality-tests');
                }
            });
        } else {
            clearFormData();
            navigate('/quality-tests');
        }
    };

    const clearFormData = () => {
        setHasUnsavedChanges(false);
        setCurrentEditingReport(null);
        setFormData({});
    };

    // Report management functions
    const getSavedReports = (): ReportData[] => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    };

    const generateReportName = (dateString: string, shift: string) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        return `Peel_Test_Report_${day}_${month}_${year}_Shift_${shift}`;
    };

    const fetchPeelData = async (date: string, shift: string) => {
        try {
            const response = await fetch(`${PEEL_API_BASE_URL}/date/${date}/shift/${shift}`);
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            return data.status === 'success' && data.data && data.data.length > 0 ? data.data : null;
        } catch (error) {
            console.error('Error fetching peel data:', error);
            return null;
        }
    };

    const loadOrCreateReport = async () => {
        if (!selectedDate) {
            showAlert('error', 'Please select a date');
            return;
        }

        if (!selectedShift) {
            showAlert('error', 'Please select a shift');
            return;
        }

        const reportName = generateReportName(selectedDate, selectedShift);
        const savedReports = getSavedReports();
        const existingLocalReport = savedReports.find(report => report.name === reportName);

        if (existingLocalReport) {
            setCurrentEditingReport(reportName);
            showAlert('success', 'Loaded locally saved report');
        } else {
            try {
                const mongoData = await fetchPeelData(selectedDate, selectedShift);
                if (mongoData && mongoData.length > 0) {
                    setCurrentEditingReport(reportName);
                    showAlert('success', 'Report created from database data');
                } else {
                    setCurrentEditingReport(reportName);
                    showAlert('info', 'No data found in database. Created blank report');
                }
            } catch (error) {
                setCurrentEditingReport(reportName);
                showAlert('info', 'Created blank report');
            }
        }

        setShowReportEditor(true);
    };

    // Saved Reports functions
    const previewSavedReport = (index: number) => {
        const savedReports = getSavedReports();
        if (index >= 0 && index < savedReports.length) {
            setPreviewReport(savedReports[index]);
            setShowPreviewModal(true);
        }
    };

    const editSavedReport = (index: number) => {
        const savedReports = getSavedReports();
        const report = savedReports[index];

        // Parse date from report name
        const dateShiftMatch = report.name.match(/Peel_Test_Report_(\d+)_(\w+)_(\d+)_Shift_([ABC])/);
        if (dateShiftMatch) {
            const day = dateShiftMatch[1];
            const month = dateShiftMatch[2];
            const year = dateShiftMatch[3];
            const shift = dateShiftMatch[4];

            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthIndex = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase()) + 1;
            const formattedDate = `${year}-${monthIndex.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;

            setSelectedDate(formattedDate);
            setSelectedShift(shift);
        }

        setCurrentEditingReport(report.name);
        setShowReportEditor(true);
        setActiveTab('edit-report');
        showAlert('success', 'Report loaded for editing');
    };

    const deleteSavedReport = (index: number) => {
        showConfirm({
            title: 'Delete Report',
            message: 'Are you sure you want to delete this report? This action cannot be undone.',
            type: 'warning',
            confirmText: 'Delete',
            onConfirm: () => {
                const savedReports = getSavedReports();
                const updatedReports = savedReports.filter((_, i) => i !== index);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedReports));
                showAlert('info', 'Report deleted successfully');
            }
        });
    };

    // Analysis functions
    const analyzeReport = async () => {
        if (!monthYear) {
            showAlert('error', 'Please select a month and year');
            return;
        }

        if (!stringer) {
            showAlert('error', 'Please select a stringer');
            return;
        }

        if (!cellFace) {
            showAlert('error', 'Please select cell face');
            return;
        }

        const [year, month] = monthYear.split('-');
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthName = monthNames[parseInt(month) - 1];

        setShowChart(true);

        try {
            const graphData = await fetchGraphData(monthName, parseInt(year), parseInt(stringer), cellFace);
            if (graphData && graphData.data && graphData.data.length > 0) {
                showAlert('success', 'Analysis completed successfully');
            } else {
                showAlert('warning', 'No data available for the selected criteria');
            }
        } catch (error) {
            console.error('Error analyzing report:', error);
            showAlert('error', 'Failed to fetch analysis data');
        }
    };

    const fetchGraphData = async (month: string, year: number, stringer: number, cellFace: string) => {
        try {
            const response = await fetch(
                `${PEEL_API_BASE_URL}/graph-data?month=${month}&year=${year}&stringer=${stringer}&cell_face=${cellFace}`
            );
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching graph data:', error);
            throw error;
        }
    };

    // Save report function
    const saveReport = () => {
        if (!currentEditingReport) {
            showAlert('error', 'Please load or create a report first');
            return;
        }

        const reportData: ReportData = {
            name: currentEditingReport,
            timestamp: new Date().toISOString(),
            formData: { ...formData },
            rowData: []
        };

        const savedReports = getSavedReports();
        const existingIndex = savedReports.findIndex(report => report.name === currentEditingReport);

        if (existingIndex !== -1) {
            savedReports[existingIndex] = reportData;
        } else {
            savedReports.push(reportData);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReports));
        setHasUnsavedChanges(false);
        showAlert('success', 'Report saved successfully!');
    };

    // Export functions (simplified)
    const exportToPDF = () => {
        showAlert('info', 'PDF export functionality would be implemented here');
    };

    const exportToExcel = () => {
        showAlert('info', 'Excel export functionality would be implemented here');
    };

    const exportPreviewToPDF = () => {
        showAlert('info', 'Preview PDF export functionality would be implemented here');
    };

    const exportPreviewToExcel = () => {
        showAlert('info', 'Preview Excel export functionality would be implemented here');
    };

    // Render components
    const renderEditReportTab = () => (
        <div className="">
            {/* Date Selection */}
            <div className="date-selector bg-gray-50 p-2 mb-2 rounded-lg border border-gray-200">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-center flex-wrap">
                    <label htmlFor="date-select" className="font-semibold text-gray-700">
                        Select Date:
                    </label>
                    <input
                        type="date"
                        id="date-select"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] focus:outline-none focus:ring-2 focus:ring-[#667eea] hover:-translate-y-0.5"
                    />
                    <label htmlFor="shift-select" className="font-semibold text-gray-700">
                        Select Shift:
                    </label>
                    <select
                        id="shift-select"
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value)}
                        className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] focus:outline-none focus:ring-2 focus:ring-[#667eea] hover:-translate-y-0.5"
                    >
                        <option value="">-- Select Shift --</option>
                        <option value="A">Shift-A</option>
                        <option value="B">Shift-B</option>
                        <option value="C">Shift-C</option>
                    </select>
                    <button
                        onClick={loadOrCreateReport}
                        className="bg-gradient-to-r from-[#8298f9] to-[#ceaaf2] border-transparent text-black rounded-lg px-5 py-2 text-sm font-semibold cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                        Load / Create Report
                    </button>
                </div>
            </div>

            {/* Report Info Display */}
            {showReportEditor && currentEditingReport && (
                <div className="report-info bg-white p-4 rounded-lg border border-gray-200">
                    <div className="save-actions flex items-center justify-between">
                        <p className="current-report-title text-red-600 font-bold bg-white rounded px-3 py-2">
                            Currently editing: <span>{currentEditingReport}</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={saveReport}
                                className="save-btn px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                            >
                                Save Report
                            </button>
                            <button
                                onClick={exportToExcel}
                                className="export-excel px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                Export as Excel
                            </button>
                            <button
                                onClick={exportToPDF}
                                className="export-pdf px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            >
                                Export as PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Editor */}
            {showReportEditor && (
                <div className="report-editor bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="test-report-container p-6">
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
                                <tr>
                                    <td className="border border-gray-300 p-2">{selectedDate}</td>
                                    <td className="border border-gray-300 p-2">{selectedShift}</td>
                                    <td className="border border-gray-300 p-2">
                                        <input
                                            type="text"
                                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Stringer"
                                            onChange={(e) => setFormData(prev => ({ ...prev, stringer: e.target.value }))}
                                        />
                                    </td>
                                    <td className="border border-gray-300 p-2">
                                        <input
                                            type="text"
                                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Unit"
                                            onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                                        />
                                    </td>
                                    <td className="border border-gray-300 p-2">
                                        <input
                                            type="text"
                                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="PO"
                                            onChange={(e) => setFormData(prev => ({ ...prev, po: e.target.value }))}
                                        />
                                    </td>
                                    <td className="border border-gray-300 p-2">
                                        <input
                                            type="text"
                                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Cell Vendor"
                                            onChange={(e) => setFormData(prev => ({ ...prev, cellVendor: e.target.value }))}
                                        />
                                    </td>
                                    {/* More cells would be generated dynamically */}
                                    <td colSpan={8} className="border border-gray-300 p-2 text-center text-gray-500">
                                        Data cells would be generated here
                                    </td>
                                    <td className="border border-gray-300 p-2"></td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Footer Signatures */}
                        <div className="footer flex justify-between mt-8 pt-4 border-t border-gray-300">
                            <div className="signature flex-1 text-center">
                                <p><strong>PREPARED BY :</strong></p>
                                <input
                                    type="text"
                                    className="w-3/4 border-b border-gray-400 focus:outline-none focus:border-blue-500 text-center"
                                    placeholder="Name"
                                    onChange={(e) => setFormData(prev => ({ ...prev, preparedBy: e.target.value }))}
                                />
                            </div>
                            <div className="signature flex-1 text-center">
                                <p><strong>ACCEPTED BY :</strong></p>
                                <input
                                    type="text"
                                    className="w-3/4 border-b border-gray-400 focus:outline-none focus:border-blue-500 text-center"
                                    placeholder="Name"
                                    onChange={(e) => setFormData(prev => ({ ...prev, acceptedBy: e.target.value }))}
                                />
                            </div>
                            <div className="signature flex-1 text-center">
                                <p><strong>VERIFIED BY :</strong></p>
                                <input
                                    type="text"
                                    className="w-3/4 border-b border-gray-400 focus:outline-none focus:border-blue-500 text-center"
                                    placeholder="Name"
                                    onChange={(e) => setFormData(prev => ({ ...prev, verifiedBy: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderSavedReportsTab = () => {
        const savedReports = getSavedReports();

        return (
            <div className="saved-reports-container bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-2xl text-center font-bold text-gray-800 mb-2">Saved Reports</h2>

                <div className="saved-reports-list space-y-4">
                    {savedReports.length === 0 ? (
                        <div className="no-reports-message text-center py-8 text-gray-500">
                            No saved reports found. Create and save a report first.
                        </div>
                    ) : (
                        savedReports.map((report, index) => (
                            <div key={index} className="saved-report-item border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center">
                                    <div className="saved-report-info">
                                        <h3 className="font-bold text-gray-800">{report.name}</h3>
                                        <p className="text-sm mt-1 text-gray-600">
                                            Saved on: {new Date(report.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="saved-report-actions flex space-x-2">
                                        <button
                                            onClick={() => previewSavedReport(index)}
                                            className="action-btn cursor-pointer px-4 py-2 bg-blue-500 text-white text-sm rounded-md font-medium transition-colors hover:bg-blue-600"
                                        >
                                            Preview
                                        </button>
                                        <button
                                            onClick={() => editSavedReport(index)}
                                            className="action-btn edit-btn cursor-pointer px-4 py-2 bg-green-500 text-white text-sm rounded-md font-medium transition-colors hover:bg-green-600"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => deleteSavedReport(index)}
                                            className="action-btn delete-report cursor-pointer px-4 py-2 bg-red-500 text-white text-sm rounded-md font-medium transition-colors hover:bg-red-600"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    const renderReportAnalysisTab = () => (
        <div className="report-analysis-container bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-center flex-wrap mb-4">
                <label htmlFor="monthYear" className="font-semibold text-gray-700">
                    Month & Year:
                </label>
                <input
                    type="month"
                    id="monthYear"
                    value={monthYear}
                    onChange={(e) => setMonthYear(e.target.value)}
                    className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] focus:outline-none focus:ring-2 focus:ring-[#667eea] hover:-translate-y-0.5"
                />
                <label htmlFor="stringer-select" className="font-semibold text-gray-700">
                    Stringer:
                </label>
                <input
                    type="number"
                    id="stringer-select"
                    value={stringer}
                    onChange={(e) => setStringer(e.target.value)}
                    min="1"
                    max="12"
                    className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] focus:outline-none focus:ring-2 focus:ring-[#667eea] hover:-translate-y-0.5"
                />
                <label htmlFor="face-select" className="font-semibold text-gray-700">
                    Cell Face:
                </label>
                <select
                    id="face-select"
                    value={cellFace}
                    onChange={(e) => setCellFace(e.target.value)}
                    className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] focus:outline-none focus:ring-2 focus:ring-[#667eea] hover:-translate-y-0.5"
                >
                    <option value="">-- Select --</option>
                    <option value="front">Front</option>
                    <option value="back">Back</option>
                    <option value="both">Front + Back</option>
                </select>
                <button
                    onClick={analyzeReport}
                    className="bg-gradient-to-r from-[#8298f9] to-[#ceaaf2] border-transparent text-black rounded-lg px-5 py-2 text-sm font-semibold cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                    Analyze
                </button>
            </div>

            {/* Chart Area */}
            <div className={`chart-container bg-white rounded-lg p-4 ${showChart ? 'block' : 'hidden'}`}>
                <div className="chart-wrapper h-96">
                    <canvas ref={chartRef} id="peel-strength-chart" className="w-full h-full"></canvas>
                </div>
                {!showChart && (
                    <div className="no-data-message text-center py-8 text-gray-500">
                        No data available for the selected criteria. Please try different parameters.
                    </div>
                )}
            </div>
        </div >
    );

    const renderPreviewModal = () => {
        if (!showPreviewModal) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
                    <div className="preview-header flex justify-between items-center p-4 border-b border-gray-200">
                        <div className="preview-title text-xl font-bold text-gray-800">
                            Preview: {previewReport?.name || 'Report'}
                        </div>
                        <div className="preview-buttons flex gap-2">
                            <button
                                onClick={exportPreviewToExcel}
                                className="preview-export-excel px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                                Export as Excel
                            </button>
                            <button
                                onClick={exportPreviewToPDF}
                                className="preview-export-pdf px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            >
                                Export as PDF
                            </button>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="close-preview w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 text-xl font-bold"
                            >
                                &times;
                            </button>
                        </div>
                    </div>

                    <div className="preview-report overflow-auto p-4 max-h-[calc(90vh-80px)]">
                        {previewReport ? (
                            <div className="test-report-container">
                                <div className="bg-white p-6 border border-gray-300">
                                    <h3 className="text-lg font-bold mb-4">{previewReport.name}</h3>
                                    <p className="text-gray-600">Preview content would be displayed here with all report data.</p>
                                    <div className="mt-4 p-4 bg-gray-50 rounded">
                                        <pre className="text-sm">{JSON.stringify(previewReport.formData, null, 2)}</pre>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-8">No report selected for preview</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="pb-4">
            <Header />
            <div className="max-w-7xl mx-auto">
                <div className="text-center text-white mb-6">
                    <button onClick={handleBackToTests}
                        className="bg-white/20 text-white border-2 border-white px-4 py-1 rounded-3xl cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-x-1"
                    >
                        <span className="font-bold text-md">⇐</span> Back to Quality Tests
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="tab-container flex mx-4">
                    {[
                        { id: 'edit-report', label: 'Edit Report' },
                        { id: 'saved-reports', label: 'Saved Reports' },
                        { id: 'report-analysis', label: 'Report Analysis' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`tab ${activeTab === tab.id ? 'active bg-white text-[#667eea] border-b-[rgba(48,30,107,1)] border-b-2 translate-y--0.5' : 'bg-[rgba(255,255,255,0.2)] text-white border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                            onClick={() => setActiveTab(tab.id as TabType)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="tab-content my-2.5 mx-4">
                    {activeTab === 'edit-report' && renderEditReportTab()}
                    {activeTab === 'saved-reports' && renderSavedReportsTab()}
                    {activeTab === 'report-analysis' && renderReportAnalysisTab()}
                </div>
            </div>

            {/* Modals */}
            {renderPreviewModal()}
        </div>
    );
}