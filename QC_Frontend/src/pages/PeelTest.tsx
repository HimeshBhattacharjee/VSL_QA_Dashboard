import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    averages?: { [key: string]: string; };
}

type TabType = 'edit-report' | 'saved-reports' | 'report-analysis';

type GraphData = {
    date: string;
    average_value: number;
    max_value: number;
    min_value: number;
};

const PEEL_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/peel';

export default function PeelTest() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('edit-report');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [currentEditingReport, setCurrentEditingReport] = useState<string | null>(null);
    const [savedReports, setSavedReports] = useState<ReportData[]>([]);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();

    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedShift, setSelectedShift] = useState('');
    const [showReportEditor, setShowReportEditor] = useState(false);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [tableData, setTableData] = useState<Record<string, string>>({});
    const [preparedBySignature, setPreparedBySignature] = useState<string>('');
    const [verifiedBySignature, setVerifiedBySignature] = useState<string>('');
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);

    const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7));
    const [stringer, setStringer] = useState('1');
    const [cellFace, setCellFace] = useState('');
    const [showChart, setShowChart] = useState(false);
    const [graphData, setGraphData] = useState<GraphData[]>([]);

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

    useEffect(() => {
        const storedUserRole = sessionStorage.getItem('userRole');
        const storedUsername = sessionStorage.getItem('username');
        setUserRole(storedUserRole);
        setUsername(storedUsername);
    }, []);

    const apiService = {
        getAllReports: async (): Promise<ReportData[]> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch reports: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        getReportById: async (id: string): Promise<ReportData> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/${id}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        createReport: async (report: Omit<ReportData, '_id'>): Promise<ReportData> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        updateReport: async (id: string, report: Omit<ReportData, '_id'>): Promise<ReportData> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update report: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        deleteReport: async (id: string): Promise<void> => {
            const response = await fetch(`${PEEL_API_BASE_URL}/peel-test-reports/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete report: ${response.status} ${errorText}`);
            }
        },
        checkReportNameExists: async (name: string, excludeId?: string): Promise<boolean> => {
            const url = `${PEEL_API_BASE_URL}/peel-test-reports/name/${encodeURIComponent(name)}${excludeId ? `?exclude_id=${excludeId}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to check report name: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            return result.exists;
        },
    };

    const PEEL_SUPPRESS_KEY = 'suppressPeelAutoRestore';

    const extractDateShiftFromReport = (report: ReportData) => {
        try {
            if (report.formData?.selectedDate || report.formData?.selectedShift) {
                return {
                    date: (report.formData?.selectedDate as string) || '',
                    shift: (report.formData?.selectedShift as string) || ''
                };
            }
            const dateKey = Object.keys(report.formData).find(k => /^row_\d+_cell_0$/.test(k));
            const shiftKey = Object.keys(report.formData).find(k => /^row_\d+_cell_1$/.test(k));
            const dateVal = dateKey ? (report.formData[dateKey] as string) : '';
            const shiftVal = shiftKey ? (report.formData[shiftKey] as string) : '';
            if (dateVal || shiftVal) return { date: dateVal || '', shift: shiftVal || '' };
            const match = /Peel_Test_Report_(\d+)_([A-Za-z]+)_(\d+)_Shift_(\d+)/.exec(report.name);
            if (match) {
                const day = match[1];
                const monthName = match[2];
                const year = match[3];
                const shift = match[4];
                const parsedDate = new Date(`${monthName} ${day}, ${year}`);
                const isoDate = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString().split('T')[0] : '';
                return { date: isoDate, shift };
            }
            return { date: '', shift: '' };
        } catch (e) {
            console.error('Failed to extract date/shift from report', e);
            return { date: '', shift: '' };
        }
    };

    const initializeForm = () => {
        const editingReportData = sessionStorage.getItem('editingPeelReportData');
        if (editingReportData) {
            try {
                const report = JSON.parse(editingReportData) as ReportData;
                const { date, shift } = extractDateShiftFromReport(report);
                if (date) setSelectedDate(date);
                if (shift) setSelectedShift(shift);
                sessionStorage.setItem(PEEL_SUPPRESS_KEY, 'true');
                loadReportForEditing(report);
                setShowReportEditor(true);
                setHasUnsavedChanges(true);
            } catch (err) {
                console.error('Failed to initialize editing report', err);
            }
        }
    };

    const loadFormData = () => {
        const savedData = sessionStorage.getItem('peelTestFormData');
        const suppressRestore = sessionStorage.getItem(PEEL_SUPPRESS_KEY) === 'true';
        const editingReportData = sessionStorage.getItem('editingPeelReportData');
        if (savedData) {
            const formData = JSON.parse(savedData);
            if (!suppressRestore && !editingReportData) {
                if (formData.selectedDate) setSelectedDate(formData.selectedDate);
                if (formData.selectedShift) setSelectedShift(formData.selectedShift);
            }
            const editingActive = !!editingReportData;
            if (!editingActive) {
                if (formData.currentEditingReport) setCurrentEditingReport(formData.currentEditingReport);
                if (formData.activeTab) setActiveTab(formData.activeTab);
                if (formData.tableData) setTableData(formData.tableData);
                if (formData.formData) setFormData(formData.formData);
                if (formData.showReportEditor) setShowReportEditor(true);
            } else {
                if (formData.activeTab) setActiveTab(formData.activeTab);
            }
            if (!editingActive) {
                if (formData.preparedBySignature) setPreparedBySignature(formData.preparedBySignature);
                if (formData.verifiedBySignature) setVerifiedBySignature(formData.verifiedBySignature);
            }
            if (Object.keys(formData.tableData || {}).length > 0 || Object.keys(formData.formData || {}).length > 0) {
                setHasUnsavedChanges(true);
            }
        }
    };

    const handleAddSignature = (section: 'prepared' | 'verified') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }
        if (currentSignature.trim()) {
            showAlert('error', `Signature already exists in ${section} section. Please remove it first.`);
            return;
        }
        if (section === 'prepared' && userRole !== 'Operator') {
            showAlert('error', 'Only Operators can add signature to Prepared By section');
            return;
        }
        if (section === 'verified' && !['Supervisor', 'Manager'].includes(userRole || '')) {
            showAlert('error', 'Only Supervisors or Managers can add signature to Verified By section');
            return;
        }
        const signatureText = `${username}`;
        switch (section) {
            case 'prepared':
                setPreparedBySignature(signatureText);
                break;
            case 'verified':
                setVerifiedBySignature(signatureText);
                break;
        }
        setHasUnsavedChanges(true);
        saveFormData();
        showAlert('success', `Signature added to ${section} section`);
    };

    const handleRemoveSignature = (section: 'prepared' | 'verified') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }
        if (!currentSignature.includes(username)) {
            showAlert('error', 'You can only remove your own signature');
            return;
        }
        switch (section) {
            case 'prepared':
                setPreparedBySignature('');
                break;
            case 'verified':
                setVerifiedBySignature('');
                break;
        }
        setHasUnsavedChanges(true);
        saveFormData();
        showAlert('info', `Signature removed from ${section} section`);
    };

    const canRemoveSignature = (section: 'prepared' | 'verified') => {
        if (!username) return false;
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }
        return currentSignature.includes(username);
    };

    const canAddSignature = (section: 'prepared' | 'verified') => {
        if (!username) return false;
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }
        if (currentSignature.trim()) return false;
        switch (section) {
            case 'prepared':
                return userRole === 'Operator';
            case 'verified':
                return ['Supervisor', 'Manager'].includes(userRole || '');
            default:
                return false;
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
            preparedBySignature,
            verifiedBySignature,
            timestamp: new Date().toISOString()
        };
        sessionStorage.setItem('peelTestFormData', JSON.stringify(formDataToSave));
    };

    useEffect(() => {
        saveFormData();
    }, [selectedDate, selectedShift, currentEditingReport, activeTab, tableData, formData, showReportEditor]);

    const handleBackToHome = () => {
        if (hasUnsavedChanges) {
            showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
                type: 'warning',
                confirmText: 'Leave',
                cancelText: 'Stay',
                onConfirm: () => {
                    clearFormData();
                    navigate('/home');
                }
            });
        } else {
            clearFormData();
            navigate('/home');
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
        setPreparedBySignature('');
        setVerifiedBySignature('');
        sessionStorage.removeItem('editingPeelReportIndex');
        sessionStorage.removeItem('editingPeelReportData');
        sessionStorage.removeItem(PEEL_SUPPRESS_KEY);
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
            setSavedReports(reports);
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
        const savedReports = await getSavedReports();
        const existingLocalReport = savedReports.find(report => report.name === reportName);
        if (existingLocalReport) {
            try {
                const fullReport = await apiService.getReportById(existingLocalReport._id!);
                loadReportForEditing(fullReport);
                showAlert('success', 'Loaded locally saved report');
            } catch (error) {
                console.error('Error loading full report:', error);
                showAlert('error', 'Failed to load report details');
            }
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
        const signatureFields: Record<string, string> = {};
        Object.keys(report.formData).forEach(key => {
            if (key === 'preparedBySignature' || key === 'verifiedBySignature') signatureFields[key] = report.formData[key];
        });
        setTableData(report.formData);
        setFormData(signatureFields);
        if (report.formData.preparedBySignature) setPreparedBySignature(report.formData.preparedBySignature as string);
        if (report.formData.verifiedBySignature) setVerifiedBySignature(report.formData.verifiedBySignature as string);
        setCurrentEditingReport(report.name);
        const { date: reportDate, shift: reportShift } = extractDateShiftFromReport(report);
        if (reportDate) setSelectedDate(reportDate);
        if (reportShift) setSelectedShift(reportShift);
        sessionStorage.setItem(PEEL_SUPPRESS_KEY, 'true');
        setHasUnsavedChanges(true);
        sessionStorage.setItem('editingPeelReportData', JSON.stringify(report));
        sessionStorage.setItem('editingPeelReportId', report._id!);
    };

    const createReportFromMongoData = (reportName: string, mongoData: any[]) => {
        sessionStorage.removeItem('editingPeelReportId');
        sessionStorage.removeItem('editingPeelReportData');
        sessionStorage.removeItem(PEEL_SUPPRESS_KEY);
        const newFormData: Record<string, string> = {};
        mongoData.forEach((record, repIndex) => {
            if (repIndex >= 24) return;
            newFormData[`row_${repIndex}_cell_0`] = record.Date || '';
            newFormData[`row_${repIndex}_cell_1`] = record.Shift || '';
            newFormData[`row_${repIndex}_cell_2`] = record.Stringer?.toString() || '';
            newFormData[`row_${repIndex}_cell_3`] = record.Unit || '';
            newFormData[`row_${repIndex}_cell_4`] = record.PO || '';
            newFormData[`row_${repIndex}_cell_5`] = record.Cell_Vendor || record['Cell Vendor'] || '';
            for (let position = 1; position <= 16; position++) {
                for (let ribbon = 1; ribbon <= 7; ribbon++) {
                    const key = `Front_${position}_${ribbon}`;
                    if (record[key] !== undefined) {
                        const cellIndex = 6 + (position - 1) * 7 + (ribbon - 1);
                        newFormData[`row_${repIndex}_cell_${cellIndex}`] = record[key]?.toString() || '';
                    }
                }
            }
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
        if (mongoData[0]) {
            if (mongoData[0].preparedBy) newFormData['preparedBy'] = mongoData[0].preparedBy;
            if (mongoData[0].verifiedBy) newFormData['verifiedBy'] = mongoData[0].verifiedBy;
        }
        setTableData(newFormData);
        const signatureFields: Record<string, string> = {};
        if (newFormData['preparedBy']) signatureFields['preparedBy'] = newFormData['preparedBy'];
        if (newFormData['verifiedBy']) signatureFields['verifiedBy'] = newFormData['verifiedBy'];
        setFormData(signatureFields);
        setCurrentEditingReport(reportName);
        setHasUnsavedChanges(true);
    };

    const createNewReport = (reportName: string) => {
        sessionStorage.removeItem('editingPeelReportId');
        sessionStorage.removeItem('editingPeelReportData');
        sessionStorage.removeItem(PEEL_SUPPRESS_KEY);
        setTableData({});
        setCurrentEditingReport(reportName);
        setHasUnsavedChanges(true);
    };

    const handleCellChange = (rowIndex: number, cellIndex: number, value: string) => {
        const cellId = `row_${rowIndex}_cell_${cellIndex}`;
        setTableData(prev => ({...prev, [cellId]: value }));
        setHasUnsavedChanges(true);
    };

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
            const fullReport = await apiService.getReportById(report._id);
            const dateShiftMatch = fullReport.name.match(/Peel_Test_Report_(\d+)_(\w+)_(\d+)_Shift_([ABC])/);
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
            loadReportForEditing(fullReport);
            setShowReportEditor(true);
            setActiveTab('edit-report');
            showAlert('success', 'Report loaded for editing');
        } catch (error) {
            console.error('Error loading report:', error);
            showAlert('error', 'Failed to load report');
        }
    };

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
        console.log('saveReport called, currentEditingReport:', currentEditingReport);
        if (!currentEditingReport) {
            showAlert('error', 'Please load or create a report first');
            return;
        }
        const averages: { [key: string]: string } = {};
        for (let rep = 0; rep < 24; rep++) {
            for (let position = 1; position <= 16; position++) {
                const startCell = 6 + (position - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);
                averages[`front_avg_${rep}_${position}`] = average;
            }
            for (let position = 1; position <= 16; position++) {
                const startCell = 118 + (position - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);
                averages[`back_avg_${rep}_${position}`] = average;
            }
        }
        const reportData: Omit<ReportData, '_id'> = {
            name: currentEditingReport,
            timestamp: new Date().toISOString(),
            formData: {
                ...tableData,
                ...formData,
                ...averages,
                preparedBySignature,
                verifiedBySignature
            },
            rowData: [],
            averages: averages
        };
        const editingId = sessionStorage.getItem('editingPeelReportId');
        try {
            if (editingId) {
                const existingReport = await apiService.getReportById(editingId);
                if (currentEditingReport === existingReport.name) {
                    await apiService.updateReport(editingId, reportData);
                    showAlert('success', 'Report updated successfully!');
                } else {
                    const nameExists = await apiService.checkReportNameExists(currentEditingReport, editingId);
                    if (nameExists) {
                        showConfirm({
                            title: 'Report Name Exists',
                            message: `A report named "${currentEditingReport}" already exists. Do you want to replace it?`,
                            type: 'warning',
                            confirmText: 'Replace',
                            cancelText: 'Cancel',
                            onConfirm: async () => {
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
                                sessionStorage.removeItem(PEEL_SUPPRESS_KEY);
                                clearFormData();
                                loadSavedReports();
                                setActiveTab('saved-reports');
                            }
                        });
                        return;
                    } else {
                        await apiService.createReport(reportData);
                        showAlert('success', 'New report created with updated name!');
                    }
                }
                sessionStorage.removeItem('editingPeelReportId');
                sessionStorage.removeItem('editingPeelReportData');
                sessionStorage.removeItem(PEEL_SUPPRESS_KEY);
            } else {
                const nameExists = await apiService.checkReportNameExists(currentEditingReport);
                if (nameExists) {
                    showConfirm({
                        title: 'Report Name Exists',
                        message: `A report named "${currentEditingReport}" already exists. Do you want to replace it?`,
                        type: 'warning',
                        confirmText: 'Replace',
                        cancelText: 'Cancel',
                        onConfirm: async () => {
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
            showAlert('info', 'Please wait! Exporting Excel will take some time...');
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
            const response = await fetch(`${PEEL_API_BASE_URL}/generate-peel-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    const exportSavedReportToExcel = async (index: number) => {
        try {
            const reports = await getSavedReports();
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }
            showAlert('info', 'Please wait! Exporting Excel will take some time...');
            const report = reports[index];
            const response = await fetch(`${PEEL_API_BASE_URL}/generate-peel-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ report_id: report._id }),
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

    const generateTableRows = () => {
        const rows = [];
        const repetitions = 24;
        for (let rep = 0; rep < repetitions; rep++) {
            rows.push(
                <tr key={`front-header-${rep}`}>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_0`] || ''}
                            onChange={(e) => handleCellChange(rep, 0, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_1`] || ''}
                            onChange={(e) => handleCellChange(rep, 1, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_2`] || ''}
                            onChange={(e) => handleCellChange(rep, 2, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_3`] || ''}
                            onChange={(e) => handleCellChange(rep, 3, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_4`] || ''}
                            onChange={(e) => handleCellChange(rep, 4, e.target.value)}
                        />
                    </td>
                    <td rowSpan={34} className="border border-gray-300 dark:border-gray-700 p-1 editable rowspan-cell bg-white dark:bg-gray-800">
                        <input
                            type="text"
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 text-center bg-transparent dark:text-white"
                            value={tableData[`row_${rep}_cell_5`] || ''}
                            onChange={(e) => handleCellChange(rep, 5, e.target.value)}
                        />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">Front</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">1</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">2</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">3</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">4</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">5</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">6</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">7</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">Avg. Value (N/mm)</td>
                </tr>
            );

            // Front data rows
            for (let i = 1; i <= 16; i++) {
                const startCell = 6 + (i - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);

                rows.push(
                    <tr key={`front-data-${rep}-${i}`}>
                        <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">{i}</td>
                        {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                            const cellIndex = startCell + offset;
                            const value = tableData[`row_${rep}_cell_${cellIndex}`] || '';
                            const isHighlighted = shouldHighlightCell(value);

                            return (
                                <td
                                    key={`front-${rep}-${i}-${offset}`}
                                    className={`border border-gray-300 dark:border-gray-700 p-1 ${isHighlighted ? 'bg-red-200 dark:bg-red-700' : 'bg-white dark:bg-gray-800'}`}
                                >
                                    <input
                                        type="text"
                                        className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 text-center bg-transparent dark:text-white"
                                        value={value}
                                        onChange={(e) => handleCellChange(rep, cellIndex, e.target.value)}
                                    />
                                </td>
                            );
                        })}
                        <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold text-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white">
                            {average}
                        </td>
                    </tr>
                );
            }

            // Back section header
            rows.push(
                <tr key={`back-header-${rep}`}>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">Back</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">1</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">2</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">3</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">4</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">5</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">6</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">7</td>
                    <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">Avg. Value (N/mm)</td>
                </tr>
            );

            // Back data rows
            for (let i = 1; i <= 16; i++) {
                const startCell = 118 + (i - 1) * 7;
                const average = calculateAverage(rep, startCell, 7);

                rows.push(
                    <tr key={`back-data-${rep}-${i}`}>
                        <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">{i}</td>
                        {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                            const cellIndex = startCell + offset;
                            const value = tableData[`row_${rep}_cell_${cellIndex}`] || '';
                            const isHighlighted = shouldHighlightCell(value);

                            return (
                                <td
                                    key={`back-${rep}-${i}-${offset}`}
                                    className={`border border-gray-300 dark:border-gray-700 p-1 ${isHighlighted ? 'bg-red-200 dark:bg-red-700' : 'bg-white dark:bg-gray-800'}`}
                                >
                                    <input
                                        type="text"
                                        className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 text-center bg-transparent dark:text-white"
                                        value={value}
                                        onChange={(e) => handleCellChange(rep, cellIndex, e.target.value)}
                                    />
                                </td>
                            );
                        })}
                        <td className="border border-gray-300 dark:border-gray-700 p-1 font-semibold text-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white">
                            {average}
                        </td>
                    </tr>
                );
            }
        }

        return rows;
    };

    const renderEditReportTab = () => (
        <>
            <div className="date-selector bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-row gap-2 items-center justify-center flex-wrap">
                    <label htmlFor="date-select" className="font-semibold text-gray-700 dark:text-gray-300">
                        Select Date:
                    </label>
                    <input
                        type="date"
                        id="date-select"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] dark:border-b-blue-500 focus:outline-none focus:ring-2 focus:ring-[#667eea] dark:focus:ring-blue-500 hover:-translate-y-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    />
                    <label htmlFor="shift-select" className="font-semibold text-gray-700 dark:text-gray-300">
                        Select Shift:
                    </label>
                    <select
                        id="shift-select"
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value)}
                        className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] dark:border-b-blue-500 focus:outline-none focus:ring-2 focus:ring-[#667eea] dark:focus:ring-blue-500 hover:-translate-y-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    >
                        <option value="" className="dark:bg-gray-800">-- Select Shift --</option>
                        <option value="A" className="dark:bg-gray-800">Shift-A</option>
                        <option value="B" className="dark:bg-gray-800">Shift-B</option>
                        <option value="C" className="dark:bg-gray-800">Shift-C</option>
                    </select>
                    <button
                        onClick={loadOrCreateReport}
                        className="bg-gradient-to-r from-[#8298f9] to-[#ceaaf2] dark:from-blue-700 dark:to-purple-700 border-transparent text-black dark:text-white rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                        Load / Create Report
                    </button>
                </div>
            </div>
            {showReportEditor && currentEditingReport && (
                <div className="report-info py-1 rounded-lg">
                    <div className="save-actions flex flex-col sm:flex-row items-center justify-center gap-2 flex-wrap">
                        <p className="current-report-title text-red-600 dark:text-red-400 font-bold bg-white dark:bg-gray-800 rounded p-2 text-sm text-center w-full">
                            Currently editing: <span className="break-all">{currentEditingReport}</span>
                        </p>
                        <button
                            className="save-btn w-full sm:w-auto p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-blue-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                            onClick={saveReport}
                        >
                            Save Report
                        </button>
                        <button
                            className="export-excel w-full sm:w-auto p-2.5 rounded-md border-2 border-white dark:border-gray-600 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-green-600 text-white text-sm hover:bg-white hover:text-black dark:hover:bg-gray-700 dark:hover:text-white hover:-translate-y-1 hover:shadow-lg"
                            onClick={exportToExcel}
                        >
                            Export as Excel
                        </button>
                    </div>
                </div>
            )}
            {showReportEditor && (
                <div className="report-editor bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="test-report-container p-1">
                        <div className="overflow-x-auto rounded-md border border-gray-300 dark:border-gray-700">
                            <table className="w-full border-collapse min-w-[1200px] text-xs sm:text-sm">
                                <thead>
                                    <tr>
                                        <td colSpan={2} rowSpan={3} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2">
                                            <img src="/LOGOS/VSL_Logo (1).png" height="70" alt="VSL Logo" className="mx-auto" />
                                        </td>
                                        <td colSpan={10} rowSpan={2} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2 text-center text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
                                            VIKRAM SOLAR LIMITED
                                        </td>
                                        <td colSpan={3} rowSpan={1} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2 text-gray-800 dark:text-white text-xs sm:text-sm font-bold">
                                            Doc. No.: VSL/QAD/FM/104
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2 text-gray-800 dark:text-white text-xs sm:text-sm font-bold">
                                            Issue Date: 04.09.2024
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={10} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2 text-center text-base sm:text-lg md:text-xl font-bold text-gray-800 dark:text-white">
                                            Solar Cell Peel Strength Test Report
                                        </td>
                                        <td colSpan={3} className="border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-2 text-gray-800 dark:text-white text-xs sm:text-sm font-bold">
                                            Rev. No./ Date: 01/ 25.09.2024
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={15} className="border border-gray-300 dark:border-gray-700 p-2 bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-white">
                                            <strong>Allowable Limit: Peel strength average ≥ 1.0 N/mm</strong>
                                        </td>
                                    </tr>
                                    <tr>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">Date</th>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">Shift</th>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">Stringer</th>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">Unit</th>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">PO</th>
                                        <th className="border border-gray-300 dark:border-gray-700 p-2 text-gray-800 dark:text-white">Cell Vendor</th>
                                        <th colSpan={8} className="border border-gray-300 dark:border-gray-700 p-2 text-center text-gray-800 dark:text-white">
                                            Bus Pad Position Wise Ribbon Peel Strength
                                        </th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {generateTableRows()}
                                </tbody>
                            </table>
                        </div>
                        <div className="footer flex flex-col lg:flex-row justify-between mt-6 border-gray-300 dark:border-gray-700 gap-4">
                            <div className="signature flex-1 text-center mb-4">
                                <p className="font-bold text-gray-800 dark:text-white mb-2">PREPARED BY:</p>
                                <div className="w-full min-h-24 border border-gray-300 dark:border-gray-700 rounded-md flex items-center justify-center">
                                    <div className="text-center relative signature-field p-4 w-full h-full flex items-center justify-center">
                                        <span className="text-gray-800 dark:text-white text-lg font-semibold">{preparedBySignature}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 mt-3">
                                    <button
                                        className={`px-3 py-2 text-sm text-white rounded ${canAddSignature('prepared') ? 'bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800 cursor-pointer' : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'}`}
                                        onClick={() => handleAddSignature('prepared')}
                                        disabled={!canAddSignature('prepared')}
                                    >
                                        Add my Signature
                                    </button>
                                    <button
                                        className={`px-3 py-2 text-sm text-white rounded ${canRemoveSignature('prepared') ? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800 cursor-pointer' : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'}`}
                                        onClick={() => handleRemoveSignature('prepared')}
                                        disabled={!canRemoveSignature('prepared')}
                                    >
                                        Remove my Signature
                                    </button>
                                </div>
                            </div>
                            <div className="signature flex-1 text-center mb-4">
                                <p className="font-bold text-gray-800 dark:text-white mb-2">VERIFIED BY:</p>
                                <div className="w-full min-h-24 border border-gray-300 dark:border-gray-700 rounded-md flex items-center justify-center">
                                    <div className="text-center relative signature-field p-4 w-full h-full flex items-center justify-center">
                                        <span className="text-gray-800 dark:text-white text-lg font-semibold">{verifiedBySignature}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 mt-3">
                                    <button
                                        className={`px-3 py-2 text-sm text-white rounded ${canAddSignature('verified') ? 'bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800 cursor-pointer' : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'}`}
                                        onClick={() => handleAddSignature('verified')}
                                        disabled={!canAddSignature('verified')}
                                    >
                                        Add my Signature
                                    </button>
                                    <button
                                        className={`px-3 py-2 text-sm text-white rounded ${canRemoveSignature('verified') ? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800 cursor-pointer' : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'}`}
                                        onClick={() => handleRemoveSignature('verified')}
                                        disabled={!canRemoveSignature('verified')}
                                    >
                                        Remove my Signature
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    const renderSavedReportsTab = () => (
        <>
            <SavedReportsNChecksheets
                reports={savedReports}
                onExportExcel={exportSavedReportToExcel}
                onEdit={editSavedReport}
                onDelete={deleteSavedReport}
            />
        </>
    );

    const renderReportAnalysisTab = () => (
        <div className="report-analysis-container bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-center justify-center flex-wrap">
                <label htmlFor="monthYear" className="font-semibold text-gray-700 dark:text-gray-300">
                    Month & Year:
                </label>
                <input
                    type="month"
                    id="monthYear"
                    value={monthYear}
                    onChange={(e) => setMonthYear(e.target.value)}
                    className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] dark:border-b-blue-500 focus:outline-none focus:ring-2 focus:ring-[#667eea] dark:focus:ring-blue-500 hover:-translate-y-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
                <label htmlFor="stringer-select" className="font-semibold text-gray-700 dark:text-gray-300">
                    Stringer:
                </label>
                <input
                    type="number"
                    id="stringer-select"
                    value={stringer}
                    onChange={(e) => setStringer(e.target.value)}
                    min="1"
                    max="12"
                    className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] dark:border-b-blue-500 focus:outline-none focus:ring-2 focus:ring-[#667eea] dark:focus:ring-blue-500 hover:-translate-y-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white w-20"
                />
                <label htmlFor="face-select" className="font-semibold text-gray-700 dark:text-gray-300">
                    Cell Face:
                </label>
                <select
                    id="face-select"
                    value={cellFace}
                    onChange={(e) => setCellFace(e.target.value)}
                    className="cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] dark:border-b-blue-500 focus:outline-none focus:ring-2 focus:ring-[#667eea] dark:focus:ring-blue-500 hover:-translate-y-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                >
                    <option value="" className="dark:bg-gray-800">-- Select --</option>
                    <option value="front" className="dark:bg-gray-800">Front</option>
                    <option value="back" className="dark:bg-gray-800">Back</option>
                    <option value="both" className="dark:bg-gray-800">Front + Back</option>
                </select>
                <button
                    onClick={analyzeReport}
                    className="bg-gradient-to-r from-[#8298f9] to-[#ceaaf2] dark:from-blue-700 dark:to-purple-700 border-transparent text-black dark:text-white rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                    Analyze
                </button>
            </div>
            {showChart && graphData.length > 0 && (
                <div className="chart-container bg-white dark:bg-gray-800 rounded-lg p-3 mt-4">
                    <div className="h-64 sm:h-80 md:h-96">
                        <ZoomableChart
                            chartData={prepareChartData()}
                            options={prepareChartOptions()}
                            type="line"
                        />
                    </div>
                </div>
            )}
            {showChart && graphData.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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
                    },
                    color: '#333'
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
                    display: true,
                    labels: {
                        color: '#333'
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Day of Month',
                        color: '#333'
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: '#333'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Peel Strength (N/mm)',
                        color: '#333'
                    },
                    min: 0,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        callback: function (value: any) {
                            return value + ' N/mm';
                        },
                        color: '#333'
                    }
                }
            },
            animation: {
                duration: 1000
            }
        };
    };

    return (
        <>
            <div className="container">
                <div className="text-center mb-6">
                    <button
                        onClick={handleBackToHome}
                        className="bg-white/20 dark:bg-gray-800/20 text-black dark:text-white border-2 border-blue-500 px-4 py-1 rounded-3xl cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-blue-500 dark:hover:bg-gray-700 dark:hover:text-blue-300 hover:-translate-x-1"
                    >
                        <span className="font-bold text-md">⇐</span> Back to Home
                    </button>
                </div>
                <div className="flex justify-center mb-2">
                    <div
                        className={`tab ${activeTab === 'edit-report' ? 'active bg-white dark:bg-gray-900 text-blue-500 border-b-2 border-b-blue-500 translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        onClick={() => setActiveTab('edit-report')}
                    >
                        Edit Report
                    </div>
                    <div
                        className={`tab ${activeTab === 'saved-reports' ? 'active bg-white dark:bg-gray-900 text-blue-500 border-b-2 border-b-blue-500 translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        onClick={() => setActiveTab('saved-reports')}
                    >
                        Saved Reports
                    </div>
                    <div
                        className={`tab ${activeTab === 'report-analysis' ? 'active bg-white dark:bg-gray-900 text-blue-500 border-b-2 border-b-blue-500 translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        onClick={() => setActiveTab('report-analysis')}
                    >
                        Report Analysis
                    </div>
                </div>
                {/* Tab Content */}
                <div className="tab-content">
                    {activeTab === 'edit-report' && renderEditReportTab()}
                    {activeTab === 'saved-reports' && renderSavedReportsTab()}
                    {activeTab === 'report-analysis' && renderReportAnalysisTab()}
                </div>
            </div>
        </>
    );
}