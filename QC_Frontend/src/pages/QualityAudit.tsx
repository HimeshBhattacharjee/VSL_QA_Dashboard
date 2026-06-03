import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initialStages } from '../audit-data';
import { AuditData, ObservationValue, StageData } from '../types/audit';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import { useLine } from '../context/LineContext';
import { LINE_DEPENDENT_CONFIG } from '../audit-data/lineConfig';
import ReportListControls, { ReportSortOption } from '../components/ReportListControls';
import ReportPagination from '../components/ReportPagination';
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
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
    createTwentySampleValue,
    normalizeSampleGroupedValue,
    updateSampleGroupedLineSelection
} from '../audit-data/sampleGroupedInputs';

const DYNAMIC_LINE_STAGE_IDS = new Set([2, 3, 9, 10, 11, 12, 16, 23, 27, 29]);
const SAMPLE_GROUPED_STAGE_IDS = new Set([12, 16, 23, 27, 29]);
const SAMPLE_GROUPED_PARAMETER_IDS = new Set(["12-1", "12-2", "16-1", "23-1", "27-1", "29-1"]);
const SAMPLE_GROUP_KEYS = ["2h", "4h", "6h", "8h"] as const;
const AUTOSAVE_DELAY_MS = 1200;

type AuditWorkflowState = 'draft' | 'submitted' | 'returned';

const getWorkflowState = (checksheet?: Pick<SavedChecksheet, 'workflowState'> | null): AuditWorkflowState =>
    checksheet?.workflowState || 'submitted';

const formatWorkflowState = (state: AuditWorkflowState) =>
    state.charAt(0).toUpperCase() + state.slice(1);

const formatTimestamp = (value?: string | number | null) =>
    value ? new Date(value).toLocaleString() : '-';

const getDynamicLineOptions = (lineNumber: string) => lineNumber === 'II' ? ['3', '4'] : ['1', '2'];

const getSelectedLineFromSlot = (timeSlot: string) => timeSlot.replace('Line-', '');

const getDefaultLineMapping = (lineOptions: string[]) => {
    const firstLine = getSelectedLineFromSlot(lineOptions[0] || '');
    const secondLine = getSelectedLineFromSlot(lineOptions[1] || lineOptions[0] || '');
    return { "2h": firstLine, "4h": firstLine, "6h": secondLine, "8h": secondLine };
};

const isSampleGroupedParameter = (paramId: string) => SAMPLE_GROUPED_PARAMETER_IDS.has(paramId);

const hydrateStage5Defaults = (paramId: string, defaultValue: any, savedValue: any) => {
    if (!['5-5-cell-appearance', '5-15-el-inspection'].includes(paramId) || typeof defaultValue !== 'object' || defaultValue === null) {
        return savedValue ?? defaultValue;
    }

    return Object.entries(defaultValue).reduce<Record<string, any>>((merged, [stringerKey, stringerDefaults]) => {
        const savedStringer = savedValue?.[stringerKey];
        if (typeof stringerDefaults === 'object' && stringerDefaults !== null) {
            merged[stringerKey] = Object.entries(stringerDefaults).reduce<Record<string, string>>((inner, [fieldKey, fieldDefault]) => {
                const savedFieldValue = typeof savedStringer === 'object' && savedStringer !== null ? savedStringer[fieldKey] : undefined;
                inner[fieldKey] = savedFieldValue === undefined || savedFieldValue === null || savedFieldValue === '' ? fieldDefault as string : savedFieldValue;
                return inner;
            }, {});
        }
        return merged;
    }, {});
};

type SignatureSection = 'auditBy' | 'reviewedBy';

const getLoadedSignatureText = (loadedSignatures: any, section: SignatureSection, fallback = '') => {
    const signatureValue = loadedSignatures?.[section] ?? fallback;
    if (signatureValue && typeof signatureValue === 'object') {
        return signatureValue.name || signatureValue.text || signatureValue.value || '';
    }
    return signatureValue || '';
};

const getLoadedSignatureImage = (loadedSignatures: any, section: SignatureSection, fallback = '') => {
    const imageKey = `${section}Image`;
    const signatureValue = loadedSignatures?.[section];
    return loadedSignatures?.[imageKey]
        || loadedSignatures?.[`${section}SignatureImage`]
        || loadedSignatures?.[`${imageKey}Url`]
        || (signatureValue && typeof signatureValue === 'object'
            ? signatureValue.signature || signatureValue.image || signatureValue.photo
            : '')
        || fallback
        || '';
};

const getAuditSnapshot = (auditData: AuditData, auditBySignature: string, reviewedBySignature: string, auditBySignatureImage = '', reviewedBySignatureImage = '') => JSON.stringify({
    lineNumber: auditData.lineNumber,
    date: auditData.date,
    shift: auditData.shift,
    productionOrderNo: auditData.productionOrderNo,
    moduleType: auditData.moduleType,
    customerSpecAvailable: auditData.customerSpecAvailable,
    specificationSignedOff: auditData.specificationSignedOff,
    stages: auditData.stages.map(stage => ({
        id: stage.id,
        parameters: stage.parameters.map(param => ({
            id: param.id,
            observations: param.observations
        }))
    })),
    signatures: { auditBy: auditBySignature, reviewedBy: reviewedBySignature, auditByImage: auditBySignatureImage, reviewedByImage: reviewedBySignatureImage }
});

interface SavedChecksheet {
    _id?: string;
    id: string;
    name: string;
    timestamp: number;
    updatedTimestamp?: number;
    data?: AuditData;
    lineNumber?: string;
    date?: string;
    shift?: string;
    productionOrderNo?: string;
    moduleType?: string;
    status?: string;
    workflowState?: AuditWorkflowState;
    createdBy?: string;
    createdByUserId?: string | null;
    createdByEmployeeName?: string | null;
    createdByEmployeeId?: string | null;
    submittedAt?: string | null;
    submittedBy?: string | null;
    returnedAt?: string | null;
    returnedBy?: string | null;
    returnComments?: string | null;
    isSigned?: boolean;
    signedAt?: string | null;
}

const buildLineDependentStages = (baseStages: StageData[], lineNumber: string) => {
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
            const defaultLine = getSelectedLineFromSlot(lineOptions[0]);
            const defaultLineMapping = getDefaultLineMapping(lineOptions);
            return {
                ...stage,
                parameters: stage.parameters.map(param => {
                    if (stageConfig.parameters.includes(param.id)) {
                        if (SAMPLE_GROUPED_STAGE_IDS.has(stage.id)) {
                            return {
                                ...param,
                                observations: [{
                                    timeSlot: lineOptions[0],
                                    value: createTwentySampleValue(param.id, defaultLineMapping),
                                    selectedLine: defaultLine,
                                    lineMapping: defaultLineMapping
                                }]
                            };
                        }
                        return {
                            ...param,
                            observations: lineOptions.map((option: string) => ({
                                timeSlot: option,
                                value: "",
                                selectedLine: DYNAMIC_LINE_STAGE_IDS.has(stage.id) ? getSelectedLineFromSlot(option) : undefined
                            }))
                        };
                    }
                    return param;
                })
            };
        });
};

const useLineDependentStages = (baseStages: StageData[], lineNumber: string) => {
    return useMemo(() => buildLineDependentStages(baseStages, lineNumber), [baseStages, lineNumber]);
};

