import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import Header from '../components/Header';
import { useAlert } from '../context/AlertContext';
import { usePreviewModal } from '../context/PreviewModalContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import { GelTestPreview } from '../components/previews/GelTestPreview';
import GelTestPDF from '../components/pdfGens/GelTestPDF';

interface GelTestReport {
    name: string;
    timestamp: string;
    formData: {
        [key: string]: string | boolean;
    };
}

export default function GelTest() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'edit-report' | 'saved-reports'>('edit-report');
    const [savedReports, setSavedReports] = useState<GelTestReport[]>([]);
    const [reportName, setReportName] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [_, setCurrentPreviewIndex] = useState<number | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const { showAlert } = useAlert();
    const { showPreview } = usePreviewModal();
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

    const handleBackToHome = () => {
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
                    navigate('/home');
                }
            });
        } else {
            sessionStorage.removeItem('editingReportIndex');
            sessionStorage.removeItem('editingReportData');
            clearFormData();
            navigate('/home');
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
                    saveFormData(); // Save to sessionStorage
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

    // Update the handleCheckboxChange function
    const handleCheckboxChange = (e: Event) => {
        const checkbox = e.target as HTMLInputElement;
        setHasUnsavedChanges(true);
        saveFormData(); // Save to sessionStorage immediately
    };

    // Update the report name useEffect to save form data
    useEffect(() => {
        if (reportName.trim() && !hasUnsavedChanges) {
            setHasUnsavedChanges(true);
        }

        // Save form data whenever report name changes
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

        // Set the report name for editing
        setReportName(report.name);

        // Store the report data to load after the tab switch
        sessionStorage.setItem('editingReportData', JSON.stringify(report));
        sessionStorage.setItem('editingReportIndex', index.toString());

        // Switch to edit tab
        setActiveTab('edit-report');

        showAlert('info', `Now editing: ${report.name}`);
    };

    // Add useEffect to handle tab switch and data loading
    useEffect(() => {
        if (activeTab === 'edit-report') {
            // Check if we have report data to load (after tab switch)
            const editingReportData = sessionStorage.getItem('editingReportData');
            const editingIndex = sessionStorage.getItem('editingReportIndex');

            if (editingReportData && editingIndex !== null) {
                // Use setTimeout to ensure DOM is fully rendered
                setTimeout(() => {
                    const report = JSON.parse(editingReportData) as GelTestReport;
                    loadReportData(report);
                    setHasUnsavedChanges(true);
                }, 100);
            }
        }
    }, [activeTab]);

    // Enhanced loadReportData function
    const loadReportData = (report: GelTestReport) => {
        // Load editable cells
        setReportName(report.name);
        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach((cell, index) => {
            const key = `editable_${index}`;
            if (report.formData[key] !== undefined) {
                const value = report.formData[key] as string;
                cell.textContent = value;

                // Update class based on content
                if (value.trim()) {
                    cell.classList.add('has-content');
                } else {
                    cell.classList.remove('has-content');
                }
            }
        });

        // Load checkboxes
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            const key = `checkbox_${index}`;
            if (report.formData[key] !== undefined) {
                (checkbox as HTMLInputElement).checked = report.formData[key] as boolean;
            }
        });

        // Recalculate averages after a brief delay to ensure DOM is updated
        setTimeout(() => {
            calculateAverages();
        }, 150);

        // Save the loaded data to session storage
        saveFormData();
    };

    const saveFormData = () => {
        const formData: { [key: string]: string | boolean } = {};

        // Save editable cell values
        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach((cell, index) => {
            formData[`editable_${index}`] = cell.textContent?.trim() || '';
        });

        // Save checkbox states
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            formData[`checkbox_${index}`] = (checkbox as HTMLInputElement).checked;
        });

        // Save report name
        formData.reportName = reportName;

        // Save to session storage
        sessionStorage.setItem('gelTestFormData', JSON.stringify(formData));
    };

    // Enhanced loadFormData function
    const loadFormData = () => {
        const savedData = sessionStorage.getItem('gelTestFormData');
        if (savedData) {
            const formData = JSON.parse(savedData);

            // Load report name
            if (formData.reportName !== undefined) {
                setReportName(formData.reportName);
            }

            // Load editable cell values
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

            // Load checkbox states
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox, index) => {
                const key = `checkbox_${index}`;
                if (formData[key] !== undefined) {
                    (checkbox as HTMLInputElement).checked = formData[key] as boolean;
                }
            });

            // Recalculate averages after a brief delay to ensure DOM is updated
            setTimeout(() => {
                calculateAverages();
            }, 100);

            setHasUnsavedChanges(true);
        }
    };

    const clearFormData = () => {
        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('has-content');
        });

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            (checkbox as HTMLInputElement).checked = false;
        });

        setReportName('');

        // Clear editing data
        sessionStorage.removeItem('editingReportIndex');
        sessionStorage.removeItem('editingReportData');

        const averageCells = document.querySelectorAll('.average-cell');
        averageCells.forEach(cell => {
            cell.textContent = '0';
        });

        const meanCell = document.querySelector('.mean-cell');
        if (meanCell) {
            meanCell.textContent = '0';
        }

        // Only clear session storage when explicitly clearing the form
        // (not during normal navigation)
        sessionStorage.removeItem('gelTestFormData');
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

        const reportData: GelTestReport = {
            name: reportName,
            timestamp: new Date().toISOString(),
            formData: {}
        };

        // Collect current form data
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
                // Same name - update the existing report
                savedReports[index] = reportData;
                showAlert('success', 'Report updated successfully!');
            } else {
                // Different name - create new report and keep the old one
                savedReports.push(reportData);
                showAlert('success', 'New report created with updated name!');
            }

            // Clear the editing data
            sessionStorage.removeItem('editingReportIndex');
            sessionStorage.removeItem('editingReportData');
        } else {
            // New report (not editing)
            savedReports.push(reportData);
            showAlert('success', 'Report saved successfully!');
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReports));
        clearFormData();
        loadSavedReports();
        setActiveTab('saved-reports');
    };

    const deleteSavedReport = (index: number) => {
        showConfirm({
            title: 'Delete Report',
            message: 'Are you sure you want to delete this report? This action cannot be undone.',
            type: 'warning',
            confirmText: 'Delete',
            onConfirm: function () {
                const savedReports = getSavedReports();
                savedReports.splice(index, 1);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReports));
                loadSavedReports();
                showAlert('info', 'Report deleted successfully');
            }
        });
    };

    const previewSavedReport = (index: number) => {
        const reports = getSavedReports();
        if (index < 0 || index >= reports.length) {
            showAlert('error', 'Report not found');
            return;
        }

        const report = reports[index];
        setCurrentPreviewIndex(index);

        // Show preview modal
        showPreview({
            title: `Preview: ${report.name}`,
            content: <GelTestPreview report={report} />,
            exportExcel: () => exportPreviewToExcel(index),
            exportPDF: () => exportPreviewToPDF(index)
        });
    };

    const closePreview = () => {
        setCurrentPreviewIndex(null);
    };

    // Export functions implementation
    const exportToExcel = () => {
        const table = document.querySelector('table');
        if (!table) {
            showAlert('error', 'No table found to export');
            return;
        }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(wb, ws, 'Gel Test Report');
        const fileName = reportName.trim() || 'Gel_Test_Report';
        XLSX.writeFile(wb, `${fileName}.xlsx`);
        showAlert('success', 'Excel file exported successfully');
    };

    const exportToPDF = async () => {
        const table = tableRef.current;
        if (!table) {
            showAlert('error', 'No table found to export');
            return;
        }

        try {
            const fileName = reportName.trim() || 'Gel_Test_Report';

            // Extract all form data
            const formData: { [key: string]: string | boolean } = {};

            // Extract editable cells
            const editableCells = document.querySelectorAll('.editable');
            editableCells.forEach((cell, index) => {
                formData[`editable_${index}`] = cell.textContent?.trim() || '';
            });

            // Extract checkbox states
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox, index) => {
                formData[`checkbox_${index}`] = (checkbox as HTMLInputElement).checked;
            });

            // Extract data cells
            const dataCells = document.querySelectorAll('.data-cell');
            dataCells.forEach((cell, index) => {
                // You might want to create a better mapping for data cells
                formData[`data_${index}`] = cell.textContent?.trim() || '';
            });

            // Extract averages
            const averages: { [key: string]: string } = {};
            const averageCells = document.querySelectorAll('.average-cell');
            averageCells.forEach((cell, index) => {
                averages[`average_${index}`] = cell.textContent?.trim() || '0';
            });

            const meanCell = document.querySelector('.mean-cell');
            if (meanCell) {
                averages.mean = meanCell.textContent?.trim() || '0';
            }

            // Generate PDF using the modular component
            const blob = await pdf(
                <GelTestPDF
                    reportName={fileName}
                    tableData={formData}
                    averages={averages}
                />
            ).toBlob();

            saveAs(blob, `${fileName}.pdf`);
            showAlert('success', 'PDF exported successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            showAlert('error', 'Error generating PDF. Please try again.');
        }
    };

    const exportPreviewToExcel = (index: number) => {
        const reports = getSavedReports();
        if (index < 0 || index >= reports.length) {
            showAlert('error', 'Report not found');
            return;
        }
        const report = reports[index];
        const previewTable = document.querySelector('.preview-report-content');
        if (!previewTable) {
            showAlert('error', 'No preview table found to export');
            return;
        }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(previewTable);
        XLSX.utils.book_append_sheet(wb, ws, 'Gel Test Report');
        XLSX.writeFile(wb, `${report.name}.xlsx`);
        showAlert('success', 'Excel file exported successfully');
    };

    const exportPreviewToPDF = async (index: number) => {
        const reports = getSavedReports();
        if (index < 0 || index >= reports.length) {
            showAlert('error', 'Report not found');
            return;
        }

        const report = reports[index];
        const previewTable = document.querySelector('.preview-table');

        if (!previewTable) {
            showAlert('error', 'No preview table found to export');
            return;
        }

        try {
            const { jsPDF } = (window as any).jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');

            // Add title
            doc.setFontSize(16);
            doc.text(report.name, 105, 15, { align: 'center' });

            // Add current date
            const currentDate = new Date().toLocaleDateString();
            doc.setFontSize(10);
            doc.text(`Generated on: ${currentDate}`, 105, 22, { align: 'center' });

            // Convert table to canvas using html2canvas
            const canvas = await (window as any).html2canvas(previewTable);
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 190;
            const imgHeight = canvas.height * imgWidth / canvas.width;

            // Add image to PDF
            doc.addImage(imgData, 'PNG', 10, 30, imgWidth, imgHeight);

            // Save the PDF
            doc.save(`${report.name}.pdf`);
            showAlert('success', 'PDF file exported successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            showAlert('error', 'Error generating PDF. Please try again.');
        }
    };

    // Set up event listeners when component mounts
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

        // Cleanup event listeners
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

    // Handle report name changes
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
                            className={`tab ${activeTab === 'edit-report' ? 'active bg-white text-[#667eea] border-b-[rgba(48,30,107,1)] border-b-4 translate-y--0.5' : 'bg-[rgba(255,255,255,0.2)] text-white border-none translate-none'} py-3 px-6 rounded-tr-xl rounded-tl-xl text-center cursor-pointer font-bold transition-all mx-0.5 w-full`}
                            onClick={() => setActiveTab('edit-report')}
                        >
                            Edit Report
                        </div>
                        <div

                            className={`tab ${activeTab === 'saved-reports' ? 'active bg-white text-[#667eea] border-b-[rgba(48,30,107,1)] border-b-4 translate-y--0.5' : 'bg-[rgba(255,255,255,0.2)] text-white border-none translate-none'} py-3 px-6 rounded-tr-xl rounded-tl-xl text-center cursor-pointer font-bold transition-all mx-0.5 w-full`}
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
                                    className="report-name-input p-2.5 rounded-md bg-white border-b-[rgba(48,30,107)] border-b-2 w-[50%] text-center text-md"
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
                                        {/* Continue with the rest of the table rows */}
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
                                            <td colSpan={4} className="section-title font-bold bg-gray-100 text-center">Tested By</td>
                                            <td colSpan={5} className="section-title font-bold bg-gray-100 text-center">Reviewed By</td>
                                            <td colSpan={5} className="section-title font-bold bg-gray-100 text-center">Approved By</td>
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
                        <div className="tab-content active">
                            <div className="saved-reports-container bg-white p-5 rounded-md shadow-lg mx-4 my-3">
                                <h2 className="text-3xl font-bold mb-4 text-center">Saved Gel Test Reports</h2>

                                {savedReports.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500 text-lg">No saved reports found.</p>
                                        <p className="text-gray-400 mt-2">Create and save your first report in the "Edit Report" tab.</p>
                                    </div>
                                ) : (
                                    <div className="reports-list">
                                        {savedReports.map((report, index) => (
                                            <div key={index} className="report-item border border-gray-200 rounded-lg p-4 mb-4 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h3 className="text-xl font-semibold text-gray-800">{report.name}</h3>
                                                        <p className="text-gray-500 text-sm mt-1">
                                                            Saved on: {new Date(report.timestamp).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <button
                                                            className="preview-btn cursor-pointer px-4 py-2 bg-blue-500 text-white text-sm rounded-md font-medium transition-colors hover:bg-blue-600"
                                                            onClick={() => previewSavedReport(index)}
                                                        >
                                                            Preview
                                                        </button>
                                                        <button
                                                            className="preview-btn cursor-pointer px-4 py-2 bg-green-500 text-white text-sm rounded-md font-medium transition-colors hover:bg-green-600"
                                                            onClick={() => editSavedReport(index)}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            className="delete-btn cursor-pointer px-4 py-2 bg-red-500 text-white text-sm rounded-md font-medium transition-colors hover:bg-red-600"
                                                            onClick={() => deleteSavedReport(index)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}