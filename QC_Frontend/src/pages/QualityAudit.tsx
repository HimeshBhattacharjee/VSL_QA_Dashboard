import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { initialStages } from '../audit-data';
import { AuditData, StageData } from '../types/audit';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import { useLine } from '../context/LineContext';
import { LINE_DEPENDENT_CONFIG } from '../audit-data/lineConfig';
import SavedReportsNChecksheets from '../components/SavedReportsNChecksheets';
import { createTabbingStringingStage } from '../audit-data/stage5';
import { createAutoBussingStage } from '../audit-data/stage7';
import { createAutoTapingNLayupStage } from '../audit-data/stage8';
import { createLaminationStage } from '../audit-data/stage14';
import { createAutoTrimmingStage } from '../audit-data/stage15';
import { createAutoFramingStage } from '../audit-data/stage17';
import { createJunctionBoxFixingStage } from '../audit-data/stage18';
import { createAutoJBSolderingStage } from '../audit-data/stage19';
import { createAutoPottingStage } from '../audit-data/stage20';
import { createCuringStage } from '../audit-data/stage21';
import { createAutoFilingStage } from '../audit-data/stage22';
import { createSunSimulatorStage } from '../audit-data/stage24';
import { createSafetyTestStage } from '../audit-data/stage26';

interface SavedChecksheet {
    _id?: string;
    id: string;
    name: string;
    timestamp: number;
    data: AuditData;
}

const useLineDependentStages = (baseStages: StageData[], lineNumber: string) => {
    return useMemo(() => {
        if (!lineNumber) return baseStages;
        return baseStages.map(stage => {
            if (stage.id === 5) return createTabbingStringingStage(lineNumber);
            if (stage.id === 7) return createAutoBussingStage(lineNumber);
            if (stage.id === 8) return createAutoTapingNLayupStage(lineNumber);
            if (stage.id === 14) return createLaminationStage(lineNumber);
            if (stage.id === 15) return createAutoTrimmingStage(lineNumber);
            if (stage.id === 17) return createAutoFramingStage(lineNumber);
            if (stage.id === 18) return createJunctionBoxFixingStage(lineNumber);
            if (stage.id === 19) return createAutoJBSolderingStage(lineNumber);
            if (stage.id === 20) return createAutoPottingStage(lineNumber);
            if (stage.id === 21) return createCuringStage(lineNumber);
            if (stage.id === 22) return createAutoFilingStage(lineNumber);
            if (stage.id === 24) return createSunSimulatorStage(lineNumber);
            if (stage.id === 26) return createSafetyTestStage(lineNumber);
            const stageConfig = LINE_DEPENDENT_CONFIG[stage.id as keyof typeof LINE_DEPENDENT_CONFIG];
            if (!stageConfig) return stage;

            const lineOptions = stageConfig.lineMapping[lineNumber];
            if (!lineOptions || !Array.isArray(lineOptions)) return stage;

            return {
                ...stage,
                parameters: stage.parameters.map(param => {
                    if (stageConfig.parameters.includes(param.id)) {
                        return {
                            ...param,
                            observations: lineOptions.map((option: string) => ({
                                timeSlot: option,
                                value: ""
                            }))
                        };
                    }
                    return param;
                })
            };
        });
    }, [baseStages, lineNumber]);
};

