import {
    getGoalStatus,
    normalizeGoalDate,
    type GoalData,
    type GoalMilestone,
} from './goalUtils';
import { normalizeAssignedTo } from './taskAssignments';

const GOAL_API_BASE_URL = `${import.meta.env.VITE_API_URL}/goals`;

interface GoalApiMilestoneRecord {
    id: string;
    title: string;
    targetDate: string;
    completed: boolean;
    completedAt?: string | null;
}

interface GoalApiRecord {
    id: string;
    title: string;
    assignedTo: string[];
    createdAt: string;
    milestones: GoalApiMilestoneRecord[];
    goalStatus?: GoalData['goalStatus'];
}

export interface GoalMutationMilestonePayload {
    id: string;
    title: string;
    targetDate: string;
    completed: boolean;
    completedAt?: string;
}

export interface GoalMutationPayload {
    title: string;
    assignedTo: string[];
    milestones: GoalMutationMilestonePayload[];
}

const normalizeMilestone = (milestone: GoalApiMilestoneRecord): GoalMilestone => ({
    id: milestone.id,
    title: milestone.title,
    targetDate: normalizeGoalDate(milestone.targetDate),
    completed: milestone.completed,
    completedAt: milestone.completedAt ?? undefined,
});

const normalizeGoal = (goal: GoalApiRecord): GoalData => {
    const normalizedGoal: GoalData = {
        id: goal.id,
        title: goal.title,
        assignedTo: normalizeAssignedTo(goal.assignedTo),
        createdAt: goal.createdAt,
        milestones: goal.milestones.map(normalizeMilestone),
        goalStatus: '',
    };

    return {
        ...normalizedGoal,
        goalStatus: getGoalStatus(normalizedGoal),
    };
};

const buildGoalRequestBody = (goal: GoalMutationPayload) => ({
    ...goal,
    title: goal.title.trim(),
    assignedTo: normalizeAssignedTo(goal.assignedTo),
    milestones: goal.milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title.trim(),
        targetDate: `${milestone.targetDate}T00:00:00.000Z`,
        completed: milestone.completed,
        completedAt: milestone.completedAt ?? null,
    })),
});

export const createGoalMutationPayloadFromGoal = (
    goal: GoalData,
    overrides: Partial<GoalMutationPayload> = {},
): GoalMutationPayload => {
    const payload: GoalMutationPayload = {
        title: goal.title,
        assignedTo: [...goal.assignedTo],
        milestones: goal.milestones.map((milestone) => ({
            ...milestone,
        })),
    };

    if ('title' in overrides) {
        payload.title = overrides.title as GoalMutationPayload['title'];
    }

    if ('assignedTo' in overrides) {
        payload.assignedTo = overrides.assignedTo as GoalMutationPayload['assignedTo'];
    }

    if ('milestones' in overrides) {
        payload.milestones = overrides.milestones as GoalMutationPayload['milestones'];
    }

    return payload;
};

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

export async function fetchGoals(): Promise<GoalData[]> {
    const response = await fetch(GOAL_API_BASE_URL);
    const goals = await readJsonResponse<GoalApiRecord[]>(response);
    return goals.map(normalizeGoal);
}

export async function createGoal(goal: GoalMutationPayload): Promise<GoalData> {
    const response = await fetch(GOAL_API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildGoalRequestBody(goal)),
    });

    const createdGoal = await readJsonResponse<GoalApiRecord>(response);
    return normalizeGoal(createdGoal);
}

export async function updateGoal(
    goalId: string,
    goal: GoalMutationPayload,
): Promise<GoalData> {
    const response = await fetch(`${GOAL_API_BASE_URL}/${goalId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildGoalRequestBody(goal)),
    });

    const updatedGoal = await readJsonResponse<GoalApiRecord>(response);
    return normalizeGoal(updatedGoal);
}

export async function deleteGoal(goalId: string): Promise<void> {
    const response = await fetch(`${GOAL_API_BASE_URL}/${goalId}`, {
        method: 'DELETE',
    });

    await readJsonResponse(response);
}
