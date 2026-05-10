import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Plus, Trash2, UserRound } from 'lucide-react';
import MultiUserSelect from './MultiUserSelect';
import { type AssignmentUserOption } from '../utilities/assignmentUsers';
import {
    getGoalManagementPermissions,
    type TaskManagementRole,
} from '../utilities/taskAccess';
import { type GoalData } from '../utilities/goalUtils';

export type GoalEditMode = 'create' | 'edit';

export interface GoalFormMilestone {
    id: string;
    title: string;
    targetDate: string;
    completed: boolean;
    completedAt?: string;
}

export interface GoalFormValues {
    title: string;
    assignedTo: string[];
    milestones: GoalFormMilestone[];
}

interface GoalModalProps {
    isOpen: boolean;
    mode: GoalEditMode;
    goal: GoalData | null;
    role: TaskManagementRole;
    employeeOptions: AssignmentUserOption[];
    onClose: () => void;
    onCreateGoal: (goal: GoalFormValues) => void;
    onUpdateGoal: (goal: GoalFormValues) => void;
    onDelete: (goalId: string) => void;
}

interface ValidationErrors {
    title?: string;
    assignedTo?: string;
    milestones?: string;
    milestoneFields?: Record<string, { title?: string; targetDate?: string }>;
}

const generateMilestoneId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const createEmptyMilestone = (): GoalFormMilestone => ({
    id: generateMilestoneId(),
    title: '',
    targetDate: '',
    completed: false,
});

const createFormValues = (
    goal: GoalData | null,
    mode: GoalEditMode,
): GoalFormValues => ({
    title: goal?.title ?? '',
    assignedTo: goal?.assignedTo ?? [],
    milestones:
        goal?.milestones.map((milestone) => ({
            ...milestone,
        })) ?? (mode === 'create' ? [createEmptyMilestone()] : []),
});

const validateForm = (formState: GoalFormValues): ValidationErrors => {
    const errors: ValidationErrors = {};
    const milestoneFieldErrors: ValidationErrors['milestoneFields'] = {};

    if (!formState.title.trim()) {
        errors.title = 'Goal title is required';
    }

    if (formState.assignedTo.length === 0) {
        errors.assignedTo = 'Select at least one employee';
    }

    if (formState.milestones.length === 0) {
        errors.milestones = 'Add at least one milestone';
    }

    for (const milestone of formState.milestones) {
        const fieldErrors: { title?: string; targetDate?: string } = {};

        if (!milestone.title.trim()) {
            fieldErrors.title = 'Milestone title is required';
        }

        if (!milestone.targetDate) {
            fieldErrors.targetDate = 'Target date is required';
        }

        if (fieldErrors.title || fieldErrors.targetDate) {
            milestoneFieldErrors[milestone.id] = fieldErrors;
        }
    }

    if (Object.keys(milestoneFieldErrors).length > 0) {
        errors.milestoneFields = milestoneFieldErrors;
    }

    return errors;
};

