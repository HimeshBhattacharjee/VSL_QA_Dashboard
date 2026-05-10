import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    CalendarDays,
    FileText,
    MessageSquareText,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import MultiUserSelect from './MultiUserSelect';
import {
    type TaskCardData,
    type TaskPriority,
    type TaskStatus,
} from './TaskCard';
import { type AssignmentUserOption } from '../utilities/assignmentUsers';
import { normalizeAssignedTo } from '../utilities/taskAssignments';
import {
    getTaskManagementPermissions,
    type TaskManagementRole,
} from '../utilities/taskAccess';

export type TaskEditMode = 'create' | 'edit';

export interface TaskFormValues {
    title: string;
    description: string;
    assignedTo: string[];
    assignedBy: string;
    priority: TaskPriority;
    deadline: string;
    status: TaskStatus;
    remarks: string;
}

interface TaskEditModalProps {
    isOpen: boolean;
    mode: TaskEditMode;
    task: TaskCardData | null;
    role: TaskManagementRole;
    fixedAssignedBy: string;
    assigneeOptions: AssignmentUserOption[];
    onClose: () => void;
    onCreateTask: (task: TaskFormValues) => void;
    onUpdateTask: (task: TaskFormValues) => void;
    onDelete: (taskId: string) => void;
}

const priorities: TaskPriority[] = ['Low', 'Medium', 'High'];
const statuses: TaskStatus[] = ['To Do', 'Done'];

type ValidationErrors = Partial<Record<'title' | 'description' | 'assignedTo' | 'priority', string>>;

const createFormValues = (
    task: TaskCardData | null,
    mode: TaskEditMode,
    fixedAssignedBy: string,
): TaskFormValues => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    assignedTo: mode === 'create' ? [] : normalizeAssignedTo(task?.assignedTo ?? []),
    assignedBy: fixedAssignedBy,
    priority: task?.priority ?? 'Medium',
    deadline: task?.deadline ?? '',
    status: task?.status ?? 'To Do',
    remarks: task?.remarks ?? '',
});

const validateForm = (
    formState: TaskFormValues,
    shouldValidateCoreFields: boolean,
): ValidationErrors => {
    const errors: ValidationErrors = {};

    if (!shouldValidateCoreFields) {
        return errors;
    }

    if (!formState.title.trim()) {
        errors.title = 'Title is required';
    }

    if (!formState.description.trim()) {
        errors.description = 'Description is required';
    }

    if (formState.assignedTo.length === 0) {
        errors.assignedTo = 'Select at least one assignee';
    }

    if (!formState.priority) {
        errors.priority = 'Priority is required';
    }

    return errors;
};

