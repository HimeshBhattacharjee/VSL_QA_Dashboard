import { formatAssignedToGroupLabel, getAssignedToGroupKey } from './taskAssignments';
import { formatISTDate, getISTDateKey } from './istDate';

export type GoalStatus =
    | ''
    | 'On Track'
    | 'Off Track'
    | 'On Track with Delay'
    | 'Done'
    | 'Not Done'
    | 'Dropped';
export type MilestoneStatus = 'Done' | 'Done (Delayed)' | 'Not Started' | 'Overdue';
export type GoalSortOption =
    | 'createdAtAsc'
    | 'createdAtDesc'
    | 'goalStatusAsc'
    | 'goalStatusDesc'
    | 'targetDateAsc'
    | 'targetDateDesc';
export type GoalStatusFilter = GoalStatus | 'All' | '__EMPTY__';
export type GoalQuarterLifecycle = 'past' | 'active' | 'upcoming' | 'future';

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
    financialYear: string;
    quarter: 1 | 2 | 3 | 4;
    isDropped: boolean;
    droppedAt?: string;
    droppedBy?: string;
    completionPercentage: number;
    parentGoalId?: string;
    originGoalId?: string;
    carryForwardSourceId?: string;
    carryForwardEligible: boolean;
    quarterLifecycle: GoalQuarterLifecycle;
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
export const GOAL_PLANNING_WINDOW_DAYS = 7;
export const GOAL_MEETING_START_FINANCIAL_YEAR = 2026;

const GOAL_STATUS_WEIGHT: Record<Exclude<GoalStatus, ''>, number> = {
    Dropped: 7,
    'Not Done': 6,
    'Off Track': 5,
    'On Track with Delay': 4,
    'On Track': 3,
    Done: 2,
};

export interface FinancialYearQuarter {
    financialYear: string;
    quarter: 1 | 2 | 3 | 4;
    label: string;
    isLocked: boolean;
    lifecycle: GoalQuarterLifecycle;
    startsOn: string;
}

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

export const getFinancialYearStart = (value = new Date()) => {
    const month = value.getMonth() + 1;
    return month >= 4 ? value.getFullYear() : value.getFullYear() - 1;
};

export const formatFinancialYear = (startYear: number) =>
    `FY ${startYear}-${String(startYear + 1).slice(-2)}`;

export const parseFinancialYearStart = (financialYear: string) => {
    const startYear = Number(financialYear.replace('FY', '').trim().split('-')[0]);
    return Number.isFinite(startYear) ? startYear : getFinancialYearStart();
};

export const getQuarterStartDate = (financialYearStart: number, quarter: 1 | 2 | 3 | 4) => {
    if (quarter === 1) {
        return new Date(financialYearStart, 3, 1);
    }

    if (quarter === 2) {
        return new Date(financialYearStart, 6, 1);
    }

    if (quarter === 3) {
        return new Date(financialYearStart, 9, 1);
    }

    return new Date(financialYearStart + 1, 0, 1);
};

export const getQuarterEndDate = (financialYearStart: number, quarter: 1 | 2 | 3 | 4) => {
    if (quarter === 1) {
        return new Date(financialYearStart, 5, 30);
    }

    if (quarter === 2) {
        return new Date(financialYearStart, 8, 30);
    }

    if (quarter === 3) {
        return new Date(financialYearStart, 11, 31);
    }

    return new Date(financialYearStart + 1, 2, 31);
};

const startOfLocalDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate());

const addDays = (value: Date, days: number) => {
    const nextDate = new Date(value);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
};

export const getQuarterLifecycle = (
    financialYear: string,
    quarter: 1 | 2 | 3 | 4,
    today = new Date(),
): GoalQuarterLifecycle => {
    const financialYearStart = parseFinancialYearStart(financialYear);
    const todayStart = startOfLocalDay(today);
    const quarterStart = startOfLocalDay(getQuarterStartDate(financialYearStart, quarter));
    const quarterEnd = startOfLocalDay(getQuarterEndDate(financialYearStart, quarter));

    if (todayStart > quarterEnd) {
        return 'past';
    }

    if (todayStart >= quarterStart) {
        return 'active';
    }

    if (todayStart >= addDays(quarterStart, -GOAL_PLANNING_WINDOW_DAYS)) {
        return 'upcoming';
    }

    return 'future';
};

export const isQuarterOpenForPlanning = (quarter: Pick<FinancialYearQuarter, 'lifecycle'>) =>
    quarter.lifecycle === 'active' || quarter.lifecycle === 'upcoming';

export const getCurrentFinancialYearQuarter = (): FinancialYearQuarter => {
    const today = new Date();
    const financialYearStart = getFinancialYearStart(today);
    const financialYear = formatFinancialYear(financialYearStart);
    const month = today.getMonth() + 1;
    const quarter = (month >= 4 && month <= 6
        ? 1
        : month >= 7 && month <= 9
            ? 2
            : month >= 10 && month <= 12
                ? 3
                : 4) as 1 | 2 | 3 | 4;

    return {
        financialYear,
        quarter,
        label: `${financialYear} Q${quarter}`,
        isLocked: false,
        lifecycle: 'active',
        startsOn: getDateKey(getQuarterStartDate(financialYearStart, quarter)),
    };
};

export const getVisibleFinancialYearQuarters = (): FinancialYearQuarter[] => {
    const today = new Date();
    const currentFinancialYear = getFinancialYearStart(today);
    const lastVisibleFinancialYear = Math.max(
        currentFinancialYear + 1,
        GOAL_MEETING_START_FINANCIAL_YEAR,
    );
    const visibleFinancialYears = Array.from(
        {
            length: lastVisibleFinancialYear - GOAL_MEETING_START_FINANCIAL_YEAR + 1,
        },
        (_, index) => GOAL_MEETING_START_FINANCIAL_YEAR + index,
    );

    return visibleFinancialYears.flatMap((startYear) =>
        ([1, 2, 3, 4] as const).map((quarter) => {
            const financialYear = formatFinancialYear(startYear);
            const quarterStartDate = getQuarterStartDate(startYear, quarter);
            const lifecycle = getQuarterLifecycle(financialYear, quarter, today);

            return {
                financialYear,
                quarter,
                label: `${financialYear} Q${quarter}`,
                isLocked: lifecycle === 'future',
                lifecycle,
                startsOn: getDateKey(quarterStartDate),
            };
        }),
    );
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

export const getGoalStatusLabelWithProgress = (goal: Pick<GoalData, 'goalStatus' | 'completionPercentage'>) =>
    goal.goalStatus === 'Not Done'
        ? `Not Done (${goal.completionPercentage}%)`
        : getGoalStatusLabel(goal.goalStatus);

export const getGoalStatusClasses = (status: GoalStatus) => {
    if (status === 'Done') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    if (status === 'Dropped') {
        return 'border-slate-300 bg-slate-100 text-slate-700';
    }

    if (status === 'Not Done') {
        return 'border-rose-200 bg-rose-50 text-rose-700';
    }

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
