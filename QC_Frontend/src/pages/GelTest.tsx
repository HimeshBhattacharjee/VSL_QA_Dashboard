import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useEffect, useRef, useState } from 'react';

// Define types for our report data
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
    const [currentPreviewIndex, setCurrentPreviewIndex] = useState<number | null>(null);

    const tableRef = useRef<HTMLTableElement>(null);
    const previewModalRef = useRef<HTMLDivElement>(null);
    const alertContainerRef = useRef<HTMLDivElement>(null);

    // Storage key for saved reports
    const STORAGE_KEY = 'gelTestReports';

    const handleBackToTests = () => {
        if (hasUnsavedChanges) {
            if (window.confirm('You have unsaved changes. Are you sure you want to leave? Your changes will be lost.')) {
                clearFormData();
                navigate('/quality-tests');
            }
        } else {
            clearFormData();
            navigate('/quality-tests');
        }
    };

    const handleHomeNavigation = () => {
        if (hasUnsavedChanges) {
            if (window.confirm('You have unsaved changes. Are you sure you want to leave? Your changes will be lost.')) {
                clearFormData();
                navigate('/');
            }
        } else {
            clearFormData();
            navigate('/');
        }
    };

    // Initialize the component
    useEffect(() => {
        initializeForm();
        loadSavedReports();

        // Load any previously entered data from session storage
        loadFormData();
    }, []);

    // Initialize form functionality
    const initializeForm = () => {
        // This would be replaced with actual form initialization logic
        // For now, we'll set up basic event listeners
        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach(cell => {
            if (!cell.classList.contains('data-cell')) {
                cell.addEventListener('click', handleEditableCellClick);
            }
        });

        const dataCells = document.querySelectorAll('.data-cell');
        dataCells.forEach(cell => {
            cell.addEventListener('click', handleDataCellClick);
        });

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', handleCheckboxChange);
        });

        calculateAverages();
    };

    const handleEditableCellClick = (e: Event) => {
        const cell = e.target as HTMLElement;
        const currentText = cell.textContent || '';

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

            if (newValue) {
                cell.classList.add('has-content');
            } else {
                cell.classList.remove('has-content');
            }

            setHasUnsavedChanges(true);
            saveFormData();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        };

        input.addEventListener('blur', handleBlur);
        input.addEventListener('keydown', handleKeyDown);
    };

    const handleDataCellClick = (e: Event) => {
        const cell = e.target as HTMLElement;
        const currentText = cell.textContent || '';

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

                if (value) {
                    cell.classList.add('has-content');
                } else {
                    cell.classList.remove('has-content');
                }

                calculateAverages();
                setHasUnsavedChanges(true);
                saveFormData();
            } else {
                showAlert('error', 'Please enter a valid number (with or without % sign)');
                cell.textContent = currentText || '';
                if (currentText) {
                    cell.classList.add('has-content');
                }
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

    const handleCheckboxChange = () => {
        setHasUnsavedChanges(true);
        saveFormData();
    };

    const calculateAverages = () => {
        // Implementation of average calculation
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

    const saveFormData = () => {
        const formData: { [key: string]: string | boolean } = {};

        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach((cell, index) => {
            formData[`editable_${index}`] = cell.textContent?.trim() || '';
        });

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            formData[`checkbox_${index}`] = (checkbox as HTMLInputElement).checked;
        });

        sessionStorage.setItem('gelTestFormData', JSON.stringify(formData));
    };

    const loadFormData = () => {
        const savedData = sessionStorage.getItem('gelTestFormData');
        if (savedData) {
            const formData = JSON.parse(savedData);

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

            calculateAverages();
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

        const averageCells = document.querySelectorAll('.average-cell');
        averageCells.forEach(cell => {
            cell.textContent = '0';
        });

        const meanCell = document.querySelector('.mean-cell');
        if (meanCell) {
            meanCell.textContent = '0';
        }

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

        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach((cell, index) => {
            reportData.formData[`editable_${index}`] = cell.textContent?.trim() || '';
        });

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            reportData.formData[`checkbox_${index}`] = (checkbox as HTMLInputElement).checked;
        });

        const savedReports = getSavedReports();
        savedReports.push(reportData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReports));

        clearFormData();
        showAlert('success', 'Report saved successfully!');
        loadSavedReports();
        setActiveTab('saved-reports');
    };

    const deleteSavedReport = (index: number) => {
        if (window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
            const savedReports = getSavedReports();
            savedReports.splice(index, 1);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReports));
            loadSavedReports();
            showAlert('info', 'Report deleted successfully');
        }
    };

    const previewSavedReport = (index: number) => {
        const reports = getSavedReports();
        if (index < 0 || index >= reports.length) {
            showAlert('error', 'Report not found');
            return;
        }

        setCurrentPreviewIndex(index);
        // Show preview modal logic would go here
    };

    const closePreview = () => {
        setCurrentPreviewIndex(null);
    };

    const showAlert = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
        const alertContainer = alertContainerRef.current;
        if (!alertContainer) return;

        const alert = document.createElement('div');
        alert.className = `alert ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        alert.innerHTML = `
      <div class="alert-icon">${icons[type]}</div>
      <div class="alert-content">
        <div class="alert-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
        <div class="alert-message">${message}</div>
      </div>
      <button class="alert-close">&times;</button>
    `;

        const closeButton = alert.querySelector('.alert-close') as HTMLButtonElement;
        closeButton.addEventListener('click', () => {
            alert.classList.add('fade-out');
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 500);
        });

        alertContainer.appendChild(alert);

        setTimeout(() => {
            if (alert.parentNode) {
                alert.classList.add('fade-out');
                setTimeout(() => {
                    if (alert.parentNode) {
                        alert.parentNode.removeChild(alert);
                    }
                }, 500);
            }
        }, 5000);
    };

    // Export functions would be implemented here
    const exportToExcel = () => {
        showAlert('info', 'Excel export functionality would be implemented here');
    };

    const exportToPDF = () => {
        showAlert('info', 'PDF export functionality would be implemented here');
    };

    const exportPreviewToExcel = () => {
        showAlert('info', 'Preview Excel export would be implemented here');
    };

    const exportPreviewToPDF = () => {
        showAlert('info', 'Preview PDF export would be implemented here');
    };

    return (
        <>
            <div className="min-h-screen">
                <Header />
                <div className="container">
                    <div className="text-center text-white mb-6">
                        <button onClick={handleBackToTests}
                            className="bg-white/20 text-white border-2 border-white px-4 py-1 rounded-3xl cursor-pointer text-md font-bold transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-x-1"
                        >
                            <span className="font-bold text-lg">⇐</span> Back to Quality Tests
                        </button>
                    </div>

                    <div className="flex justify-center m-1">
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
                            <div className="save-actions flex justify-center text-center gap-4 my-2.5">
                                <input
                                    type="text"
                                    value={reportName}
                                    onChange={(e) => setReportName(e.target.value)}
                                    className="report-name-input p-2.5 rounded-md bg-white border-b-[rgba(48, 30, 107)] border-b-2 w-[50%]"
                                    placeholder="Enter report name"
                                />
                                <button
                                    className="save-btn w-[15%]"
                                    onClick={saveReport}
                                    style={{
                                        padding: '10px',
                                        borderRadius: '5px',
                                        border: 'none',
                                        borderBottom: '2px solid white',
                                        cursor: 'pointer',
                                        fontFamily: "'Poppins', sans-serif",
                                        fontWeight: '600',
                                        transition: 'all 0.3s ease',
                                        background: 'linear-gradient(135deg, rgba(123, 0, 255, 0.29) 0%, rgba(76, 0, 198, 0.637) 100%)',
                                        color: 'white'
                                    }}
                                >
                                    Save Report
                                </button>
                                <button
                                    className="save-btn export-excel"
                                    onClick={exportToExcel}
                                    style={{
                                        width: '15%',
                                        padding: '10px',
                                        borderRadius: '5px',
                                        border: 'none',
                                        borderBottom: '2px solid white',
                                        cursor: 'pointer',
                                        fontFamily: "'Poppins', sans-serif",
                                        fontWeight: '600',
                                        transition: 'all 0.3s ease',
                                        backgroundColor: '#27ae60',
                                        color: 'white'
                                    }}
                                >
                                    Export as Excel
                                </button>
                                <button
                                    className="save-btn export-pdf"
                                    onClick={exportToPDF}
                                    style={{
                                        width: '15%',
                                        padding: '10px',
                                        borderRadius: '5px',
                                        border: 'none',
                                        borderBottom: '2px solid white',
                                        cursor: 'pointer',
                                        fontFamily: "'Poppins', sans-serif",
                                        fontWeight: '600',
                                        transition: 'all 0.3s ease',
                                        backgroundColor: '#e74c3c',
                                        color: 'white'
                                    }}
                                >
                                    Export as PDF
                                </button>
                            </div>

                            <div className="test-report-container" style={{
                                backgroundColor: 'white',
                                padding: '20px',
                                borderRadius: '5px',
                                boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)'
                            }}>
                                <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                                    <tbody>
                                        <tr>
                                            <td colSpan={2} rowSpan={3}><img src="../LOGOS/VSL_Logo (1).png" height="70" alt="VSL Logo" /></td>
                                            <td colSpan={8} rowSpan={2} className="section-title" style={{ fontSize: '28px', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>VIKRAM SOLAR LIMITED</td>
                                            <td colSpan={3} rowSpan={1} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Doc. No.: VSL/QAD/FM/90</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Issue Date: 11.01.2023</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={8} className="section-title" style={{ fontSize: '20px', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Gel Content Test Report</td>
                                            <td colSpan={3} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Rev. No./ Date: 03/ 25.02.2025</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={10} rowSpan={3}>
                                                <div className="allowable-limit" style={{
                                                    padding: '10px',
                                                    backgroundColor: '#f8f9fa',
                                                    borderLeft: '4px solid #3498db',
                                                    textAlign: 'left'
                                                }}>
                                                    <strong style={{ padding: '10px' }}>Allowable Limit:</strong>
                                                    <div className="checkbox-container" style={{ display: 'flex' }}>
                                                        <div className="checkbox-item" style={{ display: 'flex', alignItems: 'center', margin: '0 5px' }}>
                                                            <label htmlFor="eva-epe-checkbox">1. Gel Content should be: 75 to 95% for EVA & EPE</label>
                                                            <input type="checkbox" id="eva-checkbox" name="encapsulant" value="EVA" />
                                                        </div>
                                                    </div>
                                                    <div className="checkbox-container" style={{ display: 'flex' }}>
                                                        <div className="checkbox-item" style={{ display: 'flex', alignItems: 'center', margin: '0 5px' }}>
                                                            <label htmlFor="poe-checkbox">2. Gel Content should be: ≥ 60% for POE</label>
                                                            <input type="checkbox" id="eva-checkbox" name="encapsulant" value="EVA" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td colSpan={1}>Inv. No./ Date:</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={1}>P.O. No.:</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={1}>Type of Test:</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={10} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Laminator Parameter</td>
                                            <td colSpan={1}>Laminator Details:</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Process Name</td>
                                            <td colSpan={2}>Lam - 1</td>
                                            <td colSpan={3}>Lam - 2</td>
                                            <td colSpan={3}>Lam - 3 (CP)</td>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>MATERIAL INFORMATION (S)</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Pumping Time (Sec)</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={1} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Encapsulant Types:</td>
                                            <td colSpan={2}>
                                                <div className="checkbox-container" style={{ display: 'flex' }}>
                                                    <div className="checkbox-item" style={{ display: 'flex', alignItems: 'center', margin: '0 5px' }}>
                                                        <label htmlFor="eva-checkbox">EVA</label>
                                                        <input type="checkbox" id="eva-checkbox" name="encapsulant" value="EVA" />
                                                    </div>
                                                    <div className="checkbox-item" style={{ display: 'flex', alignItems: 'center', margin: '0 5px' }}>
                                                        <label htmlFor="epe-checkbox">EPE</label>
                                                        <input type="checkbox" id="epe-checkbox" name="encapsulant" value="EPE" />
                                                    </div>
                                                    <div className="checkbox-item" style={{ display: 'flex', alignItems: 'center', margin: '0 5px' }}>
                                                        <label htmlFor="poe-checkbox">POE</label>
                                                        <input type="checkbox" id="poe-checkbox" name="encapsulant" value="POE" />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Continue with the rest of the table rows */}
                                        <tr>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Pressing/Cooling Time (Sec)</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={1} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Encapsulant Supplier:</td>
                                            <td colSpan={2}>FIRST</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Venting Time (Sec)</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={1} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Category:</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Lower Heating (˚C)</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={1} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Batch/Lot No.:</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Upper Heating (˚C)</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={1} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>MFG. Date:</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Upper Pressure (Kpa)</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={1} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Exp. Date:</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Lower Pressure (Kpa)</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={1} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Glass Size:</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={13}><img src="../IMAGES/GelTest.jpg" width="100%" alt="Gel Test" /></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Date, Shift, & Time</td>
                                            <td className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Workshop</td>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Platen Position (A/B/C/D/E/F/G)</td>
                                            <td className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>#1</td>
                                            <td className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>#2</td>
                                            <td className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>#3</td>
                                            <td className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>#4</td>
                                            <td className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>#5</td>
                                            <td className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Average (A/B/C/D/E/F/G)</td>
                                            <td className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Mean</td>
                                        </tr>
                                        {/* Data rows for positions A-G */}
                                        <tr>
                                            <td colSpan={2} rowSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td rowSpan={7}>VSL FAB-II</td>
                                            <td colSpan={2}>A</td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="average-cell" style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>0</td>
                                            <td rowSpan={7} className="mean-cell" style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2}>B</td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="average-cell" style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} rowSpan={5} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={2}>C</td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="average-cell" style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2}>D</td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="average-cell" style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2}>E</td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="average-cell" style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2}>F</td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="average-cell" style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2}>G</td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="editable data-cell" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td className="average-cell" style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>0</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={13} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>CONCLUSION</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={13} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={13} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>REMARKS</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={13} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Tested By</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Checked By</td>
                                            <td colSpan={2} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                            <td colSpan={2} className="section-title" style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Approved By</td>
                                            <td colSpan={3} className="editable" style={{ minHeight: '20px', cursor: 'text' }}></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'saved-reports' && (
                        <div className="tab-content active">
                            <div className="saved-reports-container" style={{
                                backgroundColor: 'white',
                                padding: '20px',
                                borderRadius: '5px',
                                boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)'
                            }}>
                                <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>Saved Gel Test Reports</h2>

                                {savedReports.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: '#666' }}>No saved reports found.</p>
                                ) : (
                                    <div className="reports-list">
                                        {savedReports.map((report, index) => (
                                            <div key={index} className="report-item" style={{
                                                padding: '15px',
                                                border: '1px solid #ddd',
                                                borderRadius: '5px',
                                                marginBottom: '10px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div>
                                                    <h3 style={{ margin: '0 0 5px 0', color: '#333' }}>{report.name}</h3>
                                                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                                                        {new Date(report.timestamp).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="report-actions" style={{ display: 'flex', gap: '10px' }}>
                                                    <button
                                                        className="preview-btn"
                                                        onClick={() => previewSavedReport(index)}
                                                        style={{
                                                            padding: '5px 10px',
                                                            backgroundColor: '#3498db',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Preview
                                                    </button>
                                                    <button
                                                        className="delete-btn"
                                                        onClick={() => deleteSavedReport(index)}
                                                        style={{
                                                            padding: '5px 10px',
                                                            backgroundColor: '#e74c3c',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Alert Container */}
                    <div ref={alertContainerRef} className="alert-container" style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        zIndex: 1000,
                        maxWidth: '400px'
                    }}></div>

                    {/* Preview Modal */}
                    {currentPreviewIndex !== null && (
                        <div ref={previewModalRef} className="preview-modal" style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 1001
                        }}>
                            <div className="preview-content" style={{
                                backgroundColor: 'white',
                                padding: '20px',
                                borderRadius: '5px',
                                maxWidth: '90%',
                                maxHeight: '90%',
                                overflow: 'auto',
                                position: 'relative'
                            }}>
                                <button
                                    className="close-preview"
                                    onClick={closePreview}
                                    style={{
                                        position: 'absolute',
                                        top: '10px',
                                        right: '10px',
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '24px',
                                        cursor: 'pointer',
                                        color: '#333'
                                    }}
                                >
                                    &times;
                                </button>

                                <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
                                    {savedReports[currentPreviewIndex]?.name} - Preview
                                </h2>

                                <div className="preview-actions" style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    marginBottom: '20px'
                                }}>
                                    <button
                                        className="export-excel"
                                        onClick={exportPreviewToExcel}
                                        style={{
                                            padding: '10px 20px',
                                            backgroundColor: '#27ae60',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '5px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Export to Excel
                                    </button>
                                    <button
                                        className="export-pdf"
                                        onClick={exportPreviewToPDF}
                                        style={{
                                            padding: '10px 20px',
                                            backgroundColor: '#e74c3c',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '5px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Export to PDF
                                    </button>
                                </div>

                                <div className="preview-table" style={{
                                    backgroundColor: 'white',
                                    padding: '20px',
                                    borderRadius: '5px'
                                }}>
                                    {/* Preview content would be rendered here */}
                                    <p>Preview content for {savedReports[currentPreviewIndex]?.name}</p>
                                    <p>Date: {savedReports[currentPreviewIndex] && new Date(savedReports[currentPreviewIndex].timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <style>{`
        .editable {
          position: relative;
          min-height: 20px;
          cursor: text;
          border: 1px solid transparent;
          transition: border-color 0.2s ease;
        }
        
        .editable:hover {
          border-color: #3498db;
        }
        
        .editable.has-content {
          background-color: #f8f9fa;
        }
        
        .data-cell {
          text-align: center;
        }
        
        .alert {
          display: flex;
          align-items: center;
          padding: 15px;
          margin-bottom: 10px;
          border-radius: 5px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          animation: slideIn 0.3s ease;
          transition: opacity 0.5s ease;
        }
        
        .alert.fade-out {
          opacity: 0;
        }
        
        .alert.success {
          background-color: #d4edda;
          color: #155724;
          border-left: 4px solid #28a745;
        }
        
        .alert.error {
          background-color: #f8d7da;
          color: #721c24;
          border-left: 4px solid #dc3545;
        }
        
        .alert.warning {
          background-color: #fff3cd;
          color: #856404;
          border-left: 4px solid #ffc107;
        }
        
        .alert.info {
          background-color: #d1ecf1;
          color: #0c5460;
          border-left: 4px solid #17a2b8;
        }
        
        .alert-icon {
          margin-right: 10px;
          font-size: 20px;
        }
        
        .alert-content {
          flex: 1;
        }
        
        .alert-title {
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .alert-close {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: inherit;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .section-title {
          text-align: center;
        }
        
        table {
          border-collapse: collapse;
        }
        
        td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: center;
        }
        
        .checkbox-container {
          display: flex;
          flex-wrap: wrap;
        }
        
        .checkbox-item {
          display: flex;
          align-items: center;
          margin-right: 15px;
        }
        
        .checkbox-item input {
          margin-left: 5px;
        }
        
        .back-button:hover {
          background: rgba(255, 255, 255, 0.3) !important;
          transform: translateY(-2px);
        }
        
        .save-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .export-excel:hover {
          background-color: #219955 !important;
        }
        
        .export-pdf:hover {
          background-color: #c0392b !important;
        }
        
        .preview-btn:hover {
          background-color: #2980b9;
        }
        
        .delete-btn:hover {
          background-color: #c0392b;
        }
      `}</style>
            </div>
        </>
    );
}