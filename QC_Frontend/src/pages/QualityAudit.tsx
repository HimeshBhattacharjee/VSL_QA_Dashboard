import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initialStages } from '../audit-data';
import { AuditData, ObservationValue, StageData } from '../types/audit';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import { useLine } from '../context/LineContext';
import { LINE_DEPENDENT_CONFIG } from '../audit-data/lineConfig';
import { ReportSortOption } from '../components/ReportListControls';
import ReportPagination from '../components/ReportPagination';
import BusRibbonAuditPeelStrengthInput from '../components/BusRibbonAuditPeelStrengthInput';
import { buildWorkflowConfirmOptions, isResolvedCreator, OPERATOR_SIGNATURE_REQUIRED_MESSAGE, resolveCreatorName } from '../utilities/workflowUtils';
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
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, CircleDot, Download, Edit3, Eye, FileSpreadsheet, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
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
const COMPLETION_METADATA_KEYS = new Set([
    'schemaVersion',
    'parameterId',
    'sampleGroup',
    'sampleNumber',
    'sampleLabel',
    'groupKey',
    'groupLabel',
    'order',
    'selectedLine',
]);

type StageCompletionStatus = 'not_started' | 'in_progress' | 'completed';
type AuditWorkflowState = 'draft' | 'submitted' | 'approved' | 'returned';
type AuditDisplayStatus = AuditWorkflowState;
type AuditMainView = 'dashboard' | 'create-edit' | 'saved-reports' | 'returned-reports';
type AuditAccessMode = 'edit' | 'view';
type DashboardPeriod = 'daily' | 'weekly' | 'monthly';
type CompletionRangeFilter = '' | '0-25' | '26-50' | '51-75' | '76-99' | '100';
type AuditSortOption = ReportSortOption | 'completion-desc' | 'completion-asc' | 'status' | 'created-by' | 'shift' | 'date-newest' | 'date-oldest';

const TOTAL_AUDIT_STAGES = initialStages.length;
const FINALIZED_WORKFLOW_STATES = new Set<AuditWorkflowState>(['submitted', 'approved']);
const EDITABLE_OPERATOR_WORKFLOW_STATES = new Set<AuditWorkflowState>(['draft', 'returned']);
const APPROVED_DELETE_TOOLTIP = 'Approved reports are permanently retained and cannot be deleted.';

interface AuditCompletionMetrics {
    completedStages: number;
    totalStages: number;
    completionPercentage: number;
}

interface AuditListFilters {
    dateFrom: string;
    dateTo: string;
    shift: string;
    lineNumber: string;
    status: '' | AuditDisplayStatus;
    completionRange: CompletionRangeFilter;
}

interface DashboardGroupSummary {
    key: string;
    date?: string;
    dayName?: string;
    displayDate?: string;
    totalAudits: number;
    completed: number;
    draft: number;
    submitted: number;
    returned: number;
    approved: number;
    averageCompletion: number;
}

interface DashboardResponse {
    view: DashboardPeriod;
    dateFrom: string;
    dateTo: string;
    summary: {
        totalAudits: number;
        completed: number;
        draft: number;
        submitted: number;
        returned: number;
        approved: number;
        averageCompletion: number;
    };
    groups: DashboardGroupSummary[];
    items: SavedChecksheet[];
    total: number;
    truncated: boolean;
}

interface BulkOperationProgress {
    action: string;
    completed: number;
    total: number;
}

interface BulkOperationResult {
    requested?: number;
    approved?: number;
    deleted?: number;
    downloaded?: number;
    processed?: number;
    skipped?: Record<string, number>;
    skippedCount?: number;
    failed?: Array<{ auditId?: string; reason?: string }>;
    failedCount?: number;
}

type CompletionCounts = {
    userFilled: number;
    userTotal: number;
    systemFilled: number;
    systemTotal: number;
};

interface CompletionMetadata {
    treatEmptyAsComplete?: boolean;
    systemKeyNames?: string[];
    systemKeySuffixes?: string[];
}

const createEmptyCompletionCounts = (): CompletionCounts => ({
    userFilled: 0,
    userTotal: 0,
    systemFilled: 0,
    systemTotal: 0,
});

const addCompletionCounts = (left: CompletionCounts, right: CompletionCounts): CompletionCounts => ({
    userFilled: left.userFilled + right.userFilled,
    userTotal: left.userTotal + right.userTotal,
    systemFilled: left.systemFilled + right.systemFilled,
    systemTotal: left.systemTotal + right.systemTotal,
});

const DEFAULT_COMPLETED_PARAMETER_IDS = new Set([
    '2-2',
    '3-6',
    '5-2',
    '7-5',
    '8-1',
    '8-2',
    '8-3',
    '8-4',
    '8-5',
    '9-5',
    '10-4',
    '10-5',
    '10-6',
    '11-2',
    '15-1',
    '15-2',
    '17-3',
    '17-4',
    '18-4',
    '19-1',
    '20-2',
    '20-4',
    '21-5',
    '22-1',
    '22-2',
    '24-2',
    '24-3',
    '24-8',
    '24-9',
    '25-1',
    '25-2',
    '25-3',
    '26-2',
    '26-3',
    '28-1',
    '29-2',
    '30-1',
    '30-2',
    '31-2',
    '31-3',
    '31-4',
    '31-5',
    '31-6',
    '31-7',
    '31-8',
    '31-10',
    '31-11',
    '31-12',
    '31-13',
]);

const AUDIT_COMPLETION_METADATA: Record<string, CompletionMetadata> = {
    ...Object.fromEntries(
        Array.from(DEFAULT_COMPLETED_PARAMETER_IDS).map(parameterId => [
            parameterId,
            { treatEmptyAsComplete: true },
        ]),
    ),
    '18-1': { systemKeySuffixes: ['-type'] },
    '20-3': { systemKeySuffixes: ['-Ratio'] },
    '26-1': { systemKeySuffixes: ['-4hrs', '-8hrs'] },
};

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isEmptyCompletionValue = (value: unknown) =>
    value === undefined
    || value === null
    || (typeof value === 'string' && value.trim() === '')
    || (Array.isArray(value) && value.length === 0)
    || (isRecordValue(value) && Object.keys(value).length === 0);

const hasFilledCompletionValue = (value: unknown) => !isEmptyCompletionValue(value);

const isCompletionSystemPath = (path: string[], metadata?: CompletionMetadata) => {
    if (!metadata) return false;

    const leafKey = path[path.length - 1] || '';
    return Boolean(
        metadata.treatEmptyAsComplete ||
        metadata.systemKeyNames?.includes(leafKey) ||
        metadata.systemKeySuffixes?.some(suffix => leafKey.endsWith(suffix)),
    );
};

const getCompletionFieldCounts = (
    value: unknown,
    baselineValue: unknown,
    metadata: CompletionMetadata | undefined,
    path: string[],
): CompletionCounts => {
    const isSystemPath = isCompletionSystemPath(path, metadata);
    const isSameBaselineDefault =
        hasFilledCompletionValue(value) &&
        hasFilledCompletionValue(baselineValue) &&
        JSON.stringify(value) === JSON.stringify(baselineValue);
    const isSystemField = isSystemPath || isSameBaselineDefault;
    const isFilled = hasFilledCompletionValue(value) || isSystemPath;

    if (isSystemField) {
        return {
            userFilled: 0,
            userTotal: 0,
            systemFilled: isFilled ? 1 : 0,
            systemTotal: 1,
        };
    }

    return {
        userFilled: isFilled ? 1 : 0,
        userTotal: 1,
        systemFilled: 0,
        systemTotal: 0,
    };
};

const getSectionOffCompletionCounts = (
    sectionValue: Record<string, unknown>,
    recipeKey: string,
    baselineValue: unknown,
    metadata: CompletionMetadata | undefined,
    path: string[],
) => getObservationCompletionCounts(
    sectionValue[recipeKey],
    isRecordValue(baselineValue) ? baselineValue[recipeKey] : undefined,
    metadata,
    [...path, recipeKey],
);

const getObservationCompletionCounts = (
    value: unknown,
    baselineValue?: unknown,
    metadata?: CompletionMetadata,
    path: string[] = [],
): CompletionCounts => {
    if (typeof value === 'string') {
        return getCompletionFieldCounts(value, baselineValue, metadata, path);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return getCompletionFieldCounts(value, baselineValue, metadata, path);
        const baselineItems = Array.isArray(baselineValue) ? baselineValue : [];
        return value.reduce(
            (counts, item, index) => {
                const itemCounts = getObservationCompletionCounts(item, baselineItems[index], metadata, [...path, String(index)]);
                return addCompletionCounts(counts, itemCounts);
            },
            createEmptyCompletionCounts()
        );
    }

    if (isRecordValue(value)) {
        const baselineObject = isRecordValue(baselineValue) ? baselineValue : {};
        const entries = Array.from(new Set([
            ...Object.keys(value),
            ...Object.keys(baselineObject),
        ])).filter(key => !COMPLETION_METADATA_KEYS.has(key));
        if (entries.length === 0) return getCompletionFieldCounts(value, baselineValue, metadata, path);

        return entries.reduce(
            (counts, key) => {
                const nestedValue = value[key];
                const nestedBaselineValue = baselineObject[key];

                if (
                    key === 'upper' &&
                    isRecordValue(nestedValue) &&
                    String(nestedValue.selectedRecipeUpper || '').toUpperCase() === 'OFF'
                ) {
                    return addCompletionCounts(
                        counts,
                        getSectionOffCompletionCounts(nestedValue, 'selectedRecipeUpper', nestedBaselineValue, metadata, [...path, key]),
                    );
                }

                if (
                    key === 'lower' &&
                    isRecordValue(nestedValue) &&
                    String(nestedValue.selectedRecipeLower || '').toUpperCase() === 'OFF'
                ) {
                    return addCompletionCounts(
                        counts,
                        getSectionOffCompletionCounts(nestedValue, 'selectedRecipeLower', nestedBaselineValue, metadata, [...path, key]),
                    );
                }

                const nestedCounts = getObservationCompletionCounts(nestedValue, nestedBaselineValue, metadata, [...path, key]);
                return addCompletionCounts(counts, nestedCounts);
            },
            createEmptyCompletionCounts()
        );
    }

    return getCompletionFieldCounts(value, baselineValue, metadata, path);
};