export default function QualityAudit() {
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const { lineNumber, setLineNumber } = useLine();
    const [activeTab, setActiveTab] = useState<'create-edit' | 'saved-reports' | 'returned-reports'>('create-edit');
    const [currentView, setCurrentView] = useState<'basicInfo' | 'stageSelection' | 'stageDetail'>('basicInfo');
    const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
    const [_, setHasUnsavedChanges] = useState<boolean>(false);
    const [stageChanges, setStageChanges] = useState<Set<number>>(new Set());
    const [savedChecksheets, setSavedChecksheets] = useState<SavedChecksheet[]>([]);
    const [savedChecksheetsTotal, setSavedChecksheetsTotal] = useState(0);
    const [savedChecksheetsPage, setSavedChecksheetsPage] = useState(1);
    const [savedChecksheetsPageSize, setSavedChecksheetsPageSize] = useState(20);
    const [savedChecksheetsSearch, setSavedChecksheetsSearch] = useState('');
    const [savedChecksheetsSearchInput, setSavedChecksheetsSearchInput] = useState('');
    const [savedChecksheetsSort, setSavedChecksheetsSort] = useState<ReportSortOption>('newest-created');
    const [isSavedChecksheetsLoading, setIsSavedChecksheetsLoading] = useState(false);
    const [currentChecksheetId, setCurrentChecksheetId] = useState<string | null>(null);
    const [currentWorkflowState, setCurrentWorkflowState] = useState<AuditWorkflowState>('draft');
    const [currentChecksheetMeta, setCurrentChecksheetMeta] = useState<SavedChecksheet | null>(null);
    const [returnedChecksheets, setReturnedChecksheets] = useState<SavedChecksheet[]>([]);
    const [returnedChecksheetsTotal, setReturnedChecksheetsTotal] = useState(0);
    const [returnedChecksheetsPage, setReturnedChecksheetsPage] = useState(1);
    const [returnedChecksheetsPageSize, setReturnedChecksheetsPageSize] = useState(20);
    const [returnedChecksheetsSearchInput, setReturnedChecksheetsSearchInput] = useState('');
    const [returnedChecksheetsSearch, setReturnedChecksheetsSearch] = useState('');
    const [returnedChecksheetsSort, setReturnedChecksheetsSort] = useState<ReportSortOption>('newest-updated');
    const [isReturnedChecksheetsLoading, setIsReturnedChecksheetsLoading] = useState(false);
    const [returnModalChecksheetIndex, setReturnModalChecksheetIndex] = useState<number | null>(null);
    const [returnComment, setReturnComment] = useState('');
    const [returnCommentError, setReturnCommentError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [auditBySignature, setAuditBySignature] = useState<string>('');
    const [reviewedBySignature, setReviewedBySignature] = useState<string>('');
    const [auditBySignatureImage, setAuditBySignatureImage] = useState<string>('');
    const [reviewedBySignatureImage, setReviewedBySignatureImage] = useState<string>('');
    const [currentUserSignatureImage, setCurrentUserSignatureImage] = useState<string>('');
    const [userRole, setUserRole] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [isAutosaving, setIsAutosaving] = useState(false);
    const lastSavedDataRef = useRef<string>('');
    const currentChecksheetIdRef = useRef<string | null>(null);
    const savedChecksheetsRef = useRef<SavedChecksheet[]>([]);
    const autoLoadDraftKeyRef = useRef<string>('');
    const autosaveTimeoutRef = useRef<number | null>(null);
    const isAutosavingRef = useRef(false);
    
    const IPQC_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/ipqc-audits';
    const USER_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/user';

    const isOperatorRole = userRole === 'Operator';
    const isReviewerRole = ['Supervisor', 'Manager'].includes(userRole || '');
    const isSystemAdminRole = ['Admin', 'System Administrator'].includes(userRole || '');
    const canCreateChecksheet = isOperatorRole;
    const canEditCurrentChecksheet = (isSystemAdminRole && currentChecksheetId !== null)
        || (isOperatorRole && (!currentChecksheetId || ['draft', 'returned'].includes(currentWorkflowState)))
        || (isReviewerRole && currentChecksheetId !== null && currentWorkflowState === 'submitted');
    const canSaveDraftCurrentChecksheet = isOperatorRole && currentWorkflowState !== 'submitted';
    const canSubmitCurrentChecksheet = isOperatorRole
        && currentWorkflowState !== 'submitted'
        && auditBySignature.trim().length > 0;
    const canExportCurrentChecksheet = currentChecksheetId !== null && currentWorkflowState === 'submitted';

    const authHeaders = (includeJson = false): HeadersInit => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        'X-Employee-Id': sessionStorage.getItem('employeeId') || employeeId || '',
        'X-User-Name': sessionStorage.getItem('username') || username || '',
        'X-User-Role': sessionStorage.getItem('userRole') || userRole || '',
    });

    const getSignatureImageSrc = useCallback((imageSource: string) => {
        const source = imageSource?.trim();
        if (!source) return '';
        if (source.startsWith('data:') || source.startsWith('blob:')) return source;
        if (source.startsWith('users/signatures/') || source.includes('/users/signatures/')) {
            return `${USER_API_BASE_URL}/signature-image?source=${encodeURIComponent(source)}`;
        }
        return source;
    }, [USER_API_BASE_URL]);
    
    const apiService = {
        getAllAudits: async (): Promise<any[]> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/?include_data=true`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch audits: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        getAuditSummaries: async (params: {
            page: number;
            pageSize: number;
            search?: string;
            sort?: ReportSortOption;
            workflowState?: AuditWorkflowState;
            excludeWorkflowState?: AuditWorkflowState;
        }): Promise<{ items: any[]; total: number; page: number; page_size: number }> => {
            const query = new URLSearchParams({
                summary: 'true',
                page: String(params.page),
                page_size: String(params.pageSize),
                sort: params.sort || 'newest-created'
            });
            if (params.search?.trim()) query.append('search', params.search.trim());
            if (params.workflowState) query.append('workflow_state', params.workflowState);
            if (params.excludeWorkflowState) query.append('exclude_workflow_state', params.excludeWorkflowState);

            const response = await fetch(`${IPQC_API_BASE_URL}/?${query}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch audit summaries: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        getDraftByLineDateShift: async (line: string, date: string, shift: string): Promise<any | null> => {
            const query = new URLSearchParams({
                lineNumber: line,
                date,
                shift,
                workflow_state: 'draft'
            });
            const response = await fetch(`${IPQC_API_BASE_URL}/search/by-filters?${query}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to find matching draft: ${response.status} ${errorText}`);
            }
            const audits = await response.json();
            return Array.isArray(audits) ? audits.find(audit => getWorkflowState(audit) === 'draft') || null : null;
        },

        getAuditById: async (id: string): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/${id}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch audit: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        createAudit: async (audit: any): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify(audit),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create audit: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        updateAudit: async (id: string, audit: any): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/${id}`, {
                method: 'PUT',
                headers: authHeaders(true),
                body: JSON.stringify(audit),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update audit: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        deleteAudit: async (id: string): Promise<void> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete audit: ${response.status} ${errorText}`);
            }
        },

        checkAuditNameExists: async (name: string, excludeId?: string | null): Promise<boolean> => {
            const query = excludeId ? `?exclude_id=${encodeURIComponent(excludeId)}` : '';
            const response = await fetch(`${IPQC_API_BASE_URL}/name/${encodeURIComponent(name)}${query}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to check audit name: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            return result.exists;
        },
        submitAudit: async (id: string, audit: any): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/${id}/submit`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify(audit),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to submit audit: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        returnAudit: async (id: string, returnComments: string): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/${id}/return`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ returnComments }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to return audit: ${response.status} ${errorText}`);
            }
            return response.json();
        },
    };

    useEffect(() => {
        const storedUserRole = sessionStorage.getItem('userRole');
        const storedUsername = sessionStorage.getItem('username');
        const storedEmployeeId = sessionStorage.getItem('employeeId');
        setUserRole(storedUserRole);
        setUsername(storedUsername);
        setEmployeeId(storedEmployeeId);
        if (storedUserRole !== 'Operator') {
            setActiveTab('saved-reports');
        }
    }, []);

    useEffect(() => {
        const employeeId = sessionStorage.getItem('employeeId');
        if (!employeeId) return;

        const fetchStoredSignature = async () => {
            try {
                const response = await fetch(`${USER_API_BASE_URL}/signature/${employeeId}`);
                if (!response.ok) return;
                const data = await response.json();
                setCurrentUserSignatureImage(data.signatureKey || data.signature || '');
            } catch (error) {
                console.error('Error fetching stored signature:', error);
            }
        };

        fetchStoredSignature();
    }, [USER_API_BASE_URL]);

    useEffect(() => {
        if (!currentUserSignatureImage || !username) return;
        if (auditBySignature.includes(username) && !auditBySignatureImage) {
            setAuditBySignatureImage(currentUserSignatureImage);
        }
        if (reviewedBySignature.includes(username) && !reviewedBySignatureImage) {
            setReviewedBySignatureImage(currentUserSignatureImage);
        }
    }, [currentUserSignatureImage, username, auditBySignature, reviewedBySignature, auditBySignatureImage, reviewedBySignatureImage]);

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
        signatures: { auditBy: '', reviewedBy: '', auditByImage: '', reviewedByImage: '' }
    });
    const latestAuditDataRef = useRef(auditData);
    const latestAuditBySignatureRef = useRef(auditBySignature);
    const latestReviewedBySignatureRef = useRef(reviewedBySignature);
    const latestAuditBySignatureImageRef = useRef(auditBySignatureImage);
    const latestReviewedBySignatureImageRef = useRef(reviewedBySignatureImage);

    useEffect(() => {
        latestAuditDataRef.current = auditData;
        latestAuditBySignatureRef.current = auditBySignature;
        latestReviewedBySignatureRef.current = reviewedBySignature;
        latestAuditBySignatureImageRef.current = auditBySignatureImage;
        latestReviewedBySignatureImageRef.current = reviewedBySignatureImage;
        currentChecksheetIdRef.current = currentChecksheetId;
        savedChecksheetsRef.current = savedChecksheets;
    }, [auditData, auditBySignature, reviewedBySignature, auditBySignatureImage, reviewedBySignatureImage, currentChecksheetId, savedChecksheets]);

    // Helper functions
    const generateChecksheetName = useCallback((lineNumber: string, date: string, shift: string) => {
        return `Checksheet - Line ${lineNumber} - ${date} - Shift ${shift}`;
    }, []);

    const getDraftLookupKey = useCallback((line: string, date: string, shift: string) => {
        return [line, date, shift].map(value => value.trim()).join('|');
    }, []);

    const mapAuditToChecksheet = useCallback((audit: any, fallbackData?: AuditData): SavedChecksheet | null => {
        const auditDataForSummary = audit.data || fallbackData;
        const id = audit._id || audit.id || '';

        if (!id) return null;

        return {
            _id: id,
            id,
            name: audit.name,
            timestamp: new Date(audit.timestamp).getTime(),
            updatedTimestamp: audit.updated_timestamp ? new Date(audit.updated_timestamp).getTime() : undefined,
            data: audit.data,
            lineNumber: audit.lineNumber || auditDataForSummary?.lineNumber,
            date: audit.date || auditDataForSummary?.date,
            shift: audit.shift || auditDataForSummary?.shift,
            productionOrderNo: audit.productionOrderNo || auditDataForSummary?.productionOrderNo,
            moduleType: audit.moduleType || auditDataForSummary?.moduleType,
            status: audit.status || audit.workflowState || (auditDataForSummary as any)?.status,
            workflowState: audit.workflowState || audit.status || (auditDataForSummary as any)?.workflowState,
            createdBy: audit.createdBy,
            createdByUserId: audit.createdByUserId,
            createdByEmployeeName: audit.createdByEmployeeName,
            createdByEmployeeId: audit.createdByEmployeeId,
            submittedAt: audit.submittedAt,
            submittedBy: audit.submittedBy,
            returnedAt: audit.returnedAt,
            returnedBy: audit.returnedBy,
            returnComments: audit.returnComments,
            isSigned: audit.isSigned,
            signedAt: audit.signedAt
        };
    }, []);

    const upsertSavedChecksheetSummary = useCallback((audit: any, fallbackData?: AuditData) => {
        const checksheet = mapAuditToChecksheet(audit, fallbackData);
        if (!checksheet) return;

        setSavedChecksheets(prev => {
            const existingIndex = prev.findIndex(sheet => sheet.id === checksheet.id);
            if (existingIndex < 0) {
                return [checksheet, ...prev];
            }

            const next = [...prev];
            next[existingIndex] = { ...next[existingIndex], ...checksheet };
            return next;
        });
        setSavedChecksheetsTotal(prev => {
            const exists = savedChecksheetsRef.current.some(sheet => sheet.id === checksheet.id);
            return exists ? prev : prev + 1;
        });
    }, [mapAuditToChecksheet]);

    const mergeStageObservations = useCallback((stage: StageData, savedStage?: StageData, mergeLineNumber = lineNumber) => ({
        ...stage,
        parameters: stage.parameters.map(param => {
            const savedParam = savedStage?.parameters.find((p: any) => p.id === param.id);
            if (!savedParam) return param;

            return {
                ...param,
                observations: param.observations.map(obs => {
                    const savedObservation = savedParam.observations.find((savedObs: any) => savedObs.timeSlot === obs.timeSlot)
                        || (SAMPLE_GROUPED_STAGE_IDS.has(stage.id) ? savedParam.observations.find((savedObs: any) => typeof savedObs.timeSlot === 'string' && savedObs.timeSlot.startsWith('Line-')) : undefined);
                    const selectedLine = savedObservation?.selectedLine || obs.selectedLine || getSelectedLineFromSlot(obs.timeSlot);
                    const lineOptions = getDynamicLineOptions(mergeLineNumber);
                    const normalizedSelectedLine = lineOptions.includes(selectedLine) ? selectedLine : lineOptions[0];
                    const defaultGroupLineMapping = getDefaultLineMapping(lineOptions);
                    const savedLineMapping = savedObservation?.lineMapping || obs.lineMapping || {};
                    const normalizedLineMapping = SAMPLE_GROUP_KEYS.reduce<Record<string, string>>((mapping, groupKey) => {
                        const groupLine = savedLineMapping[groupKey] || defaultGroupLineMapping[groupKey] || normalizedSelectedLine;
                        mapping[groupKey] = lineOptions.includes(groupLine) ? groupLine : normalizedSelectedLine;
                        return mapping;
                    }, {});
                    const mergedValue = SAMPLE_GROUPED_STAGE_IDS.has(stage.id) && obs.timeSlot.startsWith('Line-')
                        ? normalizeSampleGroupedValue(
                            savedObservation?.value ?? obs.value,
                            param.id,
                            normalizedLineMapping,
                            normalizedSelectedLine
                        )
                        : hydrateStage5Defaults(param.id, obs.value, savedObservation?.value);

                    return {
                        ...obs,
                        ...savedObservation,
                        value: mergedValue,
                        selectedLine: obs.timeSlot.startsWith('Line-')
                            ? normalizedSelectedLine
                            : savedObservation?.selectedLine,
                        lineMapping: obs.timeSlot.startsWith('Line-')
                            ? normalizedLineMapping
                            : savedObservation?.lineMapping
                    };
                })
            };
        })
    }), [lineNumber]);

    const loadSavedChecksheets = useCallback(async () => {
        setIsSavedChecksheetsLoading(true);
        try {
            const response = await apiService.getAuditSummaries({
                page: savedChecksheetsPage,
                pageSize: savedChecksheetsPageSize,
                search: savedChecksheetsSearch,
                sort: savedChecksheetsSort,
                excludeWorkflowState: isOperatorRole ? 'returned' : undefined
            });
            const checksheets = response.items
                .map(audit => mapAuditToChecksheet(audit))
                .filter(Boolean) as SavedChecksheet[];
            setSavedChecksheets(checksheets);
            setSavedChecksheetsTotal(response.total);
        } catch (error) {
            console.error('Error loading audits:', error);
        } finally {
            setIsSavedChecksheetsLoading(false);
        }
    }, [mapAuditToChecksheet, savedChecksheetsPage, savedChecksheetsPageSize, savedChecksheetsSearch, savedChecksheetsSort, isOperatorRole]);

    const loadReturnedChecksheets = useCallback(async () => {
        if (!isOperatorRole) return;
        setIsReturnedChecksheetsLoading(true);
        try {
            const response = await apiService.getAuditSummaries({
                page: returnedChecksheetsPage,
                pageSize: returnedChecksheetsPageSize,
                search: returnedChecksheetsSearch,
                sort: returnedChecksheetsSort,
                workflowState: 'returned'
            });
            const checksheets = response.items
                .map(audit => mapAuditToChecksheet(audit))
                .filter(Boolean) as SavedChecksheet[];
            setReturnedChecksheets(checksheets);
            setReturnedChecksheetsTotal(response.total);
        } catch (error) {
            console.error('Error loading returned audits:', error);
        } finally {
            setIsReturnedChecksheetsLoading(false);
        }
    }, [mapAuditToChecksheet, returnedChecksheetsPage, returnedChecksheetsPageSize, returnedChecksheetsSearch, returnedChecksheetsSort, isOperatorRole]);

    useEffect(() => {
        if (activeTab !== 'saved-reports') return;
        loadSavedChecksheets();
    }, [activeTab, loadSavedChecksheets]);

    useEffect(() => {
        if (activeTab !== 'returned-reports') return;
        loadReturnedChecksheets();
    }, [activeTab, loadReturnedChecksheets]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setSavedChecksheetsSearch(savedChecksheetsSearchInput);
            setSavedChecksheetsPage(1);
        }, 350);

        return () => window.clearTimeout(timeout);
    }, [savedChecksheetsSearchInput]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setReturnedChecksheetsSearch(returnedChecksheetsSearchInput);
            setReturnedChecksheetsPage(1);
        }, 350);

        return () => window.clearTimeout(timeout);
    }, [returnedChecksheetsSearchInput]);

    useEffect(() => {
        if (isOperatorRole) {
            loadReturnedChecksheets();
        }
    }, [isOperatorRole, loadReturnedChecksheets]);

    useEffect(() => {
        if (activeTab === 'returned-reports' && returnedChecksheetsTotal === 0) {
            setActiveTab('saved-reports');
        }
    }, [activeTab, returnedChecksheetsTotal]);

    const getLatestSnapshot = useCallback(() => getAuditSnapshot(
        latestAuditDataRef.current,
        latestAuditBySignatureRef.current,
        latestReviewedBySignatureRef.current,
        latestAuditBySignatureImageRef.current,
        latestReviewedBySignatureImageRef.current
    ), []);

    const buildChecksheetPayload = useCallback(() => {
        const dataToSave = latestAuditDataRef.current;
        const auditBy = latestAuditBySignatureRef.current;
        const reviewedBy = latestReviewedBySignatureRef.current;
        const auditByImage = latestAuditBySignatureImageRef.current;
        const reviewedByImage = latestReviewedBySignatureImageRef.current;
        const checksheetName = generateChecksheetName(dataToSave.lineNumber, dataToSave.date, dataToSave.shift);
        const existingSummary = currentChecksheetIdRef.current
            ? savedChecksheetsRef.current.find(sheet => sheet.id === currentChecksheetIdRef.current)
            : undefined;

        return {
            name: checksheetName,
            timestamp: currentChecksheetIdRef.current
                ? new Date(existingSummary?.timestamp || Date.now()).toISOString()
                : new Date().toISOString(),
            updated_timestamp: new Date().toISOString(),
            data: {
                ...dataToSave,
                signatures: { auditBy, reviewedBy, auditByImage, reviewedByImage },
                workflowState: currentWorkflowState,
                status: currentWorkflowState,
            }
        };
    }, [currentWorkflowState, generateChecksheetName]);

    const isBasicInfoComplete = useCallback(() => (
        auditData.lineNumber.trim() !== ''
        && auditData.date.trim() !== ''
        && auditData.shift.trim() !== ''
        && auditData.productionOrderNo.trim() !== ''
        && auditData.moduleType.trim() !== ''
    ), [auditData.date, auditData.lineNumber, auditData.moduleType, auditData.productionOrderNo, auditData.shift]);

    const markChecksheetSaved = (response: any, fallbackData?: AuditData, savedSnapshot = getLatestSnapshot()) => {
        const checksheet = mapAuditToChecksheet(response, fallbackData);
        if (checksheet?._id) {
            setCurrentChecksheetId(checksheet._id);
            currentChecksheetIdRef.current = checksheet._id;
            setCurrentWorkflowState(getWorkflowState(checksheet));
            setCurrentChecksheetMeta(checksheet);
        }
        lastSavedDataRef.current = savedSnapshot;
        if (getLatestSnapshot() === savedSnapshot) {
            setHasUnsavedChanges(false);
            setStageChanges(new Set());
        } else {
            setHasUnsavedChanges(true);
        }
        upsertSavedChecksheetSummary(response, fallbackData);
    };

    const createOrLoadDraftChecksheet = async () => {
        if (!canCreateChecksheet) {
            showAlert('error', 'Only operators can create checksheets');
            return null;
        }
        if (!isBasicInfoComplete()) {
            showAlert('error', 'Please complete line, date, shift, production order number, and module type');
            return null;
        }

        const matchingDraft = await apiService.getDraftByLineDateShift(auditData.lineNumber, auditData.date, auditData.shift);
        if (matchingDraft?._id) {
            await loadChecksheetById(matchingDraft._id, { showLoading: false, showOpenedAlert: false });
            showAlert('info', 'Existing draft loaded for the selected line, date, and shift');
            return matchingDraft;
        }

        const payload = buildChecksheetPayload();
        const created = await apiService.createAudit(payload);
        markChecksheetSaved(created, payload.data as AuditData, getLatestSnapshot());
        const createdId = created._id || created.id;
        if (createdId) {
            await loadChecksheetById(createdId, { showLoading: false, showOpenedAlert: false });
        }
        await loadSavedChecksheets();
        return created;
    };

    const submitChecksheet = async () => {
        if (!auditBySignature.trim()) {
            showAlert('error', 'Prepared By signature is required before submission');
            return;
        }
        if (!isBasicInfoComplete()) {
            showAlert('error', 'Please complete line, date, shift, production order number, and module type before submitting');
            return;
        }

        try {
            setIsLoading(true);
            const payload = buildChecksheetPayload();
            let checksheetId = currentChecksheetId;
            if (!checksheetId) {
                const matchingDraft = await apiService.getDraftByLineDateShift(auditData.lineNumber, auditData.date, auditData.shift);
                if (matchingDraft?._id) {
                    const draftId = matchingDraft._id as string;
                    checksheetId = draftId;
                    setCurrentChecksheetId(checksheetId);
                    currentChecksheetIdRef.current = checksheetId;
                    await apiService.updateAudit(draftId, payload);
                } else {
                    const created = await apiService.createAudit(payload);
                    checksheetId = created._id || null;
                    setCurrentChecksheetId(checksheetId);
                    currentChecksheetIdRef.current = checksheetId;
                }
            } else {
                await apiService.updateAudit(checksheetId, payload);
            }
            if (!checksheetId) {
                showAlert('error', 'Unable to submit checksheet without a saved draft ID');
                return;
            }
            const submitted = await apiService.submitAudit(checksheetId, payload);
            markChecksheetSaved(submitted, payload.data as AuditData, getLatestSnapshot());
            setCurrentWorkflowState('submitted');
            await loadSavedChecksheets();
            if (isOperatorRole) await loadReturnedChecksheets();
            clearCurrentChecksheet();
            setActiveTab('saved-reports');
            showAlert('success', currentWorkflowState === 'returned' ? 'Checksheet resubmitted successfully' : 'Checksheet submitted successfully');
        } catch (error) {
            console.error('Error submitting checksheet:', error);
            showAlert('error', 'Failed to submit checksheet');
        } finally {
            setIsLoading(false);
        }
    };

    const saveSubmittedChanges = async () => {
        if (!currentChecksheetId || !canEditCurrentChecksheet || currentWorkflowState !== 'submitted') {
            showAlert('error', 'You are not authorized to modify this checksheet');
            return;
        }
        try {
            setIsLoading(true);
            const payload = buildChecksheetPayload();
            const response = await apiService.updateAudit(currentChecksheetId, payload);
            markChecksheetSaved(response, payload.data as AuditData, getLatestSnapshot());
            await loadSavedChecksheets();
            showAlert('success', 'Checksheet changes saved successfully');
        } catch (error) {
            console.error('Error saving checksheet:', error);
            showAlert('error', 'Failed to save checksheet');
        } finally {
            setIsLoading(false);
        }
    };

    const saveChecksheet = async () => {
        if (currentWorkflowState === 'submitted') {
            await saveSubmittedChanges();
            return;
        }
        await submitChecksheet();
    };

    useEffect(() => {
        setAuditData(prev => ({
            ...prev,
            stages: lineDependentStages.map(stage => mergeStageObservations(
                stage,
                prev.stages.find(savedStage => savedStage.id === stage.id)
            ))
        }));
    }, [lineDependentStages, mergeStageObservations]);

    useEffect(() => {
        if (autosaveTimeoutRef.current) {
            window.clearTimeout(autosaveTimeoutRef.current);
            autosaveTimeoutRef.current = null;
        }

        if (
            !currentChecksheetId
            || !canSaveDraftCurrentChecksheet
            || !canEditCurrentChecksheet
            || !['draft', 'returned'].includes(currentWorkflowState)
        ) {
            return;
        }

        const currentSnapshot = getLatestSnapshot();
        if (!lastSavedDataRef.current || currentSnapshot === lastSavedDataRef.current) return;

        autosaveTimeoutRef.current = window.setTimeout(async () => {
            if (isAutosavingRef.current || !currentChecksheetIdRef.current) return;

            const snapshotToSave = getLatestSnapshot();
            if (snapshotToSave === lastSavedDataRef.current) return;

            try {
                isAutosavingRef.current = true;
                setIsAutosaving(true);
                const payload = buildChecksheetPayload();
                const response = await apiService.updateAudit(currentChecksheetIdRef.current, payload);
                markChecksheetSaved(response, payload.data as AuditData, snapshotToSave);
            } catch (error) {
                console.error('Error autosaving checksheet:', error);
            } finally {
                isAutosavingRef.current = false;
                setIsAutosaving(false);
                autosaveTimeoutRef.current = null;
            }
        }, AUTOSAVE_DELAY_MS);

        return () => {
            if (autosaveTimeoutRef.current) {
                window.clearTimeout(autosaveTimeoutRef.current);
                autosaveTimeoutRef.current = null;
            }
        };
    }, [
        auditData,
        auditBySignature,
        auditBySignatureImage,
        reviewedBySignature,
        reviewedBySignatureImage,
        canEditCurrentChecksheet,
        canSaveDraftCurrentChecksheet,
        currentChecksheetId,
        currentWorkflowState,
        buildChecksheetPayload,
        getLatestSnapshot
    ]);

    const handleLineChange = (line: string) => {
        if (!canEditCurrentChecksheet) return;
        setLineNumber(line);
        setAuditData(prev => ({ ...prev, lineNumber: line }));
        setHasUnsavedChanges(true);
    };

    const handleAddSignature = async (section: 'audit' | 'reviewed') => {
        if (!canEditCurrentChecksheet) {
            showAlert('error', 'This checksheet is locked in its current workflow state');
            return;
        }
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }
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
            switch (section) {
                case 'audit':
                    setAuditBySignature(signatureText);
                    setAuditBySignatureImage(currentUserSignatureImage);
                    break;
                case 'reviewed':
                    setReviewedBySignature(signatureText);
                    setReviewedBySignatureImage(currentUserSignatureImage);
                    break;
            }
            setHasUnsavedChanges(true);
            showAlert('success', `Signature added to ${section} section`);
        } catch (error) {
            console.error('Error adding signature:', error);
            showAlert('error', 'Failed to add signature');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveSignature = async (section: 'audit' | 'reviewed') => {
        if (!canEditCurrentChecksheet) {
            showAlert('error', 'This checksheet is locked in its current workflow state');
            return;
        }
        if (!username) {
            showAlert('error', 'User not logged in');
            return;
        }
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
            switch (section) {
                case 'audit':
                    setAuditBySignature('');
                    setAuditBySignatureImage('');
                    break;
                case 'reviewed':
                    setReviewedBySignature('');
                    setReviewedBySignatureImage('');
                    break;
            }
            setHasUnsavedChanges(true);
            showAlert('info', `Signature removed from ${section} section`);
        } catch (error) {
            console.error('Error removing signature:', error);
            showAlert('error', 'Failed to remove signature');
        } finally {
            setIsLoading(false);
        }
    };

    const canRemoveSignature = (section: 'audit' | 'reviewed') => {
        if (!username || !canEditCurrentChecksheet) return false;
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
        if (!username || !canEditCurrentChecksheet) return false;
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
            return false;
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

    const updateObservation = (stageId: number, paramId: string, timeSlot: string, value: ObservationValue) => {
        if (!canEditCurrentChecksheet) return;
        setAuditData(prev => ({
            ...prev,
            stages: prev.stages.map(stage =>
                stage.id === stageId ? {
                    ...stage,
                    parameters: stage.parameters.map(param =>
                        param.id === paramId ? {
                            ...param,
                            observations: param.observations.map(obs =>
                                obs.timeSlot === timeSlot ? {
                                    ...obs,
                                    value: isSampleGroupedParameter(paramId)
                                        ? normalizeSampleGroupedValue(value, paramId, obs.lineMapping || {}, obs.selectedLine || '')
                                        : value
                                } : obs
                            )
                        } : param
                    )
                } : stage
            )
        }));
        setHasUnsavedChanges(true);
        setStageChanges(prev => new Set(prev).add(stageId));
    };

    const updateObservationLineSelection = (stageId: number, paramId: string, timeSlot: string, selectedLine: string) => {
        if (!canEditCurrentChecksheet) return;
        setAuditData(prev => ({
            ...prev,
            stages: prev.stages.map(stage =>
                stage.id === stageId ? {
                    ...stage,
                    parameters: stage.parameters.map(param =>
                        param.id === paramId ? {
                            ...param,
                            observations: param.observations.map(obs =>
                                obs.timeSlot === timeSlot ? { ...obs, selectedLine } : obs
                            )
                        } : param
                    )
                } : stage
            )
        }));
        setHasUnsavedChanges(true);
        setStageChanges(prev => new Set(prev).add(stageId));
    };

    const updateObservationLineMapping = (stageId: number, paramId: string, timeSlot: string, groupKey: string, selectedLine: string) => {
        if (!canEditCurrentChecksheet) return;
        setAuditData(prev => ({
            ...prev,
            stages: prev.stages.map(stage =>
                stage.id === stageId ? {
                    ...stage,
                    parameters: stage.parameters.map(param =>
                        param.id === paramId ? {
                            ...param,
                            observations: param.observations.map(obs => {
                                if (obs.timeSlot !== timeSlot) return obs;
                                const lineMapping = {
                                    ...(obs.lineMapping || {}),
                                    [groupKey]: selectedLine
                                };
                                return {
                                    ...obs,
                                    lineMapping,
                                    value: isSampleGroupedParameter(paramId)
                                        ? updateSampleGroupedLineSelection(obs.value, paramId, groupKey, selectedLine, lineMapping, obs.selectedLine || selectedLine)
                                        : obs.value
                                };
                            })
                        } : param
                    )
                } : stage
            )
        }));
        setHasUnsavedChanges(true);
        setStageChanges(prev => new Set(prev).add(stageId));
    };

    const updateBasicInfo = (field: keyof AuditData, value: any) => {
        if (!canEditCurrentChecksheet) return;
        setAuditData(prev => ({ ...prev, [field]: value }));
        setHasUnsavedChanges(true);
    };

    const clearCurrentChecksheet = () => {
        setCurrentChecksheetId(null);
        currentChecksheetIdRef.current = null;
        setCurrentWorkflowState('draft');
        setCurrentChecksheetMeta(null);
        setAuditData({
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
                reviewedBy: '',
                auditByImage: '',
                reviewedByImage: ''
            }
        });
        setAuditBySignature('');
        setAuditBySignatureImage('');
        setReviewedBySignature('');
        setReviewedBySignatureImage('');
        setCurrentView('basicInfo');
        setSelectedStageId(null);
        setStageChanges(new Set());
        setHasUnsavedChanges(false);
        lastSavedDataRef.current = '';
        autoLoadDraftKeyRef.current = '';
    };

    const generateExcelReport = async () => {
        try {
            if (!currentChecksheetId || currentWorkflowState !== 'submitted') {
                showAlert('error', 'Excel can be generated only for submitted checksheets');
                return;
            }
            showAlert('info', 'Please wait! Exporting Excel will take some time...');
            const response = await fetch(`${IPQC_API_BASE_URL}/generate-audit-report`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ audit_id: currentChecksheetId })
            });

            if (!response.ok) {
                throw new Error('Failed to generate report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

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

    const exportSavedReportToExcel = async (index: number) => {
        try {
            const checksheet = savedChecksheets[index];
            if (!checksheet) {
                showAlert('error', 'Checksheet not found');
                return;
            }
            if (getWorkflowState(checksheet) !== 'submitted') {
                showAlert('error', 'Excel can be generated only for submitted checksheets');
                return;
            }

            showAlert('info', 'Please wait! Exporting Excel will take some time...');

            const response = await fetch(`${IPQC_API_BASE_URL}/generate-audit-report`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ audit_id: checksheet._id })
            });

            if (!response.ok) {
                throw new Error('Failed to generate report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            const filenameLine = checksheet.data?.lineNumber || checksheet.lineNumber || '';
            const filenameDate = checksheet.data?.date || checksheet.date || '';
            const filenameShift = checksheet.data?.shift || checksheet.shift || '';
            const filename = `Quality_Audit_Line${filenameLine}_${filenameDate.replace(/-/g, '')}_Shift${filenameShift}.xlsx`;
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

    const handleNextFromBasicInfo = async () => {
        if (!isBasicInfoComplete()) {
            if (auditData.lineNumber === '') {
                showAlert('error', 'Please select the line number.');
            } else if (auditData.date === '') {
                showAlert('error', 'Please select the date.');
            } else if (auditData.shift === '') {
                showAlert('error', 'Please select the shift.');
            } else if (auditData.productionOrderNo === '') {
                showAlert('error', 'Please enter the production order number.');
            } else if (auditData.moduleType === '') {
                showAlert('error', 'Please enter the module type.');
            }
            return;
        }

        if (currentChecksheetId) {
            setCurrentView('stageSelection');
            return;
        }

        try {
            setIsLoading(true);
            const draft = await createOrLoadDraftChecksheet();
            if (!draft) return;
            setCurrentView('stageSelection');
            showAlert('success', 'Draft checksheet ready');
        } catch (error) {
            console.error('Error creating draft checksheet:', error);
            showAlert('error', 'Failed to create draft checksheet');
        } finally {
            setIsLoading(false);
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

    const handleStageNavigation = (targetStageId: number) => {
        if (!selectedStageId) return;

        const navigateToStage = () => setSelectedStageId(targetStageId);

        if (stageChanges.has(selectedStageId)) {
            showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes in this stage. Changes will be auto-saved. Are you sure you want to leave?',
                type: 'warning',
                confirmText: 'Leave',
                cancelText: 'Stay',
                onConfirm: navigateToStage
            });
        } else {
            navigateToStage();
        }
    };

    const handleBackToStageSelection = () => {
        if (stageChanges.has(selectedStageId!)) {
            showConfirm({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes in this stage. Changes will be auto-saved. Are you sure you want to leave?',
                type: 'warning',
                confirmText: 'Leave',
                onConfirm: () => {
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

    const loadChecksheetById = async (
        checksheetId: string,
        options: { showLoading?: boolean; showOpenedAlert?: boolean; nextView?: 'basicInfo' | 'stageSelection' | 'stageDetail' } = {}
    ) => {
        const { showLoading = true, showOpenedAlert = true, nextView = 'basicInfo' } = options;
        try {
            if (showLoading) setIsLoading(true);
            const fullAudit = await apiService.getAuditById(checksheetId);
            const loadedState = getWorkflowState(fullAudit);
            const fullAuditData = fullAudit.data || {};
            const loadedLineNumber = fullAuditData.lineNumber || fullAudit.lineNumber || '';
            const stagesForLoadedLine = buildLineDependentStages(initialStages, loadedLineNumber);
            const mergedData = {
                ...fullAuditData,
                lineNumber: loadedLineNumber,
                stages: stagesForLoadedLine.map(stage => {
                    const savedStage = fullAuditData.stages?.find((s: StageData) => s.id === stage.id);
                    return mergeStageObservations(stage, savedStage, loadedLineNumber);
                })
            } as AuditData;

            setAuditData(mergedData);
            setCurrentChecksheetId(fullAudit._id);
            currentChecksheetIdRef.current = fullAudit._id;
            setCurrentWorkflowState(loadedState);
            setCurrentChecksheetMeta(mapAuditToChecksheet(fullAudit, mergedData));
            setActiveTab('create-edit');
            setCurrentView(nextView);
            if (nextView !== 'stageDetail') {
                setSelectedStageId(null);
            }
            setHasUnsavedChanges(false);
            setStageChanges(new Set());

            const loadedSignatures = fullAuditData.signatures ||
                fullAuditData.data?.signatures ||
                {
                    auditBy: fullAuditData.auditBy || fullAuditData.data?.auditBy,
                    reviewedBy: fullAuditData.reviewedBy || fullAuditData.data?.reviewedBy,
                    auditByImage: fullAuditData.auditByImage || fullAuditData.data?.auditByImage,
                    reviewedByImage: fullAuditData.reviewedByImage || fullAuditData.data?.reviewedByImage
                };
            const loadedAuditBy = getLoadedSignatureText(loadedSignatures, 'auditBy');
            const loadedReviewedBy = getLoadedSignatureText(loadedSignatures, 'reviewedBy');
            const loadedAuditByImage = getLoadedSignatureImage(loadedSignatures, 'auditBy');
            const loadedReviewedByImage = getLoadedSignatureImage(loadedSignatures, 'reviewedBy');

            setAuditBySignature(loadedAuditBy);
            setReviewedBySignature(loadedReviewedBy);
            setAuditBySignatureImage(loadedAuditByImage);
            setReviewedBySignatureImage(loadedReviewedByImage);

            setLineNumber(loadedLineNumber);
            
            lastSavedDataRef.current = getAuditSnapshot(mergedData, loadedAuditBy, loadedReviewedBy, loadedAuditByImage, loadedReviewedByImage);
            autoLoadDraftKeyRef.current = getDraftLookupKey(mergedData.lineNumber, mergedData.date, mergedData.shift);

            const willBeEditable = isSystemAdminRole
                || (isOperatorRole && ['draft', 'returned'].includes(loadedState))
                || (isReviewerRole && loadedState === 'submitted');
            if (showOpenedAlert) {
                showAlert('info', `${willBeEditable ? 'Opened' : 'Viewing'} ${fullAudit.name}`);
            }
            return fullAudit;
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    const editChecksheetFromList = async (checksheet: SavedChecksheet | undefined) => {
        try {
            if (!checksheet || !checksheet._id) {
                showAlert('error', 'Checksheet not found');
                return;
            }
            const state = getWorkflowState(checksheet);
            if (isReviewerRole && state !== 'submitted' && !isSystemAdminRole) {
                showAlert('error', 'Draft and returned checksheets are locked until the operator submits them');
                return;
            }

            await loadChecksheetById(checksheet.id);
        } catch (error) {
            console.error('Error loading checksheet:', error);
            showAlert('error', 'Failed to load checksheet');
        }
    };

    const editSavedChecksheet = async (index: number) => {
        await editChecksheetFromList(savedChecksheets[index]);
    };

    const editReturnedChecksheet = async (index: number) => {
        await editChecksheetFromList(returnedChecksheets[index]);
    };

    useEffect(() => {
        if (!isOperatorRole || activeTab !== 'create-edit' || currentChecksheetId || currentWorkflowState !== 'draft') return;
        if (!auditData.lineNumber || !auditData.date || !auditData.shift) return;

        const lookupKey = getDraftLookupKey(auditData.lineNumber, auditData.date, auditData.shift);
        if (autoLoadDraftKeyRef.current === lookupKey) return;
        autoLoadDraftKeyRef.current = lookupKey;

        let cancelled = false;
        const timeout = window.setTimeout(async () => {
            try {
                const matchingDraft = await apiService.getDraftByLineDateShift(auditData.lineNumber, auditData.date, auditData.shift);
                if (cancelled || !matchingDraft?._id || currentChecksheetIdRef.current) return;
                await loadChecksheetById(matchingDraft._id, { showLoading: false, showOpenedAlert: false });
                showAlert('info', 'Existing draft loaded for the selected line, date, and shift');
            } catch (error) {
                console.error('Error auto-loading draft checksheet:', error);
            }
        }, 300);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [auditData.lineNumber, auditData.date, auditData.shift, activeTab, currentChecksheetId, currentWorkflowState, getDraftLookupKey, isOperatorRole]);

    const deleteSavedChecksheet = async (index: number) => {
        try {
            const checksheet = savedChecksheets[index];
            if (!checksheet?._id) {
                showAlert('error', 'Checksheet not found');
                return;
            }
            const state = getWorkflowState(checksheet);
            const canDelete = isSystemAdminRole
                || (isOperatorRole && state === 'draft')
                || (isReviewerRole && state === 'submitted');
            if (!canDelete) {
                showAlert('error', 'You are not authorized to delete this checksheet');
                return;
            }
            await apiService.deleteAudit(checksheet._id!);
            await loadSavedChecksheets();
            if (currentChecksheetId === checksheet._id) {
                clearCurrentChecksheet();
            }
            showAlert('success', 'Checksheet deleted successfully!');
        } catch (error) {
            console.error('Error deleting checksheet:', error);
            showAlert('error', 'Failed to delete checksheet');
        }
    };

    const openReturnModal = (index: number) => {
        const checksheet = savedChecksheets[index];
        if (!checksheet?._id) {
            showAlert('error', 'Checksheet not found');
            return;
        }
        if (getWorkflowState(checksheet) !== 'submitted') {
            showAlert('error', 'Only submitted checksheets can be returned');
            return;
        }
        setReturnModalChecksheetIndex(index);
        setReturnComment('');
        setReturnCommentError('');
    };

    const closeReturnModal = () => {
        setReturnModalChecksheetIndex(null);
        setReturnComment('');
        setReturnCommentError('');
    };

    const submitReturnForCorrection = async () => {
        if (returnModalChecksheetIndex === null) return;
        const trimmedComments = returnComment.trim();
        if (!trimmedComments) {
            setReturnCommentError('Correction comments are required');
            return;
        }
        try {
            setIsLoading(true);
            const checksheet = savedChecksheets[returnModalChecksheetIndex];
            await apiService.returnAudit(checksheet._id!, trimmedComments);
            if (currentChecksheetId === checksheet._id) {
                setCurrentWorkflowState('returned');
                setCurrentChecksheetMeta(prev => prev ? {
                    ...prev,
                    workflowState: 'returned',
                    returnComments: trimmedComments,
                    returnedAt: new Date().toISOString(),
                    returnedBy: username,
                } : prev);
            }
            closeReturnModal();
            await loadSavedChecksheets();
            if (isOperatorRole) await loadReturnedChecksheets();
            showAlert('success', 'Checksheet returned for correction');
        } catch (error) {
            console.error('Error returning checksheet:', error);
            showAlert('error', 'Failed to return checksheet');
        } finally {
            setIsLoading(false);
        }
    };

    const canOpenListedChecksheet = (checksheet: SavedChecksheet) => {
        const state = getWorkflowState(checksheet);
        return isSystemAdminRole || isOperatorRole || (isReviewerRole && state === 'submitted');
    };

    const canExportListedChecksheet = (checksheet: SavedChecksheet) =>
        getWorkflowState(checksheet) === 'submitted' && canOpenListedChecksheet(checksheet);

    const canDeleteListedChecksheet = (checksheet: SavedChecksheet) => {
        const state = getWorkflowState(checksheet);
        return isSystemAdminRole || (isOperatorRole && state === 'draft') || (isReviewerRole && state === 'submitted');
    };

    const canReturnListedChecksheet = (checksheet: SavedChecksheet) =>
        (isReviewerRole || isSystemAdminRole) && getWorkflowState(checksheet) === 'submitted';

    const getOpenActionLabel = (checksheet: SavedChecksheet) => {
        const state = getWorkflowState(checksheet);
        if (isReviewerRole && state !== 'submitted' && !isSystemAdminRole) return 'Locked';
        if (isOperatorRole && state === 'submitted') return 'View';
        return state === 'submitted' && isReviewerRole ? 'Open' : 'Edit';
    };

    const canProceedFromBasicInfo = isBasicInfoComplete() && (currentChecksheetId !== null || canCreateChecksheet) && !isLoading;

    const stageButtons = Array.from({ length: 31 }, (_, index) => ({
        id: index + 1,
        label: `Stage ${index + 1}`,
        enabled: index < 31,
        hasUnsavedChanges: stageChanges.has(index + 1)
    }));

    const getStateBadgeClass = (state: AuditWorkflowState) => {
        if (state === 'submitted') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200';
        if (state === 'returned') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    };

    const renderChecksheetsList = (checksheets: SavedChecksheet[], title: string, listType: 'main' | 'returned' = 'main') => {
        const isReturnedList = listType === 'returned';
        const page = isReturnedList ? returnedChecksheetsPage : savedChecksheetsPage;
        const pageSize = isReturnedList ? returnedChecksheetsPageSize : savedChecksheetsPageSize;
        const totalItems = isReturnedList ? returnedChecksheetsTotal : savedChecksheetsTotal;
        const searchTerm = isReturnedList ? returnedChecksheetsSearchInput : savedChecksheetsSearchInput;
        const sortOption = isReturnedList ? returnedChecksheetsSort : savedChecksheetsSort;
        const isListLoading = isReturnedList ? isReturnedChecksheetsLoading : isSavedChecksheetsLoading;
        const setPage = isReturnedList ? setReturnedChecksheetsPage : setSavedChecksheetsPage;
        const setPageSize = isReturnedList ? setReturnedChecksheetsPageSize : setSavedChecksheetsPageSize;
        const setSearchTerm = isReturnedList ? setReturnedChecksheetsSearchInput : setSavedChecksheetsSearchInput;
        const setSortOption = isReturnedList ? setReturnedChecksheetsSort : setSavedChecksheetsSort;

        return (
            <div className="saved-reports-container bg-white dark:bg-gray-900 p-3 md:p-5 rounded-md shadow-lg dark:shadow-gray-900/30">
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-center text-gray-800 dark:text-gray-100">
                    {title}
                </h2>
                <ReportListControls
                    searchTerm={searchTerm}
                    sortOption={sortOption}
                    totalCount={totalItems}
                    filteredCount={totalItems}
                    onSearchTermChange={(value) => {
                        setSearchTerm(value);
                        setPage(1);
                    }}
                    onSortOptionChange={(value) => {
                        setSortOption(value);
                        setPage(1);
                    }}
                    searchPlaceholder="Search by checksheet, production order, module type, or creator..."
                />
                {isListLoading ? (
                    <div className="text-center py-6 md:py-8 text-gray-500 dark:text-gray-400">
                        Loading checksheets...
                    </div>
                ) : checksheets.length === 0 ? (
                    <div className="text-center py-6 md:py-8">
                        <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg">
                            {totalItems === 0 ? 'No checksheets found.' : 'No matching checksheets found.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="reports-list">
                            {checksheets.map((checksheet, index) => {
                                const state = getWorkflowState(checksheet);
                                const canOpen = canOpenListedChecksheet(checksheet);
                                const canExport = !isReturnedList && canExportListedChecksheet(checksheet);
                                const canDelete = !isReturnedList && canDeleteListedChecksheet(checksheet);
                                const canReturn = !isReturnedList && canReturnListedChecksheet(checksheet);
                                const updatedTime = checksheet.updatedTimestamp || checksheet.timestamp;
                                const createdBy = checksheet.createdByEmployeeName || checksheet.createdByEmployeeId || checksheet.createdBy || 'Legacy checksheet';

                                return (
                                    <div
                                        key={checksheet._id || `${checksheet.name}-${index}`}
                                        className="report-item overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg p-3 md:p-4 mb-3 md:mb-4 shadow-sm bg-white dark:bg-gray-800"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="min-w-0 text-base md:text-lg font-bold text-gray-800 dark:text-gray-100 break-words">
                                                        {checksheet.name}
                                                    </h3>
                                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getStateBadgeClass(state)}`}>
                                                        {formatWorkflowState(state)}
                                                    </span>
                                                    {checksheet.lineNumber && (
                                                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                                                            Line {checksheet.lineNumber}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-2 grid gap-1 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                                                    <p>Created: {formatTimestamp(checksheet.timestamp)}</p>
                                                    <p>Created by: {createdBy}</p>
                                                    <p>Updated: {formatTimestamp(updatedTime)}</p>
                                                    <p>Date: {checksheet.date || '-'} | Shift: {checksheet.shift || '-'}</p>
                                                    <p>Production Order: {checksheet.productionOrderNo || '-'} | Module: {checksheet.moduleType || '-'}</p>
                                                    {checksheet.submittedAt && <p>Submitted: {formatTimestamp(checksheet.submittedAt)} by {checksheet.submittedBy || '-'}</p>}
                                                    {state === 'returned' && checksheet.returnComments && (
                                                        <p className="text-amber-700 dark:text-amber-300">Return comments: {checksheet.returnComments}</p>
                                                    )}
                                                    {state === 'returned' && (
                                                        <p>Returned: {formatTimestamp(checksheet.returnedAt)} by {checksheet.returnedBy || '-'}</p>
                                                    )}
                                                    {isReviewerRole && state !== 'submitted' && !isSystemAdminRole && (
                                                        <p className="text-gray-500 dark:text-gray-400">Metadata only until submitted.</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex w-full flex-wrap gap-2 justify-start lg:w-auto lg:shrink-0 lg:justify-end">
                                                <button
                                                    className={`flex-1 sm:flex-none whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-md font-medium transition-all ${canExport ? 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-green-500 dark:hover:bg-green-600 cursor-pointer' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
                                                    onClick={() => canExport && exportSavedReportToExcel(index)}
                                                    disabled={!canExport}
                                                    title={canExport ? 'Export to Excel' : 'Excel is available only after submission'}
                                                >
                                                    Excel
                                                </button>
                                                <button
                                                    className={`flex-1 sm:flex-none whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-md font-medium transition-all ${canOpen ? 'bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700 cursor-pointer' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
                                                    onClick={() => canOpen && (isReturnedList ? editReturnedChecksheet(index) : editSavedChecksheet(index))}
                                                    disabled={!canOpen}
                                                >
                                                    {getOpenActionLabel(checksheet)}
                                                </button>
                                                {canReturn && (
                                                    <button
                                                        className="flex-1 sm:flex-none whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-md font-medium bg-amber-600 text-white transition-all hover:bg-amber-700 cursor-pointer"
                                                        onClick={() => openReturnModal(index)}
                                                    >
                                                        Return
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        className="flex-1 sm:flex-none whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-md font-medium bg-red-500 dark:bg-red-600 text-white transition-all hover:bg-red-600 dark:hover:bg-red-700 cursor-pointer"
                                                        onClick={() => {
                                                            showConfirm({
                                                                title: 'Delete Checksheet',
                                                                message: `Are you sure you want to delete "${checksheet.name}"? This action cannot be undone.`,
                                                                type: 'warning',
                                                                confirmText: 'Delete',
                                                                onConfirm: () => deleteSavedChecksheet(index),
                                                            });
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <ReportPagination
                            totalItems={totalItems}
                            page={page}
                            pageSize={pageSize}
                            onPageChange={setPage}
                            onPageSizeChange={(nextPageSize) => {
                                setPageSize(nextPageSize);
                                setPage(1);
                            }}
                            itemLabel="checksheets"
                        />
                    </>
                )}
            </div>
        );
    };

    return (
        <div>
            <div className="max-w-7xl mx-auto">
                {isLoading && (
                    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
                            <p className="mt-2 text-gray-700 dark:text-gray-300">
                                Loading...
                            </p>
                        </div>
                    </div>
                )}
                {returnModalChecksheetIndex !== null && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                        <div className="w-full max-w-md rounded-md bg-white p-4 shadow-xl dark:bg-gray-900">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Return for Correction</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {savedChecksheets[returnModalChecksheetIndex]?.name}
                            </p>
                            <textarea
                                value={returnComment}
                                onChange={(event) => {
                                    setReturnComment(event.target.value);
                                    if (returnCommentError) setReturnCommentError('');
                                }}
                                rows={4}
                                className="mt-3 w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                placeholder="Enter correction comments"
                            />
                            {returnCommentError && (
                                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{returnCommentError}</p>
                            )}
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    onClick={closeReturnModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                                    onClick={submitReturnForCorrection}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex justify-center mb-2">
                    {canCreateChecksheet && (
                        <button
                            onClick={() => {
                                clearCurrentChecksheet();
                                setActiveTab('create-edit');
                            }}
                            className={`tab ${activeTab === 'create-edit' ? 'active bg-white dark:bg-gray-900 text-blue-500 border-b-2 border-b-blue-500 translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        >
                            Create Checksheet
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('saved-reports')}
                        className={`tab ${activeTab === 'saved-reports' ? 'active bg-white dark:bg-gray-900 text-blue-500 border-b-2 border-b-blue-500 translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                    >
                        Submitted/Draft Checksheets
                    </button>
                    {isOperatorRole && returnedChecksheetsTotal > 0 && (
                        <button
                            onClick={() => setActiveTab('returned-reports')}
                            className={`tab relative ${activeTab === 'returned-reports' ? 'active bg-white dark:bg-gray-900 text-blue-500 border-b-2 border-b-blue-500 translate-y--0.5' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-gray-300 border-none translate-none'} py-2 rounded-tr-xl rounded-tl-xl text-center text-sm cursor-pointer font-bold transition-all mx-0.5 w-full`}
                        >
                            Returned Checksheets
                            <span className="absolute right-3 top-1.5 min-w-5 h-5 rounded-full bg-red-600 px-1.5 text-[11px] leading-5 text-white">
                                {returnedChecksheetsTotal}
                            </span>
                        </button>
                    )}
                </div>
                {activeTab === 'create-edit' && (
                    <div>
                        {currentWorkflowState === 'returned' && currentChecksheetMeta?.returnComments && (
                            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                                <strong>Returned for correction:</strong> {currentChecksheetMeta.returnComments}
                                <div className="mt-1 text-xs">
                                    Returned by {currentChecksheetMeta.returnedBy || '-'} on {formatTimestamp(currentChecksheetMeta.returnedAt)}
                                </div>
                            </div>
                        )}
                        <div className="mb-2 flex flex-col sm:flex-row justify-center items-center gap-3">
                            {currentChecksheetId && (
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                    {currentChecksheetMeta?.name || generateChecksheetName(auditData.lineNumber, auditData.date, auditData.shift)}
                                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                        {formatWorkflowState(currentWorkflowState)}
                                    </span>
                                    {isAutosaving && (
                                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-300">
                                            Auto-saving...
                                        </span>
                                    )}
                                </div>
                            )}
                            {canEditCurrentChecksheet && (
                                <button
                                    className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${currentWorkflowState !== 'submitted' && !canSubmitCurrentChecksheet ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    onClick={saveChecksheet}
                                    disabled={currentWorkflowState !== 'submitted' && !canSubmitCurrentChecksheet}
                                    title={currentWorkflowState !== 'submitted' && !canSubmitCurrentChecksheet ? 'Prepared By signature is required before submission' : undefined}
                                >
                                    {currentWorkflowState === 'submitted' ? 'Save Changes' : currentWorkflowState === 'returned' ? 'Resubmit Checksheet' : 'Submit Checksheet'}
                                </button>
                            )}
                            {canExportCurrentChecksheet && (
                                <button
                                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                                    onClick={generateExcelReport}
                                >
                                    Generate Audit Excel
                                </button>
                            )}
                            {currentChecksheetId && currentWorkflowState === 'submitted' && (isReviewerRole || isSystemAdminRole) && (
                                <button
                                    className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                                    onClick={() => {
                                        const index = savedChecksheets.findIndex(sheet => sheet._id === currentChecksheetId);
                                        if (index >= 0) openReturnModal(index);
                                    }}
                                >
                                    Return for Correction
                                </button>
                            )}
                        </div>
                        <div aria-disabled={!canEditCurrentChecksheet} className={!canEditCurrentChecksheet ? 'opacity-90' : ''}>
                        {currentView === 'basicInfo' && (
                            <div className="flex flex-col justify-center">
                                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 mb-6">
                                    <h2 className="text-xl sm:text-2xl font-bold text-center text-gray-800 dark:text-gray-200 mb-6">
                                        Basic Information
                                    </h2>
                                    <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
                                        <div className="w-full">
                                            <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
                                                <span className="text-sm sm:text-lg text-gray-800 dark:text-gray-300 font-medium">
                                                    Inprocess Quality Audit Report - FAB - II LINE -
                                                </span>
                                                <select
                                                    value={auditData.lineNumber}
                                                    onChange={(e) => handleLineChange(e.target.value)}
                                                    className="text-sm p-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 border focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                                                >
                                                    <option value="">Select</option>
                                                    <option value="II">II</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="w-full sm:w-[48%]">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date</label>
                                            <input
                                                type="date"
                                                value={auditData.date}
                                                onChange={(e) => updateBasicInfo('date', e.target.value)}
                                                className="p-2 text-sm block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 border focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                                            />
                                        </div>
                                        <div className="w-full sm:w-[48%]">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Shift</label>
                                            <select
                                                value={auditData.shift}
                                                onChange={(e) => updateBasicInfo('shift', e.target.value)}
                                                className="p-2 text-sm block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 border focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                                            >
                                                <option value="">Select Shift</option>
                                                <option value="A">Shift-A</option>
                                                <option value="B">Shift-B</option>
                                                <option value="C">Shift-C</option>
                                                <option value="G">Shift-G</option>
                                            </select>
                                        </div>
                                        <div className="w-full sm:w-[48%]">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Production Order No.
                                            </label>
                                            <input
                                                type="text"
                                                value={auditData.productionOrderNo}
                                                onChange={(e) => updateBasicInfo('productionOrderNo', e.target.value)}
                                                className="p-2 text-sm block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 border focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                                            />
                                        </div>
                                        <div className="w-full sm:w-[48%]">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Module Type</label>
                                            <input
                                                type="text"
                                                value={auditData.moduleType}
                                                onChange={(e) => updateBasicInfo('moduleType', e.target.value)}
                                                className="p-2 text-sm block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 border focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                                            />
                                        </div>
                                        <div className="w-full flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-10 mt-4">
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={auditData.customerSpecAvailable}
                                                    onChange={(e) => updateBasicInfo('customerSpecAvailable', e.target.checked)}
                                                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:border-blue-500 w-4 h-4 sm:w-5 sm:h-5"
                                                />
                                                <span className="ml-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">Customer Specification Available</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={auditData.specificationSignedOff}
                                                    onChange={(e) => updateBasicInfo('specificationSignedOff', e.target.checked)}
                                                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:border-blue-500 w-4 h-4 sm:w-5 sm:h-5"
                                                />
                                                <span className="ml-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">Specification Signed Off With Customer</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="text-center">
                                        <button
                                            onClick={handleNextFromBasicInfo}
                                            disabled={!canProceedFromBasicInfo}
                                            className={`px-6 sm:px-8 py-2 sm:py-3 text-white rounded-lg transition-colors text-sm sm:text-lg font-semibold ${canProceedFromBasicInfo ? 'bg-blue-600 dark:bg-blue-700 cursor-pointer hover:bg-blue-700 dark:hover:bg-blue-600' : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'}`}
                                            title={!canProceedFromBasicInfo ? 'Complete all required basic information before continuing' : undefined}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {currentView === 'stageSelection' && (
                            <div className="flex flex-col justify-center">
                                <div className="bg-transparent dark:bg-gray-800 rounded-lg">
                                    <div className="flex flex-wrap justify-center gap-2 mb-2">
                                        <button
                                            onClick={handleBackToBasicInfo}
                                            className="bg-gray-600 dark:bg-gray-700 text-white border border-gray-600 dark:border-gray-700 p-2 rounded-lg cursor-pointer text-xs sm:text-sm font-bold transition-all duration-300 hover:bg-gray-700 dark:hover:bg-gray-600 hover:border-gray-700 dark:hover:border-gray-600"
                                        >
                                            ← Back to Basic Info
                                        </button>
                                    </div>
                                    <div className="flex flex-col md:flex-row justify-between gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div className="flex-1 text-center mb-4 md:mb-0">
                                            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">AUDIT BY:</p>
                                            <div className="min-h-10 p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded mb-2 flex items-center justify-center">
                                                <span className={`${auditBySignature ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {auditBySignature || 'No signature'}
                                                </span>
                                            </div>
                                            {auditBySignatureImage && (
                                                <img
                                                    src={getSignatureImageSrc(auditBySignatureImage)}
                                                    alt="Audit by signature preview"
                                                    className="mx-auto mb-2 h-14 max-w-full object-contain rounded border border-gray-200 dark:border-gray-600 bg-white"
                                                />
                                            )}
                                            <div className="flex flex-wrap justify-center gap-2">
                                                <button
                                                    className={`px-2 sm:px-3 py-1 text-white rounded text-xs sm:text-sm font-medium transition-colors ${canAddSignature('audit') ? 'bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-500 cursor-pointer' : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'}`}
                                                    onClick={() => handleAddSignature('audit')}
                                                    disabled={!canAddSignature('audit')}
                                                >
                                                    Add my Signature
                                                </button>
                                                <button
                                                    className={`px-2 sm:px-3 py-1 text-white rounded text-xs sm:text-sm font-medium transition-colors ${canRemoveSignature('audit') ? 'bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-500 cursor-pointer' : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'}`}
                                                    onClick={() => handleRemoveSignature('audit')}
                                                    disabled={!canRemoveSignature('audit')}
                                                >
                                                    Remove my Signature
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex-1 text-center">
                                            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">REVIEWED BY:</p>
                                            <div className="min-h-10 p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded mb-2 flex items-center justify-center">
                                                <span className={`${reviewedBySignature ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {reviewedBySignature || 'No signature'}
                                                </span>
                                            </div>
                                            {reviewedBySignatureImage && (
                                                <img
                                                    src={getSignatureImageSrc(reviewedBySignatureImage)}
                                                    alt="Reviewed by signature preview"
                                                    className="mx-auto mb-2 h-14 max-w-full object-contain rounded border border-gray-200 dark:border-gray-600 bg-white"
                                                />
                                            )}
                                            <div className="flex flex-wrap justify-center gap-2">
                                                <button
                                                    className={`px-2 sm:px-3 py-1 text-white rounded text-xs sm:text-sm font-medium transition-colors ${canAddSignature('reviewed') ? 'bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-500 cursor-pointer' : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'}`}
                                                    onClick={() => handleAddSignature('reviewed')}
                                                    disabled={!canAddSignature('reviewed')}
                                                >
                                                    Add my Signature
                                                </button>
                                                <button
                                                    className={`px-2 sm:px-3 py-1 text-white rounded text-xs sm:text-sm font-medium transition-colors ${canRemoveSignature('reviewed') ? 'bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-500 cursor-pointer' : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'}`}
                                                    onClick={() => handleRemoveSignature('reviewed')}
                                                    disabled={!canRemoveSignature('reviewed')}
                                                >
                                                    Remove my Signature
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {stageButtons.map((button) => (
                                            <button
                                                key={button.id}
                                                onClick={() => button.enabled && handleStageButtonClick(button.id)}
                                                disabled={!button.enabled}
                                                className={`p-3 sm:p-4 md:p-6 rounded-lg transition-all duration-300 transform hover:scale-105 relative ${button.enabled
                                                    ? button.hasUnsavedChanges
                                                        ? 'bg-orange-500 dark:bg-orange-600 text-white hover:bg-orange-600 dark:hover:bg-orange-500 cursor-pointer'
                                                        : 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 cursor-pointer'
                                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                                    }`}
                                            >
                                                <span className="text-xs sm:text-sm font-medium">
                                                    {auditData.stages.find(stage => stage.id === button.id)?.name || button.label}
                                                </span>
                                                {button.hasUnsavedChanges && (
                                                    <span className="absolute top-1 right-1 sm:top-2 sm:right-2 w-2 h-2 bg-yellow-400 dark:bg-yellow-500 rounded-full"></span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {currentView === 'stageDetail' && selectedStageId && (
                            <div className="bg-transparent dark:bg-gray-800 rounded-lg overflow-hidden animate-fade-in max-h-[calc(100vh-7rem)] flex flex-col min-h-0">
                                <div className="sticky top-0 z-30 bg-blue-600 dark:bg-blue-700 text-white px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-sm">
                                    <h2 className="text-lg sm:text-xl font-semibold">
                                        {auditData.stages.find(stage => stage.id === selectedStageId)?.name || `Stage ${selectedStageId}`}
                                        {stageChanges.has(selectedStageId) && (
                                            <span className="ml-2 text-yellow-300 dark:text-yellow-400 text-xs sm:text-sm">• Unsaved changes (auto-saving)</span>
                                        )}
                                    </h2>
                                    <div className="flex flex-wrap gap-2 self-end sm:self-auto">
                                        {(() => {
                                            const currentStageIndex = auditData.stages.findIndex(stage => stage.id === selectedStageId);
                                            const previousStage = currentStageIndex > 0 ? auditData.stages[currentStageIndex - 1] : null;
                                            const nextStage = currentStageIndex >= 0 && currentStageIndex < auditData.stages.length - 1 ? auditData.stages[currentStageIndex + 1] : null;

                                            return (
                                                <>
                                                    <button
                                                        onClick={() => previousStage && handleStageNavigation(previousStage.id)}
                                                        disabled={!previousStage}
                                                        className="bg-white/20 dark:bg-gray-800/20 text-white border border-white dark:border-gray-300 px-3 sm:px-4 py-1 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-bold transition-all duration-300 hover:bg-white hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/20 disabled:hover:text-white"
                                                    >
                                                        <ChevronLeft />
                                                    </button>
                                                    <button
                                                        onClick={() => nextStage && handleStageNavigation(nextStage.id)}
                                                        disabled={!nextStage}
                                                        className="bg-white/20 dark:bg-gray-800/20 text-white border border-white dark:border-gray-300 px-3 sm:px-4 py-1 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-bold transition-all duration-300 hover:bg-white hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/20 disabled:hover:text-white"
                                                    >
                                                        <ChevronRight />
                                                    </button>
                                                </>
                                            );
                                        })()}
                                        <button
                                            onClick={handleBackToStageSelection}
                                            className="bg-white/20 dark:bg-gray-800/20 text-white border border-white dark:border-gray-300 px-3 sm:px-4 py-1 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-bold transition-all duration-300 hover:bg-white hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                                        >
                                            <X />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 min-h-0 overflow-auto -mx-4 sm:mx-0">
                                    <div className="min-w-full inline-block align-middle">
                                        {auditData.stages
                                            .find(stage => stage.id === selectedStageId)
                                            ?.parameters.map((param) => {
                                                const savedStage = auditData.stages.find(s => s.id === selectedStageId);
                                                const savedParam = savedStage?.parameters.find(p => p.id === param.id);
                                                return (
                                                    <div key={param.id} className="min-w-[800px] sm:min-w-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-2">
                                                        <table className="w-full">
                                                            <thead className="bg-gray-50 dark:bg-gray-900">
                                                                <tr>
                                                                    <th className="px-4 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                                                                        Parameters
                                                                    </th>
                                                                    <th className="px-4 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                                                                        Criteria
                                                                    </th>
                                                                    <th className="px-4 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                                                                        Type of Inspection
                                                                    </th>
                                                                    <th className="px-4 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                                                                        Inspection Frequency
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white dark:bg-gray-800">
                                                                <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold">
                                                                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-normal text-xs sm:text-sm text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                                                        {param.parameters}
                                                                    </td>
                                                                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-normal text-xs sm:text-sm text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                                                        {param.criteria}
                                                                    </td>
                                                                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-normal text-xs sm:text-sm text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${param.typeOfInspection === 'Aesthetics' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                                                                            param.typeOfInspection === 'Measurements' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                                                                                param.typeOfInspection === 'Functionality' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                                                                                    param.typeOfInspection === 'RFID Scanner' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300' :
                                                                                        'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                                                            }`}>
                                                                            {param.typeOfInspection}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-normal text-xs sm:text-sm text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                                                        {param.inspectionFrequency}
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td colSpan={4} className="px-4 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                                                        Observations
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td colSpan={4} className="px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 dark:border-gray-700">
                                                                        <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-2 w-full">
                                                                            {param.observations.map((obs) => {
                                                                                const savedObservation = savedParam?.observations.find(
                                                                                    o => o.timeSlot === obs.timeSlot
                                                                                );
                                                                                const isGroupedSampleRow = SAMPLE_GROUPED_STAGE_IDS.has(selectedStageId) && obs.timeSlot.startsWith('Line-');

                                                                                return (
                                                                                    <div
                                                                                        key={obs.timeSlot}
                                                                                        className={`flex flex-col items-center ${isGroupedSampleRow || param.observations.length === 1 ? 'w-full' :
                                                                                            param.observations.length === 2 ? 'sm:w-1/2' :
                                                                                                param.observations.length === 3 ? 'sm:w-1/3' :
                                                                                                    'sm:w-1/4'}`}
                                                                                    >
                                                                                        {DYNAMIC_LINE_STAGE_IDS.has(selectedStageId) && obs.timeSlot.startsWith('Line-') && !isGroupedSampleRow ? (
                                                                                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                                                                                <span>Line -</span>
                                                                                                <select
                                                                                                    value={savedObservation?.selectedLine || obs.selectedLine || getSelectedLineFromSlot(obs.timeSlot)}
                                                                                                    onChange={(e) => updateObservationLineSelection(selectedStageId, param.id, obs.timeSlot, e.target.value)}
                                                                                                    className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                                >
                                                                                                    {getDynamicLineOptions(auditData.lineNumber).map(line => (
                                                                                                        <option key={line} value={line}>{line}</option>
                                                                                                    ))}
                                                                                                </select>
                                                                                            </label>
                                                                                        ) : (
                                                                                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">{obs.timeSlot}</label>
                                                                                        )}
                                                                                        {param.renderObservation ? (
                                                                                            param.renderObservation({
                                                                                                stageId: selectedStageId,
                                                                                                paramId: param.id,
                                                                                                timeSlot: obs.timeSlot,
                                                                                                value: savedObservation?.value ?? obs.value,
                                                                                                observationData: savedObservation ?? obs,
                                                                                                onUpdate: updateObservation,
                                                                                                lineOptions: getDynamicLineOptions(auditData.lineNumber),
                                                                                                onLineMappingUpdate: updateObservationLineMapping
                                                                                            })
                                                                                        ) : (
                                                                                            <div className="w-full flex justify-center">
                                                                                                {typeof (savedObservation?.value ?? obs.value) === 'string' ? (
                                                                                                    <input
                                                                                                        type="text"
                                                                                                        value={(savedObservation?.value ?? obs.value) as string}
                                                                                                        onChange={(e) => updateObservation(selectedStageId, param.id, obs.timeSlot, e.target.value)}
                                                                                                        placeholder="Enter value"
                                                                                                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                                                                                                    />
                                                                                                ) : (
                                                                                                    <div className="text-xs text-gray-500 dark:text-gray-400 p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900">
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
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                )}
                {activeTab === 'saved-reports' && (
                    <div className="tab-content active">
                        {renderChecksheetsList(savedChecksheets, isOperatorRole ? 'Submitted/Draft Checksheets' : 'Checksheets')}
                    </div>
                )}
                {activeTab === 'returned-reports' && isOperatorRole && (
                    <div className="tab-content active">
                        {renderChecksheetsList(returnedChecksheets, 'Returned Checksheets', 'returned')}
                    </div>
                )}
            </div>
            <div id="alert-container" className="fixed top-5 right-5 z-50 w-80 sm:w-96"></div>
        </div>
    );
}
