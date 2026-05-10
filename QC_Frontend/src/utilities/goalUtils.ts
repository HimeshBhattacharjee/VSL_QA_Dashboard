import { formatAssignedToGroupLabel, getAssignedToGroupKey } from './taskAssignments';

export type GoalStatus = '' | 'On Track' | 'Off Track';
export type MilestoneStatus = 'Done' | 'Not Done' | 'Pending';
export type GoalSortOption = 'createdAt' | 'goalStatus' | 'targetDate';
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
export const DEFAULT_GOAL_SORT_OPTION: GoalSortOption = 'createdAt';
export const DEFAULT_GOAL_FILTERS: GoalFilters = {
    goalStatus: 'All',
    assignedUser: ALL_GOAL_ASSIGNEES_FILTER_VALUE,
};

const GOAL_STATUS_WEIGHT: Record<Exclude<GoalStatus, ''>, number> = {
    'Off Track': 3,
    'On Track': 2,
};

const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getDateKey = (value: string | Date) => {
    const parsedDate = value instanceof Date ? value : new Date(value);
    return formatDateKey(parsedDate);
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

        return getDateKey(milestone.completedAt) <= milestone.targetDate ? 'Done' : 'Not Done';
    }

    return milestone.targetDate < todayKey ? 'Not Done' : 'Pending';
};

export const getGoalStatus = (
    goal: Pick<GoalData, 'milestones'>,
    todayKey = getDateKey(new Date()),
): GoalStatus => {
    if (goal.milestones.length === 0) {
        return '';
    }

    let hasReachedEvaluationWindow = false;

    for (const milestone of goal.milestones) {
        const isDueOrCompleted = milestone.targetDate <= todayKey || milestone.completed;
        if (isDueOrCompleted) {
            hasReachedEvaluationWindow = true;
        }

        if (milestone.completedAt && getDateKey(milestone.completedAt) > milestone.targetDate) {
            return 'Off Track';
        }

        if (milestone.targetDate < todayKey && !milestone.completed) {
            return 'Off Track';
        }
    }

    return hasReachedEvaluationWindow ? 'On Track' : '';
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

    return 'border-slate-200 bg-slate-100 text-slate-600';
};

export const getMilestoneStatusClasses = (status: MilestoneStatus) => {
    if (status === 'Done') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    if (status === 'Not Done') {
        return 'border-rose-200 bg-rose-50 text-rose-700';
    }

    return 'border-amber-200 bg-amber-50 text-amber-700';
};

export const formatGoalDate = (
    value: string,
    options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    },
) =>
    new Intl.DateTimeFormat('en-IN', options).format(new Date(value));

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

const compareByCreatedAt = (left: GoalData, right: GoalData) =>
    (getDateTimeValue(right.createdAt) ?? 0) - (getDateTimeValue(left.createdAt) ?? 0);

const compareByGoalStatus = (left: GoalData, right: GoalData) => {
    const leftWeight = left.goalStatus ? GOAL_STATUS_WEIGHT[left.goalStatus] : 1;
    const rightWeight = right.goalStatus ? GOAL_STATUS_WEIGHT[right.goalStatus] : 1;
    return rightWeight - leftWeight;
};

const compareByTargetDate = (left: GoalData, right: GoalData) => {
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

    return leftTargetDate.localeCompare(rightTargetDate);
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
        if (sortOption === 'goalStatus') {
            return compareByGoalStatus(left, right) || compareByCreatedAt(left, right);
        }

        if (sortOption === 'targetDate') {
            return compareByTargetDate(left, right) || compareByCreatedAt(left, right);
        }

        return compareByCreatedAt(left, right);
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
