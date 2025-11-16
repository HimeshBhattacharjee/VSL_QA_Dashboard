import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import SavedReportsNChecksheets from '../components/SavedReportsNChecksheets';

interface GelTestReport {
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
    const tableRef = useRef<HTMLTableElement>(null);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const STORAGE_KEY = 'gelTestReports';

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
        const checkbox = e.target as HTMLInputElement;
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

    const editSavedReport = (index: number) => {
        const reports = getSavedReports();
        if (index < 0 || index >= reports.length) {
            showAlert('error', 'Report not found');
            return;
        }

        const report = reports[index];

        // Clear any existing form data first (but preserve editing state)
        clearFormData(false);

        // Set the report name immediately
        setReportName(report.name);

        // Save editing state to sessionStorage
        sessionStorage.setItem('editingReportData', JSON.stringify(report));
        sessionStorage.setItem('editingReportIndex', index.toString());

        setActiveTab('edit-report');

        // Load the report data after a brief delay to ensure DOM is ready
        setTimeout(() => {
            loadReportData(report);
            setHasUnsavedChanges(true);
        }, 150);

        showAlert('info', `Now editing: ${report.name}`);
    };

    useEffect(() => {
        if (activeTab === 'edit-report') {
            const editingReportData = sessionStorage.getItem('editingReportData');
            const editingIndex = sessionStorage.getItem('editingReportIndex');

            if (editingReportData && editingIndex !== null) {
                // Clear any existing form data first
                clearFormData();

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

        setTimeout(() => {
            calculateAverages();
        }, 150);

        // Save the editing state with current report name
        saveEditingFormData(report.name);
    };

    const saveEditingFormData = (currentReportName: string) => {
        const formData: { [key: string]: string | boolean } = {};

        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach((cell, index) => {
            formData[`editable_${index}`] = cell.textContent?.trim() || '';
        });

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            formData[`checkbox_${index}`] = (checkbox as HTMLInputElement).checked;
        });

        formData.reportName = currentReportName;
        sessionStorage.setItem('gelTestFormData', JSON.stringify(formData));
    };

    // Update the saveFormData function to handle both editing and new reports
    const saveFormData = () => {
        const editingReportData = sessionStorage.getItem('editingReportData');

        if (editingReportData) {
            // If editing a saved report, use the specialized function
            saveEditingFormData(reportName);
        } else {
            // For new reports, use the original logic
            const formData: { [key: string]: string | boolean } = {};

            const editableCells = document.querySelectorAll('.editable');
            editableCells.forEach((cell, index) => {
                formData[`editable_${index}`] = cell.textContent?.trim() || '';
            });

            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox, index) => {
                formData[`checkbox_${index}`] = (checkbox as HTMLInputElement).checked;
            });

            formData.reportName = reportName;
            sessionStorage.setItem('gelTestFormData', JSON.stringify(formData));
        }
    };

    // Update the loadFormData function to handle reportName for editing state
    const loadFormData = () => {
        const savedData = sessionStorage.getItem('gelTestFormData');

        if (savedData) {
            const formData = JSON.parse(savedData);

            // Always load reportName from saved data if it exists
            if (formData.reportName !== undefined) {
                setReportName(formData.reportName);
            }

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

            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox, index) => {
                const key = `checkbox_${index}`;
                if (formData[key] !== undefined) {
                    (checkbox as HTMLInputElement).checked = formData[key] as boolean;
                }
            });

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

        // Only clear reportName if we're clearing editing state
        if (clearEditingState) {
            setReportName('');
            sessionStorage.removeItem('editingReportIndex');
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

    const getSavedReports = (): GelTestReport[] => {
        const savedReportsJSON = localStorage.getItem(STORAGE_KEY);
        return savedReportsJSON ? JSON.parse(savedReportsJSON) : [];
    };

    const loadSavedReports = () => {
        const reports = getSavedReports();
        setSavedReports(reports);
    };

    const saveReport = () => {
        if (!reportName.trim()) {
            showAlert('error', 'Please enter a report name');
            return;
        }

        // Collect current averages and mean
        const averages: { [key: string]: string } = {};
        const averageCells = document.querySelectorAll('.average-cell');
        averageCells.forEach((cell, index) => {
            averages[`average_${index}`] = cell.textContent?.trim() || '0';
        });

        const meanCell = document.querySelector('.mean-cell');
        averages.mean = meanCell?.textContent?.trim() || '0';

        const reportData: GelTestReport = {
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

        const savedReports = getSavedReports();
        const editingIndex = sessionStorage.getItem('editingReportIndex');

        if (editingIndex !== null) {
            const index = parseInt(editingIndex);
            const originalReport = savedReports[index];

            if (reportName === originalReport.name) {
                savedReports[index] = reportData;
                showAlert('success', 'Report updated successfully!');
            } else {
                savedReports.push(reportData);
                showAlert('success', 'New report created with updated name!');
            }

            sessionStorage.removeItem('editingReportIndex');
            sessionStorage.removeItem('editingReportData');
        } else {
            savedReports.push(reportData);
            showAlert('success', 'Report saved successfully!');
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReports));
        clearFormData();
        loadSavedReports();
        setActiveTab('saved-reports');
    };

    const deleteSavedReport = (index: number) => {
        const savedReports = getSavedReports();
        savedReports.splice(index, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReports));
        loadSavedReports();
        showAlert('info', 'Report deleted successfully');
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

            const response = await fetch('http://localhost:8000/generate-gel-report', {
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

            const response = await fetch('http://localhost:8000/generate-gel-pdf', {
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
            const reports = getSavedReports();
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

            const response = await fetch('http://localhost:8000/generate-gel-report', {
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
            const reports = getSavedReports();
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

            const response = await fetch('http://localhost:8000/generate-gel-pdf', {
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
                                        <tr>
                                            <td colSpan={4} className="section-title font-bold bg-gray-100 text-center">Prepared By</td>
                                            <td colSpan={5} className="section-title font-bold bg-gray-100 text-center">Accepted By</td>
                                            <td colSpan={5} className="section-title font-bold bg-gray-100 text-center">Verified By</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={4} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={5} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                            <td colSpan={5} className="editable min-h-5 cursor-text relative border border-transparent transition-border-color duration-200 ease-in-out hover:border-blue-500"></td>
                                        </tr>
                                    </tbody>
                                </table>
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