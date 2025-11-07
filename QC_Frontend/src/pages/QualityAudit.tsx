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

interface SavedChecksheet { id: string; name: string; timestamp: number; data: AuditData; }

// In QualityAudit.tsx - update the useLineDependentStages hook
const useLineDependentStages = (baseStages: StageData[], lineNumber: string) => {
    return useMemo(() => {
        if (!lineNumber) return baseStages;
        return baseStages.map(stage => {
            if (stage.id === 5) return createTabbingStringingStage(lineNumber);
            if (stage.id === 7) return createAutoBussingStage(lineNumber);
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

    // Load saved checksheets from localStorage on component mount
    useEffect(() => {
        const saved = localStorage.getItem('qualityAuditChecksheets');
        if (saved) {
            setSavedChecksheets(JSON.parse(saved));
        }
    }, []);

    const lineDependentStages = useLineDependentStages(initialStages, lineNumber);

    // Initialize audit data with line-dependent stages
    const [auditData, setAuditData] = useState<AuditData>({
        lineNumber: '',
        date: new Date().toISOString().split('T')[0],
        shift: '',
        productionOrderNo: '',
        moduleType: '',
        customerSpecAvailable: false,
        specificationSignedOff: false,
        stages: lineDependentStages
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

    // Check if checksheet exists when line, date, or shift changes
    useEffect(() => {
        if (auditData.lineNumber && auditData.date && auditData.shift) {
            const checksheetId = generateChecksheetId(auditData.lineNumber, auditData.date, auditData.shift);
            const existingChecksheet = savedChecksheets.find(sheet => sheet.id === checksheetId);

            if (existingChecksheet) {
                setAuditData(existingChecksheet.data);
                setCurrentChecksheetId(checksheetId);
            } else {
                setCurrentChecksheetId(null);
            }
        }
    }, [auditData.lineNumber, auditData.date, auditData.shift]);

    const generateChecksheetId = (lineNumber: string, date: string, shift: string) => {
        return `checksheet-${lineNumber}-${date}-${shift}`;
    };

    const generateChecksheetName = (lineNumber: string, date: string, shift: string) => {
        return `Checksheet - Line ${lineNumber} - ${date} - Shift ${shift}`;
    };

    const saveChecksheet = () => {
        if (!auditData.lineNumber || !auditData.date || !auditData.shift) {
            showAlert('error', 'Line number, date, and shift are required to save checksheet.');
            return;
        }

        const checksheetId = generateChecksheetId(auditData.lineNumber, auditData.date, auditData.shift);
        const checksheetName = generateChecksheetName(auditData.lineNumber, auditData.date, auditData.shift);

        const newChecksheet: SavedChecksheet = {
            id: checksheetId,
            name: checksheetName,
            timestamp: Date.now(),
            data: { ...auditData }
        };

        setSavedChecksheets(prev => {
            const filtered = prev.filter(sheet => sheet.id !== checksheetId);
            const updated = [newChecksheet, ...filtered];
            localStorage.setItem('qualityAuditChecksheets', JSON.stringify(updated));
            return updated;
        });

        setCurrentChecksheetId(checksheetId);
        setHasUnsavedChanges(false);
        setStageChanges(new Set());
        showAlert('success', 'Checksheet saved successfully!');
    };

    const autoSaveChecksheet = () => {
        if (auditData.lineNumber && auditData.date && auditData.shift) {
            saveChecksheet();
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
                        stages: initialStages
                    });
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

    const generatePDFReport = () => {
        console.log('Generating PDF with data:', auditData);
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
        showAlert('success', `Stage ${selectedStageId} saved successfully!`);
    };

    const previewSavedChecksheet = (index: number) => {
        // Implement it later
    };

    const editSavedChecksheet = (index: number) => {
        const checksheet = savedChecksheets[index];
        setAuditData(checksheet.data);
        setCurrentChecksheetId(checksheet.id);
        setActiveTab('create-edit');
        setCurrentView('basicInfo');
        setHasUnsavedChanges(false);
        setStageChanges(new Set());
        showAlert('info', `Editing checksheet: ${checksheet.name}`);
    };

    const deleteSavedChecksheet = (index: number) => {
        const checksheet = savedChecksheets[index];
        setSavedChecksheets(prev => {
            const updated = prev.filter((_, i) => i !== index);
            localStorage.setItem('qualityAuditChecksheets', JSON.stringify(updated));
            return updated;
        });
        if (currentChecksheetId === checksheet.id) {
            setCurrentChecksheetId(null);
            setAuditData({
                lineNumber: '',
                date: new Date().toISOString().split('T')[0],
                shift: '',
                productionOrderNo: '',
                moduleType: '',
                customerSpecAvailable: false,
                specificationSignedOff: false,
                stages: initialStages
            });
        }
        showAlert('success', 'Checksheet deleted successfully!');
    };

    const stageButtons = Array.from({ length: 32 }, (_, index) => ({
        id: index + 1,
        label: `Stage ${index + 1}`,
        enabled: index < 32,
        hasUnsavedChanges: stageChanges.has(index + 1)
    }));

    return (
        <div className="pb-4">
            <Header />
            <div className="max-w-7xl mx-4">
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
                                                    className="text-sm p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border"
                                                >
                                                    <option value="">Select</option>
                                                    <option value="I">I</option>
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
                                                className="p-3 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border"
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
                                                className="p-3 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border"
                                            >
                                                <option value="">Select Shift</option>
                                                <option value="A">Shift-A</option>
                                                <option value="B">Shift-B</option>
                                                <option value="C">Shift-C</option>
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
                                                className="p-3 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border"
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
                                                className="p-3 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border"
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
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
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
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
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
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-2xl font-bold text-center text-gray-800 flex-1">
                                            Select Audit Stage
                                        </h2>
                                    </div>
                                    <div className="flex justify-center gap-2 mb-4">
                                        <button
                                            onClick={handleBackToBasicInfo}
                                            className="bg-gray-600 text-white border border-gray-600 p-2 rounded-lg cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-gray-700 hover:border-gray-700"
                                        >
                                            ← Back to Basic Info
                                        </button>
                                        <button
                                            onClick={generatePDFReport}
                                            className="p-2 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                                        >
                                            Generate Audit Report
                                        </button>
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
                                        ?.parameters.map((param) => (
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
                                                                {param.observations.map((obs) => (
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
                                                                                value: obs.value,
                                                                                observationData: obs,
                                                                                onUpdate: updateObservation
                                                                            })
                                                                        ) : (
                                                                            <div className="w-full flex justify-center">
                                                                                {/* Handle both string and object values */}
                                                                                {typeof obs.value === 'string' ? (
                                                                                    <input
                                                                                        type="text"
                                                                                        value={obs.value}
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
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        ))}
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
                            onPreview={previewSavedChecksheet}
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