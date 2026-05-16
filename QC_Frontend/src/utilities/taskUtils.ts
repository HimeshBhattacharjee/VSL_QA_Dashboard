import { type TaskCardData, type TaskPriority, type TaskStatus } from '../components/TaskCard';

export type TaskSortOption =
    | 'serialNumberAsc'
    | 'serialNumberDesc'
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
export const DEFAULT_TASK_SORT_OPTION: TaskSortOption = 'serialNumberAsc';
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

const compareBySerialNumber = (
    left: TaskCardData,
    right: TaskCardData,
    serialNumberByTaskId: Record<string, number>,
    direction: 'asc' | 'desc',
) => {
    const leftSerialNumber = serialNumberByTaskId[left.id] ?? Number.MAX_SAFE_INTEGER;
    const rightSerialNumber = serialNumberByTaskId[right.id] ?? Number.MAX_SAFE_INTEGER;

    return direction === 'asc'
        ? leftSerialNumber - rightSerialNumber
        : rightSerialNumber - leftSerialNumber;
};

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

export const getTaskSerialNumberMap = (tasks: TaskCardData[]) => {
    const sortedTasks = [...tasks].sort(
        (left, right) => compareByCreatedAtAsc(left, right) || left.id.localeCompare(right.id),
    );

    // Serial numbers are based on the complete task history, not filtered visible rows.
    return sortedTasks.reduce<Record<string, number>>((serialMap, task, index) => {
        serialMap[task.id] = index + 1;
        return serialMap;
    }, {});
};

export const processTasks = (
    tasks: TaskCardData[],
    searchQuery: string,
    filters: TaskFilters,
    sortOption: TaskSortOption,
    serialNumberByTaskId: Record<string, number> = getTaskSerialNumberMap(tasks),
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
        if (sortOption === 'serialNumberAsc') {
            return compareBySerialNumber(left, right, serialNumberByTaskId, 'asc');
        }

        if (sortOption === 'serialNumberDesc') {
            return compareBySerialNumber(left, right, serialNumberByTaskId, 'desc');
        }

        if (sortOption === 'priorityAsc') {
            return (
                compareByPriority(left, right, 'asc') ||
                compareBySerialNumber(left, right, serialNumberByTaskId, 'asc')
            );
        }

        if (sortOption === 'priorityDesc') {
            return (
                compareByPriority(left, right, 'desc') ||
                compareBySerialNumber(left, right, serialNumberByTaskId, 'desc')
            );
        }

        if (sortOption === 'deadlineAsc') {
            return (
                compareByDeadline(left, right, 'asc') ||
                compareBySerialNumber(left, right, serialNumberByTaskId, 'asc')
            );
        }

        return (
            compareByDeadline(left, right, 'desc') ||
            compareBySerialNumber(left, right, serialNumberByTaskId, 'desc')
        );
    });
};
