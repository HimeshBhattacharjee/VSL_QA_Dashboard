import { formatAssignedToGroupLabel, getAssignedToGroupKey } from './taskAssignments';
import { formatISTDate, getISTDateKey } from './istDate';

export type GoalStatus = '' | 'On Track' | 'Off Track' | 'On Track with Delay';
export type MilestoneStatus = 'Done' | 'Done (Delayed)' | 'Not Started' | 'Overdue';
export type GoalSortOption =
    | 'createdAtAsc'
    | 'createdAtDesc'
    | 'goalStatusAsc'
    | 'goalStatusDesc'
    | 'targetDateAsc'
    | 'targetDateDesc';
export type GoalStatusFilter = GoalStatus | 'All' | '__EMPTY__';

export interface GoalMilestone {
    id: string;
    title: string;
    targetDate: string;
    completed: boolean;
    completedAt?: string;
}

export interface GoalData {
    id: string;
    title: string;
    assignedTo: string[];
    createdAt: string;
    milestones: GoalMilestone[];
    goalStatus: GoalStatus;
}

export interface GoalFilters {
    goalStatus: GoalStatusFilter;
    assignedUser: string;
}

export interface OwnerGoalGroup {
    key: string;
    label: string;
    goals: GoalData[];
}

export const ALL_GOAL_ASSIGNEES_FILTER_VALUE = 'All';
export const EMPTY_GOAL_STATUS_FILTER_VALUE = '__EMPTY__';
export const DEFAULT_GOAL_SORT_OPTION: GoalSortOption = 'createdAtDesc';
export const DEFAULT_GOAL_FILTERS: GoalFilters = {
    goalStatus: 'All',
    assignedUser: ALL_GOAL_ASSIGNEES_FILTER_VALUE,
};

const GOAL_STATUS_WEIGHT: Record<Exclude<GoalStatus, ''>, number> = {
    'Off Track': 4,
    'On Track with Delay': 3,
    'On Track': 2,
};

export const getDateKey = (value: string | Date) => {
    return getISTDateKey(value);
};

const compareIsoDates = (left?: string, right?: string) => {
    if (!left && !right) {
        return 0;
    }

    if (!left) {
        return 1;
    }

    if (!right) {
        return -1;
    }

    return left.localeCompare(right);
};

const getDateTimeValue = (value?: string) => {
    if (!value) {
        return null;
    }

    const parsedTime = new Date(value).getTime();
    return Number.isNaN(parsedTime) ? null : parsedTime;
};

export const normalizeGoalDate = (value?: string | null) => {
    if (!value) {
        return '';
    }

    return value.length >= 10 ? value.slice(0, 10) : value;
};

export const getMilestoneStatus = (
    milestone: GoalMilestone,
    todayKey = getDateKey(new Date()),
): MilestoneStatus => {
    if (milestone.completed) {
        if (!milestone.completedAt) {
            return 'Done';
        }

        return getDateKey(milestone.completedAt) <= milestone.targetDate
            ? 'Done'
            : 'Done (Delayed)';
    }

    return milestone.targetDate < todayKey ? 'Overdue' : 'Not Started';
};

export const getGoalStatus = (
    goal: Pick<GoalData, 'milestones'>,
    todayKey = getDateKey(new Date()),
): GoalStatus => {
    if (goal.milestones.length === 0) {
        return '';
    }

    let hasCompletedMilestone = false;
    let hasDelayedCompletion = false;

    for (const milestone of goal.milestones) {
        if (milestone.completed) {
            hasCompletedMilestone = true;
            if (
                milestone.completedAt &&
                getDateKey(milestone.completedAt) > milestone.targetDate
            ) {
                hasDelayedCompletion = true;
            }
            continue;
        }

        if (milestone.targetDate < todayKey && !milestone.completed) {
            return 'Off Track';
        }
    }

    if (hasDelayedCompletion) {
        return 'On Track with Delay';
    }

    if (hasCompletedMilestone) {
        return 'On Track';
    }

    return '';
};

export const getCompletedMilestoneCount = (goal: Pick<GoalData, 'milestones'>) =>
    goal.milestones.filter((milestone) => milestone.completed).length;

export const getGoalProgressSummary = (goal: Pick<GoalData, 'milestones'>) =>
    `${getCompletedMilestoneCount(goal)}/${goal.milestones.length} milestones completed`;

export const getGoalProgressPercentage = (goal: Pick<GoalData, 'milestones'>) => {
    if (goal.milestones.length === 0) {
        return 0;
    }

    return Math.round((getCompletedMilestoneCount(goal) / goal.milestones.length) * 100);
};

export const getGoalStatusLabel = (status: GoalStatus) => (status ? status : 'Not Started');

export const getGoalStatusClasses = (status: GoalStatus) => {
    if (status === 'Off Track') {
        return 'border-rose-200 bg-rose-50 text-rose-700';
    }

    if (status === 'On Track') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    if (status === 'On Track with Delay') {
        return 'border-amber-200 bg-amber-50 text-amber-700';
    }

    return 'border-slate-200 bg-slate-100 text-slate-600';
};

export const getMilestoneStatusClasses = (status: MilestoneStatus) => {
    if (status === 'Done') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    if (status === 'Done (Delayed)') {
        return 'border-amber-200 bg-amber-50 text-amber-700';
    }

    if (status === 'Overdue') {
        return 'border-rose-200 bg-rose-50 text-rose-700';
    }

    return 'border-slate-200 bg-slate-100 text-slate-600';
};

