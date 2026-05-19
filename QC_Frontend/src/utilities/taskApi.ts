import { type TaskCardData } from '../components/TaskCard';
import { toISTStartOfDayIso } from './istDate';
import { normalizeAssignedTo } from './taskAssignments';

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
    visibleInMeeting?: boolean;
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
    visibleInMeeting: boolean;
    deadline?: string;
    remarks?: string;
}

export interface TaskCreatePayload extends TaskMutationPayload {
    createdAt?: string;
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
        visibleInMeeting: task.visibleInMeeting,
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

    if ('visibleInMeeting' in overrides) {
        payload.visibleInMeeting = overrides.visibleInMeeting as TaskMutationPayload['visibleInMeeting'];
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
    assignedTo: normalizeAssignedTo(task.assignedTo),
    visibleInMeeting: task.visibleInMeeting ?? true,
    deadline: normalizeDeadline(task.deadline),
    remarks: task.remarks ?? undefined,
});

const buildTaskRequestBody = (task: TaskMutationPayload) => ({
    ...task,
    title: task.title.trim(),
    description: task.description.trim(),
    assignedBy: task.assignedBy.trim(),
    assignedTo: normalizeAssignedTo(task.assignedTo),
    remarks: task.remarks?.trim() || null,
    deadline: task.deadline ? `${task.deadline}T00:00:00.000Z` : null,
});

const getTaskRequestHeaders = (includeContentType = false) => {
    const headers: Record<string, string> = {
        'X-Employee-Id': sessionStorage.getItem('employeeId') || '',
        'X-Employee-Name': sessionStorage.getItem('username') || '',
        'X-User-Role': sessionStorage.getItem('userRole') || '',
    };

    if (includeContentType) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
};

const buildTaskCreateRequestBody = (task: TaskCreatePayload) => ({
    ...buildTaskRequestBody(task),
    createdAt: task.createdAt ? toISTStartOfDayIso(task.createdAt) : undefined,
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
    const response = await fetch(TASK_API_BASE_URL, {
        headers: getTaskRequestHeaders(),
    });
    const tasks = await readJsonResponse<TaskApiRecord[]>(response);
    return tasks.map(normalizeTask);
}

export async function createTask(task: TaskCreatePayload): Promise<TaskCardData> {
    const response = await fetch(TASK_API_BASE_URL, {
        method: 'POST',
        headers: {
            ...getTaskRequestHeaders(true),
        },
        body: JSON.stringify(buildTaskCreateRequestBody(task)),
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
            ...getTaskRequestHeaders(true),
        },
        body: JSON.stringify(buildTaskRequestBody(task)),
    });

    const updatedTask = await readJsonResponse<TaskApiRecord>(response);
    return normalizeTask(updatedTask);
}

export async function updateTaskVisibility(
    taskId: string,
    visibleInMeeting: boolean,
): Promise<TaskCardData> {
    const response = await fetch(`${TASK_API_BASE_URL}/${taskId}/visibility`, {
        method: 'PATCH',
        headers: getTaskRequestHeaders(true),
        body: JSON.stringify({ visibleInMeeting }),
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