const getStageCompletionStatus = (stage: StageData, baselineStage?: StageData): StageCompletionStatus => {
    const counts = stage.parameters.reduce(
        (stageCounts, parameter) => {
            const baselineParameter = baselineStage?.parameters.find(item => item.id === parameter.id);
            const metadata = AUDIT_COMPLETION_METADATA[parameter.id];

            return parameter.observations.reduce(
                (parameterCounts, observation) => {
                    const baselineObservation = baselineParameter?.observations.find(item => item.timeSlot === observation.timeSlot);
                    const observationCounts = getObservationCompletionCounts(
                        observation.value,
                        baselineObservation?.value,
                        metadata,
                    );
                    return addCompletionCounts(parameterCounts, observationCounts);
                },
                stageCounts
            );
        },
        createEmptyCompletionCounts()
    );

    if (counts.userTotal === 0) {
        return counts.systemTotal > 0 && counts.systemFilled === counts.systemTotal
            ? 'completed'
            : 'not_started';
    }

    if (counts.userFilled === 0) return 'not_started';
    if (counts.userFilled === counts.userTotal && counts.systemFilled === counts.systemTotal) return 'completed';
    return 'in_progress';
};

const getAuditCompletionMetrics = (auditData: AuditData): AuditCompletionMetrics => {
    const baselineStages = buildLineDependentStages(initialStages, auditData.lineNumber);
    const baselineStagesById = new Map(baselineStages.map(stage => [stage.id, stage]));
    const totalStages = auditData.stages.length || TOTAL_AUDIT_STAGES;
    const completedStages = auditData.stages.filter(stage =>
        getStageCompletionStatus(stage, baselineStagesById.get(stage.id)) === 'completed'
    ).length;

    return {
        completedStages,
        totalStages,
        completionPercentage: totalStages ? Math.round((completedStages / totalStages) * 100) : 0,
    };
};

const getWorkflowState = (checksheet?: Pick<SavedChecksheet, 'workflowState'> | null): AuditWorkflowState =>
    checksheet?.workflowState || 'submitted';

const formatWorkflowState = (state: AuditWorkflowState) =>
    state.charAt(0).toUpperCase() + state.slice(1);

const formatTimestamp = (value?: string | number | null) =>
    value ? new Date(value).toLocaleString() : '-';

const sumObjectValues = (values: Record<string, number>) =>
    Object.values(values).reduce((total, count) => total + count, 0);

const getDynamicLineOptions = (lineNumber: string) => lineNumber === 'II' ? ['3', '4'] : ['1', '2'];