export default function TaskEditModal({
    isOpen,
    mode,
    task,
    role,
    fixedAssignedBy,
    assigneeOptions,
    onClose,
    onCreateTask,
    onUpdateTask,
    onDelete,
}: TaskEditModalProps) {
    const [formState, setFormState] = useState<TaskFormValues>(() =>
        createFormValues(task, mode, fixedAssignedBy),
    );
    const [errors, setErrors] = useState<ValidationErrors>({});

    useEffect(() => {
        if (!isOpen) {
            setFormState(createFormValues(null, 'create', fixedAssignedBy));
            setErrors({});
            return;
        }

        setFormState(createFormValues(task, mode, fixedAssignedBy));
        setErrors({});
    }, [fixedAssignedBy, isOpen, mode, task]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') {
            return;
        }

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    if (!isOpen || (mode === 'edit' && !task)) {
        return null;
    }

    const isCreateMode = mode === 'create';
    const permissions = getTaskManagementPermissions(role);
    const canEditCoreFields = permissions.canEditAllTaskFields;
    const canEditRemarks = isCreateMode ? permissions.canCreateTasks : permissions.canEditTasks;
    const canEditStatus = !isCreateMode && permissions.canEditAllTaskFields;
    const canSubmit = isCreateMode ? permissions.canCreateTasks : permissions.canEditTasks;
    const readOnlyFieldClass =
        'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:dark:bg-slate-700 disabled:text-slate-400 disabled:dark:text-slate-300 disabled:border-slate-200';
    const fieldClass =
        'w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition-colors dark:bg-slate-800 dark:text-white';
    const getFieldClass = (hasError: boolean, isReadOnly = false) =>
        `${fieldClass} ${hasError ? 'border-rose-300 focus:border-rose-500 dark:border-rose-500/70' : 'border-slate-200 focus:border-slate-400 dark:border-slate-700'} ${isReadOnly ? readOnlyFieldClass : ''}`;

    const updateField = <K extends keyof TaskFormValues>(field: K, value: TaskFormValues[K]) => {
        setFormState((current) => ({ ...current, [field]: value }));
        setErrors((current) => {
            if (!(field in current)) {
                return current;
            }

            const nextErrors = { ...current };
            delete nextErrors[field as keyof ValidationErrors];
            return nextErrors;
        });
    };

    const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        if (!canSubmit) {
            return;
        }

        const nextErrors = validateForm(formState, canEditCoreFields || isCreateMode);
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        if (isCreateMode) {
            onCreateTask(formState);
            return;
        }

        onUpdateTask(formState);
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center custom-scrollbar bg-black/40 p-4 backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {isCreateMode ? 'Create New Task' : 'Edit Task'}
                            </h2>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-green-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                            <ShieldCheck className="h-4 w-4 fill-green-400" />
                            <span>{role}</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={formState.title}
                                    onChange={(event) => updateField('title', event.target.value)}
                                    disabled={!canEditCoreFields}
                                    className={getFieldClass(Boolean(errors.title), !canEditCoreFields)}
                                    placeholder="Enter task title"
                                />
                                {errors.title && (
                                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                        {errors.title}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    <FileText className="h-4 w-4" />
                                    Description
                                </label>
                                <textarea
                                    value={formState.description}
                                    onChange={(event) => updateField('description', event.target.value)}
                                    disabled={!canEditCoreFields}
                                    rows={3}
                                    className={getFieldClass(Boolean(errors.description), !canEditCoreFields)}
                                    placeholder="Describe the task"
                                />
                                {errors.description && (
                                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                        {errors.description}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    <UserRound className="h-4 w-4" />
                                    Assigned To
                                </label>
                                <MultiUserSelect
                                    options={assigneeOptions}
                                    selectedUsers={formState.assignedTo}
                                    onChange={(users) => updateField('assignedTo', users)}
                                    disabled={!canEditCoreFields}
                                    hasError={Boolean(errors.assignedTo)}
                                    placeholder="Search and select team members"
                                />
                                {errors.assignedTo && (
                                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                        {errors.assignedTo}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Assigned By
                                </label>
                                <input
                                    type="text"
                                    value={formState.assignedBy}
                                    disabled
                                    className={getFieldClass(false, true)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Priority
                                </label>
                                <select
                                    value={formState.priority}
                                    onChange={(event) => updateField('priority', event.target.value as TaskPriority)}
                                    disabled={!canEditCoreFields}
                                    className={getFieldClass(Boolean(errors.priority), !canEditCoreFields)}
                                >
                                    {priorities.map((priority) => (
                                        <option key={priority} value={priority}>
                                            {priority}
                                        </option>
                                    ))}
                                </select>
                                {errors.priority && (
                                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                        {errors.priority}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    <CalendarDays className="h-4 w-4" />
                                    Deadline
                                </label>
                                <input
                                    type="date"
                                    value={formState.deadline}
                                    onChange={(event) => updateField('deadline', event.target.value)}
                                    disabled={!canEditCoreFields}
                                    className={getFieldClass(false, !canEditCoreFields)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Status
                                </label>
                                {isCreateMode ? (
                                    <div className="space-y-2">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                            To Do
                                        </div>
                                    </div>
                                ) : (
                                    <select
                                        value={formState.status}
                                        onChange={(event) => updateField('status', event.target.value as TaskStatus)}
                                        disabled={!canEditStatus}
                                        className={getFieldClass(false, !canEditStatus)}
                                    >
                                        {statuses.map((status) => (
                                            <option key={status} value={status}>
                                                {status}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    <MessageSquareText className="h-4 w-4" />
                                    Remarks
                                </label>
                                <textarea
                                    value={formState.remarks}
                                    onChange={(event) => updateField('remarks', event.target.value)}
                                    rows={3}
                                    disabled={!canEditRemarks}
                                    className={getFieldClass(false, !canEditRemarks)}
                                    placeholder="Add remarks or status notes"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            {!isCreateMode && permissions.canDeleteTasks && task && (
                                <button
                                    type="button"
                                    onClick={() => onDelete(task.id)}
                                    className="rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-500 transition-colors hover:bg-rose-500 hover:text-white"
                                >
                                    Delete Task
                                </button>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                            >
                                {isCreateMode ? 'Create Task' : permissions.canEditRemarksOnly ? 'Save Remarks' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
