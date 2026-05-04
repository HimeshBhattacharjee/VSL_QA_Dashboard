import { type TaskCardData } from '../components/TaskCard';

const TASK_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/tasks';
export const FIXED_TASK_ASSIGNED_BY = 'Sanjit Basu';

interface TaskApiRecord {
    id: string;
    title: string;
    description: string;
    assignedTo: string[];
    assignedBy: string;
    priority: TaskCardData['priority'];
    status: TaskCardData['status'];
    deadline?: string | null;
    remarks?: string | null;
    createdAt: string;
}

export interface TaskMutationPayload {
    title: string;
    description: string;
    assignedTo: string[];
    assignedBy: string;
    priority: TaskCardData['priority'];
    status: TaskCardData['status'];
    deadline?: string;
    remarks?: string;
}

export const createTaskMutationPayloadFromTask = (
    task: TaskCardData,
    overrides: Partial<TaskMutationPayload> = {},
): TaskMutationPayload => {
    const payload: TaskMutationPayload = {
        title: task.title,
        description: task.description,
        assignedTo: [...task.assignedTo],
        assignedBy: FIXED_TASK_ASSIGNED_BY,
        priority: task.priority,
        status: task.status,
        deadline: task.deadline,
        remarks: task.remarks,
    };

    if ('title' in overrides) {
        payload.title = overrides.title as TaskMutationPayload['title'];
    }

    if ('description' in overrides) {
        payload.description = overrides.description as TaskMutationPayload['description'];
    }

    if ('assignedTo' in overrides) {
        payload.assignedTo = overrides.assignedTo as TaskMutationPayload['assignedTo'];
    }

    if ('assignedBy' in overrides) {
        payload.assignedBy = FIXED_TASK_ASSIGNED_BY;
    }

    if ('priority' in overrides) {
        payload.priority = overrides.priority as TaskMutationPayload['priority'];
    }

    if ('status' in overrides) {
        payload.status = overrides.status as TaskMutationPayload['status'];
    }

    if ('deadline' in overrides) {
        payload.deadline = overrides.deadline;
    }

    if ('remarks' in overrides) {
        payload.remarks = overrides.remarks;
    }

    return payload;
};

const normalizeDeadline = (value?: string | null) => {
    if (!value) {
        return undefined;
    }

    return value.length >= 10 ? value.slice(0, 10) : value;
};

const normalizeTask = (task: TaskApiRecord): TaskCardData => ({
    ...task,
    deadline: normalizeDeadline(task.deadline),
    remarks: task.remarks ?? undefined,
});

const buildTaskRequestBody = (task: TaskMutationPayload) => ({
    ...task,
    title: task.title.trim(),
    description: task.description.trim(),
    assignedBy: task.assignedBy.trim(),
    assignedTo: task.assignedTo,
    remarks: task.remarks?.trim() || null,
    deadline: task.deadline ? `${task.deadline}T00:00:00.000Z` : null,
});

async function readJsonResponse<T>(response: Response): Promise<T> {
    const responseText = await response.text();
    const responseData = responseText ? JSON.parse(responseText) : null;

    if (!response.ok) {
        const detail =
            typeof responseData?.detail === 'string'
                ? responseData.detail
                : `Request failed with status ${response.status}`;
        throw new Error(detail);
    }

    return responseData as T;
}

export async function fetchTasks(): Promise<TaskCardData[]> {
    const response = await fetch(TASK_API_BASE_URL);
    const tasks = await readJsonResponse<TaskApiRecord[]>(response);
    return tasks.map(normalizeTask);
}

export async function createTask(task: TaskMutationPayload): Promise<TaskCardData> {
    const response = await fetch(TASK_API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildTaskRequestBody(task)),
    });

    const createdTask = await readJsonResponse<TaskApiRecord>(response);
    return normalizeTask(createdTask);
}

export async function updateTask(
    taskId: string,
    task: TaskMutationPayload,
): Promise<TaskCardData> {
    const response = await fetch(`${TASK_API_BASE_URL}/${taskId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildTaskRequestBody(task)),
    });

    const updatedTask = await readJsonResponse<TaskApiRecord>(response);
    return normalizeTask(updatedTask);
}

export async function deleteTask(taskId: string): Promise<void> {
    const response = await fetch(`${TASK_API_BASE_URL}/${taskId}`, {
        method: 'DELETE',
    });

    await readJsonResponse(response);
}