export default function QualityAudit() {
    const navigate = useNavigate();
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const { lineNumber, setLineNumber } = useLine();
    const [activeTab, setActiveTab] = useState<'create-edit' | 'saved-reports'>('create-edit');
    const [currentView, setCurrentView] = useState<'basicInfo' | 'stageSelection' | 'stageDetail'>('basicInfo');
    const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
    const [stageChanges, setStageChanges] = useState<Set<number>>(new Set());
    const [savedChecksheets, setSavedChecksheets] = useState<SavedChecksheet[]>([]);
    const [currentChecksheetId, setCurrentChecksheetId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [auditBySignature, setAuditBySignature] = useState<string>('');
    const [reviewedBySignature, setReviewedBySignature] = useState<string>('');
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);

    const IPQC_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/ipqc-audits';

    const apiService = {
        // Get all audits
        getAllAudits: async (): Promise<any[]> => {
            const response = await fetch(`${IPQC_API_BASE_URL}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch audits: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        // Get audit by ID
        getAuditById: async (id: string): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/${id}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch audit: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        // Create new audit
        createAudit: async (audit: any): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(audit),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create audit: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        // Update existing audit
        updateAudit: async (id: string, audit: any): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(audit),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update audit: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        // Delete audit
        deleteAudit: async (id: string): Promise<void> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete audit: ${response.status} ${errorText}`);
            }
        },

        // Search audits by filters
        searchAuditsByFilters: async (filters: { lineNumber?: string; date?: string; shift?: string }): Promise<any[]> => {
            const params = new URLSearchParams();
            if (filters.lineNumber) params.append('lineNumber', filters.lineNumber);
            if (filters.date) params.append('date', filters.date);
            if (filters.shift) params.append('shift', filters.shift);

            const response = await fetch(`${IPQC_API_BASE_URL}/search/by-filters?${params}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to search audits: ${response.status} ${errorText}`);
            }
            return response.json();
        },
    };

    useEffect(() => {
        const storedUserRole = sessionStorage.getItem('userRole');
        const storedUsername = sessionStorage.getItem('username');
        setUserRole(storedUserRole);
        setUsername(storedUsername);
    }, []);

    useEffect(() => {
        loadSavedChecksheets();
    }, []);

    const handleAddSignature = async (section: 'audit' | 'reviewed') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }

        // Check if signature already exists in this section
        let currentSignature = '';
        switch (section) {
            case 'audit':
                currentSignature = auditBySignature;
                break;
            case 'reviewed':
                currentSignature = reviewedBySignature;
                break;
        }

        if (currentSignature.trim()) {
            showAlert('error', `Signature already exists in ${section} section. Please remove it first.`);
            return;
        }

        // Check role permissions
        if (section === 'audit' && userRole !== 'Operator') {
            showAlert('error', 'Only Operators can add signature to Audit By section');
            return;
        }

        if (section === 'reviewed' && !['Supervisor', 'Manager'].includes(userRole || '')) {
            showAlert('error', 'Only Supervisors or Managers can add signature to Reviewed By section');
            return;
        }

        const signatureText = `${username}`;

        try {
            setIsLoading(true);

            // Update signature state
            const newAuditSig = section === 'audit' ? signatureText : auditBySignature;
            const newReviewedSig = section === 'reviewed' ? signatureText : reviewedBySignature;

            switch (section) {
                case 'audit':
                    setAuditBySignature(signatureText);
                    break;
                case 'reviewed':
                    setReviewedBySignature(signatureText);
                    break;
            }

            setHasUnsavedChanges(true);

            // Auto-save the signatures immediately after adding signature
            if (auditData.lineNumber && auditData.date && auditData.shift) {
                // Pass explicit values to avoid React state race condition
                await saveSignaturesImmediately({
                    auditBy: newAuditSig,
                    reviewedBy: newReviewedSig
                });
                showAlert('success', `Signature added to ${section} section and saved!`);
            } else {
                showAlert('success', `Signature added to ${section} section`);
            }
        } catch (error) {
            console.error('Error adding signature:', error);
            showAlert('error', 'Failed to add signature');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveSignature = async (section: 'audit' | 'reviewed') => {
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }

        // Check if current user is the one who added the signature
        let currentSignature = '';
        switch (section) {
            case 'audit':
                currentSignature = auditBySignature;
                break;
            case 'reviewed':
                currentSignature = reviewedBySignature;
                break;
        }

        if (!currentSignature.includes(username)) {
            showAlert('error', 'You can only remove your own signature');
            return;
        }

        try {
            setIsLoading(true);

            // Calculate new signature values after removal
            const newAuditSig = section === 'audit' ? '' : auditBySignature;
            const newReviewedSig = section === 'reviewed' ? '' : reviewedBySignature;

            // Remove signature state
            switch (section) {
                case 'audit':
                    setAuditBySignature('');
                    break;
                case 'reviewed':
                    setReviewedBySignature('');
                    break;
            }

            setHasUnsavedChanges(true);

            // Auto-save the signatures immediately after removing signature
            if (auditData.lineNumber && auditData.date && auditData.shift) {
                // Pass explicit values to avoid React state race condition
                await saveSignaturesImmediately({
                    auditBy: newAuditSig,
                    reviewedBy: newReviewedSig
                });
                showAlert('info', `Signature removed from ${section} section and saved!`);
            } else {
                showAlert('info', `Signature removed from ${section} section`);
            }
        } catch (error) {
            console.error('Error removing signature:', error);
            showAlert('error', 'Failed to remove signature');
        } finally {
            setIsLoading(false);
        }
    };

    // Check if remove button should be enabled for each section
    const canRemoveSignature = (section: 'audit' | 'reviewed') => {
        if (!username) return false;

        let currentSignature = '';
        switch (section) {
            case 'audit':
                currentSignature = auditBySignature;
                break;
            case 'reviewed':
                currentSignature = reviewedBySignature;
                break;
        }

        return currentSignature.includes(username);
    };

    const canAddSignature = (section: 'audit' | 'reviewed') => {
        if (!username) return false;

        // Check if signature already exists in this section
        let currentSignature = '';
        switch (section) {
            case 'audit':
                currentSignature = auditBySignature;
                break;
            case 'reviewed':
                currentSignature = reviewedBySignature;
                break;
        }

        if (currentSignature.trim()) {
            return false; // Cannot add if signature already exists
        }

        switch (section) {
            case 'audit':
                return userRole === 'Operator';
            case 'reviewed':
                return ['Supervisor', 'Manager'].includes(userRole || '');
            default:
                return false;
        }
    };

    const loadSavedChecksheets = async () => {
        try {
            setIsLoading(true);
            const audits = await apiService.getAllAudits();
            console.log('Loaded audits from MongoDB:', audits); // Debug log

            // Convert MongoDB audits to SavedChecksheet format
            const checksheets = audits.map(audit => {
                // Ensure the data structure is correct
                if (!audit.data) {
                    console.warn('Audit missing data field:', audit);
                    return null;
                }

                return {
                    _id: audit._id,
                    id: audit._id || '', // Use MongoDB _id as id
                    name: audit.name,
                    timestamp: new Date(audit.timestamp).getTime(),
                    data: audit.data
                };
            }).filter(Boolean) as SavedChecksheet[]; // Remove any null entries

            setSavedChecksheets(checksheets);
        } catch (error) {
            console.error('Error loading audits:', error);
            showAlert('error', 'Failed to load saved audits');
        } finally {
            setIsLoading(false);
        }
    };

    const lineDependentStages = useLineDependentStages(initialStages, lineNumber);

    const [auditData, setAuditData] = useState<AuditData>({
        lineNumber: '',
        date: new Date().toISOString().split('T')[0],
        shift: '',
        productionOrderNo: '',
        moduleType: '',
        customerSpecAvailable: false,
        specificationSignedOff: false,
        stages: lineDependentStages,
        signatures: {
            auditBy: '',
            reviewedBy: ''
        }
    });

    useEffect(() => {
        setAuditData(prev => ({
            ...prev,
            stages: lineDependentStages
        }));
    }, [lineDependentStages]);

    // Update your handleLineChange function
    const handleLineChange = (line: string) => {
        setLineNumber(line);
        setAuditData(prev => ({ ...prev, lineNumber: line }));
    };

    useEffect(() => {
        const checkExistingChecksheet = async () => {
            if (auditData.lineNumber && auditData.date && auditData.shift) {
                try {
                    const existingAudits = await apiService.searchAuditsByFilters({
                        lineNumber: auditData.lineNumber,
                        date: auditData.date,
                        shift: auditData.shift
                    });

                    if (existingAudits.length > 0) {
                        const existingAudit = existingAudits[0];
                        console.log('Found existing audit:', existingAudit); // Debug log

                        // Merge the saved data with current line-dependent stages
                        const mergedData = {
                            ...existingAudit.data,
                            stages: lineDependentStages.map(stage => {
                                const savedStage = existingAudit.data.stages.find(s => s.id === stage.id);
                                if (savedStage) {
                                    return {
                                        ...stage, // Current line-dependent structure
                                        parameters: stage.parameters.map(param => {
                                            const savedParam = savedStage.parameters.find(p => p.id === param.id);
                                            if (savedParam) {
                                                return {
                                                    ...param, // Current parameter structure
                                                    observations: savedParam.observations // Saved observations
                                                };
                                            }
                                            return param;
                                        })
                                    };
                                }
                                return stage;
                            })
                        };
                        setAuditData(mergedData);
                        setCurrentChecksheetId(existingAudit._id!);
                    } else {
                        setCurrentChecksheetId(null);
                    }
                } catch (error) {
                    console.error('Error checking existing checksheet:', error);
                }
            }
        };

        checkExistingChecksheet();
    }, [auditData.lineNumber, auditData.date, auditData.shift, lineDependentStages]);

    const generateChecksheetName = (lineNumber: string, date: string, shift: string) => {
        return `Checksheet - Line ${lineNumber} - ${date} - Shift ${shift}`;
    };

    const saveChecksheet = async () => {
        if (!auditData.lineNumber || !auditData.date || !auditData.shift) {
            showAlert('error', 'Line number, date, and shift are required to save checksheet.');
            return;
        }

        try {
            setIsLoading(true);
            const checksheetName = generateChecksheetName(auditData.lineNumber, auditData.date, auditData.shift);

            // Create the proper structure for MongoDB with signatures
            const checksheetData = {
                name: checksheetName,
                timestamp: new Date().toISOString(),
                data: {
                    ...auditData,
                    // Include signatures in the saved data
                    signatures: {
                        auditBy: auditBySignature,
                        reviewedBy: reviewedBySignature,
                    }
                }
            };

            if (currentChecksheetId) {
                // Update existing checksheet
                await apiService.updateAudit(currentChecksheetId, checksheetData);
                showAlert('success', 'Checksheet updated successfully!');
            } else {
                // Create new checksheet
                const result = await apiService.createAudit(checksheetData);
                setCurrentChecksheetId(result._id!);
                showAlert('success', 'Checksheet saved successfully!');
            }

            setHasUnsavedChanges(false);
            setStageChanges(new Set());
            await loadSavedChecksheets(); // Reload the list
        } catch (error) {
            console.error('Error saving checksheet:', error);
            showAlert('error', 'Failed to save checksheet');
        } finally {
            setIsLoading(false);
        }
    };

    const autoSaveChecksheet = () => {
        if (auditData.lineNumber && auditData.date && auditData.shift) {
            saveChecksheet();
        }
    };

    // Save signatures immediately to database with explicit values, avoiding React state race conditions
    const saveSignaturesImmediately = async (signatures: { auditBy: string; reviewedBy: string }) => {
        if (!auditData.lineNumber || !auditData.date || !auditData.shift) {
            return;
        }

        try {
            const checksheetName = generateChecksheetName(auditData.lineNumber, auditData.date, auditData.shift);

            // Create the proper structure for MongoDB with explicit signature values
            const checksheetData = {
                name: checksheetName,
                timestamp: new Date().toISOString(),
                data: {
                    ...auditData,
                    // Use explicit passed values, not state variables
                    signatures: {
                        auditBy: signatures.auditBy,
                        reviewedBy: signatures.reviewedBy,
                    }
                }
            };

            if (currentChecksheetId) {
                // Update existing checksheet
                await apiService.updateAudit(currentChecksheetId, checksheetData);
            } else {
                // Create new checksheet if it doesn't exist
                const result = await apiService.createAudit(checksheetData);
                setCurrentChecksheetId(result._id!);
            }

            setHasUnsavedChanges(false);
            await loadSavedChecksheets(); // Reload the list
        } catch (error) {
            console.error('Error saving signatures:', error);
        }
    };

    const handleBackToHome = () => {
        if (hasUnsavedChanges) {
            showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. Are you sure you want to leave? All unsaved data will be lost.',
                type: 'warning',
                confirmText: 'Leave',
                cancelText: 'Stay',
                onConfirm: () => {
                    setLineNumber(''); // Clear line number
                    setAuditData({
                        lineNumber: '',
                        date: new Date().toISOString().split('T')[0],
                        shift: '',
                        productionOrderNo: '',
                        moduleType: '',
                        customerSpecAvailable: false,
                        specificationSignedOff: false,
                        stages: initialStages,
                        signatures: {
                            auditBy: '',
                            reviewedBy: ''
                        }
                    });
                    setAuditBySignature('');
                    setReviewedBySignature('');
                    setCurrentChecksheetId(null);
                    setHasUnsavedChanges(false);
                    setStageChanges(new Set());
                    setCurrentView('basicInfo');
                    setSelectedStageId(null);
                    navigate('/home');
                }
            });
        } else {
            setLineNumber(''); // Clear line number
            navigate('/home');
        }
    };

    const updateObservation = (stageId: number, paramId: string, timeSlot: string, value: string | Record<string, string> | Record<string, Record<string, string>>) => {
        setAuditData(prev => ({
            ...prev,
            stages: prev.stages.map(stage =>
                stage.id === stageId ? {
                    ...stage,
                    parameters: stage.parameters.map(param =>
                        param.id === paramId ? {
                            ...param,
                            observations: param.observations.map(obs =>
                                obs.timeSlot === timeSlot ? { ...obs, value } : obs
                            )
                        } : param
                    )
                } : stage
            )
        }));
        setHasUnsavedChanges(true);
        setStageChanges(prev => new Set(prev).add(stageId));
    };

    const generateExcelReport = async () => {
        try {
            showAlert('info', 'Please wait! Exporting Excel will take some time...');
            console.log('Generating Excel with data:', auditData);
            const response = await fetch(`${IPQC_API_BASE_URL}/generate-audit-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(auditData)
            });

            if (!response.ok) {
                throw new Error('Failed to generate report');
            }

            // Create blob from response and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            // Generate filename based on audit data
            const filename = `Quality_Audit_Line${auditData.lineNumber}_${auditData.date.replace(/-/g, '')}_Shift${auditData.shift}.xlsx`;
            a.download = filename;

            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('success', 'Audit report generated successfully!');

        } catch (error) {
            console.error('Error generating report:', error);
            showAlert('error', 'Failed to generate audit report. Please try again.');
        }
    };

    const generatePDFReport = async () => {
        try {
            showAlert('info', 'Please wait! Exporting PDF will take some time...');
            console.log('Generating PDF with data:', auditData);
            const response = await fetch(`${IPQC_API_BASE_URL}/generate-audit-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(auditData)
            });

            if (!response.ok) {
                throw new Error('Failed to generate PDF report');
            }

            // Create blob from response and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            // Generate filename based on audit data
            const filename = `Quality_Audit_Line${auditData.lineNumber}_${auditData.date.replace(/-/g, '')}_Shift${auditData.shift}.pdf`;
            a.download = filename;

            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('success', 'Audit PDF report generated successfully!');

        } catch (error) {
            console.error('Error generating PDF report:', error);
            showAlert('error', 'Failed to generate audit PDF report. Please try again.');
        }
    };

    const exportSavedReportToExcel = async (index: number) => {
        try {
            const checksheet = savedChecksheets[index];
            if (!checksheet) {
                showAlert('error', 'Checksheet not found');
                return;
            }

            showAlert('info', 'Please wait! Exporting Excel will take some time...');
            console.log('Generating Excel for saved checksheet:', checksheet);
            const response = await fetch(`${IPQC_API_BASE_URL}/generate-audit-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(checksheet.data)
            });

            if (!response.ok) {
                throw new Error('Failed to generate report');
            }

            // Create blob from response and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            // Generate filename based on the saved checksheet data
            const filename = `Quality_Audit_Line${checksheet.data.lineNumber}_${checksheet.data.date.replace(/-/g, '')}_Shift${checksheet.data.shift}.xlsx`;
            a.download = filename;

            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('success', 'Excel report generated successfully!');

        } catch (error) {
            console.error('Error generating Excel report:', error);
            showAlert('error', 'Failed to generate Excel report. Please try again.');
        }
    };

    const exportSavedReportToPDF = async (index: number) => {
        try {
            const checksheet = savedChecksheets[index];
            if (!checksheet) {
                showAlert('error', 'Checksheet not found');
                return;
            }

            showAlert('info', 'Please wait! Exporting PDF will take some time...');
            console.log('Generating PDF for saved checksheet:', checksheet);
            const response = await fetch(`${IPQC_API_BASE_URL}/generate-audit-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(checksheet.data)
            });

            if (!response.ok) {
                throw new Error('Failed to generate PDF report');
            }

            // Create blob from response and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            // Generate filename based on the saved checksheet data
            const filename = `Quality_Audit_Line${checksheet.data.lineNumber}_${checksheet.data.date.replace(/-/g, '')}_Shift${checksheet.data.shift}.pdf`;
            a.download = filename;

            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('success', 'PDF report generated successfully!');

        } catch (error) {
            console.error('Error generating PDF report:', error);
            showAlert('error', 'Failed to generate PDF report. Please try again.');
        }
    };

    const isBasicInfoComplete = () => {
        return (
            auditData.lineNumber !== '' &&
            auditData.date !== '' &&
            auditData.shift !== '' &&
            auditData.productionOrderNo !== '' &&
            auditData.moduleType !== ''
        );
    };

    const handleNextFromBasicInfo = () => {
        if (isBasicInfoComplete()) {
            autoSaveChecksheet(); // Auto-save when moving to next section
            setCurrentView('stageSelection');
        } else if (auditData.lineNumber === '') {
            showAlert('error', 'Please select the line number.');
        } else if (auditData.shift === '') {
            showAlert('error', 'Please select the shift.');
        } else if (auditData.productionOrderNo === '') {
            showAlert('error', 'Please enter the production order number.');
        } else if (auditData.moduleType === '') {
            showAlert('error', 'Please enter the module type.');
        }
    };

    const handleBackToBasicInfo = () => {
        setCurrentView('basicInfo');
        setSelectedStageId(null);
    };

    const handleStageButtonClick = (stageId: number) => {
        setSelectedStageId(stageId);
        setCurrentView('stageDetail');
    };

    const handleBackToStageSelection = () => {
        if (stageChanges.has(selectedStageId!)) {
            showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes in this stage. Are you sure you want to leave? Your changes will be lost.',
                type: 'warning',
                confirmText: 'Close',
                onConfirm: () => {
                    if (currentChecksheetId) {
                        const savedChecksheet = savedChecksheets.find(sheet => sheet.id === currentChecksheetId);
                        if (savedChecksheet) {
                            setAuditData(savedChecksheet.data);
                        }
                    }
                    setStageChanges(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(selectedStageId!);
                        return newSet;
                    });
                    setHasUnsavedChanges(Array.from(stageChanges).length > 1);
                    setCurrentView('stageSelection');
                    setSelectedStageId(null);
                }
            });
        } else {
            setCurrentView('stageSelection');
            setSelectedStageId(null);
        }
    };

    const handleSaveStage = () => {
        autoSaveChecksheet(); // Save the current state
        setStageChanges(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedStageId!);
            return newSet;
        });
        setHasUnsavedChanges(Array.from(stageChanges).some(stageId => stageId !== selectedStageId));
    };

    const editSavedChecksheet = async (index: number) => {
        try {
            setIsLoading(true);
            const checksheet = savedChecksheets[index];

            // Reset to basic info view and load the saved data
            setAuditData(checksheet.data);
            setCurrentChecksheetId(checksheet._id!);
            setActiveTab('create-edit');
            setCurrentView('basicInfo');
            setHasUnsavedChanges(false);
            setStageChanges(new Set());

            // Load signatures if they exist
            if (checksheet.data.signatures) {
                setAuditBySignature(checksheet.data.signatures.auditBy || '');
                setReviewedBySignature(checksheet.data.signatures.reviewedBy || '');
            } else {
                // Initialize empty signatures if not present
                setAuditBySignature('');
                setReviewedBySignature('');
            }

            // Set the line number context
            setLineNumber(checksheet.data.lineNumber);

            showAlert('info', `Editing ${checksheet.name}`);
        } catch (error) {
            console.error('Error loading checksheet:', error);
            showAlert('error', 'Failed to load checksheet');
        } finally {
            setIsLoading(false);
        }
    };

    const deleteSavedChecksheet = async (index: number) => {
        try {
            const checksheet = savedChecksheets[index];
            await apiService.deleteAudit(checksheet._id!);
            await loadSavedChecksheets();
            if (currentChecksheetId === checksheet._id) {
                setCurrentChecksheetId(null);
                setAuditData({
                    lineNumber: '',
                    date: new Date().toISOString().split('T')[0],
                    shift: '',
                    productionOrderNo: '',
                    moduleType: '',
                    customerSpecAvailable: false,
                    specificationSignedOff: false,
                    stages: initialStages,
                    signatures: {
                        auditBy: '',
                        reviewedBy: ''
                    }
                });
                setAuditBySignature('');
                setReviewedBySignature('');
            }
            showAlert('success', 'Checksheet deleted successfully!');
        } catch (error) {
            console.error('Error deleting checksheet:', error);
            showAlert('error', 'Failed to delete checksheet');
        }
    };

    const stageButtons = Array.from({ length: 31 }, (_, index) => ({
        id: index + 1,
        label: `Stage ${index + 1}`,
        enabled: index < 31,
        hasUnsavedChanges: stageChanges.has(index + 1)
    }));

    return (
        <div className="pb-4">
            <Header />
            <div className="max-w-7xl mx-4">
                {isLoading && (
                    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-4 rounded-lg">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                            <p className="mt-2 text-gray-700">Loading...</p>
                        </div>
                    </div>
                )}
                <div className="text-center mb-6">
                    <button
                        onClick={handleBackToHome}
                        className="bg-white/20 text-white border-2 border-white px-4 py-1 rounded-3xl cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-x-1"
                    >
                        <span className="font-bold text-md">⇐</span> Back to Home
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex justify-center mb-2">
                    <button
                        onClick={() => setActiveTab('create-edit')}
                        className={`tab ${activeTab === 'create-edit' ? 'active bg-white text-[#667eea] border-b-[rgba(48,30,107,1)] border-b-2 translate-y--0.5' : 'bg-[rgba(255,255,255,0.2)] text-white border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                    >
                        Create/Edit Checksheet
                    </button>
                    <button
                        onClick={() => setActiveTab('saved-reports')}
                        className={`tab ${activeTab === 'saved-reports' ? 'active bg-white text-[#667eea] border-b-[rgba(48,30,107,1)] border-b-2 translate-y--0.5' : 'bg-[rgba(255,255,255,0.2)] text-white border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                    >
                        Saved Checksheets
                    </button>
                </div>

                {/* Create/Edit Checksheet Tab */}
                {activeTab === 'create-edit' && (
                    <div>
                        {/* Basic Information View */}
                        {currentView === 'basicInfo' && (
                            <div className="flex flex-col justify-center">
                                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                                    <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
                                        Basic Information
                                    </h2>
                                    <div className="flex flex-wrap gap-6 mb-6">
                                        {/* Report Name with Line Selector */}
                                        <div className="w-full">
                                            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                                                <span className="text-lg text-gray-800 font-medium">
                                                    Inprocess Quality Audit Report - FAB - II LINE -
                                                </span>
                                                <select
                                                    value={auditData.lineNumber}
                                                    onChange={(e) => handleLineChange(e.target.value)}
                                                    className="text-sm p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 border"
                                                >
                                                    <option value="">Select</option>
                                                    <option value="II">II</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Date */}
                                        <div className="w-full sm:w-[48%] lg:w-[23%]">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                                            <input
                                                type="date"
                                                value={auditData.date}
                                                onChange={(e) =>
                                                    setAuditData({ ...auditData, date: e.target.value })
                                                }
                                                className="p-3 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 border"
                                            />
                                        </div>

                                        {/* Shift */}
                                        <div className="w-full sm:w-[48%] lg:w-[23%]">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Shift</label>
                                            <select
                                                value={auditData.shift}
                                                onChange={(e) =>
                                                    setAuditData({ ...auditData, shift: e.target.value })
                                                }
                                                className="p-3 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 border"
                                            >
                                                <option value="">Select Shift</option>
                                                <option value="A">Shift-A</option>
                                                <option value="B">Shift-B</option>
                                                <option value="C">Shift-C</option>
                                                <option value="G">Shift-G</option>
                                            </select>
                                        </div>

                                        {/* Production Order No. */}
                                        <div className="w-full sm:w-[48%] lg:w-[23%]">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Production Order No.
                                            </label>
                                            <input
                                                type="text"
                                                value={auditData.productionOrderNo}
                                                onChange={(e) =>
                                                    setAuditData({ ...auditData, productionOrderNo: e.target.value })
                                                }
                                                className="p-3 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 border"
                                            />
                                        </div>

                                        {/* Module Type as Text Input */}
                                        <div className="w-full sm:w-[48%] lg:w-[23%]">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Module Type</label>
                                            <input
                                                type="text"
                                                value={auditData.moduleType}
                                                onChange={(e) =>
                                                    setAuditData({ ...auditData, moduleType: e.target.value })
                                                }
                                                className="p-3 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 border"
                                            />
                                        </div>

                                        {/* Checkboxes */}
                                        <div className="w-full flex flex-row justify-center gap-10 mt-4">
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={auditData.customerSpecAvailable}
                                                    onChange={(e) =>
                                                        setAuditData({ ...auditData, customerSpecAvailable: e.target.checked })
                                                    }
                                                    className="rounded border-gray-300 text-blue-600 hover:border-blue-500 w-5 h-5"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">Customer Specification Available</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={auditData.specificationSignedOff}
                                                    onChange={(e) =>
                                                        setAuditData({ ...auditData, specificationSignedOff: e.target.checked })
                                                    }
                                                    className="rounded border-gray-300 text-blue-600 hover:border-blue-500 w-5 h-5"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">Specification Signed Off With Customer</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="text-center">
                                        <button
                                            onClick={handleNextFromBasicInfo}
                                            className="px-8 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors text-lg font-semibold"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Stage Selection View */}
                        {currentView === 'stageSelection' && (
                            <div className="flex flex-col justify-center">
                                <div className="bg-white rounded-lg shadow-md p-6">
                                    <div className="flex justify-center gap-2 mb-4">
                                        <button
                                            onClick={handleBackToBasicInfo}
                                            className="bg-gray-600 text-white border border-gray-600 p-2 rounded-lg cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-gray-700 hover:border-gray-700"
                                        >
                                            ← Back to Basic Info
                                        </button>
                                        <button
                                            onClick={generateExcelReport}
                                            className="p-2 bg-green-600 text-white rounded-lg shadow-lg cursor-pointer hover:bg-green-700 transition-colors text-sm font-semibold"
                                        >
                                            Generate Audit Excel
                                        </button>
                                        <button
                                            onClick={generatePDFReport}
                                            className="p-2 bg-red-600 text-white rounded-lg shadow-lg cursor-pointer hover:bg-red-700 transition-colors text-sm font-semibold"
                                        >
                                            Generate Audit PDF
                                        </button>
                                    </div>

                                    {/* Signature Section */}
                                    <div className="flex justify-between gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex-1 text-center">
                                            <p className="font-semibold text-gray-700 mb-2">AUDIT BY:</p>
                                            <div className="min-h-10 p-2 bg-white border border-gray-300 rounded mb-2 flex items-center justify-center">
                                                <span className={`${auditBySignature ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                                                    {auditBySignature || 'No signature'}
                                                </span>
                                            </div>
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    className={`px-3 py-1 text-white rounded text-sm font-medium transition-colors ${canAddSignature('audit') ? 'bg-green-500 hover:bg-green-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
                                                    onClick={() => handleAddSignature('audit')}
                                                    disabled={!canAddSignature('audit')}
                                                >
                                                    Add my Signature
                                                </button>
                                                <button
                                                    className={`px-3 py-1 text-white rounded text-sm font-medium transition-colors ${canRemoveSignature('audit') ? 'bg-red-500 hover:bg-red-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
                                                    onClick={() => handleRemoveSignature('audit')}
                                                    disabled={!canRemoveSignature('audit')}
                                                >
                                                    Remove my Signature
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex-1 text-center">
                                            <p className="font-semibold text-gray-700 mb-2">REVIEWED BY:</p>
                                            <div className="min-h-10 p-2 bg-white border border-gray-300 rounded mb-2 flex items-center justify-center">
                                                <span className={`${reviewedBySignature ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                                                    {reviewedBySignature || 'No signature'}
                                                </span>
                                            </div>
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    className={`px-3 py-1 text-white rounded text-sm font-medium transition-colors ${canAddSignature('reviewed') ? 'bg-green-500 hover:bg-green-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
                                                    onClick={() => handleAddSignature('reviewed')}
                                                    disabled={!canAddSignature('reviewed')}
                                                >
                                                    Add my Signature
                                                </button>
                                                <button
                                                    className={`px-3 py-1 text-white rounded text-sm font-medium transition-colors ${canRemoveSignature('reviewed') ? 'bg-red-500 hover:bg-red-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
                                                    onClick={() => handleRemoveSignature('reviewed')}
                                                    disabled={!canRemoveSignature('reviewed')}
                                                >
                                                    Remove my Signature
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-4">
                                        {stageButtons.map((button) => (
                                            <button
                                                key={button.id}
                                                onClick={() => button.enabled && handleStageButtonClick(button.id)}
                                                disabled={!button.enabled}
                                                className={`p-6 rounded-lg transition-all duration-300 transform hover:scale-105 relative ${button.enabled
                                                    ? button.hasUnsavedChanges
                                                        ? 'bg-orange-500 text-white hover:bg-orange-600 cursor-pointer'
                                                        : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                    }`}
                                            >
                                                {auditData.stages.find(stage => stage.id === button.id)?.name || button.label}
                                                {button.hasUnsavedChanges && (
                                                    <span className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full"></span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Stage Detail View */}
                        {currentView === 'stageDetail' && selectedStageId && (
                            <div className="bg-white rounded-lg shadow-md overflow-hidden animate-fade-in">
                                <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
                                    <h2 className="text-xl font-semibold">
                                        {auditData.stages.find(stage => stage.id === selectedStageId)?.name || `Stage ${selectedStageId}`}
                                        {stageChanges.has(selectedStageId) && (
                                            <span className="ml-2 text-yellow-300 text-sm">• Unsaved changes</span>
                                        )}
                                    </h2>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSaveStage}
                                            className="bg-green-500 text-white border border-white px-4 py-2 rounded-lg cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-blue-600"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={handleBackToStageSelection}
                                            className="bg-white/20 text-white border border-white px-4 py-2 rounded-lg cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-blue-600"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    {auditData.stages
                                        .find(stage => stage.id === selectedStageId)
                                        ?.parameters.map((param) => {
                                            // Get the saved parameter data
                                            const savedStage = auditData.stages.find(s => s.id === selectedStageId);
                                            const savedParam = savedStage?.parameters.find(p => p.id === param.id);

                                            return (
                                                <table key={param.id} className="min-w-full border border-gray-200 rounded-lg overflow-hidden mb-2">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                                                                Parameters
                                                            </th>
                                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                                                                Criteria
                                                            </th>
                                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                                                                Type of Inspection
                                                            </th>
                                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                                                                Inspection Frequency
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white">
                                                        <tr className="bg-blue-50 font-bold">
                                                            <td className="px-6 py-4 whitespace-normal text-sm text-gray-900 border border-gray-200">
                                                                {param.parameters}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-normal text-sm text-gray-900 border border-gray-200">
                                                                {param.criteria}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-normal text-sm text-gray-900 border border-gray-200">
                                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${param.typeOfInspection === 'Aesthetics' ? 'bg-green-100 text-green-800' :
                                                                    param.typeOfInspection === 'Measurements' ? 'bg-blue-100 text-blue-800' :
                                                                        param.typeOfInspection === 'Functionality' ? 'bg-purple-100 text-purple-800' :
                                                                            param.typeOfInspection === 'RFID Scanner' ? 'bg-cyan-100 text-cyan-800' :
                                                                                'bg-gray-100 text-gray-800'
                                                                    }`}>
                                                                    {param.typeOfInspection}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-normal text-sm text-gray-900 border border-gray-200">
                                                                {param.inspectionFrequency}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td colSpan={4} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border border-gray-200">
                                                                Observations
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td colSpan={4} className="px-6 py-4 border border-gray-200">
                                                                <div className="flex justify-center space-x-2 w-full">
                                                                    {param.observations.map((obs) => {
                                                                        // Get the saved observation value
                                                                        const savedObservation = savedParam?.observations.find(
                                                                            o => o.timeSlot === obs.timeSlot
                                                                        );

                                                                        return (
                                                                            <div
                                                                                key={obs.timeSlot}
                                                                                className={`flex flex-col items-center ${param.observations.length === 1 ? 'w-full' :
                                                                                    param.observations.length === 2 ? 'w-1/2' :
                                                                                        param.observations.length === 3 ? 'w-1/3' :
                                                                                            'w-1/4'}`}
                                                                            >
                                                                                <label className="text-xs text-gray-500 mb-1">{obs.timeSlot}</label>
                                                                                {param.renderObservation ? (
                                                                                    param.renderObservation({
                                                                                        stageId: selectedStageId,
                                                                                        paramId: param.id,
                                                                                        timeSlot: obs.timeSlot,
                                                                                        value: savedObservation?.value || obs.value,
                                                                                        observationData: savedObservation || obs,
                                                                                        onUpdate: updateObservation
                                                                                    })
                                                                                ) : (
                                                                                    <div className="w-full flex justify-center">
                                                                                        {/* Handle both string and object values */}
                                                                                        {typeof (savedObservation?.value || obs.value) === 'string' ? (
                                                                                            <input
                                                                                                type="text"
                                                                                                value={savedObservation?.value || obs.value}
                                                                                                onChange={(e) => updateObservation(selectedStageId, param.id, obs.timeSlot, e.target.value)}
                                                                                                placeholder="Enter value"
                                                                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                            />
                                                                                        ) : (
                                                                                            <div className="text-xs text-gray-500 p-2 border border-gray-300 rounded bg-gray-50">
                                                                                                Complex data structure - use custom renderer
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Saved Checksheets Tab */}
                {activeTab === 'saved-reports' && (
                    <div className="tab-content active">
                        <SavedReportsNChecksheets
                            reports={savedChecksheets.map(sheet => ({
                                ...sheet,
                                timestamp: sheet.timestamp
                            }))}
                            onExportExcel={exportSavedReportToExcel}
                            onExportPdf={exportSavedReportToPDF}
                            onEdit={editSavedChecksheet}
                            onDelete={deleteSavedChecksheet}
                            emptyMessage={{
                                title: 'No saved checksheets found.',
                                description: 'Create and save your first checksheet in the "Create/Edit Checksheet" tab.'
                            }}
                            showAdditionalInfo={(report: any) => (
                                <p className="text-gray-600 text-sm">
                                    Product: {report.data.productionOrderNo} | Module: {report.data.moduleType}
                                </p>
                            )}
                        />
                    </div>
                )}
            </div>
            <div id="alert-container" className="fixed top-5 right-5 z-50 w-80"></div>
        </div>
    );
}