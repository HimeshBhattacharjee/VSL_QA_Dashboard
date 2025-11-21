import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import ZoomableChart from '../components/ZoomableChart';
import SavedReportsNChecksheets from '../components/SavedReportsNChecksheets';

interface ReportData {
    _id?: string;
    name: string;
    timestamp: string;
    formData: Record<string, string>;
    rowData: any[];
    averages?: {
        [key: string]: string;
    };
}

type TabType = 'edit-report' | 'saved-reports' | 'report-analysis';

type GraphData = {
    date: string;
    average_value: number;
    max_value: number;
    min_value: number;
};

const PEEL_API_BASE_URL = 'http://localhost:8000/peel';

export default function PeelTest() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('edit-report');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [currentEditingReport, setCurrentEditingReport] = useState<string | null>(null);
    const [savedReports, setSavedReports] = useState<ReportData[]>([]);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();

    // Edit Report Tab States
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedShift, setSelectedShift] = useState('');
    const [showReportEditor, setShowReportEditor] = useState(false);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [tableData, setTableData] = useState<Record<string, string>>({});

    // Analysis Tab States
    const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7));
    const [stringer, setStringer] = useState('1');
    const [cellFace, setCellFace] = useState('');
    const [showChart, setShowChart] = useState(false);
    const [graphData, setGraphData] = useState<GraphData[]>([]);

    // Initialize with today's date and load saved state
    useEffect(() => {
        initializeForm();
        loadSavedReports();
        loadFormData();

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    const apiService = {
        // Get all reports
        getAllReports: async (): Promise<ReportData[]> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch reports: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        // Get report by ID
        getReportById: async (id: string): Promise<ReportData> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/${id}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch report: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        // Create new report
        createReport: async (report: Omit<ReportData, '_id'>): Promise<ReportData> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(report),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create report: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        // Update existing report
        updateReport: async (id: string, report: Omit<ReportData, '_id'>): Promise<ReportData> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(report),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update report: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        // Delete report
        deleteReport: async (id: string): Promise<void> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete report: ${response.status} ${errorText}`);
            }
        },

        // Check if report name exists
        checkReportNameExists: async (name: string, excludeId?: string): Promise<boolean> => {
            const url = `${PEEL_API_BASE_URL}/peel-test-reports/name/${encodeURIComponent(name)}${excludeId ? `?excludeId=${excludeId}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to check report name: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            return result.exists;
        },
    };

    const initializeForm = () => {
        // Check if we have editing report data from session storage
        const editingReportData = sessionStorage.getItem('editingPeelReportData');
        const editingIndex = sessionStorage.getItem('editingPeelReportIndex');

        if (editingReportData && editingIndex !== null) {
            setTimeout(() => {
                const report = JSON.parse(editingReportData) as ReportData;
                loadReportForEditing(report);
                setShowReportEditor(true);
                setHasUnsavedChanges(true);
            }, 100);
        }
    };

    const loadFormData = () => {
        const savedData = sessionStorage.getItem('peelTestFormData');
        if (savedData) {
            const formData = JSON.parse(savedData);

            if (formData.selectedDate) {
                setSelectedDate(formData.selectedDate);
            }
            if (formData.selectedShift) {
                setSelectedShift(formData.selectedShift);
            }
            if (formData.currentEditingReport) {
                setCurrentEditingReport(formData.currentEditingReport);
            }
            if (formData.activeTab) {
                setActiveTab(formData.activeTab);
            }
            if (formData.tableData) {
                setTableData(formData.tableData);
            }
            if (formData.formData) {
                setFormData(formData.formData);
            }
            if (formData.showReportEditor) {
                setShowReportEditor(true);
            }

            if (Object.keys(formData.tableData || {}).length > 0 || Object.keys(formData.formData || {}).length > 0) {
                setHasUnsavedChanges(true);
            }
        }
    };

    const saveFormData = () => {
        const formDataToSave = {
            selectedDate,
            selectedShift,
            currentEditingReport,
            activeTab,
            tableData,
            formData,
            showReportEditor,
            timestamp: new Date().toISOString()
        };
        sessionStorage.setItem('peelTestFormData', JSON.stringify(formDataToSave));
    };

    // Save form data whenever relevant states change
    useEffect(() => {
        saveFormData();
    }, [selectedDate, selectedShift, currentEditingReport, activeTab, tableData, formData, showReportEditor]);

    // Navigation functions with state persistence
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
        setTableData({});
        setShowReportEditor(false);
        setSelectedDate(new Date().toISOString().split('T')[0]);
        setSelectedShift('');

        sessionStorage.removeItem('editingPeelReportIndex');
        sessionStorage.removeItem('editingPeelReportData');
        sessionStorage.removeItem('peelTestFormData');
    };

    const getSavedReports = async (): Promise<ReportData[]> => {
        try {
            return await apiService.getAllReports();
        } catch (error) {
            console.error('Error fetching saved reports:', error);
            showAlert('error', 'Failed to load saved reports');
            return [];
        }
    };

    const loadSavedReports = async () => {
        try {
            const reports = await getSavedReports();
            setSavedReports(reports); // Set the state here
        } catch (error) {
            console.error('Error loading reports:', error);
        }
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
        const savedReports = await getSavedReports(); // Add await here
        const existingLocalReport = savedReports.find(report => report.name === reportName);

        if (existingLocalReport) {
            loadReportForEditing(existingLocalReport);
            showAlert('success', 'Loaded locally saved report');
        } else {
            try {
                const mongoData = await fetchPeelData(selectedDate, selectedShift);
                if (mongoData && mongoData.length > 0) {
                    createReportFromMongoData(reportName, mongoData);
                    showAlert('success', 'Report created from database data');
                } else {
                    createNewReport(reportName);
                    showAlert('info', 'No data found in database. Created blank report');
                }
            } catch (error) {
                createNewReport(reportName);
                showAlert('info', 'Created blank report');
            }
        }

        setShowReportEditor(true);
        setHasUnsavedChanges(true);
    };

    const loadReportForEditing = (report: ReportData) => {
        // Extract signature fields from formData
        const signatureFields: Record<string, string> = {};
        Object.keys(report.formData).forEach(key => {
            if (key === 'preparedBy' || key === 'verifiedBy') {
                signatureFields[key] = report.formData[key];
            }
        });

        // Set both table data and form data (for signatures)
        setTableData(report.formData);
        setFormData(signatureFields);
        setCurrentEditingReport(report.name);
        setHasUnsavedChanges(true);

        // Save to session storage for persistence
        sessionStorage.setItem('editingPeelReportData', JSON.stringify(report));
        sessionStorage.setItem('editingPeelReportId', report._id!);
    };

    const createReportFromMongoData = (reportName: string, mongoData: any[]) => {
        const newFormData: Record<string, string> = {};

        mongoData.forEach((record, repIndex) => {
            if (repIndex >= 24) return;

            // Set basic information
            newFormData[`row_${repIndex}_cell_0`] = record.Date || '';
            newFormData[`row_${repIndex}_cell_1`] = record.Shift || '';
            newFormData[`row_${repIndex}_cell_2`] = record.Stringer?.toString() || '';
            newFormData[`row_${repIndex}_cell_3`] = record.Unit || '';
            newFormData[`row_${repIndex}_cell_4`] = record.PO || '';
            newFormData[`row_${repIndex}_cell_5`] = record.Cell_Vendor || record['Cell Vendor'] || '';

            // Front side data
            for (let position = 1; position <= 16; position++) {
                for (let ribbon = 1; ribbon <= 7; ribbon++) {
                    const key = `Front_${position}_${ribbon}`;
                    if (record[key] !== undefined) {
                        const cellIndex = 6 + (position - 1) * 7 + (ribbon - 1);
                        newFormData[`row_${repIndex}_cell_${cellIndex}`] = record[key]?.toString() || '';
                    }
                }
            }

            // Back side data
            for (let position = 1; position <= 16; position++) {
                for (let ribbon = 1; ribbon <= 7; ribbon++) {
                    const key = `Back_${position}_${ribbon}`;
                    if (record[key] !== undefined) {
                        const cellIndex = 118 + (position - 1) * 7 + (ribbon - 1);
                        newFormData[`row_${repIndex}_cell_${cellIndex}`] = record[key]?.toString() || '';
                    }
                }
            }
        });

        // Extract signature fields if they exist in the first record
        if (mongoData[0]) {
            if (mongoData[0].preparedBy) {
                newFormData['preparedBy'] = mongoData[0].preparedBy;
            }
            if (mongoData[0].verifiedBy) {
                newFormData['verifiedBy'] = mongoData[0].verifiedBy;
            }
        }

        setTableData(newFormData);

        // Set signature fields in formData
        const signatureFields: Record<string, string> = {};
        if (newFormData['preparedBy']) signatureFields['preparedBy'] = newFormData['preparedBy'];
        if (newFormData['verifiedBy']) signatureFields['verifiedBy'] = newFormData['verifiedBy'];
        setFormData(signatureFields);

        setCurrentEditingReport(reportName);
        setHasUnsavedChanges(true);
    };

    const createNewReport = (reportName: string) => {
        setTableData({});
        setCurrentEditingReport(reportName);
        setHasUnsavedChanges(true);
    };

    const handleCellChange = (rowIndex: number, cellIndex: number, value: string) => {
        const cellId = `row_${rowIndex}_cell_${cellIndex}`;
        setTableData(prev => ({
            ...prev,
            [cellId]: value
        }));
        setHasUnsavedChanges(true);
    };

    const handleSignatureChange = (type: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [type]: value
        }));
        setHasUnsavedChanges(true);
    };

    // Calculate averages for a specific row and position
    const calculateAverage = (rowIndex: number, startCell: number, count: number): string => {
        let sum = 0;
        let validCount = 0;

        for (let i = 0; i < count; i++) {
            const cellId = `row_${rowIndex}_cell_${startCell + i}`;
            const value = tableData[cellId];
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

    const editSavedReport = async (index: number) => {
        try {
            const reports = await apiService.getAllReports();
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }

            const report = reports[index];

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

            loadReportForEditing(report);
            setShowReportEditor(true);
            setActiveTab('edit-report');
            showAlert('success', 'Report loaded for editing');
        } catch (error) {
            console.error('Error loading report:', error);
            showAlert('error', 'Failed to load report');
        }
    };

    // Update the deleteSavedReport function
    const deleteSavedReport = async (index: number) => {
        try {
            const reports = await apiService.getAllReports();
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }

            const report = reports[index];
            await apiService.deleteReport(report._id!);
            await loadSavedReports();
            showAlert('info', 'Report deleted successfully');
        } catch (error) {
            console.error('Error deleting report:', error);
            showAlert('error', 'Failed to delete report');
        }
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
                setGraphData(graphData.data);
                showAlert('success', 'Analysis completed successfully');
            } else {
                setGraphData([]);
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

    const getCellFaceDisplayName = (cellFace: string) => {
        switch (cellFace) {
            case 'front': return 'Front';
            case 'back': return 'Back';
            case 'both': return 'Front + Back';
            default: return cellFace;
        }
    };

    const saveReport = async () => {
        if (!currentEditingReport) {
            showAlert('error', 'Please load or create a report first');
            return;
        }

        // Calculate and save averages
        const averages: { [key: string]: string } = {};

        // Calculate averages for all repetitions
        for (let rep = 0; rep < 24; rep++) {
            // Front section averages
            for (let position = 1; position <= 16; position++) {
                const startCell = 6 + (position - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);
                averages[`front_avg_${rep}_${position}`] = average;
            }

            // Back section averages  
            for (let position = 1; position <= 16; position++) {
                const startCell = 118 + (position - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);
                averages[`back_avg_${rep}_${position}`] = average;
            }
        }

        const reportData: Omit<ReportData, '_id'> = {
            name: currentEditingReport,
            timestamp: new Date().toISOString(),
            formData: { ...tableData, ...formData, ...averages },
            rowData: [],
            averages: averages
        };

        const editingId = sessionStorage.getItem('editingPeelReportId');

        try {
            if (editingId) {
                // Editing existing report
                const existingReport = await apiService.getReportById(editingId);

                if (currentEditingReport === existingReport.name) {
                    // Same name, update the report
                    await apiService.updateReport(editingId, reportData);
                    showAlert('success', 'Report updated successfully!');
                } else {
                    // Different name, check if name already exists
                    const nameExists = await apiService.checkReportNameExists(currentEditingReport, editingId);

                    if (nameExists) {
                        showConfirm({
                            title: 'Report Name Exists',
                            message: `A report named "${currentEditingReport}" already exists. Do you want to replace it?`,
                            type: 'warning',
                            confirmText: 'Replace',
                            cancelText: 'Cancel',
                            onConfirm: async () => {
                                // Find the existing report with this name and update it
                                const allReports = await apiService.getAllReports();
                                const existingReportWithSameName = allReports.find(report => report.name === currentEditingReport);

                                if (existingReportWithSameName) {
                                    await apiService.updateReport(existingReportWithSameName._id!, reportData);
                                    showAlert('success', 'Report updated successfully!');
                                } else {
                                    await apiService.createReport(reportData);
                                    showAlert('success', 'New report created successfully!');
                                }

                                sessionStorage.removeItem('editingPeelReportId');
                                sessionStorage.removeItem('editingPeelReportData');
                                clearFormData();
                                loadSavedReports();
                                setActiveTab('saved-reports');
                            }
                        });
                        return;
                    } else {
                        // Name doesn't exist, create new report
                        await apiService.createReport(reportData);
                        showAlert('success', 'New report created with updated name!');
                    }
                }

                sessionStorage.removeItem('editingPeelReportId');
                sessionStorage.removeItem('editingPeelReportData');
            } else {
                // Creating new report
                const nameExists = await apiService.checkReportNameExists(currentEditingReport);

                if (nameExists) {
                    showConfirm({
                        title: 'Report Name Exists',
                        message: `A report named "${currentEditingReport}" already exists. Do you want to replace it?`,
                        type: 'warning',
                        confirmText: 'Replace',
                        cancelText: 'Cancel',
                        onConfirm: async () => {
                            // Find the existing report with this name and update it
                            const allReports = await apiService.getAllReports();
                            const existingReport = allReports.find(report => report.name === currentEditingReport);

                            if (existingReport) {
                                await apiService.updateReport(existingReport._id!, reportData);
                                showAlert('success', 'Report updated successfully!');
                            } else {
                                await apiService.createReport(reportData);
                                showAlert('success', 'New report created successfully!');
                            }

                            clearFormData();
                            loadSavedReports();
                            setActiveTab('saved-reports');
                        }
                    });
                    return;
                } else {
                    // Name doesn't exist, create new report
                    await apiService.createReport(reportData);
                    showAlert('success', 'Report saved successfully!');
                }
            }

            clearFormData();
            loadSavedReports();
            setActiveTab('saved-reports');
        } catch (error) {
            console.error('Error saving report:', error);
            showAlert('error', 'Failed to save report');
        }
    };

    const exportToExcel = async () => {
        try {
            if (!currentEditingReport) {
                showAlert('error', 'Please load or create a report first');
                return;
            }

            const averages: { [key: string]: string } = {};
            for (let rep = 0; rep < 24; rep++) {
                for (let position = 1; position <= 16; position++) {
                    const frontStartCell = 6 + (position - 1) * 7;
                    averages[`front_avg_${rep}_${position}`] = calculateAverage(rep, frontStartCell, 7);

                    const backStartCell = 118 + (position - 1) * 7;
                    averages[`back_avg_${rep}_${position}`] = calculateAverage(rep, backStartCell, 7);
                }
            }

            const peelReportData = {
                report_name: currentEditingReport,
                timestamp: new Date().toISOString(),
                form_data: { ...tableData, ...formData, ...averages }, // Include averages
                averages: averages
            };

            console.log(peelReportData);

            const response = await fetch('http://localhost:8000/generate-peel-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(peelReportData),
            });

            if (!response.ok) {
                throw new Error('Failed to generate report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentEditingReport}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('success', 'Excel file exported successfully');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showAlert('error', 'Failed to export Excel file');
        }
    };

    const exportToPDF = async () => {
        try {
            showAlert('info', 'Please wait! Exporting PDF will take some time...');
            if (!currentEditingReport) {
                showAlert('error', 'Please load or create a report first');
                return;
            }

            const averages: { [key: string]: string } = {};
            for (let rep = 0; rep < 24; rep++) {
                for (let position = 1; position <= 16; position++) {
                    const frontStartCell = 6 + (position - 1) * 7;
                    averages[`front_avg_${rep}_${position}`] = calculateAverage(rep, frontStartCell, 7);

                    const backStartCell = 118 + (position - 1) * 7;
                    averages[`back_avg_${rep}_${position}`] = calculateAverage(rep, backStartCell, 7);
                }
            }

            const peelReportData = {
                report_name: currentEditingReport,
                timestamp: new Date().toISOString(),
                form_data: { ...tableData, ...formData, ...averages }, // Include averages
                averages: averages
            };

            console.log(peelReportData);

            const response = await fetch('http://localhost:8000/generate-peel-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(peelReportData),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to generate PDF: ${errorText}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentEditingReport}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('success', 'PDF file exported successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            showAlert('error', 'Failed to generate PDF file');
        }
    };

    const exportSavedReportToExcel = async (index: number) => {
        try {
            const reports = await getSavedReports(); // Add await here
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }

            const report = reports[index];

            const peelReportData = {
                report_name: report.name,
                timestamp: report.timestamp,
                form_data: report.formData,
                averages: report.averages || {}
            };

            const response = await fetch('http://localhost:8000/generate-peel-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(peelReportData),
            });

            if (!response.ok) {
                throw new Error('Failed to generate report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${report.name}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('success', 'Excel file exported successfully');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showAlert('error', 'Failed to export Excel file');
        }
    };

    const exportSavedReportToPDF = async (index: number) => {
        try {
            showAlert('info', 'Please wait! Exporting PDF will take some time...');
            const reports = await getSavedReports(); // Add await here
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }

            const report = reports[index];

            const peelReportData = {
                report_name: report.name,
                timestamp: report.timestamp,
                form_data: report.formData,
                averages: report.averages || {}
            };

            const response = await fetch('http://localhost:8000/generate-peel-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(peelReportData),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to generate PDF: ${errorText}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${report.name}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('success', 'PDF file exported successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            showAlert('error', 'Failed to generate PDF file');
        }
    };

    // Generate table rows
    const generateTableRows = () => {
        const rows = [];
        const repetitions = 24;

        for (let rep = 0; rep < repetitions; rep++) {
            // Front section header
            rows.push(
                <tr key={`front-header-${rep}`}>
                    <td rowSpan={34} className="border border-gray-300 p-1 editable rowspan-cell">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                            value={tableData[`row_${rep}_cell_0`] || ''}
                            onChange={(e) => handleCellChange(rep, 0, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 p-1 editable rowspan-cell">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                            value={tableData[`row_${rep}_cell_1`] || ''}
                            onChange={(e) => handleCellChange(rep, 1, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 p-1 editable rowspan-cell">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                            value={tableData[`row_${rep}_cell_2`] || ''}
                            onChange={(e) => handleCellChange(rep, 2, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 p-1 editable rowspan-cell">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                            value={tableData[`row_${rep}_cell_3`] || ''}
                            onChange={(e) => handleCellChange(rep, 3, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 p-1 editable rowspan-cell">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                            value={tableData[`row_${rep}_cell_4`] || ''}
                            onChange={(e) => handleCellChange(rep, 4, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 p-1 editable rowspan-cell">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                            value={tableData[`row_${rep}_cell_5`] || ''}
                            onChange={(e) => handleCellChange(rep, 5, e.target.value)}
                        />
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

            // Front data rows
            for (let i = 1; i <= 16; i++) {
                const startCell = 6 + (i - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);

                rows.push(
                    <tr key={`front-data-${rep}-${i}`}>
                        <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">{i}</td>
                        {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                            const cellIndex = startCell + offset;
                            const value = tableData[`row_${rep}_cell_${cellIndex}`] || '';
                            const isHighlighted = shouldHighlightCell(value);

                            return (
                                <td
                                    key={`front-${rep}-${i}-${offset}`}
                                    className={`border border-gray-300 p-1 ${isHighlighted ? 'bg-red-200' : ''}`}
                                >
                                    <input
                                        type="text"
                                        className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                                        value={value}
                                        onChange={(e) => handleCellChange(rep, cellIndex, e.target.value)}
                                    />
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
            rows.push(
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

            // Back data rows
            for (let i = 1; i <= 16; i++) {
                const startCell = 118 + (i - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);

                rows.push(
                    <tr key={`back-data-${rep}-${i}`}>
                        <td className="border border-gray-300 p-1 font-semibold bg-gray-100 text-center">{i}</td>
                        {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                            const cellIndex = startCell + offset;
                            const value = tableData[`row_${rep}_cell_${cellIndex}`] || '';
                            const isHighlighted = shouldHighlightCell(value);

                            return (
                                <td
                                    key={`back-${rep}-${i}-${offset}`}
                                    className={`border border-gray-300 p-1 ${isHighlighted ? 'bg-red-200' : ''}`}
                                >
                                    <input
                                        type="text"
                                        className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                                        value={value}
                                        onChange={(e) => handleCellChange(rep, cellIndex, e.target.value)}
                                    />
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

        return rows;
    };

    // Render components
    const renderEditReportTab = () => (
        <div className="">
            {/* Date Selection */}
            <div className="date-selector bg-gray-50 p-2 rounded-lg border border-gray-200">
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
                <div className="report-info p-2 rounded-lg">
                    <div className="save-actions flex items-center justify-center gap-2">
                        <p className="current-report-title text-red-600 font-bold bg-white rounded p-2">
                            Currently editing: <span>{currentEditingReport}</span>
                        </p>
                        <button
                            className="save-btn w-[15%] p-2.5 rounded-md border-b-white border-b-2 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-[rgb(76,0,198,0.5))] text-white text-sm hover:bg-white hover:text-black hover:transform hover:-translate-y-1 hover:shadow-lg"
                            onClick={saveReport}
                        >
                            Save Report
                        </button>
                        <button
                            className="export-excel w-[15%] p-2.5 rounded-md border-b-white border-b-2 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-[#27ae60] text-white text-sm hover:bg-white hover:text-black hover:transform hover:-translate-y-1 hover:shadow-lg"
                            onClick={exportToExcel}
                        >
                            Export as Excel
                        </button>
                        <button
                            className="export-pdf w-[15%] p-2.5 rounded-md border-b-white border-b-2 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-[#e74c3c] text-white text-sm hover:bg-white hover:text-black hover:transform hover:-translate-y-1 hover:shadow-lg"
                            onClick={exportToPDF}
                        >
                            Export as PDF
                        </button>
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
                                {generateTableRows()}
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
                                    value={formData.preparedBy || ''}
                                    onChange={(e) => handleSignatureChange('preparedBy', e.target.value)}
                                />
                            </div>
                            <div className="signature flex-1 text-center">
                                <p><strong>VERIFIED BY :</strong></p>
                                <input
                                    type="text"
                                    className="w-3/4 border-b border-gray-400 focus:outline-none focus:border-blue-500 text-center"
                                    placeholder="Name"
                                    value={formData.verifiedBy || ''}
                                    onChange={(e) => handleSignatureChange('verifiedBy', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderSavedReportsTab = () => (
        <SavedReportsNChecksheets
            reports={savedReports}
            onExportExcel={exportSavedReportToExcel}
            onExportPdf={exportSavedReportToPDF}
            onEdit={editSavedReport}
            onDelete={deleteSavedReport}
        />
    );

    const renderReportAnalysisTab = () => (
        <div className="report-analysis-container bg-white rounded-lg border border-gray-200 p-2">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-center flex-wrap">
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
            {showChart && graphData.length > 0 && (
                <div className="chart-container bg-white rounded-lg p-2">
                    <ZoomableChart
                        chartData={prepareChartData()}
                        options={prepareChartOptions()}
                        type="line"
                    />
                </div>
            )}
            {showChart && graphData.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    No data available for the selected criteria. Please try different parameters.
                </div>
            )}
        </div>
    );

    const prepareChartData = () => {
        const labels = graphData.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('en-GB');
        });

        const dataPoints = graphData.map(item => item.average_value);
        const maxValues = graphData.map(item => item.max_value);
        const minValues = graphData.map(item => item.min_value);

        return {
            labels,
            datasets: [
                {
                    label: `Average Peel Strength (N/mm)`,
                    data: dataPoints,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: `Maximum Value (N/mm)`,
                    data: maxValues,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    pointRadius: 3,
                    tension: 0.4
                },
                {
                    label: `Minimum Value (N/mm)`,
                    data: minValues,
                    borderColor: '#ddb505',
                    backgroundColor: 'rgba(255, 250, 0, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    pointRadius: 3,
                    tension: 0.4
                },
                {
                    label: 'Minimum Requirement (1.0 N/mm)',
                    data: Array(labels.length).fill(1.0),
                    borderColor: '#ff4444',
                    backgroundColor: 'rgba(255, 68, 68, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    tension: 0
                }
            ]
        };
    };

    const prepareChartOptions = () => {
        const [year, month] = monthYear.split('-');
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthName = monthNames[parseInt(month) - 1];

        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Peel Strength Analysis - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}, Stringer ${stringer}, ${getCellFaceDisplayName(cellFace)}`,
                    font: {
                        size: 16,
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context: any) {
                            const datasetLabel = context.dataset.label || '';
                            const value = context.parsed.y;
                            if (datasetLabel.includes('Average')) {
                                return `Avg Strength: ${value} N/mm`;
                            } else if (datasetLabel.includes('Maximum')) {
                                return `Max Strength: ${value} N/mm`;
                            } else if (datasetLabel.includes('Minimum Value')) {
                                return `Min Strength: ${value} N/mm`;
                            } else if (datasetLabel.includes('Requirement')) {
                                return `Min Requirement: ${value} N/mm`;
                            }
                            return `${datasetLabel}: ${value} N/mm`;
                        }
                    }
                },
                legend: {
                    display: true
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Day of Month'
                    },
                    grid: {
                        display: true
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Peel Strength (N/mm)'
                    },
                    min: 0,
                    grid: {
                        display: true
                    },
                    ticks: {
                        callback: function (value: any) {
                            return value + ' N/mm';
                        }
                    }
                }
            },
            animation: {
                duration: 1000
            }
        };
    };

    return (
        <div className="pb-4">
            <Header />
            <div className="container">
                <div className="text-center text-white mb-6">
                    <button onClick={handleBackToTests}
                        className="bg-white/20 text-white border-2 border-white px-4 py-1 rounded-3xl cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-x-1"
                    >
                        <span className="font-bold text-md">⇐</span> Back to Quality Tests
                    </button>
                </div>

                <div className="flex justify-center mx-4">
                    <div
                        className={`tab ${activeTab === 'edit-report' ? 'active bg-white text-[#667eea] border-b-[rgba(48,30,107,1)] border-b-2 translate-y--0.5' : 'bg-[rgba(255,255,255,0.2)] text-white border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        onClick={() => setActiveTab('edit-report')}
                    >
                        Edit Report
                    </div>
                    <div
                        className={`tab ${activeTab === 'saved-reports' ? 'active bg-white text-[#667eea] border-b-[rgba(48,30,107,1)] border-b-2 translate-y--0.5' : 'bg-[rgba(255,255,255,0.2)] text-white border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        onClick={() => setActiveTab('saved-reports')}
                    >
                        Saved Reports
                    </div>
                    <div
                        className={`tab ${activeTab === 'report-analysis' ? 'active bg-white text-[#667eea] border-b-[rgba(48,30,107,1)] border-b-2 translate-y--0.5' : 'bg-[rgba(255,255,255,0.2)] text-white border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        onClick={() => setActiveTab('report-analysis')}
                    >
                        Report Analysis
                    </div>
                </div>
                {/* Tab Content */}
                <div className="tab-content mt-2 mx-4">
                    {activeTab === 'edit-report' && renderEditReportTab()}
                    {activeTab === 'saved-reports' && renderSavedReportsTab()}
                    {activeTab === 'report-analysis' && renderReportAnalysisTab()}
                </div>
            </div>
        </div >
    );
}