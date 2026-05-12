import { type TaskCardData, type TaskPriority, type TaskStatus } from '../components/TaskCard';

export type TaskSortOption =
    | 'createdAtAsc'
    | 'createdAtDesc'
    | 'priorityAsc'
    | 'priorityDesc'
    | 'deadlineAsc'
    | 'deadlineDesc';
export type TaskPriorityFilter = TaskPriority | 'All';

export interface TaskFilters {
    priority: TaskPriorityFilter;
    assignedUser: string;
}

export const ALL_ASSIGNEES_FILTER_VALUE = 'All';
export const DEFAULT_TASK_SORT_OPTION: TaskSortOption = 'createdAtAsc';
export const DEFAULT_TASK_FILTERS: TaskFilters = {
    priority: 'All',
    assignedUser: ALL_ASSIGNEES_FILTER_VALUE,
};

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
    High: 3,
    Medium: 2,
    Low: 1,
};

const getDateTimeValue = (value?: string) => {
    if (!value) {
        return null;
    }

    const parsedTime = new Date(value).getTime();
    return Number.isNaN(parsedTime) ? null : parsedTime;
};

const compareByCreatedAtAsc = (left: TaskCardData, right: TaskCardData) =>
    (getDateTimeValue(left.createdAt) ?? 0) - (getDateTimeValue(right.createdAt) ?? 0);

const compareByCreatedAtDesc = (left: TaskCardData, right: TaskCardData) =>
    compareByCreatedAtAsc(right, left);

const compareByPriority = (
    left: TaskCardData,
    right: TaskCardData,
    direction: 'asc' | 'desc',
) =>
    direction === 'asc'
        ? PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority]
        : PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];

const compareByDeadline = (
    left: TaskCardData,
    right: TaskCardData,
    direction: 'asc' | 'desc',
) => {
    const leftDeadline = getDateTimeValue(left.deadline);
    const rightDeadline = getDateTimeValue(right.deadline);

    if (leftDeadline === null && rightDeadline === null) {
        return 0;
    }

    if (leftDeadline === null) {
        return 1;
    }

    if (rightDeadline === null) {
        return -1;
    }

    return direction === 'asc'
        ? leftDeadline - rightDeadline
        : rightDeadline - leftDeadline;
};

const normalizeTaskSignature = (tasks: TaskCardData[]) =>
    [...tasks]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((task) => ({
            ...task,
            assignedTo: [...task.assignedTo],
        }));

export const getTasksByStatus = (tasks: TaskCardData[], status: TaskStatus) =>
    tasks.filter((task) => task.status === status);

export const moveTaskToStatus = (
    tasks: TaskCardData[],
    taskId: string,
    nextStatus: TaskStatus,
) =>
    tasks.map((task) =>
        task.id === taskId
            ? {
                ...task,
                status: nextStatus,
            }
            : task,
    );

export const areTasksEqual = (left: TaskCardData[], right: TaskCardData[]) =>
    JSON.stringify(normalizeTaskSignature(left)) === JSON.stringify(normalizeTaskSignature(right));

export const processTasks = (
    tasks: TaskCardData[],
    searchQuery: string,
    filters: TaskFilters,
    sortOption: TaskSortOption,
) => {
    const filteredTasks = tasks.filter((task) => {
        const matchesPriority = filters.priority === 'All' || task.priority === filters.priority;
        const matchesAssignedUser =
            filters.assignedUser === ALL_ASSIGNEES_FILTER_VALUE ||
            task.assignedTo.includes(filters.assignedUser);

        return matchesPriority && matchesAssignedUser;
    });

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const searchedTasks = normalizedSearchQuery
        ? filteredTasks.filter((task) =>
            task.title.toLowerCase().includes(normalizedSearchQuery) ||
            task.assignedTo.some((assignee) =>
                assignee.toLowerCase().includes(normalizedSearchQuery),
            ),
        )
        : filteredTasks;

    return [...searchedTasks].sort((left, right) => {
        if (sortOption === 'createdAtAsc') {
            return compareByCreatedAtAsc(left, right);
        }

        if (sortOption === 'createdAtDesc') {
            return compareByCreatedAtDesc(left, right);
        }

        if (sortOption === 'priorityAsc') {
            return compareByPriority(left, right, 'asc') || compareByCreatedAtAsc(left, right);
        }

        if (sortOption === 'priorityDesc') {
            return compareByPriority(left, right, 'desc') || compareByCreatedAtDesc(left, right);
        }

        if (sortOption === 'deadlineAsc') {
            return compareByDeadline(left, right, 'asc') || compareByCreatedAtAsc(left, right);
        }

        return compareByDeadline(left, right, 'desc') || compareByCreatedAtDesc(left, right);
    });
};