export const formatGoalDate = (
    value: string,
    options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    },
) => formatISTDate(value, options);

export const getGoalTargetDate = (goal: Pick<GoalData, 'milestones'>) => {
    const targetDates = goal.milestones
        .map((milestone) => milestone.targetDate)
        .filter(Boolean)
        .sort(compareIsoDates);

    return targetDates[0] ?? '';
};

export const getNextMilestoneTargetDate = (goal: Pick<GoalData, 'milestones'>) => {
    const openMilestones = goal.milestones
        .filter((milestone) => !milestone.completed)
        .map((milestone) => milestone.targetDate)
        .filter(Boolean)
        .sort(compareIsoDates);

    return openMilestones[0] ?? getGoalTargetDate(goal);
};

export const normalizeGoalSignature = (goals: GoalData[]) =>
    [...goals]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((goal) => ({
            ...goal,
            assignedTo: [...goal.assignedTo],
            milestones: [...goal.milestones].sort((left, right) =>
                left.id.localeCompare(right.id),
            ),
        }));

export const areGoalsEqual = (left: GoalData[], right: GoalData[]) =>
    JSON.stringify(normalizeGoalSignature(left)) === JSON.stringify(normalizeGoalSignature(right));

const compareByCreatedAtAsc = (left: GoalData, right: GoalData) =>
    (getDateTimeValue(left.createdAt) ?? 0) - (getDateTimeValue(right.createdAt) ?? 0);

const compareByCreatedAtDesc = (left: GoalData, right: GoalData) =>
    compareByCreatedAtAsc(right, left);

const compareByGoalStatus = (
    left: GoalData,
    right: GoalData,
    direction: 'asc' | 'desc',
) => {
    const leftWeight = left.goalStatus ? GOAL_STATUS_WEIGHT[left.goalStatus] : 1;
    const rightWeight = right.goalStatus ? GOAL_STATUS_WEIGHT[right.goalStatus] : 1;
    return direction === 'asc' ? leftWeight - rightWeight : rightWeight - leftWeight;
};

const compareByTargetDate = (
    left: GoalData,
    right: GoalData,
    direction: 'asc' | 'desc',
) => {
    const leftTargetDate = getGoalTargetDate(left);
    const rightTargetDate = getGoalTargetDate(right);

    if (!leftTargetDate && !rightTargetDate) {
        return 0;
    }

    if (!leftTargetDate) {
        return 1;
    }

    if (!rightTargetDate) {
        return -1;
    }

    return direction === 'asc'
        ? leftTargetDate.localeCompare(rightTargetDate)
        : rightTargetDate.localeCompare(leftTargetDate);
};

export const processGoals = (
    goals: GoalData[],
    searchQuery: string,
    filters: GoalFilters,
    sortOption: GoalSortOption,
) => {
    const filteredGoals = goals.filter((goal) => {
        const matchesGoalStatus =
            filters.goalStatus === 'All' ||
            (filters.goalStatus === EMPTY_GOAL_STATUS_FILTER_VALUE
                ? goal.goalStatus === ''
                : goal.goalStatus === filters.goalStatus);
        const matchesAssignedUser =
            filters.assignedUser === ALL_GOAL_ASSIGNEES_FILTER_VALUE ||
            goal.assignedTo.includes(filters.assignedUser);

        return matchesGoalStatus && matchesAssignedUser;
    });

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const searchedGoals = normalizedSearchQuery
        ? filteredGoals.filter((goal) =>
            goal.title.toLowerCase().includes(normalizedSearchQuery) ||
            goal.assignedTo.some((assignee) =>
                assignee.toLowerCase().includes(normalizedSearchQuery),
            ),
        )
        : filteredGoals;

    return [...searchedGoals].sort((left, right) => {
        if (sortOption === 'createdAtAsc') {
            return compareByCreatedAtAsc(left, right);
        }

        if (sortOption === 'createdAtDesc') {
            return compareByCreatedAtDesc(left, right);
        }

        if (sortOption === 'goalStatusAsc') {
            return compareByGoalStatus(left, right, 'asc') || compareByCreatedAtAsc(left, right);
        }

        if (sortOption === 'goalStatusDesc') {
            return compareByGoalStatus(left, right, 'desc') || compareByCreatedAtDesc(left, right);
        }

        if (sortOption === 'targetDateAsc') {
            return compareByTargetDate(left, right, 'asc') || compareByCreatedAtAsc(left, right);
        }

        return compareByTargetDate(left, right, 'desc') || compareByCreatedAtDesc(left, right);
    });
};

export const getOwnerGroupLabel = (assignedTo: string[]) => {
    return formatAssignedToGroupLabel(assignedTo);
};

export const groupGoalsByOwner = (goals: GoalData[]): OwnerGoalGroup[] => {
    const groupedMap = new Map<string, OwnerGoalGroup>();

    for (const goal of goals) {
        const key = getAssignedToGroupKey(goal.assignedTo);
        const existingGroup = groupedMap.get(key);

        if (existingGroup) {
            existingGroup.goals.push(goal);
            continue;
        }

        groupedMap.set(key, {
            key,
            label: getOwnerGroupLabel(goal.assignedTo),
            goals: [goal],
        });
    }

    return Array.from(groupedMap.values()).sort(
        (left, right) =>
            left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }) ||
            left.key.localeCompare(right.key),
    );
};
