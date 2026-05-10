import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import GoalModal, { type GoalFormValues } from '../components/GoalModal';
import UserSingleSelect from '../components/UserSingleSelect';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import {
    fetchAssignmentUsers,
    type AssignmentUserOption,
} from '../utilities/assignmentUsers';
import { normalizeAssignedTo } from '../utilities/taskAssignments';
import {
    createGoal as createGoalRequest,
    createGoalMutationPayloadFromGoal,
    deleteGoal as deleteGoalRequest,
    fetchGoals,
    updateGoal as updateGoalRequest,
} from '../utilities/goalApi';
import {
    ALL_GOAL_ASSIGNEES_FILTER_VALUE,
    DEFAULT_GOAL_FILTERS,
    DEFAULT_GOAL_SORT_OPTION,
    EMPTY_GOAL_STATUS_FILTER_VALUE,
    areGoalsEqual,
    formatGoalDate,
    getGoalProgressSummary,
    getGoalStatusClasses,
    getGoalStatusLabel,
    getMilestoneStatus,
    getMilestoneStatusClasses,
    getNextMilestoneTargetDate,
    groupGoalsByOwner,
    processGoals,
    type GoalData,
    type GoalFilters,
    type GoalSortOption,
} from '../utilities/goalUtils';
import {
    getCurrentTaskManagementRole,
    getGoalManagementPermissions,
} from '../utilities/taskAccess';

type GoalModalState =
    | {
        mode: 'create';
        goal: null;
    }
    | {
        mode: 'edit';
        goal: GoalData;
    };

interface GoalViewControlsProps {
    searchQuery: string;
    sortOption: GoalSortOption;
    filters: GoalFilters;
    assigneeOptions: AssignmentUserOption[];
    onSearchChange: (value: string) => void;
    onSortChange: (value: GoalSortOption) => void;
    onGoalStatusChange: (value: GoalFilters['goalStatus']) => void;
    onAssigneeChange: (value: string) => void;
}

interface GoalMeetingTableProps {
    goals: GoalData[];
    expandedGoalIds: Set<string>;
    canEditGoal: boolean;
    canUpdateMilestones: boolean;
    onEditGoal: (goal: GoalData) => void;
    onToggleExpand: (goalId: string) => void;
    onToggleMilestone: (goal: GoalData, milestoneId: string, nextCompleted: boolean) => void;
}

const headerCellClass =
    'sticky top-0 z-10 border-b border-slate-200 bg-white p-3 text-center align-middle text-xs font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
const bodyCellClass = 'p-3 align-middle';

const getMilestoneBreakdown = (goal: GoalData) =>
    goal.milestones.reduce(
        (summary, milestone) => {
            const status = getMilestoneStatus(milestone);

            if (status === 'Done') {
                summary.done += 1;
            } else if (status === 'Pending') {
                summary.pending += 1;
            } else {
                summary.notDone += 1;
            }

            return summary;
        },
        { done: 0, pending: 0, notDone: 0 },
    );

function GoalViewControls({
    searchQuery,
    sortOption,
    filters,
    assigneeOptions,
    onSearchChange,
    onSortChange,
    onGoalStatusChange,
    onAssigneeChange,
}: GoalViewControlsProps) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Search
                    </label>
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search by goal title or employee"
                        className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Sort
                    </label>
                    <select
                        value={sortOption}
                        onChange={(event) => onSortChange(event.target.value as GoalSortOption)}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                        <option value="createdAt">Creation Date</option>
                        <option value="goalStatus">Goal Status</option>
                        <option value="targetDate">Target Date</option>
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Goal Status
                    </label>
                    <select
                        value={filters.goalStatus}
                        onChange={(event) =>
                            onGoalStatusChange(event.target.value as GoalFilters['goalStatus'])
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                        <option value="All">All Statuses</option>
                        <option value={EMPTY_GOAL_STATUS_FILTER_VALUE}>Not Started</option>
                        <option value="On Track">On Track</option>
                        <option value="Off Track">Off Track</option>
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Assigned Employee
                    </label>
                    <UserSingleSelect
                        options={assigneeOptions}
                        value={filters.assignedUser}
                        onChange={onAssigneeChange}
                        allOptionLabel="All Employees"
                        allOptionValue={ALL_GOAL_ASSIGNEES_FILTER_VALUE}
                        placeholder="Filter by employee"
                        searchPlaceholder="Search employees"
                    />
                </div>
            </div>
        </section>
    );
}

