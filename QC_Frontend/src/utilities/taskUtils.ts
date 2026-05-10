import { type TaskCardData, type TaskPriority, type TaskStatus } from '../components/TaskCard';

export type TaskSortOption = 'createdAt' | 'priority' | 'deadline';
export type TaskPriorityFilter = TaskPriority | 'All';

export interface TaskFilters {
    priority: TaskPriorityFilter;
    assignedUser: string;
}

export const ALL_ASSIGNEES_FILTER_VALUE = 'All';
export const DEFAULT_TASK_SORT_OPTION: TaskSortOption = 'createdAt';
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

const compareByCreatedAt = (left: TaskCardData, right: TaskCardData) =>
    (getDateTimeValue(right.createdAt) ?? 0) - (getDateTimeValue(left.createdAt) ?? 0);

const compareByPriority = (left: TaskCardData, right: TaskCardData) =>
    PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];

const compareByDeadline = (left: TaskCardData, right: TaskCardData) => {
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

    return leftDeadline - rightDeadline;
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
        if (sortOption === 'priority') {
            return compareByPriority(left, right) || compareByCreatedAt(left, right);
        }

        if (sortOption === 'deadline') {
            return compareByDeadline(left, right) || compareByCreatedAt(left, right);
        }

        return compareByCreatedAt(left, right);
    });
};