const getBusRibbonAuditLineOptions = (lineNumber: string) =>
    lineNumber === 'II' ? ['Line-4', 'Line-5'] : ['Line-1', 'Line-2', 'Line-3'];

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
    displayStatus?: AuditDisplayStatus;
    completedStages?: number;
    totalStages?: number;
    completionPercentage?: number;
    createdBy?: string;
    createdByUserId?: string | null;
    createdByEmployeeName?: string | null;
    createdByEmployeeId?: string | null;
    submittedAt?: string | null;
    submittedBy?: string | null;
    approvedAt?: string | null;
    approvedBy?: string | null;
    returnedAt?: string | null;
    returnedBy?: string | null;
    returnComments?: string | null;
    isSigned?: boolean;
    signedAt?: string | null;
    isLocked?: boolean;
    lockedBy?: string | null;
    lockedByUserId?: string | null;
    lockedByEmployeeId?: string | null;
    lockTimestamp?: string | null;
    lockSessionId?: string | null;
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
    const [activeTab, setActiveTab] = useState<AuditMainView>('dashboard');
    const [dashboardView, setDashboardView] = useState<DashboardPeriod>('daily');
    const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
    const [isDashboardLoading, setIsDashboardLoading] = useState(false);
    const [currentView, setCurrentView] = useState<'basicInfo' | 'stageSelection' | 'stageDetail'>('basicInfo');
    const [currentAccessMode, setCurrentAccessMode] = useState<AuditAccessMode>('edit');
    const [readOnlyReason, setReadOnlyReason] = useState('');
    const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
    const [_, setHasUnsavedChanges] = useState<boolean>(false);
    const [stageChanges, setStageChanges] = useState<Set<number>>(new Set());
    const [savedChecksheets, setSavedChecksheets] = useState<SavedChecksheet[]>([]);
    const [savedChecksheetsTotal, setSavedChecksheetsTotal] = useState(0);
    const [savedChecksheetsPage, setSavedChecksheetsPage] = useState(1);
    const [savedChecksheetsPageSize, setSavedChecksheetsPageSize] = useState(20);
    const [savedChecksheetsSearch, setSavedChecksheetsSearch] = useState('');
    const [savedChecksheetsSearchInput, setSavedChecksheetsSearchInput] = useState('');
    const [savedChecksheetsSort, setSavedChecksheetsSort] = useState<AuditSortOption>('newest-created');
    const [savedChecksheetsFilters, setSavedChecksheetsFilters] = useState<AuditListFilters>({
        dateFrom: '',
        dateTo: '',
        shift: '',
        lineNumber: '',
        status: '',
        completionRange: '',
    });
    const [selectedAuditIds, setSelectedAuditIds] = useState<Set<string>>(new Set());
    const [selectedAuditRecords, setSelectedAuditRecords] = useState<Record<string, SavedChecksheet>>({});
    const [bulkProgress, setBulkProgress] = useState<BulkOperationProgress | null>(null);
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
    const [returnedChecksheetsSort, setReturnedChecksheetsSort] = useState<AuditSortOption>('newest-updated');
    const [returnedChecksheetsFilters, setReturnedChecksheetsFilters] = useState<AuditListFilters>({
        dateFrom: '',
        dateTo: '',
        shift: '',
        lineNumber: '',
        status: 'returned',
        completionRange: '',
    });
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
    const lastSelectedAuditIdRef = useRef<string | null>(null);
    const autoLoadDraftKeyRef = useRef<string>('');
    const autosaveTimeoutRef = useRef<number | null>(null);
    const isAutosavingRef = useRef(false);
    const lockSessionIdRef = useRef(
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const currentLockHeldRef = useRef<string | null>(null);
    
    const IPQC_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/ipqc-audits';
    const USER_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/user';

    const isOperatorRole = userRole === 'Operator';
    const isReviewerRole = ['Supervisor', 'Manager'].includes(userRole || '');
    const isSystemAdminRole = ['Admin', 'System Administrator'].includes(userRole || '');
    const isCurrentChecksheetOwner = isResolvedCreator(currentChecksheetMeta, { employeeId, username });
    const canCreateChecksheet = isOperatorRole;
    const canEditCurrentChecksheet = currentAccessMode === 'edit' && (
        (isOperatorRole && (!currentChecksheetId || (isCurrentChecksheetOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState))))
        || ((isReviewerRole || isSystemAdminRole) && currentChecksheetId !== null && currentWorkflowState === 'submitted')
    );
    const canSaveDraftCurrentChecksheet = isOperatorRole && isCurrentChecksheetOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState);
    const canSubmitCurrentChecksheet = isOperatorRole
        && currentAccessMode === 'edit'
        && (!currentChecksheetId || (isCurrentChecksheetOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState)));
    const canExportCurrentChecksheet = currentChecksheetId !== null
        && FINALIZED_WORKFLOW_STATES.has(currentWorkflowState)
        && (isReviewerRole || isSystemAdminRole || isOperatorRole);

    const authHeaders = (includeJson = false, includeLockSession = false): HeadersInit => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        'X-Employee-Id': sessionStorage.getItem('employeeId') || employeeId || '',
        'X-User-Name': sessionStorage.getItem('username') || username || '',
        'X-User-Role': sessionStorage.getItem('userRole') || userRole || '',
        ...(includeLockSession ? { 'X-Lock-Session-Id': lockSessionIdRef.current } : {}),
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
            sort?: AuditSortOption;
            workflowState?: AuditWorkflowState;
            excludeWorkflowState?: AuditWorkflowState;
            filters?: AuditListFilters;
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
            if (params.filters?.dateFrom) query.append('date_from', params.filters.dateFrom);
            if (params.filters?.dateTo) query.append('date_to', params.filters.dateTo);
            if (params.filters?.shift) query.append('shift', params.filters.shift);
            if (params.filters?.lineNumber) query.append('lineNumber', params.filters.lineNumber);
            if (params.filters?.status) query.append('status', params.filters.status);
            if (params.filters?.completionRange) query.append('completion_range', params.filters.completionRange);

            const response = await fetch(`${IPQC_API_BASE_URL}/?${query}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch audit summaries: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        getDashboard: async (view: DashboardPeriod): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/dashboard?view=${view}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch audit dashboard: ${response.status} ${errorText}`);
            }
            return response.json();
        },

        getDraftByLineDateShift: async (line: string, date: string, shift: string): Promise<any | null> => {
            const query = new URLSearchParams({
                lineNumber: line,
                date,
                shift,
                workflow_state: 'draft',
                owner_only: 'true'
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
                headers: authHeaders(true, true),
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
                headers: authHeaders(true, true),
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
                headers: authHeaders(true, true),
                body: JSON.stringify(audit),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to submit audit: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        approveAudit: async (id: string): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/${id}/approve`, {
                method: 'POST',
                headers: authHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to approve audit: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        bulkApproveAudits: async (auditIds: string[]): Promise<BulkOperationResult> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/bulk/approve`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ auditIds }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to bulk approve audits: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        bulkDeleteAudits: async (auditIds: string[]): Promise<BulkOperationResult> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/bulk/delete`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ auditIds }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to bulk delete audits: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        lockAudit: async (id: string): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/${id}/lock`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ lockSessionId: lockSessionIdRef.current }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to lock audit: ${response.status} ${errorText}`);
            }
            return response.json();
        },
        unlockAudit: async (id: string): Promise<any> => {
            const response = await fetch(`${IPQC_API_BASE_URL}/${id}/unlock`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ lockSessionId: lockSessionIdRef.current }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to unlock audit: ${response.status} ${errorText}`);
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
        const fallbackCompletion = auditDataForSummary
            ? getAuditCompletionMetrics(auditDataForSummary as AuditData)
            : { completedStages: 0, totalStages: TOTAL_AUDIT_STAGES, completionPercentage: 0 };

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
            displayStatus: audit.displayStatus,
            completedStages: audit.completedStages ?? fallbackCompletion.completedStages,
            totalStages: audit.totalStages ?? fallbackCompletion.totalStages,
            completionPercentage: audit.completionPercentage ?? fallbackCompletion.completionPercentage,
            createdBy: audit.createdBy,
            createdByUserId: audit.createdByUserId,
            createdByEmployeeName: audit.createdByEmployeeName,
            createdByEmployeeId: audit.createdByEmployeeId,
            submittedAt: audit.submittedAt,
            submittedBy: audit.submittedBy,
            approvedAt: audit.approvedAt,
            approvedBy: audit.approvedBy,
            returnedAt: audit.returnedAt,
            returnedBy: audit.returnedBy,
            returnComments: audit.returnComments,
            isSigned: audit.isSigned,
            signedAt: audit.signedAt,
            isLocked: audit.isLocked,
            lockedBy: audit.lockedBy,
            lockedByUserId: audit.lockedByUserId,
            lockedByEmployeeId: audit.lockedByEmployeeId,
            lockTimestamp: audit.lockTimestamp,
            lockSessionId: audit.lockSessionId,
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

    const releaseAuditLock = useCallback(async (auditId?: string | null) => {
        const idToRelease = auditId || currentLockHeldRef.current;
        if (!idToRelease) return;
        try {
            await apiService.unlockAudit(idToRelease);
        } catch (error) {
            console.error('Error releasing audit lock:', error);
        } finally {
            if (currentLockHeldRef.current === idToRelease) {
                currentLockHeldRef.current = null;
            }
        }
    }, []);

    const acquireAuditLock = useCallback(async (checksheet: SavedChecksheet) => {
        if (!checksheet._id) return false;
        try {
            const lockedAudit = await apiService.lockAudit(checksheet._id);
            currentLockHeldRef.current = checksheet._id;
            upsertSavedChecksheetSummary(lockedAudit);
            return true;
        } catch (error: any) {
            console.error('Error acquiring audit lock:', error);
            const message = error?.message?.includes('currently')
                ? error.message
                : `This audit is currently being completed by ${checksheet.lockedBy || checksheet.createdByEmployeeName || 'another operator'}. Editing is locked until submission.`;
            showAlert('warning', message);
            return false;
        }
    }, [showAlert, upsertSavedChecksheetSummary]);

    useEffect(() => {
        if (!currentLockHeldRef.current) return;
        const interval = window.setInterval(() => {
            const lockedAuditId = currentLockHeldRef.current;
            if (!lockedAuditId) return;
            apiService.lockAudit(lockedAuditId).catch(error => {
                console.error('Error refreshing audit lock:', error);
            });
        }, 60000);
        return () => window.clearInterval(interval);
    }, [currentChecksheetId]);

    useEffect(() => {
        const releaseOnUnload = () => {
            const lockedAuditId = currentLockHeldRef.current;
            if (!lockedAuditId) return;
            fetch(`${IPQC_API_BASE_URL}/${lockedAuditId}/unlock`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ lockSessionId: lockSessionIdRef.current }),
                keepalive: true,
            }).catch(() => undefined);
        };

        window.addEventListener('beforeunload', releaseOnUnload);
        return () => {
            releaseOnUnload();
            window.removeEventListener('beforeunload', releaseOnUnload);
        };
    }, [IPQC_API_BASE_URL]);

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
                filters: savedChecksheetsFilters,
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
    }, [mapAuditToChecksheet, savedChecksheetsPage, savedChecksheetsPageSize, savedChecksheetsSearch, savedChecksheetsSort, savedChecksheetsFilters]);

    const loadReturnedChecksheets = useCallback(async () => {
        if (!isOperatorRole) return;
        setIsReturnedChecksheetsLoading(true);
        try {
            const response = await apiService.getAuditSummaries({
                page: returnedChecksheetsPage,
                pageSize: returnedChecksheetsPageSize,
                search: returnedChecksheetsSearch,
                sort: returnedChecksheetsSort,
                workflowState: 'returned',
                filters: { ...returnedChecksheetsFilters, status: 'returned' },
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
    }, [mapAuditToChecksheet, returnedChecksheetsPage, returnedChecksheetsPageSize, returnedChecksheetsSearch, returnedChecksheetsSort, returnedChecksheetsFilters, isOperatorRole]);

    const loadDashboard = useCallback(async () => {
        setIsDashboardLoading(true);
        try {
            const response = await apiService.getDashboard(dashboardView);
            setDashboardData({
                ...response,
                items: Array.isArray(response.items)
                    ? response.items.map((audit: any) => mapAuditToChecksheet(audit)).filter(Boolean) as SavedChecksheet[]
                    : [],
            });
        } catch (error) {
            console.error('Error loading audit dashboard:', error);
        } finally {
            setIsDashboardLoading(false);
        }
    }, [dashboardView, mapAuditToChecksheet]);

    useEffect(() => {
        if (activeTab !== 'saved-reports') return;
        loadSavedChecksheets();
    }, [activeTab, loadSavedChecksheets]);

    useEffect(() => {
        if (activeTab !== 'dashboard') return;
        loadDashboard();
    }, [activeTab, loadDashboard]);

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

    const buildChecksheetPayloadForData = useCallback((
        dataToSave: AuditData,
        workflowState: AuditWorkflowState,
        existingSummary?: SavedChecksheet,
        signatures?: {
            auditBy?: string;
            reviewedBy?: string;
            auditByImage?: string;
            reviewedByImage?: string;
        }
    ) => {
        const completion = getAuditCompletionMetrics(dataToSave);
        const checksheetName = generateChecksheetName(dataToSave.lineNumber, dataToSave.date, dataToSave.shift);

        return {
            name: checksheetName,
            timestamp: existingSummary
                ? new Date(existingSummary?.timestamp || Date.now()).toISOString()
                : new Date().toISOString(),
            updated_timestamp: new Date().toISOString(),
            ...completion,
            data: {
                ...dataToSave,
                signatures: {
                    auditBy: signatures?.auditBy ?? dataToSave.signatures?.auditBy ?? '',
                    reviewedBy: signatures?.reviewedBy ?? dataToSave.signatures?.reviewedBy ?? '',
                    auditByImage: signatures?.auditByImage ?? dataToSave.signatures?.auditByImage ?? '',
                    reviewedByImage: signatures?.reviewedByImage ?? dataToSave.signatures?.reviewedByImage ?? '',
                },
                workflowState,
                status: workflowState,
            }
        };
    }, [generateChecksheetName]);

    const buildChecksheetPayload = useCallback((signatureOverrides?: {
        auditBy?: string;
        reviewedBy?: string;
        auditByImage?: string;
        reviewedByImage?: string;
    }) => {
        const dataToSave = latestAuditDataRef.current;
        const existingSummary = currentChecksheetIdRef.current
            ? savedChecksheetsRef.current.find(sheet => sheet.id === currentChecksheetIdRef.current)
            : undefined;

        return buildChecksheetPayloadForData(
            dataToSave,
            currentWorkflowState,
            existingSummary,
            {
                auditBy: signatureOverrides?.auditBy ?? latestAuditBySignatureRef.current,
                reviewedBy: signatureOverrides?.reviewedBy ?? latestReviewedBySignatureRef.current,
                auditByImage: signatureOverrides?.auditByImage ?? latestAuditBySignatureImageRef.current,
                reviewedByImage: signatureOverrides?.reviewedByImage ?? latestReviewedBySignatureImageRef.current,
            }
        );
    }, [buildChecksheetPayloadForData, currentWorkflowState]);

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
            const mappedDraft = mapAuditToChecksheet(matchingDraft);
            if (mappedDraft) {
                await acquireAuditLock(mappedDraft);
            }
            await loadChecksheetById(matchingDraft._id, { showLoading: false, showOpenedAlert: false });
            showAlert('info', 'Existing draft loaded for the selected line, date, and shift');
            return matchingDraft;
        }

        const payload = buildChecksheetPayload();
        const created = await apiService.createAudit(payload);
        markChecksheetSaved(created, payload.data as AuditData, getLatestSnapshot());
        const createdId = created._id || created.id;
        if (createdId) {
            const mappedCreated = mapAuditToChecksheet(created, payload.data as AuditData);
            if (mappedCreated) {
                await acquireAuditLock(mappedCreated);
            }
            await loadChecksheetById(createdId, { showLoading: false, showOpenedAlert: false });
        }
        await loadSavedChecksheets();
        return created;
    };

    const submitChecksheet = async () => {
        const effectiveAuditBySignature = auditBySignature.trim();
        const effectiveAuditBySignatureImage = auditBySignatureImage || '';
        if (!effectiveAuditBySignature.trim()) {
            showAlert('error', OPERATOR_SIGNATURE_REQUIRED_MESSAGE);
            return;
        }
        if (!isBasicInfoComplete()) {
            showAlert('error', 'Please complete line, date, shift, production order number, and module type before submitting');
            return;
        }

        try {
            setIsLoading(true);
            const payload = buildChecksheetPayload({
                auditBy: effectiveAuditBySignature,
                auditByImage: effectiveAuditBySignatureImage,
            });
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
            await loadDashboard();
            if (isOperatorRole) await loadReturnedChecksheets();
            clearCurrentChecksheet();
            setActiveTab('saved-reports');
            showAlert('success', currentWorkflowState === 'returned' ? 'Checksheet resubmitted successfully' : 'Checksheet submitted successfully');
        } catch (error) {
            console.error('Error submitting checksheet:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to submit checksheet');
        } finally {
            setIsLoading(false);
        }
    };

    const saveSubmittedChanges = async () => {
        if (!currentChecksheetId || !canEditCurrentChecksheet) {
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
        if (!isOperatorRole || !EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState)) {
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
            || isAutosaving
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
        isAutosaving,
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
        releaseAuditLock(currentChecksheetIdRef.current);
        setCurrentChecksheetId(null);
        currentChecksheetIdRef.current = null;
        setCurrentWorkflowState('draft');
        setCurrentChecksheetMeta(null);
        setCurrentAccessMode('edit');
        setReadOnlyReason('');
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
            if (!currentChecksheetId || !canExportCurrentChecksheet) {
                showAlert('error', 'You are not authorized to export this checksheet');
                return;
            }
            showAlert('info', 'Please wait! Exporting report will take some time...');
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

    const downloadChecksheetExcel = async (checksheet: SavedChecksheet) => {
        const auditId = checksheet._id || checksheet.id;
        if (!auditId) {
            throw new Error('Checksheet not found');
        }

        const response = await fetch(`${IPQC_API_BASE_URL}/generate-audit-report`, {
            method: 'POST',
            headers: authHeaders(true),
            body: JSON.stringify({ audit_id: auditId })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to generate report');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        const filenameLine = checksheet.data?.lineNumber || checksheet.lineNumber || '';
        const filenameDate = checksheet.data?.date || checksheet.date || '';
        const filenameShift = checksheet.data?.shift || checksheet.shift || '';
        const filename = `Quality_Audit_Line${filenameLine}_${String(filenameDate).replace(/-/g, '')}_Shift${filenameShift}.xlsx`;
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const exportChecksheetToExcel = async (checksheet: SavedChecksheet | undefined) => {
        try {
            if (!checksheet) {
                showAlert('error', 'Checksheet not found');
                return;
            }
            if (!canExportListedChecksheet(checksheet)) {
                showAlert('error', 'You are not authorized to export this checksheet');
                return;
            }

            showAlert('info', 'Please wait! Exporting report will take some time...');
            await downloadChecksheetExcel(checksheet);
            showAlert('success', 'Report generated successfully!');

        } catch (error) {
            console.error('Error generating report:', error);
            showAlert('error', 'Failed to generate report. Please try again.');
        }
    };

    const confirmGenerateExcelReport = () => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            noun: 'report',
            onConfirm: generateExcelReport,
        }));
    };

    const confirmExportChecksheetToExcel = (checksheet: SavedChecksheet) => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            noun: 'report',
            onConfirm: () => exportChecksheetToExcel(checksheet),
        }));
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
        options: {
            showLoading?: boolean;
            showOpenedAlert?: boolean;
            nextView?: 'basicInfo' | 'stageSelection' | 'stageDetail';
            accessMode?: AuditAccessMode;
            readOnlyReason?: string;
        } = {}
    ) => {
        const { showLoading = true, showOpenedAlert = true, nextView = 'basicInfo', accessMode = 'edit', readOnlyReason = '' } = options;
        try {
            if (showLoading) setIsLoading(true);
            if (currentLockHeldRef.current && currentLockHeldRef.current !== checksheetId) {
                await releaseAuditLock(currentLockHeldRef.current);
            }
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
            setCurrentAccessMode(accessMode);
            setReadOnlyReason(readOnlyReason);
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
                || (isOperatorRole && EDITABLE_OPERATOR_WORKFLOW_STATES.has(loadedState))
                || isReviewerRole;
            if (showOpenedAlert) {
                showAlert('info', `${accessMode === 'edit' && willBeEditable ? 'Opened' : 'Viewing'} ${fullAudit.name}`);
            }
            return fullAudit;
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    const isChecksheetOwner = (checksheet?: SavedChecksheet | null) =>
        isResolvedCreator(checksheet, { employeeId, username });

    const openChecksheetFromList = async (checksheet: SavedChecksheet | undefined, requestedMode: AuditAccessMode = 'edit') => {
        try {
            if (!checksheet || !checksheet._id) {
                showAlert('error', 'Checksheet not found');
                return;
            }
            const state = getWorkflowState(checksheet);
            let accessMode = requestedMode;
            let reason = '';
            const ownerName = resolveCreatorName(checksheet) || checksheet.lockedBy || 'the creating operator';
            const draftLockMessage = `This audit is currently being completed by ${ownerName}. Editing is locked until submission.`;
            const returnedLockMessage = `This audit has been returned to ${ownerName} for correction. Editing is locked until resubmission.`;
            const workflowLockMessage = state === 'returned' ? returnedLockMessage : draftLockMessage;

            if (requestedMode === 'view' && EDITABLE_OPERATOR_WORKFLOW_STATES.has(state) && !isChecksheetOwner(checksheet)) {
                reason = workflowLockMessage;
            }

            if (requestedMode === 'edit') {
                if (isOperatorRole) {
                    if (!isChecksheetOwner(checksheet) || !EDITABLE_OPERATOR_WORKFLOW_STATES.has(state)) {
                        accessMode = 'view';
                        reason = state === 'submitted' || state === 'approved'
                            ? 'Submitted and approved audits are read-only for operators.'
                            : workflowLockMessage;
                    } else {
                        const lockAcquired = await acquireAuditLock(checksheet);
                        if (!lockAcquired) {
                            accessMode = 'view';
                            reason = workflowLockMessage;
                        }
                    }
                } else if ((isReviewerRole || isSystemAdminRole) && state !== 'submitted') {
                    accessMode = 'view';
                    reason = state === 'approved' ? 'Approved audits are read-only.' : workflowLockMessage;
                }
            }

            await loadChecksheetById(checksheet.id, { accessMode, readOnlyReason: reason });
        } catch (error) {
            console.error('Error loading checksheet:', error);
            showAlert('error', 'Failed to load checksheet');
        }
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
                const mappedDraft = mapAuditToChecksheet(matchingDraft);
                if (mappedDraft) {
                    await acquireAuditLock(mappedDraft);
                }
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
    }, [auditData.lineNumber, auditData.date, auditData.shift, activeTab, currentChecksheetId, currentWorkflowState, getDraftLookupKey, isOperatorRole, mapAuditToChecksheet, acquireAuditLock]);

    const deleteChecksheet = async (checksheet: SavedChecksheet | undefined) => {
        try {
            if (!checksheet?._id) {
                showAlert('error', 'Checksheet not found');
                return;
            }
            if (!canDeleteListedChecksheet(checksheet)) {
                showAlert('error', 'You are not authorized to delete this checksheet');
                return;
            }
            await apiService.deleteAudit(checksheet._id!);
            await loadSavedChecksheets();
            await loadDashboard();
            if (currentChecksheetId === checksheet._id) {
                clearCurrentChecksheet();
            }
            showAlert('success', 'Checksheet deleted successfully!');
        } catch (error) {
            console.error('Error deleting checksheet:', error);
            showAlert('error', 'Failed to delete checksheet');
        }
    };

    const approveChecksheet = async (checksheet: SavedChecksheet | undefined) => {
        if (!checksheet?._id) {
            showAlert('error', 'Checksheet not found');
            return;
        }
        if (!canApproveListedChecksheet(checksheet)) {
            showAlert('error', 'You are not authorized to approve this checksheet');
            return;
        }
        try {
            setIsLoading(true);
            const approved = await apiService.approveAudit(checksheet._id);
            upsertSavedChecksheetSummary(approved);
            if (currentChecksheetId === checksheet._id) {
                setCurrentWorkflowState('approved');
                setCurrentChecksheetMeta(prev => prev ? { ...prev, workflowState: 'approved', status: 'approved' } : prev);
            }
            await loadSavedChecksheets();
            await loadDashboard();
            showAlert('success', 'Checksheet approved');
        } catch (error) {
            console.error('Error approving checksheet:', error);
            showAlert('error', 'Failed to approve checksheet');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmApproveChecksheet = (checksheet: SavedChecksheet | undefined) => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'approve',
            noun: 'report',
            onConfirm: () => approveChecksheet(checksheet),
        }));
    };

    const confirmDeleteChecksheet = (checksheet: SavedChecksheet) => {
        showConfirm(buildWorkflowConfirmOptions({
            action: 'delete',
            noun: 'report',
            onConfirm: () => deleteChecksheet(checksheet),
        }));
    };

    const submitListedChecksheet = async (checksheet: SavedChecksheet | undefined) => {
        if (!checksheet?._id) {
            showAlert('error', 'Checksheet not found');
            return;
        }
        if (!canSubmitListedChecksheet(checksheet)) {
            showAlert('error', 'Only the creating operator can submit this checksheet');
            return;
        }
        const lockAcquired = await acquireAuditLock(checksheet);
        if (!lockAcquired) return;
        try {
            setIsLoading(true);
            const fullAudit = await apiService.getAuditById(checksheet._id);
            const fullAuditData = fullAudit.data as AuditData;
            const loadedSignatures = fullAuditData.signatures || {};
            const effectiveAuditBy = getLoadedSignatureText(loadedSignatures, 'auditBy');
            const effectiveAuditByImage = getLoadedSignatureImage(loadedSignatures, 'auditBy') || '';
            if (!effectiveAuditBy) {
                showAlert('error', OPERATOR_SIGNATURE_REQUIRED_MESSAGE);
                return;
            }
            const payload = buildChecksheetPayloadForData(
                fullAuditData,
                getWorkflowState(checksheet),
                checksheet,
                {
                    auditBy: effectiveAuditBy,
                    auditByImage: effectiveAuditByImage,
                    reviewedBy: getLoadedSignatureText(loadedSignatures, 'reviewedBy'),
                    reviewedByImage: getLoadedSignatureImage(loadedSignatures, 'reviewedBy'),
                }
            );
            await apiService.updateAudit(checksheet._id, payload);
            const submitted = await apiService.submitAudit(checksheet._id, payload);
            upsertSavedChecksheetSummary(submitted, payload.data as AuditData);
            await loadSavedChecksheets();
            await loadDashboard();
            if (isOperatorRole) await loadReturnedChecksheets();
            showAlert('success', 'Checksheet submitted successfully');
        } catch (error) {
            console.error('Error submitting checksheet:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to submit checksheet');
        } finally {
            await releaseAuditLock(checksheet._id);
            setIsLoading(false);
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
            await loadDashboard();
            if (isOperatorRole) await loadReturnedChecksheets();
            showAlert('success', 'Checksheet returned for correction');
        } catch (error) {
            console.error('Error returning checksheet:', error);
            showAlert('error', 'Failed to return checksheet');
        } finally {
            setIsLoading(false);
        }
    };

    const getListedAuditPermissions = (checksheet: SavedChecksheet) => {
        const state = getWorkflowState(checksheet);
        const isOwner = isChecksheetOwner(checksheet);
        const isReviewerLike = isReviewerRole || isSystemAdminRole;

        return {
            canView: isSystemAdminRole || isReviewerRole || isOperatorRole,
            canEdit: (isOperatorRole && isOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(state))
                || (isReviewerLike && state === 'submitted'),
            canSubmit: isOperatorRole && isOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(state),
            canExport: FINALIZED_WORKFLOW_STATES.has(state) && (isOperatorRole || isReviewerLike),
            canApprove: isReviewerLike && state === 'submitted',
            canReturn: isReviewerLike && state === 'submitted',
            canDelete: state !== 'approved' && (
                isSystemAdminRole
                || (isReviewerRole && state === 'submitted')
                || (isOperatorRole && isOwner && EDITABLE_OPERATOR_WORKFLOW_STATES.has(state))
            ),
        };
    };

    const canOpenListedChecksheet = (checksheet: SavedChecksheet) =>
        getListedAuditPermissions(checksheet).canView;

    const canEditListedChecksheet = (checksheet: SavedChecksheet) =>
        getListedAuditPermissions(checksheet).canEdit;

    const canSubmitListedChecksheet = (checksheet: SavedChecksheet) =>
        getListedAuditPermissions(checksheet).canSubmit;

    const canExportListedChecksheet = (checksheet: SavedChecksheet) =>
        getListedAuditPermissions(checksheet).canExport;

    const canDeleteListedChecksheet = (checksheet: SavedChecksheet) =>
        getListedAuditPermissions(checksheet).canDelete;

    const canReturnListedChecksheet = (checksheet: SavedChecksheet) =>
        getListedAuditPermissions(checksheet).canReturn;

    const canApproveListedChecksheet = (checksheet: SavedChecksheet) =>
        getListedAuditPermissions(checksheet).canApprove;

    const getAuditSelectionId = (checksheet?: SavedChecksheet | null) => checksheet?._id || checksheet?.id || '';

    const clearAuditSelection = useCallback(() => {
        setSelectedAuditIds(new Set());
        setSelectedAuditRecords({});
        lastSelectedAuditIdRef.current = null;
    }, []);

    const setAuditSelection = (checksheet: SavedChecksheet, selected: boolean) => {
        const auditId = getAuditSelectionId(checksheet);
        if (!auditId) return;

        setSelectedAuditIds(prev => {
            const next = new Set(prev);
            if (selected) {
                next.add(auditId);
            } else {
                next.delete(auditId);
            }
            return next;
        });

        setSelectedAuditRecords(prev => {
            const next = { ...prev };
            if (selected) {
                next[auditId] = checksheet;
            } else {
                delete next[auditId];
            }
            return next;
        });
    };

    const setVisibleAuditSelection = (visibleChecksheets: SavedChecksheet[], selected: boolean) => {
        setSelectedAuditIds(prev => {
            const next = new Set(prev);
            visibleChecksheets.forEach(checksheet => {
                const auditId = getAuditSelectionId(checksheet);
                if (!auditId) return;
                if (selected) {
                    next.add(auditId);
                } else {
                    next.delete(auditId);
                }
            });
            return next;
        });

        setSelectedAuditRecords(prev => {
            const next = { ...prev };
            visibleChecksheets.forEach(checksheet => {
                const auditId = getAuditSelectionId(checksheet);
                if (!auditId) return;
                if (selected) {
                    next[auditId] = checksheet;
                } else {
                    delete next[auditId];
                }
            });
            return next;
        });
    };

    const toggleAuditSelection = (
        checksheet: SavedChecksheet,
        visibleChecksheets: SavedChecksheet[],
        selected: boolean,
        shiftKey: boolean
    ) => {
        const auditId = getAuditSelectionId(checksheet);
        if (!auditId) return;

        if (shiftKey && lastSelectedAuditIdRef.current) {
            const visibleIds = visibleChecksheets.map(getAuditSelectionId);
            const lastIndex = visibleIds.indexOf(lastSelectedAuditIdRef.current);
            const currentIndex = visibleIds.indexOf(auditId);
            if (lastIndex >= 0 && currentIndex >= 0) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                setVisibleAuditSelection(visibleChecksheets.slice(start, end + 1), selected);
                lastSelectedAuditIdRef.current = auditId;
                return;
            }
        }

        setAuditSelection(checksheet, selected);
        lastSelectedAuditIdRef.current = auditId;
    };

    const getSelectedAudits = () =>
        Object.values(selectedAuditRecords).filter(checksheet => selectedAuditIds.has(getAuditSelectionId(checksheet)));

    const getBulkFailureCount = (result: BulkOperationResult) =>
        result.failedCount ?? result.failed?.length ?? 0;

    const getBulkStatusLabel = (checksheet: SavedChecksheet) =>
        formatWorkflowState(getWorkflowState(checksheet));

    const formatBulkOperationSummary = (
        title: string,
        successLabel: string,
        successCount: number,
        result: BulkOperationResult,
        eligibilityNote?: string
    ) => {
        const lines = [title, `${successCount} ${successLabel}`];
        const skippedCount = result.skippedCount ?? sumObjectValues(result.skipped || {});
        if (eligibilityNote && skippedCount > 0) {
            lines.push(`${eligibilityNote} ${skippedCount} selected ${skippedCount === 1 ? 'audit was' : 'audits were'} skipped.`);
        }
        Object.entries(result.skipped || {}).forEach(([reason, count]) => {
            lines.push(reason === 'Already Approved' ? `${count} ${reason}` : `${count} ${reason} Skipped`);
        });
        const failedCount = getBulkFailureCount(result);
        if (failedCount > 0) {
            lines.push(`${failedCount} Failed. See console for details.`);
        }
        return lines.join(' | ');
    };

    const refreshAuditsAfterBulkOperation = async () => {
        await loadSavedChecksheets();
        await loadDashboard();
        if (isOperatorRole) {
            await loadReturnedChecksheets();
        }
    };

    const runBulkApproveAudits = async () => {
        const selectedAudits = getSelectedAudits();
        const auditIds = selectedAudits.map(getAuditSelectionId).filter(Boolean);
        if (auditIds.length === 0) return;

        try {
            setBulkProgress({ action: 'Approving...', completed: 0, total: auditIds.length });
            const result = await apiService.bulkApproveAudits(auditIds);
            setBulkProgress({ action: 'Approving...', completed: auditIds.length, total: auditIds.length });
            if (getBulkFailureCount(result) > 0) {
                console.warn('Bulk approval failures', result.failed);
            }
            await refreshAuditsAfterBulkOperation();
            clearAuditSelection();
            const approved = result.approved ?? result.processed ?? 0;
            showAlert(
                getBulkFailureCount(result) > 0 ? 'warning' : 'success',
                formatBulkOperationSummary(
                    'Bulk Approval Completed',
                    'Approved',
                    approved,
                    result,
                    'Only Submitted audits can be approved.'
                )
            );
        } catch (error) {
            console.error('Error bulk approving checksheets:', error);
            showAlert('error', 'Bulk approval failed. Please try again.');
        } finally {
            setBulkProgress(null);
        }
    };

    const runBulkDeleteAudits = async () => {
        const selectedAudits = getSelectedAudits();
        const deletableAudits = selectedAudits.filter(canDeleteListedChecksheet);
        const auditIds = deletableAudits.map(getAuditSelectionId).filter(Boolean);
        if (auditIds.length === 0) return;

        try {
            setBulkProgress({ action: 'Deleting...', completed: 0, total: auditIds.length });
            const result = await apiService.bulkDeleteAudits(auditIds);
            setBulkProgress({ action: 'Deleting...', completed: auditIds.length, total: auditIds.length });
            if (getBulkFailureCount(result) > 0) {
                console.warn('Bulk delete failures', result.failed);
            }
            await refreshAuditsAfterBulkOperation();
            clearAuditSelection();
            const deleted = result.deleted ?? result.processed ?? 0;
            showAlert(
                getBulkFailureCount(result) > 0 ? 'warning' : 'success',
                formatBulkOperationSummary('Bulk Delete Completed', 'Deleted', deleted, result)
            );
        } catch (error) {
            console.error('Error bulk deleting checksheets:', error);
            showAlert('error', 'Bulk delete failed. Please try again.');
        } finally {
            setBulkProgress(null);
        }
    };

    const runBulkDownloadAudits = async () => {
        const selectedAudits = getSelectedAudits();
        if (selectedAudits.length === 0) return;

        const result: BulkOperationResult = { requested: selectedAudits.length, downloaded: 0, skipped: {}, failed: [] };
        try {
            setBulkProgress({ action: 'Generating report...', completed: 0, total: selectedAudits.length });
            for (let index = 0; index < selectedAudits.length; index += 1) {
                const checksheet = selectedAudits[index];
                const auditId = getAuditSelectionId(checksheet);
                if (!canExportListedChecksheet(checksheet)) {
                    const reason = getBulkStatusLabel(checksheet);
                    result.skipped![reason] = (result.skipped![reason] || 0) + 1;
                } else {
                    try {
                        await downloadChecksheetExcel(checksheet);
                        result.downloaded = (result.downloaded || 0) + 1;
                    } catch (error) {
                        result.failed!.push({
                            auditId,
                            reason: error instanceof Error ? error.message : 'Download failed',
                        });
                    }
                }
                setBulkProgress({ action: 'Generating report...', completed: index + 1, total: selectedAudits.length });
                await new Promise(resolve => window.setTimeout(resolve, 0));
            }
            result.skippedCount = sumObjectValues(result.skipped || {});
            result.failedCount = getBulkFailureCount(result);
            if (getBulkFailureCount(result) > 0) {
                console.warn('Bulk download failures', result.failed);
            }
            clearAuditSelection();
            showAlert(
                getBulkFailureCount(result) > 0 ? 'warning' : 'success',
                formatBulkOperationSummary('Bulk Download Completed', 'Downloaded', result.downloaded || 0, result)
            );
        } catch (error) {
            console.error('Error bulk downloading checksheets:', error);
            showAlert('error', 'Bulk download failed. Please try again.');
        } finally {
            setBulkProgress(null);
        }
    };

    const confirmBulkApproveAudits = () => {
        const selectedCount = selectedAuditIds.size;
        showConfirm(buildWorkflowConfirmOptions({
            action: 'approve',
            count: selectedCount,
            noun: 'report',
            onConfirm: runBulkApproveAudits,
        }));
    };

    const confirmBulkDeleteAudits = () => {
        const selectedCount = getSelectedAudits().filter(canDeleteListedChecksheet).length;
        if (selectedCount === 0) return;
        showConfirm(buildWorkflowConfirmOptions({
            action: 'delete',
            count: selectedCount,
            noun: 'report',
            onConfirm: runBulkDeleteAudits,
        }));
    };

    const confirmBulkDownloadAudits = () => {
        const selectedCount = selectedAuditIds.size;
        showConfirm(buildWorkflowConfirmOptions({
            action: 'download',
            count: selectedCount,
            noun: 'report',
            onConfirm: runBulkDownloadAudits,
        }));
    };

    useEffect(() => {
        clearAuditSelection();
    }, [activeTab, savedChecksheetsFilters, savedChecksheetsSearchInput, clearAuditSelection]);

    useEffect(() => {
        if (selectedAuditIds.size === 0) return;
        setSelectedAuditRecords(prev => {
            let hasChanges = false;
            const next = { ...prev };
            savedChecksheets.forEach(checksheet => {
                const auditId = getAuditSelectionId(checksheet);
                if (auditId && selectedAuditIds.has(auditId)) {
                    next[auditId] = checksheet;
                    hasChanges = true;
                }
            });
            return hasChanges ? next : prev;
        });
    }, [savedChecksheets, selectedAuditIds]);

    const getOpenActionLabel = (checksheet: SavedChecksheet) => {
        const state = getWorkflowState(checksheet);
        if (isOperatorRole && (!isChecksheetOwner(checksheet) || FINALIZED_WORKFLOW_STATES.has(state))) return 'View';
        return canEditListedChecksheet(checksheet) ? (isOperatorRole ? 'Continue' : 'Edit') : 'View';
    };

    const canProceedFromBasicInfo = isBasicInfoComplete() && (currentChecksheetId !== null || canCreateChecksheet) && !isLoading;

    const baselineStagesById = useMemo(
        () => new Map(lineDependentStages.map(stage => [stage.id, stage])),
        [lineDependentStages]
    );

    const stageButtons = useMemo(() => auditData.stages.map(stage => ({
        id: stage.id,
        label: stage.name || `Stage ${stage.id}`,
        enabled: true,
        hasUnsavedChanges: stageChanges.has(stage.id),
        completionStatus: getStageCompletionStatus(stage, baselineStagesById.get(stage.id)),
    })), [auditData.stages, baselineStagesById, stageChanges]);

    const getDisplayStatus = (checksheet: SavedChecksheet): AuditDisplayStatus => {
        return checksheet.displayStatus || getWorkflowState(checksheet);
    };

    const formatDisplayStatus = (state: AuditDisplayStatus) => {
        return formatWorkflowState(state);
    };

    const getStateBadgeClass = (state: AuditDisplayStatus) => {
        if (state === 'approved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
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
        const filters = isReturnedList ? returnedChecksheetsFilters : savedChecksheetsFilters;
        const isListLoading = isReturnedList ? isReturnedChecksheetsLoading : isSavedChecksheetsLoading;
        const setPage = isReturnedList ? setReturnedChecksheetsPage : setSavedChecksheetsPage;
        const setPageSize = isReturnedList ? setReturnedChecksheetsPageSize : setSavedChecksheetsPageSize;
        const setSearchTerm = isReturnedList ? setReturnedChecksheetsSearchInput : setSavedChecksheetsSearchInput;
        const setSortOption = isReturnedList ? setReturnedChecksheetsSort : setSavedChecksheetsSort;
        const setFilters = isReturnedList ? setReturnedChecksheetsFilters : setSavedChecksheetsFilters;

        const updateFilters = (patch: Partial<AuditListFilters>) => {
            setFilters(prev => ({ ...prev, ...patch }));
            setPage(1);
            if (!isReturnedList) clearAuditSelection();
        };

        const resetFilters = () => {
            setFilters({
                dateFrom: '',
                dateTo: '',
                shift: '',
                lineNumber: '',
                status: isReturnedList ? 'returned' : '',
                completionRange: '',
            });
            setSearchTerm('');
            setPage(1);
            if (!isReturnedList) clearAuditSelection();
        };

        const enableBulkSelection = !isReturnedList;
        const visibleSelectableChecksheets = enableBulkSelection
            ? checksheets.filter(checksheet => Boolean(getAuditSelectionId(checksheet)))
            : [];
        const visibleSelectedCount = visibleSelectableChecksheets.filter(checksheet =>
            selectedAuditIds.has(getAuditSelectionId(checksheet))
        ).length;
        const allVisibleSelected = visibleSelectableChecksheets.length > 0
            && visibleSelectedCount === visibleSelectableChecksheets.length;
        const someVisibleSelected = visibleSelectedCount > 0 && visibleSelectedCount < visibleSelectableChecksheets.length;
        const selectedAuditsForBulk = getSelectedAudits();
        const selectedCount = selectedAuditIds.size;
        const selectedCountLabel = `${selectedCount} ${selectedCount === 1 ? 'audit' : 'audits'} selected`;
        const canBulkApprove = selectedAuditsForBulk.some(canApproveListedChecksheet);
        const canBulkDelete = selectedAuditsForBulk.some(canDeleteListedChecksheet);
        const canBulkDownload = selectedAuditsForBulk.some(canExportListedChecksheet);

        return (
            <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:p-4">
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{totalItems} checksheets</span>
                </div>

                <div className="mb-2 grid gap-2 md:grid-cols-5 xl:grid-cols-9">
                    <label className="relative">
                        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            value={searchTerm}
                            onChange={(event) => {
                                setSearchTerm(event.target.value);
                                setPage(1);
                                if (!isReturnedList) clearAuditSelection();
                            }}
                            placeholder="Search production order, creator, shift, date, line, status"
                            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                    </label>
                    <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(event) => updateFilters({ dateFrom: event.target.value, dateTo: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        title="Date from"
                    />
                    <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(event) => updateFilters({ dateTo: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        title="Date to"
                    />
                    <select
                        value={filters.shift}
                        onChange={(event) => updateFilters({ shift: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Shift filter"
                    >
                        <option value="">Shift</option>
                        <option value="A">Shift A</option>
                        <option value="B">Shift B</option>
                        <option value="C">Shift C</option>
                        <option value="G">Shift G</option>
                    </select>
                    <select
                        value={filters.lineNumber}
                        onChange={(event) => updateFilters({ lineNumber: event.target.value })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Line filter"
                    >
                        <option value="">Line</option>
                        <option value="I">Line I</option>
                        <option value="II">Line II</option>
                    </select>
                    <select
                        value={filters.status}
                        onChange={(event) => updateFilters({ status: event.target.value as AuditListFilters['status'] })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Status filter"
                        disabled={isReturnedList}
                    >
                        <option value="">Status</option>
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="approved">Approved</option>
                        <option value="returned">Returned</option>
                    </select>
                    <select
                        value={filters.completionRange}
                        onChange={(event) => updateFilters({ completionRange: event.target.value as CompletionRangeFilter })}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Completion filter"
                    >
                        <option value="">Completion %</option>
                        <option value="0-25">0-25</option>
                        <option value="26-50">26-50</option>
                        <option value="51-75">51-75</option>
                        <option value="76-99">76-99</option>
                        <option value="100">100</option>
                    </select>
                    <select
                        value={sortOption}
                        onChange={(event) => {
                            setSortOption(event.target.value as AuditSortOption);
                            setPage(1);
                        }}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        aria-label="Sort audits"
                    >
                        <option value="newest-created">Newest</option>
                        <option value="oldest-created">Oldest</option>
                        <option value="completion-desc">Completion %</option>
                        <option value="status">Status</option>
                        <option value="created-by">Created By</option>
                        <option value="shift">Shift</option>
                        <option value="date-newest">Date</option>
                    </select>
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="h-9 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        Clear Filters
                    </button>
                </div>

                {enableBulkSelection && selectedCount > 0 && (
                    <div className="mb-3 rounded-md border border-brand-primary/30 bg-brand-primary/5 p-3 dark:border-brand-primary/40 dark:bg-brand-primary/10">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedCountLabel}</div>
                            <div className="flex flex-wrap items-center gap-2">
                                {canBulkApprove && (
                                    <button
                                        type="button"
                                        onClick={confirmBulkApproveAudits}
                                        disabled={Boolean(bulkProgress)}
                                        className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-600 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        Approve
                                    </button>
                                )}
                                {canBulkDownload && (
                                    <button
                                        type="button"
                                        onClick={confirmBulkDownloadAudits}
                                        disabled={Boolean(bulkProgress)}
                                        className="inline-flex h-8 items-center gap-1 rounded-md border border-green-600 px-3 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-300 dark:hover:bg-green-900/20"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                    </button>
                                )}
                                {canBulkDelete && (
                                    <button
                                        type="button"
                                        onClick={confirmBulkDeleteAudits}
                                        disabled={Boolean(bulkProgress)}
                                        className="inline-flex h-8 items-center gap-1 rounded-md border border-red-600 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-900/20"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={clearAuditSelection}
                                    disabled={Boolean(bulkProgress)}
                                    className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Clear Selection
                                </button>
                            </div>
                        </div>
                        {bulkProgress && (
                            <div className="mt-3">
                                <div className="mb-1 flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-200">
                                    <span>{bulkProgress.action}</span>
                                    <span>{bulkProgress.completed} / {bulkProgress.total} completed</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                    <div
                                        className="h-full rounded-full bg-brand-primary transition-all"
                                        style={{
                                            width: `${bulkProgress.total ? Math.round((bulkProgress.completed / bulkProgress.total) * 100) : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {isListLoading ? (
                    <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading checksheets...</div>
                ) : checksheets.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        {totalItems === 0 ? 'No checksheets found.' : 'No matching checksheets found.'}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-0 text-center text-xs">
                                <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                    <tr>
                                        {enableBulkSelection && (
                                            <th className="w-10 border-b border-gray-200 px-3 py-2 text-center font-semibold dark:border-gray-700">
                                                <input
                                                    type="checkbox"
                                                    aria-label="Select all visible audits"
                                                    checked={allVisibleSelected}
                                                    disabled={visibleSelectableChecksheets.length === 0}
                                                    ref={(element) => {
                                                        if (element) element.indeterminate = someVisibleSelected;
                                                    }}
                                                    onChange={(event) => setVisibleAuditSelection(visibleSelectableChecksheets, event.currentTarget.checked)}
                                                    className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                />
                                            </th>
                                        )}
                                        {['Shift', 'Line', 'Production Order', 'Date', 'Created By', 'Completion %', 'Status', 'Actions'].map(column => (
                                            <th key={column} className="border-b border-gray-200 px-3 py-2 text-center font-semibold dark:border-gray-700">
                                                {column}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {checksheets.map((checksheet, index) => {
                                        const displayStatus = getDisplayStatus(checksheet);
                                        const completion = checksheet.completionPercentage ?? 0;
                                        const createdBy = resolveCreatorName(checksheet);
                                        const rowKey = checksheet._id || `${checksheet.name}-${index}`;
                                        const canOpen = canOpenListedChecksheet(checksheet);
                                        const canEdit = canEditListedChecksheet(checksheet);
                                        const canSubmit = canSubmitListedChecksheet(checksheet);
                                        const canExport = canExportListedChecksheet(checksheet);
                                        const canApprove = canApproveListedChecksheet(checksheet);
                                        const canReturn = !isReturnedList && canReturnListedChecksheet(checksheet);
                                        const canDelete = canDeleteListedChecksheet(checksheet);
                                        const isApproved = getWorkflowState(checksheet) === 'approved';
                                        const selectionId = getAuditSelectionId(checksheet);
                                        const isSelected = selectionId ? selectedAuditIds.has(selectionId) : false;

                                        return (
                                            <tr
                                                key={rowKey}
                                                className={`${isSelected ? 'bg-brand-primary/5 dark:bg-brand-primary/10' : 'bg-white dark:bg-gray-900'} text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800/70`}
                                            >
                                                {enableBulkSelection && (
                                                    <td className="whitespace-nowrap px-3 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`Select audit ${checksheet.productionOrderNo || checksheet.name || rowKey}`}
                                                            checked={isSelected}
                                                            disabled={!selectionId}
                                                            onChange={(event) => {
                                                                const nativeEvent = event.nativeEvent as MouseEvent;
                                                                toggleAuditSelection(
                                                                    checksheet,
                                                                    visibleSelectableChecksheets,
                                                                    event.currentTarget.checked,
                                                                    Boolean(nativeEvent.shiftKey)
                                                                );
                                                            }}
                                                            className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                        />
                                                    </td>
                                                )}
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{checksheet.shift || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{checksheet.lineNumber || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left font-medium">{checksheet.productionOrderNo || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{checksheet.date || '-'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">{createdBy}</td>
                                                <td className="min-w-40 px-3 py-2 text-left">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                                            <div
                                                                className="h-full rounded-full bg-brand-primary"
                                                                style={{ width: `${Math.min(100, Math.max(0, completion))}%` }}
                                                            />
                                                        </div>
                                                        <span className="whitespace-nowrap font-semibold">{completion}%</span>
                                                        <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">
                                                            {checksheet.completedStages ?? 0}/{checksheet.totalStages ?? TOTAL_AUDIT_STAGES}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-left">
                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStateBadgeClass(displayStatus)}`}
                                                    >
                                                        {formatDisplayStatus(displayStatus)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => canOpen && openChecksheetFromList(checksheet, 'view')}
                                                            disabled={!canOpen}
                                                            className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                            title="View"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        {canEdit && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openChecksheetFromList(checksheet, 'edit')}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-primary px-2 text-xs font-medium text-white hover:bg-brand-primary-hover"
                                                                title={getOpenActionLabel(checksheet)}
                                                            >
                                                                <Edit3 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {canSubmit && (
                                                            <button
                                                                type="button"
                                                                onClick={() => submitListedChecksheet(checksheet)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md bg-green-600 px-2 text-xs font-medium text-white hover:bg-green-700"
                                                                title="Submit"
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {canExport && (
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmExportChecksheetToExcel(checksheet)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-green-600 px-2 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20"
                                                                title="Download"
                                                            >
                                                                <Download className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {canApprove && (
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmApproveChecksheet(checksheet)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-600 px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                                                                title="Approve"
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {canReturn && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openReturnModal(index)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-600 px-2 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20"
                                                                title="Return"
                                                            >
                                                                <RotateCcw className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmDeleteChecksheet(checksheet)}
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-red-600 px-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {!canDelete && isApproved && (
                                                            <button
                                                                type="button"
                                                                disabled
                                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2 text-xs font-medium text-gray-400 opacity-60 dark:border-gray-700 dark:text-gray-500"
                                                                title={APPROVED_DELETE_TOOLTIP}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
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

    const renderAuditProgressCard = (checksheet: SavedChecksheet) => {
        const completion = checksheet.completionPercentage ?? 0;
        const status = getDisplayStatus(checksheet);
        const createdBy = resolveCreatorName(checksheet);

        return (
            <div key={checksheet._id || checksheet.id} className="rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Shift {checksheet.shift || '-'}</div>
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {checksheet.date || '-'} | Line {checksheet.lineNumber || '-'}
                        </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStateBadgeClass(status)}`}>
                        {formatDisplayStatus(status)}
                    </span>
                </div>
                <div className="mb-2 text-xs text-gray-600 dark:text-gray-300">
                    <div className="truncate">PO: {checksheet.productionOrderNo || '-'}</div>
                    <div className="truncate">Created by: {createdBy}</div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                        className="h-full rounded-full bg-brand-primary"
                        style={{ width: `${Math.min(100, Math.max(0, completion))}%` }}
                    />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">
                        {checksheet.completedStages ?? 0} / {checksheet.totalStages ?? TOTAL_AUDIT_STAGES} Stages
                    </span>
                    <span className="font-bold text-brand-primary dark:text-brand-primary-light">{completion}%</span>
                </div>
            </div>
        );
    };

    const renderDashboard = () => {
        const summary = dashboardData?.summary || {
            totalAudits: 0,
            completed: 0,
            draft: 0,
            submitted: 0,
            returned: 0,
            approved: 0,
            averageCompletion: 0,
        };
        const dailyGroups = (dashboardData?.items || []).reduce<Record<string, SavedChecksheet[]>>((groups, checksheet) => {
            const key = checksheet.shift || 'Unassigned';
            groups[key] = groups[key] || [];
            groups[key].push(checksheet);
            return groups;
        }, {});

        return (
            <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="inline-flex rounded-md border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
                        {(['daily', 'weekly', 'monthly'] as DashboardPeriod[]).map(period => (
                            <button
                                key={period}
                                type="button"
                                onClick={() => setDashboardView(period)}
                                className={`h-9 rounded px-4 text-sm font-semibold capitalize transition-colors ${
                                    dashboardView === period
                                        ? 'bg-brand-primary text-white'
                                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                                }`}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={loadDashboard}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Refresh
                    </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                    {[
                        [dashboardView === 'daily' ? 'Today\'s Audits' : dashboardView === 'weekly' ? 'Last 7 Days Audits' : 'Monthly Audits', summary.totalAudits],
                        ['Completed', summary.completed],
                        ['Draft', summary.draft],
                        ['Returned', summary.returned],
                        ['Approved', summary.approved],
                        ['Average Completion %', `${summary.averageCompletion}%`],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
                            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
                        </div>
                    ))}
                </div>

                {isDashboardLoading ? (
                    <div className="rounded-md border border-gray-200 bg-white py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                        Loading dashboard...
                    </div>
                ) : dashboardView === 'daily' ? (
                    <div className="space-y-3">
                        {['A', 'B', 'C', 'G', ...Object.keys(dailyGroups).filter(shift => !['A', 'B', 'C', 'G'].includes(shift))].map(shift => {
                            const items = dailyGroups[shift] || [];
                            return (
                                <section key={shift} className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                                    <div className="mb-2 flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Shift {shift}</h3>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{items.length} audits</span>
                                    </div>
                                    {items.length === 0 ? (
                                        <div className="py-4 text-sm text-gray-500 dark:text-gray-400">No audits for this shift.</div>
                                    ) : (
                                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                            {items.map(renderAuditProgressCard)}
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                        <table className="min-w-full text-left text-xs">
                            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold">Day</th>
                                    <th className="px-3 py-2 text-left font-semibold">Total Audits</th>
                                    <th className="px-3 py-2 text-left font-semibold">Draft</th>
                                    <th className="px-3 py-2 text-left font-semibold">Submitted</th>
                                    <th className="px-3 py-2 text-left font-semibold">Approved</th>
                                    <th className="px-3 py-2 text-left font-semibold">Returned</th>
                                    <th className="px-3 py-2 text-left font-semibold">Average Completion %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {(dashboardData?.groups || []).map(group => (
                                    <tr key={group.key} className="text-gray-800 dark:text-gray-100">
                                        <td className="px-3 py-2 text-left font-medium">
                                            {group.dayName ? (
                                                <div>
                                                    <div>{group.dayName}</div>
                                                    <div className="text-[11px] font-normal text-gray-500 dark:text-gray-400">{group.displayDate || group.date}</div>
                                                </div>
                                            ) : group.key}
                                        </td>
                                        <td className="px-3 py-2 text-left">{group.totalAudits}</td>
                                        <td className="px-3 py-2 text-left">{group.draft}</td>
                                        <td className="px-3 py-2 text-left">{group.submitted}</td>
                                        <td className="px-3 py-2 text-left">{group.approved}</td>
                                        <td className="px-3 py-2 text-left">{group.returned}</td>
                                        <td className="px-3 py-2 text-left">{group.averageCompletion}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary dark:border-brand-primary-light mx-auto"></div>
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
                                className="mt-3 w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
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
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">IPQC Audits</h1>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (activeTab === 'create-edit') clearCurrentChecksheet();
                                setActiveTab('dashboard');
                            }}
                            className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                                activeTab === 'dashboard'
                                    ? 'bg-brand-primary text-white'
                                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                            }`}
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Dashboard
                        </button>
                        {canCreateChecksheet && (
                            <button
                                type="button"
                                onClick={() => {
                                    clearCurrentChecksheet();
                                    setActiveTab('create-edit');
                                }}
                                className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                                    activeTab === 'create-edit'
                                        ? 'bg-brand-primary text-white'
                                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                                }`}
                            >
                                <Plus className="h-4 w-4" />
                                Create
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                if (activeTab === 'create-edit') clearCurrentChecksheet();
                                setActiveTab('saved-reports');
                            }}
                            className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                                activeTab === 'saved-reports'
                                    ? 'bg-brand-primary text-white'
                                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                            }`}
                        >
                            <Search className="h-4 w-4" />
                            Audit List
                        </button>
                        {isOperatorRole && returnedChecksheetsTotal > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeTab === 'create-edit') clearCurrentChecksheet();
                                    setActiveTab('returned-reports');
                                }}
                                className={`relative inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                                    activeTab === 'returned-reports'
                                        ? 'bg-brand-primary text-white'
                                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                                }`}
                            >
                                <RotateCcw className="h-4 w-4" />
                                Returned
                                <span className="rounded-full bg-red-600 px-1.5 py-0.4 text-[10px] text-white">
                                    {returnedChecksheetsTotal}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
                {activeTab === 'dashboard' && (
                    <div className="tab-content active">
                        {renderDashboard()}
                    </div>
                )}
                {activeTab === 'create-edit' && (
                    <div>
                        {currentAccessMode === 'view' && currentChecksheetId && (
                            <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/25 dark:text-blue-100">
                                <strong>Read-only view.</strong> {readOnlyReason || 'All fields are disabled.'}
                            </div>
                        )}
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
                                        <span className="ml-2 text-xs text-brand-primary dark:text-brand-primary-light">
                                            Auto-saving...
                                        </span>
                                    )}
                                </div>
                            )}
                            {canEditCurrentChecksheet && (
                                <button
                                    className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${isOperatorRole && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState) && !canSubmitCurrentChecksheet ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-primary hover:bg-brand-primary-hover'}`}
                                    onClick={saveChecksheet}
                                    disabled={isOperatorRole && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState) && !canSubmitCurrentChecksheet}
                                >
                                    {isOperatorRole && EDITABLE_OPERATOR_WORKFLOW_STATES.has(currentWorkflowState)
                                        ? currentWorkflowState === 'returned' ? 'Resubmit Checksheet' : 'Submit Checksheet'
                                        : 'Save Changes'}
                                </button>
                            )}
                            {canExportCurrentChecksheet && (
                                <button
                                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                                    onClick={confirmGenerateExcelReport}
                                >
                                    Download
                                </button>
                            )}
                            {currentChecksheetId && currentWorkflowState === 'submitted' && (isReviewerRole || isSystemAdminRole) && (
                                <button
                                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                                    onClick={() => confirmApproveChecksheet(currentChecksheetMeta || undefined)}
                                >
                                    Approve
                                </button>
                            )}
                            {currentChecksheetId && currentWorkflowState === 'submitted' && (isReviewerRole || isSystemAdminRole) && (
                                <button
                                    className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                                    onClick={() => {
                                        const index = savedChecksheets.findIndex(sheet => sheet._id === currentChecksheetId);
                                        if (index >= 0) {
                                            openReturnModal(index);
                                        } else {
                                            showAlert('error', 'Open the audit from the current list page before returning it');
                                        }
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
                                                    disabled={!canEditCurrentChecksheet}
                                                    className="text-sm p-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-brand-primary dark:focus:border-brand-primary-light border focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light"
                                                >
                                                    <option value="">Select</option>
                                                    <option value="I">I</option>
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
                                                disabled={!canEditCurrentChecksheet}
                                                className="p-2 text-sm block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-brand-primary dark:focus:border-brand-primary-light border focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light"
                                            />
                                        </div>
                                        <div className="w-full sm:w-[48%]">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Shift</label>
                                            <select
                                                value={auditData.shift}
                                                onChange={(e) => updateBasicInfo('shift', e.target.value)}
                                                disabled={!canEditCurrentChecksheet}
                                                className="p-2 text-sm block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-brand-primary dark:focus:border-brand-primary-light border focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light"
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
                                                disabled={!canEditCurrentChecksheet}
                                                className="p-2 text-sm block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-brand-primary dark:focus:border-brand-primary-light border focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light"
                                            />
                                        </div>
                                        <div className="w-full sm:w-[48%]">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Module Type</label>
                                            <input
                                                type="text"
                                                value={auditData.moduleType}
                                                onChange={(e) => updateBasicInfo('moduleType', e.target.value)}
                                                disabled={!canEditCurrentChecksheet}
                                                className="p-2 text-sm block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-brand-primary dark:focus:border-brand-primary-light border focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light"
                                            />
                                        </div>
                                        <div className="w-full flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-10 mt-4">
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={auditData.customerSpecAvailable}
                                                    onChange={(e) => updateBasicInfo('customerSpecAvailable', e.target.checked)}
                                                    disabled={!canEditCurrentChecksheet}
                                                    className="rounded border-gray-300 dark:border-gray-600 text-brand-primary dark:text-brand-primary-light hover:border-brand-primary-light w-4 h-4 sm:w-5 sm:h-5"
                                                />
                                                <span className="ml-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">Customer Specification Available</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={auditData.specificationSignedOff}
                                                    onChange={(e) => updateBasicInfo('specificationSignedOff', e.target.checked)}
                                                    disabled={!canEditCurrentChecksheet}
                                                    className="rounded border-gray-300 dark:border-gray-600 text-brand-primary dark:text-brand-primary-light hover:border-brand-primary-light w-4 h-4 sm:w-5 sm:h-5"
                                                />
                                                <span className="ml-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">Specification Signed Off With Customer</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="text-center">
                                        <button
                                            onClick={handleNextFromBasicInfo}
                                            disabled={!canProceedFromBasicInfo}
                                            className={`px-6 sm:px-8 py-2 sm:py-3 text-white rounded-lg transition-colors text-sm sm:text-lg font-semibold ${canProceedFromBasicInfo ? 'bg-brand-primary dark:bg-brand-primary-hover cursor-pointer hover:bg-brand-primary-hover dark:hover:bg-brand-primary-hover' : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'}`}
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
                                                className={`group relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border bg-white px-3 pb-3 pt-10 text-center transition-all duration-200 sm:px-4 sm:pb-4 dark:bg-gray-800 ${
                                                    button.enabled
                                                        ? selectedStageId === button.id
                                                            ? 'border-brand-primary bg-brand-primary-soft shadow-sm hover:bg-brand-primary-soft dark:border-brand-primary-light dark:bg-brand-primary/15'
                                                            : button.completionStatus === 'completed'
                                                                ? 'border-green-200 hover:border-brand-primary hover:bg-brand-primary-soft hover:shadow-sm dark:border-green-900/70 dark:hover:border-brand-primary-light dark:hover:bg-brand-primary/10'
                                                                : button.completionStatus === 'in_progress'
                                                                    ? 'border-amber-200 hover:border-brand-primary hover:bg-brand-primary-soft hover:shadow-sm dark:border-amber-900/70 dark:hover:border-brand-primary-light dark:hover:bg-brand-primary/10'
                                                                    : 'border-slate-200 hover:border-brand-primary hover:bg-brand-primary-soft hover:shadow-sm dark:border-slate-700 dark:hover:border-brand-primary-light dark:hover:bg-brand-primary/10'
                                                        : 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'
                                                }`}
                                            >
                                                <span
                                                    className={`text-xs font-semibold leading-5 transition-colors duration-200 sm:text-sm ${
                                                        button.enabled
                                                            ? selectedStageId === button.id
                                                                ? 'text-brand-primary dark:text-brand-primary-light'
                                                                : 'text-slate-700 group-hover:text-brand-primary dark:text-slate-200 dark:group-hover:text-brand-primary-light'
                                                            : 'text-gray-400 dark:text-gray-500'
                                                    }`}
                                                >
                                                    {button.label}
                                                </span>
                                                <span
                                                    aria-hidden="true"
                                                    className={`absolute right-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded border px-1.5 ${
                                                        button.completionStatus === 'completed'
                                                            ? 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                            : button.completionStatus === 'in_progress'
                                                                ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                                : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                                                    }`}
                                                >
                                                    {button.completionStatus === 'completed' ? (
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    ) : button.completionStatus === 'in_progress' ? (
                                                        <CircleDot className="h-4 w-4" />
                                                    ) : (
                                                        <Circle className="h-4 w-4" />
                                                    )}
                                                </span>
                                                <span className={`text-[11px] font-medium sm:text-xs ${
                                                    button.completionStatus === 'completed'
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : button.completionStatus === 'in_progress'
                                                            ? 'text-amber-600 dark:text-amber-400'
                                                            : 'text-slate-500 dark:text-slate-400'
                                                }`}>
                                                    {button.completionStatus === 'completed'
                                                        ? 'Completed'
                                                        : button.completionStatus === 'in_progress'
                                                            ? 'In Progress'
                                                            : 'Not Started'}
                                                </span>
                                                {button.hasUnsavedChanges && (
                                                    <span
                                                        className="absolute left-2 top-2 h-2 w-2 rounded-full bg-amber-400"
                                                        title="Changes are being auto-saved"
                                                        aria-label="Changes are being auto-saved"
                                                    />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {currentView === 'stageDetail' && selectedStageId && (
                            <div className="bg-transparent dark:bg-gray-800 rounded-lg overflow-hidden animate-fade-in max-h-[calc(100vh-7rem)] flex flex-col min-h-0">
                                <div className="sticky top-0 z-30 bg-brand-primary dark:bg-brand-primary-hover text-white px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-sm">
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
                                                        className="bg-white/20 dark:bg-gray-800/20 text-white border border-white dark:border-gray-300 px-3 sm:px-4 py-1 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-bold transition-all duration-300 hover:bg-white hover:text-brand-primary-hover dark:hover:bg-gray-800 dark:hover:text-brand-primary-light disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/20 disabled:hover:text-white"
                                                    >
                                                        <ChevronLeft />
                                                    </button>
                                                    <button
                                                        onClick={() => nextStage && handleStageNavigation(nextStage.id)}
                                                        disabled={!nextStage}
                                                        className="bg-white/20 dark:bg-gray-800/20 text-white border border-white dark:border-gray-300 px-3 sm:px-4 py-1 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-bold transition-all duration-300 hover:bg-white hover:text-brand-primary-hover dark:hover:bg-gray-800 dark:hover:text-brand-primary-light disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/20 disabled:hover:text-white"
                                                    >
                                                        <ChevronRight />
                                                    </button>
                                                </>
                                            );
                                        })()}
                                        <button
                                            onClick={handleBackToStageSelection}
                                            className="bg-white/20 dark:bg-gray-800/20 text-white border border-white dark:border-gray-300 px-3 sm:px-4 py-1 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-bold transition-all duration-300 hover:bg-white hover:text-brand-primary-hover dark:hover:bg-gray-800 dark:hover:text-brand-primary-light"
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
                                                                <tr className="bg-brand-primary-soft dark:bg-brand-primary/10 font-bold">
                                                                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-normal text-xs sm:text-sm text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                                                        {param.parameters}
                                                                    </td>
                                                                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-normal text-xs sm:text-sm text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                                                        {param.criteria}
                                                                    </td>
                                                                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-normal text-xs sm:text-sm text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${param.typeOfInspection === 'Aesthetics' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                                                                            ['Measurement', 'Measurements'].includes(param.typeOfInspection) ? 'bg-brand-primary-muted dark:bg-brand-primary/15 text-brand-primary-deep dark:text-brand-primary-light' :
                                                                                param.typeOfInspection === 'Functionality' ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' :
                                                                                    param.typeOfInspection === 'RFID Scanner' ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' :
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
                                                                                                    disabled={!canEditCurrentChecksheet}
                                                                                                    className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                                                                                >
                                                                                                    {getDynamicLineOptions(auditData.lineNumber).map(line => (
                                                                                                        <option key={line} value={line}>{line}</option>
                                                                                                    ))}
                                                                                                </select>
                                                                                            </label>
                                                                                        ) : (
                                                                                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">{obs.timeSlot}</label>
                                                                                        )}
                                                                                        <fieldset disabled={!canEditCurrentChecksheet} className="w-full">
                                                                                        {selectedStageId === 7 && param.id === '7-9' ? (
                                                                                            <BusRibbonAuditPeelStrengthInput
                                                                                                stageId={selectedStageId}
                                                                                                paramId={param.id}
                                                                                                timeSlot={obs.timeSlot}
                                                                                                value={savedObservation?.value ?? obs.value}
                                                                                                observationData={savedObservation ?? obs}
                                                                                                onUpdate={updateObservation}
                                                                                                auditDate={auditData.date}
                                                                                                auditShift={auditData.shift}
                                                                                                lineOptions={getBusRibbonAuditLineOptions(auditData.lineNumber)}
                                                                                                onLineMappingUpdate={updateObservationLineMapping}
                                                                                            />
                                                                                        ) : param.renderObservation ? (
                                                                                            param.renderObservation({
                                                                                                stageId: selectedStageId,
                                                                                                paramId: param.id,
                                                                                                timeSlot: obs.timeSlot,
                                                                                                value: savedObservation?.value ?? obs.value,
                                                                                                observationData: savedObservation ?? obs,
                                                                                                onUpdate: updateObservation,
                                                                                                auditDate: auditData.date,
                                                                                                auditShift: auditData.shift,
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
                                                                                                        disabled={!canEditCurrentChecksheet}
                                                                                                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary dark:focus:ring-brand-primary-light"
                                                                                                    />
                                                                                                ) : (
                                                                                                    <div className="text-xs text-gray-500 dark:text-gray-400 p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900">
                                                                                                        Complex data structure - use custom renderer
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                        </fieldset>
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
                        {renderChecksheetsList(savedChecksheets, 'Audit Checksheets')}
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