function GoalMeetingTable({
    goals,
    expandedGoalIds,
    canEditGoal,
    canUpdateMilestones,
    onEditGoal,
    onToggleExpand,
    onToggleMilestone,
}: GoalMeetingTableProps) {
    const groupedGoals = groupGoalsByOwner(goals);
    const activeGoals = goals.filter((goal) => goal.goalStatus !== '').length;
    const totalGoals = goals.length;
    const onTrackGoals = goals.filter((goal) => goal.goalStatus === 'On Track').length;
    const offTrackGoals = goals.filter((goal) => goal.goalStatus === 'Off Track').length;
    const stats = [
        {
            label: 'Active Goals',
            value: activeGoals,
            className:
                'border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
        },
        {
            label: 'Total Goals',
            value: totalGoals,
            className:
                'border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-900/20 dark:text-slate-100',
        },
        {
            label: 'On Track',
            value: onTrackGoals,
            className:
                'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/80 dark:text-emerald-300',
        },
        {
            label: 'Off Track',
            value: offTrackGoals,
            className:
                'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-600 dark:bg-rose-900 dark:text-rose-300',
        },
    ];

    return (
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80">
            <div className="mb-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className={`flex gap-4 p-2 rounded-2xl border shadow-sm justify-between ${stat.className}`}
                    >
                        <p className="text-[12px] font-semibold uppercase tracking-wide opacity-80">
                            {stat.label}
                        </p>
                        <p className="text-sm font-extrabold">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner dark:border-slate-700 dark:bg-slate-900">
                <div className="max-h-[calc(100vh-18rem)] overflow-auto">
                    <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-left">
                        <thead>
                            <tr>
                                <th className={`${headerCellClass} w-[220px]`}>Owner</th>
                                <th className={`${headerCellClass} w-[280px]`}>Goal Title</th>
                                <th className={`${headerCellClass} w-[260px]`}>Milestones</th>
                                <th className={`${headerCellClass} w-[220px]`}>Milestone Status</th>
                                <th className={`${headerCellClass} w-[140px]`}>Goal Status</th>
                                <th className={`${headerCellClass} w-[160px]`}>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {groupedGoals.length > 0 ? (
                                groupedGoals.map((group) =>
                                    group.goals.map((goal, goalIndex) => {
                                        const isExpanded = expandedGoalIds.has(goal.id);
                                        const nextTargetDate = getNextMilestoneTargetDate(goal);
                                        const breakdown = getMilestoneBreakdown(goal);
                                        const milestoneSummary = [
                                            {
                                                label: 'Done',
                                                value: breakdown.done,
                                                className:
                                                    'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/80 dark:text-emerald-300',
                                            },
                                            {
                                                label: 'Pending',
                                                value: breakdown.pending,
                                                className:
                                                    'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-600 dark:bg-amber-900/80 dark:text-amber-300',
                                            },
                                            {
                                                label: 'Not Done',
                                                value: breakdown.notDone,
                                                className:
                                                    'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-600 dark:bg-rose-900 dark:text-rose-300',
                                            },
                                        ];

                                        return (
                                            <tr
                                                key={goal.id}
                                                className="bg-white transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/70"
                                            >
                                                {goalIndex === 0 && (
                                                    <td
                                                        rowSpan={group.goals.length}
                                                        className={`${bodyCellClass} border-b border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-800/60`}
                                                    >
                                                        <div className="sticky top-12 space-y-1">
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                                {group.label}
                                                            </p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {group.goals.length} goal
                                                                {group.goals.length === 1 ? '' : 's'}
                                                            </p>
                                                        </div>
                                                    </td>
                                                )}

                                                <td className={`${bodyCellClass} border-b border-slate-200 dark:border-slate-800`}>
                                                    <p className="text-sm font-semibold leading-6 text-slate-900 dark:text-white">
                                                        {goal.title}
                                                    </p>
                                                </td>

                                                <td className={`${bodyCellClass} border-b border-slate-200 dark:border-slate-800`}>
                                                    {isExpanded ? (
                                                        <div className="space-y-1">
                                                            {goal.milestones.map((milestone) => (
                                                                <div
                                                                    key={milestone.id}
                                                                    className="flex min-h-[60px] flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                                >
                                                                    <p className="font-medium text-slate-800 dark:text-slate-100">
                                                                        {milestone.title}
                                                                    </p>
                                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                        Target {formatGoalDate(milestone.targetDate)}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                                {getGoalProgressSummary(goal)}
                                                            </div>
                                                            {nextTargetDate && (
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                    Next target {formatGoalDate(nextTargetDate)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className={`${bodyCellClass} border-b border-slate-200 dark:border-slate-800`}>
                                                    {isExpanded ? (
                                                        <div className="space-y-1">
                                                            {goal.milestones.map((milestone) => {
                                                                const milestoneStatus =
                                                                    getMilestoneStatus(milestone);

                                                                return (
                                                                    <div
                                                                        key={milestone.id}
                                                                        className="flex min-h-[60px] flex-row justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900"
                                                                    >
                                                                        <span
                                                                            className={`inline-flex w-fit items-center rounded-full border px-2 py-1 text-xs font-semibold ${getMilestoneStatusClasses(milestoneStatus)}`}
                                                                        >
                                                                            {milestoneStatus}
                                                                        </span>
                                                                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={milestone.completed}
                                                                                disabled={
                                                                                    !canUpdateMilestones
                                                                                }
                                                                                onChange={(event) =>
                                                                                    onToggleMilestone(
                                                                                        goal,
                                                                                        milestone.id,
                                                                                        event.target.checked,
                                                                                    )
                                                                                }
                                                                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                                                                            />
                                                                            <span>Complete</span>
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            {milestoneSummary.map((item) => (
                                                                <div
                                                                    key={item.label}
                                                                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                                                                >
                                                                    <span className="font-medium text-slate-600 dark:text-slate-300">
                                                                        {item.label}
                                                                    </span>
                                                                    <span
                                                                        className={`inline-flex min-w-8 items-center justify-center rounded-full border px-1 font-semibold ${item.className}`}
                                                                    >
                                                                        {item.value}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className={`${bodyCellClass} border-b border-slate-200 dark:border-slate-800`}>
                                                    <span
                                                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getGoalStatusClasses(goal.goalStatus)}`}
                                                    >
                                                        {getGoalStatusLabel(goal.goalStatus)}
                                                    </span>
                                                </td>

                                                <td className={`${bodyCellClass} border-b border-slate-200 dark:border-slate-800`}>
                                                    <div className="flex flex-wrap justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => onToggleExpand(goal.id)}
                                                            className="inline-flex min-w-[92px] items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                        >
                                                            {isExpanded ? 'Collapse' : 'Expand'}
                                                        </button>

                                                        {canEditGoal && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onEditGoal(goal)}
                                                                className="inline-flex min-w-[92px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                            >
                                                                Edit
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }),
                                )
                            ) : (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                                    >
                                        No goals match the current meeting filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

const createGoalPayloadFromFormValues = (formValues: GoalFormValues) => ({
    title: formValues.title.trim(),
    assignedTo: normalizeAssignedTo(formValues.assignedTo),
    milestones: formValues.milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title.trim(),
        targetDate: milestone.targetDate,
        completed: milestone.completed,
        completedAt: milestone.completed ? milestone.completedAt ?? new Date().toISOString() : undefined,
    })),
});

export default function GoalMeeting() {
    const [goals, setGoals] = useState<GoalData[]>([]);
    const [employeeOptions, setEmployeeOptions] = useState<AssignmentUserOption[]>([]);
    const [modalState, setModalState] = useState<GoalModalState | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<GoalSortOption>(DEFAULT_GOAL_SORT_OPTION);
    const [filters, setFilters] = useState<GoalFilters>(DEFAULT_GOAL_FILTERS);
    const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();

    const currentUserRole = getCurrentTaskManagementRole();
    const permissions = getGoalManagementPermissions(currentUserRole);

    const visibleGoals = processGoals(goals, searchQuery, filters, sortOption);

    useEffect(() => {
        let isActive = true;

        const syncGoals = async (shouldShowAlert = false) => {
            try {
                const latestGoals = await fetchGoals();
                if (!isActive) {
                    return;
                }

                setGoals((current) => (areGoalsEqual(current, latestGoals) ? current : latestGoals));
            } catch (error) {
                console.error('Failed to fetch goals:', error);
                if (shouldShowAlert) {
                    showAlert('error', 'Failed to load goals from the server.');
                }
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        };

        void syncGoals(true);
        const pollTimer = window.setInterval(() => {
            void syncGoals(false);
        }, 10000);

        return () => {
            isActive = false;
            window.clearInterval(pollTimer);
        };
    }, [showAlert]);

    useEffect(() => {
        let isActive = true;

        const loadEmployees = async () => {
            try {
                const users = await fetchAssignmentUsers('goal');
                if (!isActive) {
                    return;
                }

                setEmployeeOptions(users);
            } catch (error) {
                console.error('Failed to fetch employees:', error);
                showAlert('error', 'Failed to load employee options.');
            }
        };

        void loadEmployees();

        return () => {
            isActive = false;
        };
    }, [showAlert]);

    const handleToggleExpand = (goalId: string) => {
        setExpandedGoalIds((current) => {
            const nextExpandedGoalIds = new Set(current);

            if (nextExpandedGoalIds.has(goalId)) {
                nextExpandedGoalIds.delete(goalId);
            } else {
                nextExpandedGoalIds.add(goalId);
            }

            return nextExpandedGoalIds;
        });
    };

    const handleOpenCreateModal = () => {
        if (!permissions.canCreateGoals) {
            return;
        }

        setModalState({
            mode: 'create',
            goal: null,
        });
    };

    const handleOpenEditModal = (goal: GoalData) => {
        if (!permissions.canEditGoalDetails) {
            return;
        }

        setModalState({
            mode: 'edit',
            goal,
        });
    };

    const handleCloseModal = () => {
        setModalState(null);
    };

    const handleCreateGoal = async (formValues: GoalFormValues) => {
        if (!permissions.canCreateGoals) {
            return;
        }

        try {
            const createdGoal = await createGoalRequest(
                createGoalPayloadFromFormValues(formValues),
            );
            setGoals((current) => [createdGoal, ...current]);
            setModalState(null);
        } catch (error) {
            console.error('Failed to create goal:', error);
            showAlert('error', 'Failed to create goal.');
        }
    };

    const handleUpdateGoal = async (formValues: GoalFormValues) => {
        if (!modalState || modalState.mode !== 'edit' || !permissions.canEditGoalDetails) {
            return;
        }

        try {
            const updatedGoal = await updateGoalRequest(
                modalState.goal.id,
                createGoalPayloadFromFormValues(formValues),
            );
            setGoals((current) =>
                current.map((goal) => (goal.id === updatedGoal.id ? updatedGoal : goal)),
            );
            setModalState(null);
        } catch (error) {
            console.error('Failed to update goal:', error);
            showAlert('error', 'Failed to update goal.');
        }
    };

    const handleDeleteGoalConfirmed = async (goalId: string) => {
        if (!permissions.canDeleteGoals) {
            return;
        }

        try {
            await deleteGoalRequest(goalId);
            setGoals((current) => current.filter((goal) => goal.id !== goalId));
            setExpandedGoalIds((current) => {
                const nextExpandedGoalIds = new Set(current);
                nextExpandedGoalIds.delete(goalId);
                return nextExpandedGoalIds;
            });
            setModalState(null);
        } catch (error) {
            console.error('Failed to delete goal:', error);
            showAlert('error', 'Failed to delete goal.');
        }
    };

    const handleDeleteGoal = (goalId: string) => {
        if (!permissions.canDeleteGoals) {
            return;
        }

        showConfirm({
            title: 'Delete Goal',
            message: 'Are you sure you want to delete this goal?',
            type: 'warning',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            onConfirm: () => {
                void handleDeleteGoalConfirmed(goalId);
            },
        });
    };

    const handleMilestoneToggle = async (
        goal: GoalData,
        milestoneId: string,
        nextCompleted: boolean,
    ) => {
        if (!permissions.canUpdateMilestones) {
            return;
        }

        try {
            const updatedMilestones = goal.milestones.map((milestone) =>
                milestone.id === milestoneId
                    ? {
                        ...milestone,
                        completed: nextCompleted,
                        completedAt: nextCompleted ? new Date().toISOString() : undefined,
                    }
                    : milestone,
            );

            const updatedGoal = await updateGoalRequest(
                goal.id,
                createGoalMutationPayloadFromGoal(goal, {
                    milestones: updatedMilestones,
                }),
            );

            setGoals((current) =>
                current.map((currentGoal) =>
                    currentGoal.id === updatedGoal.id ? updatedGoal : currentGoal,
                ),
            );
        } catch (error) {
            console.error('Failed to update milestone completion:', error);
            showAlert('error', 'Failed to update milestone completion.');
        }
    };

    return (
        <div className="relative min-h-[85vh] overflow-hidden rounded-3xl bg-slate-50 p-2 transition-colors duration-300 dark:bg-slate-900 sm:p-4">
            <div className="pointer-events-none absolute left-[-10%] top-[-5%] h-72 w-72 rounded-full bg-red-500/15 blur-[90px] dark:bg-red-400/20" />
            <div className="pointer-events-none absolute bottom-[-15%] right-[-5%] h-80 w-80 rounded-full bg-blue-500/10 blur-[110px] dark:bg-blue-400/10" />

            <div className="relative z-10 mx-auto flex h-full max-w-[96rem] flex-col gap-2 custom-scrollbar">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                        Goal Meeting
                    </h1>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {permissions.canCreateGoals && (
                            <button
                                type="button"
                                onClick={handleOpenCreateModal}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Create Goal</span>
                            </button>
                        )}
                    </div>
                </div>

                <GoalViewControls
                    searchQuery={searchQuery}
                    sortOption={sortOption}
                    filters={filters}
                    assigneeOptions={employeeOptions}
                    onSearchChange={setSearchQuery}
                    onSortChange={setSortOption}
                    onGoalStatusChange={(value) =>
                        setFilters((current) => ({
                            ...current,
                            goalStatus: value,
                        }))
                    }
                    onAssigneeChange={(value) =>
                        setFilters((current) => ({
                            ...current,
                            assignedUser: value,
                        }))
                    }
                />

                {isLoading && goals.length === 0 ? (
                    <section className="rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Loading goals...
                        </p>
                    </section>
                ) : (
                    <GoalMeetingTable
                        goals={visibleGoals}
                        expandedGoalIds={expandedGoalIds}
                        canEditGoal={permissions.canEditGoalDetails}
                        canUpdateMilestones={permissions.canUpdateMilestones}
                        onEditGoal={handleOpenEditModal}
                        onToggleExpand={handleToggleExpand}
                        onToggleMilestone={handleMilestoneToggle}
                    />
                )}
            </div>

            <GoalModal
                isOpen={Boolean(modalState)}
                mode={modalState?.mode ?? 'create'}
                goal={modalState?.goal ?? null}
                role={currentUserRole}
                employeeOptions={employeeOptions}
                onClose={handleCloseModal}
                onCreateGoal={handleCreateGoal}
                onUpdateGoal={handleUpdateGoal}
                onDelete={handleDeleteGoal}
            />
        </div>
    );
}
