import type { ConfirmOptions } from '../context/ConfirmModalContext';

export const LEGACY_ENTRY_LABEL = 'Legacy Entry';
export const OPERATOR_SIGNATURE_REQUIRED_MESSAGE = 'Operator signature is required before submitting this report.';

type WorkflowRecord = object | null | undefined;

const CREATOR_FIELDS = [
    'createdBy',
    'createdByLabel',
    'createdByEmployeeName',
    'createdByEmployeeId',
    'created_by',
    'created_by_employee_name',
];

const CREATOR_SIGNATURE_FIELDS = [
    'preparedBy',
    'preparedBySignature',
    'preparedSignature',
    'auditBy',
    'auditSignature',
    'operatorSignature',
    'operator',
    'operatorName',
    'testedBy',
    'testedBySignature',
    'checkedBy',
    'checkedBySignature',
    'createdBySignature',
];

const IGNORED_SIGNATURE_TOKENS = ['approved', 'reviewed', 'verified', 'returned'];

const normalizeText = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    return '';
};

const isLegacyLabel = (value: string): boolean =>
    ['legacy entry', 'legacy report'].includes(value.trim().toLowerCase());

const isValidSignatureText = (value: string): boolean => {
    const text = value.trim();
    if (!text) return false;
    if (isLegacyLabel(text)) return false;
    const lowered = text.toLowerCase();
    if (lowered.startsWith('http://') || lowered.startsWith('https://') || lowered.startsWith('data:image')) return false;
    if (lowered.startsWith('users/signatures/') || lowered.includes('/users/signatures/')) return false;
    return text.length <= 160;
};

const extractSignedEmployee = (value: unknown): string => {
    if (!value) return '';
    if (typeof value === 'object' && !Array.isArray(value)) {
        const source = value as Record<string, unknown>;
        for (const key of ['name', 'employeeName', 'employee_name', 'text', 'value', 'signedBy', 'signed_by']) {
            const candidate = extractSignedEmployee(source[key]);
            if (candidate) return candidate;
        }
        return '';
    }

    const text = normalizeText(value);
    return isValidSignatureText(text) ? text : '';
};

const getNestedSources = (record: WorkflowRecord): Record<string, unknown>[] => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
    const source = record as Record<string, unknown>;
    const nested = ['formData', 'form_data', 'data']
        .map(key => source[key])
        .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value));
    return [source, ...nested];
};

export const resolveCreatorName = (record: WorkflowRecord): string => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return LEGACY_ENTRY_LABEL;
    const source = record as Record<string, unknown>;

    for (const field of CREATOR_FIELDS) {
        const value = normalizeText(source[field]);
        if (value && !isLegacyLabel(value)) return value;
    }

    for (const candidateSource of getNestedSources(source)) {
        for (const field of CREATOR_SIGNATURE_FIELDS) {
            const candidate = extractSignedEmployee(candidateSource[field]);
            if (candidate) return candidate;
        }

        const signatures = candidateSource.signatures;
        if (!signatures || typeof signatures !== 'object' || Array.isArray(signatures)) continue;
        const signatureMap = signatures as Record<string, unknown>;
        for (const field of CREATOR_SIGNATURE_FIELDS) {
            const candidate = extractSignedEmployee(signatureMap[field]);
            if (candidate) return candidate;
        }
        for (const [key, value] of Object.entries(signatureMap)) {
            const loweredKey = key.toLowerCase();
            if (IGNORED_SIGNATURE_TOKENS.some(token => loweredKey.includes(token))) continue;
            if (!loweredKey.includes('signature') && !loweredKey.includes('by')) continue;
            const candidate = extractSignedEmployee(value);
            if (candidate) return candidate;
        }
    }

    return LEGACY_ENTRY_LABEL;
};

export const isResolvedCreator = (
    record: WorkflowRecord,
    user: { employeeId?: string | null; username?: string | null },
): boolean => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    const source = record as Record<string, unknown>;
    const employeeId = (user.employeeId || '').trim();
    const username = (user.username || '').trim();
    if (employeeId && normalizeText(source.createdByEmployeeId) === employeeId) return true;
    if (username && resolveCreatorName(source) === username) return true;
    return false;
};

type WorkflowConfirmAction = 'approve' | 'delete' | 'download';

interface WorkflowConfirmOptions {
    action: WorkflowConfirmAction;
    count?: number;
    noun?: string;
    onConfirm: () => void;
}

export const buildWorkflowConfirmOptions = ({
    action,
    count,
    noun = 'report',
    onConfirm,
}: WorkflowConfirmOptions): ConfirmOptions => {
    const normalizedCount = typeof count === 'number' && count > 0 ? count : undefined;
    const pluralNoun = normalizedCount === 1 ? noun : `${noun}s`;
    const selectedText = normalizedCount ? `${normalizedCount} selected ${pluralNoun}` : `this ${noun}`;

    if (action === 'approve') {
        return {
            title: normalizedCount ? `Approve ${selectedText}?` : `Approve this ${noun}?`,
            message: normalizedCount
                ? 'Your approval signature will automatically be added wherever applicable.'
                : `This action will mark the ${noun} as approved and automatically add your approval signature.`,
            type: 'success',
            confirmText: 'Approve',
            cancelText: 'Cancel',
            onConfirm,
        };
    }

    if (action === 'delete') {
        return {
            title: normalizedCount ? `Delete ${selectedText}?` : `Delete this ${noun}?`,
            message: 'This action cannot be undone.',
            type: 'warning',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm,
        };
    }

    return {
        title: normalizedCount ? `Download ${selectedText}?` : `Download this ${noun}?`,
        message: normalizedCount ? '' : `The ${noun} will be generated in its current approved format.`,
        type: 'info',
        confirmText: 'Download',
        cancelText: 'Cancel',
        onConfirm,
    };
};
