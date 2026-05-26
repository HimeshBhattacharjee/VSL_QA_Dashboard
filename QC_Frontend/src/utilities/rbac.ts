export type UserRole = 'Operator' | 'Supervisor' | 'Manager' | string | null;
export type ChecksheetStatus = 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';

export interface CurrentUser {
    employeeId: string;
    name: string;
    role: UserRole;
}

export interface WorkflowRecord {
    status?: ChecksheetStatus | string;
    created_by?: string;
    created_by_name?: string;
    created_at?: string | number;
    updated_at?: string | number;
    submitted_at?: string | number;
    returned_at?: string | number;
    returned_by_name?: string;
    return_comment?: string;
    [key: string]: any;
}

const REVIEWER_ROLES = new Set(['Supervisor', 'Manager']);

export const getCurrentUser = (): CurrentUser => ({
    employeeId: sessionStorage.getItem('employeeId') || '',
    name: sessionStorage.getItem('username') || '',
    role: sessionStorage.getItem('userRole'),
});

export const getAuthHeaders = (includeJson = false): HeadersInit => {
    const user = getCurrentUser();
    return {
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        'X-Employee-Id': user.employeeId,
        'X-User-Name': user.name,
        'X-User-Role': user.role || '',
    };
};

export const normalizeStatus = (record?: WorkflowRecord): ChecksheetStatus => {
    const status = String(record?.status || '').toUpperCase();
    if (status === 'DRAFT' || status === 'RETURNED' || status === 'APPROVED') return status;
    return 'SUBMITTED';
};

export const isOperator = (role: UserRole) => role === 'Operator';
export const isReviewer = (role: UserRole) => REVIEWER_ROLES.has(role || '');

export const isOwner = (record: WorkflowRecord, user = getCurrentUser()) =>
    Boolean(record.created_by && record.created_by === user.employeeId) ||
    Boolean(!record.created_by && record.created_by_name && record.created_by_name === user.name);

export const canCreate = (role: UserRole = getCurrentUser().role) => isOperator(role);

export const canView = (record: WorkflowRecord, user = getCurrentUser()) =>
    isReviewer(user.role) || (isOperator(user.role) && isOwner(record, user));

export const canEdit = (record: WorkflowRecord, user = getCurrentUser()) => {
    const status = normalizeStatus(record);
    if (isOperator(user.role)) return isOwner(record, user) && (status === 'DRAFT' || status === 'RETURNED');
    return isReviewer(user.role) && status === 'SUBMITTED';
};

export const canSubmit = (record: WorkflowRecord, user = getCurrentUser()) => {
    const status = normalizeStatus(record);
    return isOperator(user.role) && isOwner(record, user) && (status === 'DRAFT' || status === 'RETURNED');
};

export const canDelete = (record: WorkflowRecord, user = getCurrentUser()) =>
    isReviewer(user.role) && normalizeStatus(record) === 'SUBMITTED';

export const canExport = (record: WorkflowRecord, user = getCurrentUser()) =>
    normalizeStatus(record) === 'SUBMITTED' && canView(record, user);

export const canReturn = (record: WorkflowRecord, user = getCurrentUser()) =>
    isReviewer(user.role) && normalizeStatus(record) === 'SUBMITTED';

export const getCreatedByLabel = (record: WorkflowRecord) =>
    record.created_by_name || record.created_by || 'Legacy record';

export const getActionLabel = (record: WorkflowRecord) =>
    canEdit(record) ? (normalizeStatus(record) === 'RETURNED' ? 'Edit' : 'Edit') : 'View';
