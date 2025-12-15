import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import SavedReportsNChecksheets from '../components/SavedReportsNChecksheets';

interface GelTestReport {
    _id?: string;
    name: string;
    timestamp: string;
    formData: {
        [key: string]: string | boolean;
    };
    averages: {
        [key: string]: string;
    };
}

export default function GelTest() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'edit-report' | 'saved-reports'>('edit-report');
    const [savedReports, setSavedReports] = useState<GelTestReport[]>([]);
    const [reportName, setReportName] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const GEL_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/gel-test-reports';

    // Signature state
    const [preparedBySignature, setPreparedBySignature] = useState<string>('');
    const [acceptedBySignature, setAcceptedBySignature] = useState<string>('');
    const [verifiedBySignature, setVerifiedBySignature] = useState<string>('');

    const apiService = {
        // Get all reports
        getAllReports: async (): Promise<GelTestReport[]> => {
            const response = await fetch(`${GEL_API_BASE_URL}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch reports: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        // Get report by ID
        getReportById: async (id: string): Promise<GelTestReport> => {
            const response = await fetch(`${GEL_API_BASE_URL}/${id}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch report: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        // Create new report
        createReport: async (report: Omit<GelTestReport, '_id'>): Promise<GelTestReport> => {
            const response = await fetch(`${GEL_API_BASE_URL}`, {
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
        updateReport: async (id: string, report: Omit<GelTestReport, '_id'>): Promise<GelTestReport> => {
            const response = await fetch(`${GEL_API_BASE_URL}/${id}`, {
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
            const response = await fetch(`${GEL_API_BASE_URL}/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete report: ${response.status} ${errorText}`);
            }
        },

        // Check if report name exists
        checkReportNameExists: async (name: string, excludeId?: string): Promise<boolean> => {
            const url = `${GEL_API_BASE_URL}/name/${encodeURIComponent(name)}${excludeId ? `?excludeId=${excludeId}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to check report name: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            return result.exists;
        },
    };

    // Load user info from session storage
    useEffect(() => {
        const storedUserRole = sessionStorage.getItem('userRole');
        const storedUsername = sessionStorage.getItem('username');
        setUserRole(storedUserRole);
        setUsername(storedUsername);
    }, []);

    const handleBackToTests = () => {
        if (hasUnsavedChanges) {
            showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
                type: 'warning',
                confirmText: 'Leave',
                cancelText: 'Stay',
                onConfirm: function () {
                    sessionStorage.removeItem('editingReportIndex');
                    sessionStorage.removeItem('editingReportData');
                    clearFormData();
                    navigate('/quality-tests');
                }
            });
        } else {
            sessionStorage.removeItem('editingReportIndex');
            sessionStorage.removeItem('editingReportData');
            clearFormData();
            navigate('/quality-tests');
        }
    };

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
        return () => { window.removeEventListener('beforeunload', handleBeforeUnload) };
    }, []);

    const initializeForm = () => { calculateAverages() };

    const handleEditableCellClick = (e: Event) => {
        const cell = e.target as HTMLElement;
        const currentText = cell.textContent || '';
        const oldValue = currentText.trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.style.width = '100%';
        input.style.height = '100%';
        input.style.border = 'none';
        input.style.background = 'transparent';
        input.style.fontFamily = 'inherit';
        input.style.fontSize = 'inherit';
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
        const handleBlur = () => {
            const newValue = input.value.trim();
            cell.textContent = newValue || ' ';
            if (newValue) cell.classList.add('has-content');
            else cell.classList.remove('has-content');
            if (detectMeaningfulChange(oldValue, newValue)) {
                setHasUnsavedChanges(true);
                saveFormData();
            }
            saveFormData();
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') input.blur();
        };
        input.addEventListener('blur', handleBlur);
        input.addEventListener('keydown', handleKeyDown);
    };

    const handleDataCellClick = (e: Event) => {
        const cell = e.target as HTMLElement;
        const currentText = cell.textContent || '';
        const oldValue = currentText.trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.style.width = '100%';
        input.style.height = '100%';
        input.style.border = 'none';
        input.style.background = 'transparent';
        input.style.fontFamily = 'inherit';
        input.style.fontSize = 'inherit';
        input.style.textAlign = 'center';
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
        const handleBlur = () => {
            const value = input.value.trim();
            const isValid = value === '' ||
                !isNaN(parseFloat(value)) ||
                (!isNaN(parseFloat(value.replace('%', ''))) && value.includes('%'));
            if (isValid) {
                cell.textContent = value || '';
                if (value) cell.classList.add('has-content');
                else cell.classList.remove('has-content');
                calculateAverages();
                if (detectMeaningfulChange(oldValue, value)) {
                    setHasUnsavedChanges(true);
                    saveFormData();
                }
                saveFormData();
            } else {
                showAlert('error', 'Please enter a valid number (with or without % sign)');
                cell.textContent = currentText || '';
                if (currentText) cell.classList.add('has-content');
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        };

        input.addEventListener('blur', handleBlur);
        input.addEventListener('keydown', handleKeyDown);
    };

    const handleCheckboxChange = (e: Event) => {
        e.target as HTMLInputElement;
        setHasUnsavedChanges(true);
        saveFormData();
    };

    useEffect(() => {
        if (reportName.trim() && !hasUnsavedChanges) {
            setHasUnsavedChanges(true);
        }

        if (reportName !== '') {
            saveFormData();
        }
    }, [reportName]);

    const detectMeaningfulChange = (oldValue: string, newValue: string): boolean => {
        if (!oldValue.trim() && !newValue.trim()) {
            return false;
        }
        return oldValue.trim() !== newValue.trim();
    };

    const calculateAverages = () => {
        const rows = document.querySelectorAll('tr');
        const dataRows: HTMLTableRowElement[] = [];

        rows.forEach(row => {
            const cells = row.querySelectorAll('.data-cell');
            if (cells.length > 0) {
                dataRows.push(row as HTMLTableRowElement);
            }
        });

        const averages: { value: number; hasPercentage: boolean; count: number }[] = [];

        dataRows.forEach(row => {
            const dataCells = row.querySelectorAll('.data-cell');
            let sum = 0;
            let count = 0;
            let hasPercentage = false;

            dataCells.forEach(cell => {
                const value = cell.textContent?.trim() || '';
                if (value) {
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
            if (count > 0) {
                average = sum / count;
            }

            let averageDisplay = average.toFixed(2);
            if (hasPercentage && count > 0) {
                averageDisplay += '%';
            }

            averages.push({ value: average, hasPercentage, count });

            const averageCell = row.querySelector('.average-cell');
            if (averageCell) {
                averageCell.textContent = averageDisplay;
            }
        });

        const meanCell = document.querySelector('.mean-cell');
        if (meanCell && averages.length > 0) {
            const validAverages = averages.filter(avg => avg.count > 0);

            if (validAverages.length > 0) {
                const mean = validAverages.reduce((sum, avg) => sum + avg.value, 0) / validAverages.length;
                let meanDisplay = mean.toFixed(2);

                const hasAnyPercentage = validAverages.some(avg => avg.hasPercentage);
                if (hasAnyPercentage) {
                    meanDisplay += '%';
                }

                meanCell.textContent = meanDisplay;
            } else {
                meanCell.textContent = '0';
            }
        }
    };

    const handleAddSignature = (section: 'prepared' | 'accepted' | 'verified') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }

        // Check if signature already exists in this section
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'accepted':
                currentSignature = acceptedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }

        if (currentSignature.trim()) {
            showAlert('error', `Signature already exists in ${section} section. Please remove it first.`);
            return;
        }

        // Check role permissions
        if (section === 'prepared' && userRole !== 'Operator') {
            showAlert('error', 'Only Operators can add signature to Prepared By section');
            return;
        }

        if (section === 'accepted' && !['Supervisor', 'Manager'].includes(userRole || '')) {
            showAlert('error', 'Only Supervisors or Managers can add signature to Accepted By section');
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
            case 'accepted':
                setAcceptedBySignature(signatureText);
                break;
            case 'verified':
                setVerifiedBySignature(signatureText);
                break;
        }

        setHasUnsavedChanges(true);

        // CRITICAL FIX: Save form data immediately after state update
        // Use setTimeout to ensure React state is updated before saving
        setTimeout(() => {
            saveFormData();
        }, 0);

        showAlert('success', `Signature added to ${section} section`);
    };

    const handleRemoveSignature = (section: 'prepared' | 'accepted' | 'verified') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }

        // Check if current user is the one who added the signature
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'accepted':
                currentSignature = acceptedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }

        if (!currentSignature.includes(username)) {
            showAlert('error', 'You can only remove your own signature');
            return;
        }

        // Update state immediately
        switch (section) {
            case 'prepared':
                setPreparedBySignature('');
                break;
            case 'accepted':
                setAcceptedBySignature('');
                break;
            case 'verified':
                setVerifiedBySignature('');
                break;
        }

        setHasUnsavedChanges(true);

        // CRITICAL FIX: Save form data immediately after state update
        // Use setTimeout to ensure React state is updated before saving
        setTimeout(() => {
            saveFormData();
        }, 0);

        showAlert('info', `Signature removed from ${section} section`);
    };

    // Check if remove button should be enabled for each section
    const canRemoveSignature = (section: 'prepared' | 'accepted' | 'verified') => {
        if (!username) return false;

        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'accepted':
                currentSignature = acceptedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }

        return currentSignature.includes(username);
    };

    const canAddSignature = (section: 'prepared' | 'accepted' | 'verified') => {
        if (!username) return false;

        // Check if signature already exists in this section
        let currentSignature = '';
        switch (section) {
            case 'prepared':
                currentSignature = preparedBySignature;
                break;
            case 'accepted':
                currentSignature = acceptedBySignature;
                break;
            case 'verified':
                currentSignature = verifiedBySignature;
                break;
        }

        if (currentSignature.trim()) {
            return false; // Cannot add if signature already exists
        }

        switch (section) {
            case 'prepared':
                return userRole === 'Operator';
            case 'accepted':
            case 'verified':
                return ['Supervisor', 'Manager'].includes(userRole || '');
            default:
                return false;
        }
    };

    const editSavedReport = async (index: number) => {
        try {
            setIsLoading(true);
            const reports = await apiService.getAllReports();
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }

            const report = reports[index];

            // Clear any existing form data first
            clearFormData(false);

            // Set the report name immediately
            setReportName(report.name);

            // Save editing state to sessionStorage
            sessionStorage.setItem('editingReportData', JSON.stringify(report));
            sessionStorage.setItem('editingReportId', report._id!);

            setActiveTab('edit-report');

            // Load the report data after a brief delay to ensure DOM is ready
            setTimeout(() => {
                loadReportData(report);
                setHasUnsavedChanges(true);
            }, 150);

            showAlert('info', `Now editing: ${report.name}`);
        } catch (error) {
            console.error('Error loading report:', error);
            showAlert('error', 'Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    const loadReportData = (report: GelTestReport) => {
        setReportName(report.name);

        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach((cell, index) => {
            const key = `editable_${index}`;
            if (report.formData[key] !== undefined) {
                const value = report.formData[key] as string;
                cell.textContent = value;

                if (value.trim()) {
                    cell.classList.add('has-content');
                } else {
                    cell.classList.remove('has-content');
                }
            }
        });

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            const key = `checkbox_${index}`;
            if (report.formData[key] !== undefined) {
                (checkbox as HTMLInputElement).checked = report.formData[key] as boolean;
            }
        });

        // CRITICAL FIX: Load signatures from the report data
        // This ensures signatures are loaded when editing saved reports
        if (report.formData.preparedBySignature !== undefined) {
            setPreparedBySignature(report.formData.preparedBySignature as string);
        } else {
            setPreparedBySignature(''); // Clear if not present
        }

        if (report.formData.acceptedBySignature !== undefined) {
            setAcceptedBySignature(report.formData.acceptedBySignature as string);
        } else {
            setAcceptedBySignature(''); // Clear if not present
        }

        if (report.formData.verifiedBySignature !== undefined) {
            setVerifiedBySignature(report.formData.verifiedBySignature as string);
        } else {
            setVerifiedBySignature(''); // Clear if not present
        }

        setTimeout(() => {
            calculateAverages();
        }, 150);

        // CRITICAL FIX: Save the current state to sessionStorage immediately after loading
        // This ensures that if the page is refreshed, the loaded data (including signatures) is preserved
        setTimeout(() => {
            saveFormData();
        }, 200);
    };

    // Update the useEffect that handles tab switching to ensure proper state loading
    useEffect(() => {
        if (activeTab === 'edit-report') {
            const editingReportData = sessionStorage.getItem('editingReportData');

            if (editingReportData) {
                // Clear any existing form data first
                clearFormData(false);

                setTimeout(() => {
                    const report = JSON.parse(editingReportData) as GelTestReport;
                    loadReportData(report);
                    setHasUnsavedChanges(true);
                }, 100);
            } else {
                // Load regular form data if not editing a saved report
                loadFormData();
            }
        }
    }, [activeTab]);

    const saveFormData = () => {
        const formData: { [key: string]: string | boolean } = {};

        // Always collect editable cells and checkboxes
        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach((cell, index) => {
            formData[`editable_${index}`] = cell.textContent?.trim() || '';
        });

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            formData[`checkbox_${index}`] = (checkbox as HTMLInputElement).checked;
        });

        // Always save signatures
        formData.preparedBySignature = preparedBySignature;
        formData.acceptedBySignature = acceptedBySignature;
        formData.verifiedBySignature = verifiedBySignature;
        formData.reportName = reportName;

        // Save to sessionStorage
        sessionStorage.setItem('gelTestFormData', JSON.stringify(formData));
    };

    // Update the loadFormData function to ensure signatures are loaded properly
    const loadFormData = () => {
        const savedData = sessionStorage.getItem('gelTestFormData');

        if (savedData) {
            const formData = JSON.parse(savedData);

            // Load reportName from saved data if it exists
            if (formData.reportName !== undefined) {
                setReportName(formData.reportName);
            }

            // Load editable cells
            const editableCells = document.querySelectorAll('.editable');
            editableCells.forEach((cell, index) => {
                const key = `editable_${index}`;
                if (formData[key] !== undefined) {
                    cell.textContent = formData[key] as string;
                    if ((formData[key] as string).trim()) {
                        cell.classList.add('has-content');
                    }
                }
            });

            // Load checkboxes
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox, index) => {
                const key = `checkbox_${index}`;
                if (formData[key] !== undefined) {
                    (checkbox as HTMLInputElement).checked = formData[key] as boolean;
                }
            });

            // CRITICAL FIX: Load signatures from form data
            // This ensures signatures are loaded when page refreshes
            if (formData.preparedBySignature !== undefined) {
                setPreparedBySignature(formData.preparedBySignature as string);
            }
            if (formData.acceptedBySignature !== undefined) {
                setAcceptedBySignature(formData.acceptedBySignature as string);
            }
            if (formData.verifiedBySignature !== undefined) {
                setVerifiedBySignature(formData.verifiedBySignature as string);
            }

            setTimeout(() => {
                calculateAverages();
            }, 100);

            setHasUnsavedChanges(true);
        }
    };

    // Update the clearFormData function to preserve editing state if needed
    const clearFormData = (clearEditingState = true) => {
        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('has-content');
        });

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            (checkbox as HTMLInputElement).checked = false;
        });

        // Clear signatures
        setPreparedBySignature('');
        setAcceptedBySignature('');
        setVerifiedBySignature('');

        // Only clear reportName if we're clearing editing state
        if (clearEditingState) {
            setReportName('');
            sessionStorage.removeItem('editingReportId');
            sessionStorage.removeItem('editingReportData');
        }

        const averageCells = document.querySelectorAll('.average-cell');
        averageCells.forEach(cell => {
            cell.textContent = '0';
        });

        const meanCell = document.querySelector('.mean-cell');
        if (meanCell) {
            meanCell.textContent = '0';
        }

        // Only clear form data if we're clearing editing state
        if (clearEditingState) {
            sessionStorage.removeItem('gelTestFormData');
        }

        setHasUnsavedChanges(false);
    };

    const loadSavedReports = async () => {
        try {
            setIsLoading(true);
            const reports = await apiService.getAllReports();
            setSavedReports(reports);
        } catch (error) {
            console.error('Error loading reports:', error);
            showAlert('error', 'Failed to load saved reports');
        } finally {
            setIsLoading(false);
        }
    };

    // Update the saveReport function to include signatures
    const saveReport = async () => {
        if (!reportName.trim()) {
            showAlert('error', 'Please enter a report name');
            return;
        }

        try {
            setIsLoading(true);

            // Collect current averages and mean
            const averages: { [key: string]: string } = {};
            const averageCells = document.querySelectorAll('.average-cell');
            averageCells.forEach((cell, index) => {
                averages[`average_${index}`] = cell.textContent?.trim() || '0';
            });

            const meanCell = document.querySelector('.mean-cell');
            averages.mean = meanCell?.textContent?.trim() || '0';

            const reportData: Omit<GelTestReport, '_id'> = {
                name: reportName,
                timestamp: new Date().toISOString(),
                formData: {},
                averages: averages,
            };

            const editableCells = document.querySelectorAll('.editable');
            editableCells.forEach((cell, index) => {
                reportData.formData[`editable_${index}`] = cell.textContent?.trim() || '';
            });

            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox, index) => {
                reportData.formData[`checkbox_${index}`] = (checkbox as HTMLInputElement).checked;
            });

            // Include signatures in form data
            reportData.formData.preparedBySignature = preparedBySignature;
            reportData.formData.acceptedBySignature = acceptedBySignature;
            reportData.formData.verifiedBySignature = verifiedBySignature;

            const editingId = sessionStorage.getItem('editingReportId');

            if (editingId) {
                // Editing existing report
                const existingReport = await apiService.getReportById(editingId);

                if (reportName === existingReport.name) {
                    // Same name, update the report
                    await apiService.updateReport(editingId, reportData);
                    showAlert('success', 'Report updated successfully!');
                } else {
                    // Different name, check if name already exists
                    const nameExists = await apiService.checkReportNameExists(reportName, editingId);

                    if (nameExists) {
                        showConfirm({
                            title: 'Report Name Exists',
                            message: `A report named "${reportName}" already exists. Do you want to replace it?`,
                            type: 'warning',
                            confirmText: 'Replace',
                            cancelText: 'Cancel',
                            onConfirm: async () => {
                                // Find the existing report with this name and update it
                                const allReports = await apiService.getAllReports();
                                const existingReportWithSameName = allReports.find(report => report.name === reportName);

                                if (existingReportWithSameName) {
                                    await apiService.updateReport(existingReportWithSameName._id!, reportData);
                                    showAlert('success', 'Report updated successfully!');
                                } else {
                                    await apiService.createReport(reportData);
                                    showAlert('success', 'New report created successfully!');
                                }

                                sessionStorage.removeItem('editingReportId');
                                sessionStorage.removeItem('editingReportData');
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

                sessionStorage.removeItem('editingReportId');
                sessionStorage.removeItem('editingReportData');
            } else {
                // Creating new report
                const nameExists = await apiService.checkReportNameExists(reportName);

                if (nameExists) {
                    showConfirm({
                        title: 'Report Name Exists',
                        message: `A report named "${reportName}" already exists. Do you want to replace it?`,
                        type: 'warning',
                        confirmText: 'Replace',
                        cancelText: 'Cancel',
                        onConfirm: async () => {
                            // Find the existing report with this name and update it
                            const allReports = await apiService.getAllReports();
                            const existingReport = allReports.find(report => report.name === reportName);

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
        } finally {
            setIsLoading(false);
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

    const exportToExcel = async () => {
        try {
            const formData: { [key: string]: string | boolean } = {};

            const editableCells = document.querySelectorAll('.editable');
            editableCells.forEach((cell, index) => {
                formData[`editable_${index}`] = cell.textContent?.trim() || '';
            });

            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox, index) => {
                formData[`checkbox_${index}`] = (checkbox as HTMLInputElement).checked;
            });

            // Include signatures in export
            formData.preparedBySignature = preparedBySignature;
            formData.acceptedBySignature = acceptedBySignature;
            formData.verifiedBySignature = verifiedBySignature;

            const averages: { [key: string]: string } = {};
            const averageCells = document.querySelectorAll('.average-cell');
            averageCells.forEach((cell, index) => {
                averages[`average_${index}`] = cell.textContent?.trim() || '0';
            });

            const meanCell = document.querySelector('.mean-cell');
            if (meanCell) {
                averages.mean = meanCell.textContent?.trim() || '0';
            }

            const gelReportData = {
                report_name: reportName.trim() || 'Gel_Test_Report',
                timestamp: new Date().toISOString(),
                form_data: formData,
                averages: averages,
            };
            const response = await fetch(`${GEL_API_BASE_URL}/generate-gel-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(gelReportData),
            });

            if (!response.ok) {
                throw new Error('Failed to generate report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${reportName.trim() || 'Gel_Test_Report'}.xlsx`;
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
            const formData: { [key: string]: string | boolean } = {};

            const editableCells = document.querySelectorAll('.editable');
            editableCells.forEach((cell, index) => {
                formData[`editable_${index}`] = cell.textContent?.trim() || '';
            });

            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox, index) => {
                formData[`checkbox_${index}`] = (checkbox as HTMLInputElement).checked;
            });

            // Include signatures in export
            formData.preparedBySignature = preparedBySignature;
            formData.acceptedBySignature = acceptedBySignature;
            formData.verifiedBySignature = verifiedBySignature;

            const averages: { [key: string]: string } = {};
            const averageCells = document.querySelectorAll('.average-cell');
            averageCells.forEach((cell, index) => {
                averages[`average_${index}`] = cell.textContent?.trim() || '0';
            });

            const meanCell = document.querySelector('.mean-cell');
            if (meanCell) {
                averages.mean = meanCell.textContent?.trim() || '0';
            }

            const gelReportData = {
                report_name: reportName.trim() || 'Gel_Test_Report',
                timestamp: new Date().toISOString(),
                form_data: formData,
                averages: averages,
            };

            console.log('Generating PDF from Excel template...');
            const response = await fetch(`${GEL_API_BASE_URL}/generate-gel-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(gelReportData),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to generate PDF: ${errorText}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${reportName.trim() || 'Gel_Test_Report'}.pdf`;
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
            const reports = await apiService.getAllReports();
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }

            const report = reports[index];

            const gelReportData = {
                report_name: report.name,
                timestamp: report.timestamp,
                form_data: report.formData,
                averages: report.averages
            };
            const response = await fetch(`${GEL_API_BASE_URL}/generate-gel-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(gelReportData),
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
            const reports = await apiService.getAllReports();
            if (index < 0 || index >= reports.length) {
                showAlert('error', 'Report not found');
                return;
            }

            const report = reports[index];

            const gelReportData = {
                report_name: report.name,
                timestamp: report.timestamp,
                form_data: report.formData,
                averages: report.averages
            };
            const response = await fetch(`${GEL_API_BASE_URL}/generate-gel-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(gelReportData),
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

    useEffect(() => {
        const editableCells = document.querySelectorAll('.editable:not(.data-cell)');
        editableCells.forEach(cell => {
            cell.addEventListener('click', handleEditableCellClick);
        });

        const dataCells = document.querySelectorAll('.data-cell');
        dataCells.forEach(cell => {
            cell.addEventListener('click', handleDataCellClick);
        });

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', handleCheckboxChange);
        });

        return () => {
            editableCells.forEach(cell => {
                cell.removeEventListener('click', handleEditableCellClick);
            });
            dataCells.forEach(cell => {
                cell.removeEventListener('click', handleDataCellClick);
            });
            checkboxes.forEach(checkbox => {
                checkbox.removeEventListener('change', handleCheckboxChange);
            });
        };
    }, []);

    useEffect(() => {
        if (reportName.trim() && !hasUnsavedChanges) {
            setHasUnsavedChanges(true);
        }
    }, [reportName]);


    return (
        <>
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
                    {isLoading && (
                        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white p-4 rounded-lg">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                <p className="mt-2 text-gray-700">Loading...</p>
                            </div>
                        </div>
                    )}
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
                    </div>

                    {activeTab === 'edit-report' && (
                        <div className="tab-content active">
                            <div className="save-actions flex justify-center text-center gap-4 m-2.5">
                                <input
                                    type="text"
                                    value={reportName}
                                    onChange={(e) => setReportName(e.target.value)}
                                    className="report-name-input p-2.5 rounded-md bg-white border-b-[rgba(48,30,107)] border-b-2 w-[50%] text-center text-sm"
                                    placeholder="Enter report name"
                                />
                                <button
                                    className="save-btn w-[15%] p-2.5 rounded-md border-b-white border-b-2 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-[rgb(76,0,198,0.5))] text-white text-sm hover:bg-white hover:text-black hover:transform hover:-translate-y-1 hover:shadow-lg"
                                    onClick={saveReport}
                                >
                                    Save Report
                                </button>
                                <button
                                    className="save-btn export-excel w-[15%] p-2.5 rounded-md border-b-white border-b-2 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-[#27ae60] text-white text-sm hover:bg-white hover:text-black hover:transform hover:-translate-y-1 hover:shadow-lg"
                                    onClick={exportToExcel}
                                >
                                    Export as Excel
                                </button>
                                <button
                                    className="save-btn export-pdf w-[15%] p-2.5 rounded-md border-b-white border-b-2 cursor-pointer font-semibold transition-all duration-300 ease-in-out bg-[#e74c3c] text-white text-sm hover:bg-white hover:text-black hover:transform hover:-translate-y-1 hover:shadow-lg"
                                    onClick={exportToPDF}
                                >
                                    Export as PDF
                                </button>
                            </div>

                            <div className="test-report-container bg-white p-5 rounded-md shadow-lg mx-4">
                                <table ref={tableRef} className="w-full border-collapse mb-5 border border-gray-300">
                                    <tbody>
                                        <tr>
                                            <td colSpan={2} rowSpan={3}><img src="../LOGOS/VSL_Logo (1).png" height="70" alt="VSL Logo" /></td>
                                            <td colSpan={8} rowSpan={2} className="section-title text-3xl font-bold bg-gray-100 text-center">VIKRAM SOLAR LIMITED</td>
                                            <td colSpan={3} rowSpan={1} className="section-title font-bold bg-gray-100 text-center">Doc. No.: VSL/QAD/FM/90</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">Issue Date: 11.01.2023</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={8} className="section-title text-xl font-bold bg-gray-100 text-center">Gel Content Test Report</td>
                                            <td colSpan={3} className="section-title font-bold bg-gray-100 text-center">Rev. No./ Date: 03/ 25.02.2025</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={10} rowSpan={3}>
                                                <div className="allowable-limit p-2.5 bg-gray-50 border-l-4 border-l-blue-500 text-left">
                                                    <strong className="px-2.5">Allowable Limit:</strong>
                                                    <div className="checkbox-container flex">
                                                        <div className="checkbox-item flex items-center mx-2">
                                                            <label htmlFor="eva-epe-checkbox">1. Gel Content should be: 75 to 95% for EVA & EPE</label>
                                                            <input type="checkbox" id="eva-checkbox" name="encapsulant" value="EVA" className="ml-1" />
                                                        </div>
                                                    </div>
                                                    <div className="checkbox-container flex">
                                                        <div className="checkbox-item flex items-center mx-1.5">
                                                            <label htmlFor="poe-checkbox">2. Gel Content should be: ≥ 60% for POE</label>
                                                            <input type="checkbox" id="eva-checkbox" name="encapsulant" value="EVA" className="ml-1" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td colSpan={1}>Inv. No./ Date:</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={1}>P.O. No.:</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={1}>Type of Test:</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={10} className="section-title font-bold bg-gray-100 text-center">Laminator Parameter</td>
                                            <td colSpan={1}>Laminator Details:</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">Process Name</td>
                                            <td colSpan={2}>Lam - 1</td>
                                            <td colSpan={3}>Lam - 2</td>
                                            <td colSpan={3}>Lam - 3 (CP)</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">MATERIAL INFORMATION (S)</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">Pumping Time (Sec)</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">Encapsulant Types:</td>
                                            <td colSpan={2}>
                                                <div className="checkbox-container flex">
                                                    <div className="checkbox-item flex items-center mx-1">
                                                        <label htmlFor="eva-checkbox">EVA</label>
                                                        <input type="checkbox" id="eva-checkbox" name="encapsulant" value="EVA" className="ml-1" />
                                                    </div>
                                                    <div className="checkbox-item flex items-center mx-1">
                                                        <label htmlFor="epe-checkbox">EPE</label>
                                                        <input type="checkbox" id="epe-checkbox" name="encapsulant" value="EPE" className="ml-1" />
                                                    </div>
                                                    <div className="checkbox-item flex items-center mx-1">
                                                        <label htmlFor="poe-checkbox">POE</label>
                                                        <input type="checkbox" id="poe-checkbox" name="encapsulant" value="POE" className="ml-1" />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">Pressing/Cooling Time (Sec)</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">Encapsulant Supplier:</td>
                                            <td colSpan={2}>FIRST</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">Venting Time (Sec)</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">Category:</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">Lower Heating (˚C)</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">Batch/Lot No.:</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">Upper Heating (˚C)</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">MFG. Date:</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">Upper Pressure (Kpa)</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">Exp. Date:</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">Lower Pressure (Kpa)</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={1} className="section-title font-bold bg-gray-100 text-center">Glass Size:</td>
                                            <td colSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={13}><img src="../IMAGES/GelTest.jpg" width="100%" alt="Gel Test" /></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">Date, Shift, & Time</td>
                                            <td className="section-title font-bold bg-gray-100 text-center">Workshop</td>
                                            <td colSpan={2} className="section-title font-bold bg-gray-100 text-center">Platen Position (A/B/C/D/E/F/G)</td>
                                            <td className="section-title font-bold bg-gray-100 text-center">#1</td>
                                            <td className="section-title font-bold bg-gray-100 text-center">#2</td>
                                            <td className="section-title font-bold bg-gray-100 text-center">#3</td>
                                            <td className="section-title font-bold bg-gray-100 text-center">#4</td>
                                            <td className="section-title font-bold bg-gray-100 text-center">#5</td>
                                            <td className="section-title font-bold bg-gray-100 text-center">Average (A/B/C/D/E/F/G)</td>
                                            <td className="section-title font-bold bg-gray-100 text-center">Mean</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} rowSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td rowSpan={7}>VSL FAB-II</td>
                                            <td colSpan={2}>A</td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="average-cell font-bold bg-gray-50">0</td>
                                            <td rowSpan={7} className="mean-cell font-bold bg-gray-50">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2}>B</td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="average-cell font-bold bg-gray-50">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} rowSpan={3} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={2}>C</td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="average-cell font-bold bg-gray-50">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2}>D</td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="average-cell font-bold bg-gray-50">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2}>E</td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="average-cell font-bold bg-gray-50">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} rowSpan={2} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={2}>F</td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="average-cell font-bold bg-gray-50">0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2}>G</td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="editable data-cell min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500 text-center"></td>
                                            <td className="average-cell font-bold bg-gray-50">0</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div className="footer flex justify-between mt-6 border-gray-300 gap-4">
                                    <div className="signature flex-1 text-center mb-4">
                                        <p><strong>PREPARED BY:</strong></p>
                                        <table className="w-full min-h-10 border-collapse mb-4 border border-gray-300">
                                            <tbody>
                                                <tr>
                                                    <td className="text-center relative signature-field">
                                                        {preparedBySignature}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <button
                                            className={`px-3 py-1 text-sm text-white rounded mx-1 ${canAddSignature('prepared') ? 'bg-green-500 hover:bg-green-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
                                            onClick={() => handleAddSignature('prepared')}
                                            disabled={!canAddSignature('prepared')}
                                        >
                                            Add my Signature
                                        </button>
                                        <button
                                            className={`px-3 py-1 text-sm text-white rounded mx-1 ${canRemoveSignature('prepared') ? 'bg-red-500 hover:bg-red-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
                                            onClick={() => handleRemoveSignature('prepared')}
                                            disabled={!canRemoveSignature('prepared')}
                                        >
                                            Remove my Signature
                                        </button>
                                    </div>
                                    <div className="signature flex-1 text-center mb-4">
                                        <p><strong>ACCEPTED BY:</strong></p>
                                        <table className="w-full min-h-10 border-collapse mb-4 border border-gray-300">
                                            <tbody>
                                                <tr>
                                                    <td className="text-center relative signature-field">
                                                        {acceptedBySignature}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <button
                                            className={`px-3 py-1 text-sm text-white rounded mx-1 ${canAddSignature('accepted') ? 'bg-green-500 hover:bg-green-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
                                            onClick={() => handleAddSignature('accepted')}
                                            disabled={!canAddSignature('accepted')}
                                        >
                                            Add my Signature
                                        </button>
                                        <button
                                            className={`px-3 py-1 text-sm text-white rounded mx-1 ${canRemoveSignature('accepted') ? 'bg-red-500 hover:bg-red-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
                                            onClick={() => handleRemoveSignature('accepted')}
                                            disabled={!canRemoveSignature('accepted')}
                                        >
                                            Remove my Signature
                                        </button>
                                    </div>
                                    <div className="signature flex-1 text-center mb-4">
                                        <p><strong>VERIFIED BY:</strong></p>
                                        <table className="w-full min-h-10 border-collapse mb-4 border border-gray-300">
                                            <tbody>
                                                <tr>
                                                    <td className="text-center relative signature-field">
                                                        {verifiedBySignature}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <button
                                            className={`px-3 py-1 text-sm text-white rounded mx-1 ${canAddSignature('verified') ? 'bg-green-500 hover:bg-green-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
                                            onClick={() => handleAddSignature('verified')}
                                            disabled={!canAddSignature('verified')}
                                        >
                                            Add my Signature
                                        </button>
                                        <button
                                            className={`px-3 py-1 text-sm text-white rounded mx-1 ${canRemoveSignature('verified') ? 'bg-red-500 hover:bg-red-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
                                            onClick={() => handleRemoveSignature('verified')}
                                            disabled={!canRemoveSignature('verified')}
                                        >
                                            Remove my Signature
                                        </button>
                                    </div>
                                </div>
                                <div className="controlled-copy text-center text-lg text-red-500">
                                    <p>(Controlled Copy)</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'saved-reports' && (
                        <div className="tab-content active mx-4 mt-2">
                            <SavedReportsNChecksheets
                                reports={savedReports}
                                onExportExcel={exportSavedReportToExcel}
                                onExportPdf={exportSavedReportToPDF}
                                onEdit={editSavedReport}
                                onDelete={deleteSavedReport}
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}