export default function GoalModal({
    isOpen,
    mode,
    goal,
    role,
    employeeOptions,
    onClose,
    onCreateGoal,
    onUpdateGoal,
    onDelete,
}: GoalModalProps) {
    const [formState, setFormState] = useState<GoalFormValues>(() =>
        createFormValues(goal, mode),
    );
    const [errors, setErrors] = useState<ValidationErrors>({});

    useEffect(() => {
        if (!isOpen) {
            setFormState(createFormValues(null, 'create'));
            setErrors({});
            return;
        }

        setFormState(createFormValues(goal, mode));
        setErrors({});
    }, [goal, isOpen, mode]);

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

    if (!isOpen || (mode === 'edit' && !goal)) {
        return null;
    }

    const permissions = getGoalManagementPermissions(role);
    const canSubmit = permissions.canEditGoalDetails;
    const fieldClass =
        'w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition-colors dark:bg-slate-800 dark:text-white';
    const getFieldClass = (hasError: boolean) =>
        `${fieldClass} ${hasError ? 'border-rose-300 focus:border-rose-500 dark:border-rose-500/70' : 'border-slate-200 focus:border-slate-400 dark:border-slate-700'}`;

    const updateField = <K extends keyof GoalFormValues>(field: K, value: GoalFormValues[K]) => {
        setFormState((current) => ({ ...current, [field]: value }));
        setErrors((current) => {
            if (!(field in current)) {
                return current;
            }

            const nextErrors = { ...current };
            const removableField = field as 'title' | 'assignedTo' | 'milestones';
            delete nextErrors[removableField];
            return nextErrors;
        });
    };

    const updateMilestone = (
        milestoneId: string,
        field: keyof GoalFormMilestone,
        value: GoalFormMilestone[keyof GoalFormMilestone],
    ) => {
        setFormState((current) => ({
            ...current,
            milestones: current.milestones.map((milestone) =>
                milestone.id === milestoneId
                    ? {
                        ...milestone,
                        [field]: value,
                    }
                    : milestone,
            ),
        }));
        setErrors((current) => {
            if (!current.milestoneFields?.[milestoneId]) {
                return current;
            }

            const nextMilestoneFields = { ...current.milestoneFields };
            const nextFieldErrors = { ...nextMilestoneFields[milestoneId] };
            delete nextFieldErrors[field as 'title' | 'targetDate'];

            if (Object.keys(nextFieldErrors).length > 0) {
                nextMilestoneFields[milestoneId] = nextFieldErrors;
            } else {
                delete nextMilestoneFields[milestoneId];
            }

            return {
                ...current,
                milestoneFields:
                    Object.keys(nextMilestoneFields).length > 0
                        ? nextMilestoneFields
                        : undefined,
            };
        });
    };

    const handleAddMilestone = () => {
        setFormState((current) => ({
            ...current,
            milestones: [...current.milestones, createEmptyMilestone()],
        }));
        setErrors((current) => {
            if (!current.milestones) {
                return current;
            }

            const nextErrors = { ...current };
            delete nextErrors.milestones;
            return nextErrors;
        });
    };

    const handleRemoveMilestone = (milestoneId: string) => {
        setFormState((current) => ({
            ...current,
            milestones: current.milestones.filter((milestone) => milestone.id !== milestoneId),
        }));
        setErrors((current) => {
            if (!current.milestoneFields?.[milestoneId]) {
                return current;
            }

            const nextMilestoneFields = { ...current.milestoneFields };
            delete nextMilestoneFields[milestoneId];

            return {
                ...current,
                milestoneFields:
                    Object.keys(nextMilestoneFields).length > 0
                        ? nextMilestoneFields
                        : undefined,
            };
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

        const nextErrors = validateForm(formState);
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        if (mode === 'create') {
            onCreateGoal(formState);
            return;
        }

        onUpdateGoal(formState);
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center custom-scrollbar bg-black/40 p-4 backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {mode === 'create' ? 'Create Goal' : 'Edit Goal'}
                        </h2>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Goal Title
                                </label>
                                <input
                                    type="text"
                                    value={formState.title}
                                    onChange={(event) => updateField('title', event.target.value)}
                                    className={getFieldClass(Boolean(errors.title))}
                                    placeholder="Enter the goal title"
                                />
                                {errors.title && (
                                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                        {errors.title}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    <UserRound className="h-4 w-4" />
                                    <span>Assigned Employees</span>
                                </label>
                                <MultiUserSelect
                                    options={employeeOptions}
                                    selectedUsers={formState.assignedTo}
                                    onChange={(users) => updateField('assignedTo', users)}
                                    hasError={Boolean(errors.assignedTo)}
                                    placeholder="Search and select team members"
                                />
                                {errors.assignedTo && (
                                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                        {errors.assignedTo}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                        Milestone Planning
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Add the checkpoints and target dates for this goal.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddMilestone}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add Milestone</span>
                                </button>
                            </div>

                            {errors.milestones && (
                                <p className="mb-3 text-xs font-medium text-rose-600 dark:text-rose-400">
                                    {errors.milestones}
                                </p>
                            )}

                            <div className="space-y-3">
                                {formState.milestones.map((milestone, index) => {
                                    const milestoneErrors =
                                        errors.milestoneFields?.[milestone.id] ?? {};

                                    return (
                                        <div
                                            key={milestone.id}
                                            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                                        >
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                    Milestone {index + 1}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveMilestone(milestone.id)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    <span>Remove</span>
                                                </button>
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                        Milestone Title
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={milestone.title}
                                                        onChange={(event) =>
                                                            updateMilestone(
                                                                milestone.id,
                                                                'title',
                                                                event.target.value,
                                                            )
                                                        }
                                                        className={getFieldClass(Boolean(milestoneErrors.title))}
                                                        placeholder="Define the milestone"
                                                    />
                                                    {milestoneErrors.title && (
                                                        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                                            {milestoneErrors.title}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                        <CalendarDays className="h-4 w-4" />
                                                        <span>Target Date</span>
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={milestone.targetDate}
                                                        onChange={(event) =>
                                                            updateMilestone(
                                                                milestone.id,
                                                                'targetDate',
                                                                event.target.value,
                                                            )
                                                        }
                                                        className={getFieldClass(
                                                            Boolean(milestoneErrors.targetDate),
                                                        )}
                                                    />
                                                    {milestoneErrors.targetDate && (
                                                        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                                            {milestoneErrors.targetDate}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            {mode === 'edit' && goal && permissions.canDeleteGoals && (
                                <button
                                    type="button"
                                    onClick={() => onDelete(goal.id)}
                                    className="rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-500 transition-colors hover:bg-rose-500 hover:text-white"
                                >
                                    Delete Goal
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
                                className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                            >
                                {mode === 'create' ? 'Create Goal' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
