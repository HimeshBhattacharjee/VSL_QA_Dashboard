import {
    getCurrentFinancialYearQuarter,
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
    financialYear?: string;
    quarter?: GoalData['quarter'];
    isDropped?: boolean;
    droppedAt?: string | null;
    droppedBy?: string | null;
    completionPercentage?: number;
    parentGoalId?: string | null;
    originGoalId?: string | null;
    carryForwardSourceId?: string | null;
    carryForwardEligible?: boolean;
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
    financialYear?: string;
    quarter?: GoalData['quarter'];
}

const normalizeMilestone = (milestone: GoalApiMilestoneRecord): GoalMilestone => ({
    id: milestone.id,
    title: milestone.title,
    targetDate: normalizeGoalDate(milestone.targetDate),
    completed: milestone.completed,
    completedAt: milestone.completedAt ?? undefined,
});

const normalizeGoal = (goal: GoalApiRecord): GoalData => {
    const fallbackQuarter = getCurrentFinancialYearQuarter();
    const normalizedGoal: GoalData = {
        id: goal.id,
        title: goal.title,
        assignedTo: normalizeAssignedTo(goal.assignedTo),
        createdAt: goal.createdAt,
        milestones: goal.milestones.map(normalizeMilestone),
        goalStatus: goal.goalStatus ?? '',
        financialYear: goal.financialYear ?? fallbackQuarter.financialYear,
        quarter: goal.quarter ?? fallbackQuarter.quarter,
        isDropped: goal.isDropped ?? false,
        droppedAt: goal.droppedAt ?? undefined,
        droppedBy: goal.droppedBy ?? undefined,
        completionPercentage: goal.completionPercentage ?? 0,
        parentGoalId: goal.parentGoalId ?? undefined,
        originGoalId: goal.originGoalId ?? undefined,
        carryForwardSourceId: goal.carryForwardSourceId ?? undefined,
        carryForwardEligible: goal.carryForwardEligible ?? false,
    };

    return normalizedGoal;
};

const buildGoalRequestBody = (goal: GoalMutationPayload) => ({
    ...goal,
    title: goal.title.trim(),
    assignedTo: normalizeAssignedTo(goal.assignedTo),
    financialYear: goal.financialYear,
    quarter: goal.quarter,
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
        financialYear: goal.financialYear,
        quarter: goal.quarter,
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

    if ('financialYear' in overrides) {
        payload.financialYear = overrides.financialYear as GoalMutationPayload['financialYear'];
    }

    if ('quarter' in overrides) {
        payload.quarter = overrides.quarter as GoalMutationPayload['quarter'];
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

export async function dropGoal(
    goalId: string,
    actorRole: string,
    droppedBy?: string,
): Promise<GoalData> {
    const droppedByQuery = droppedBy ? `?dropped_by=${encodeURIComponent(droppedBy)}` : '';
    const response = await fetch(`${GOAL_API_BASE_URL}/${goalId}/drop${droppedByQuery}`, {
        method: 'POST',
        headers: {
            'X-User-Role': actorRole,
        },
    });

    const droppedGoal = await readJsonResponse<GoalApiRecord>(response);
    return normalizeGoal(droppedGoal);
}

export async function reviveGoal(goalId: string, actorRole: string): Promise<GoalData> {
    const response = await fetch(`${GOAL_API_BASE_URL}/${goalId}/revive`, {
        method: 'POST',
        headers: {
            'X-User-Role': actorRole,
        },
    });

    const revivedGoal = await readJsonResponse<GoalApiRecord>(response);
    return normalizeGoal(revivedGoal);
}

export async function carryForwardGoal(goalId: string, actorRole: string): Promise<GoalData> {
    const response = await fetch(`${GOAL_API_BASE_URL}/${goalId}/carry-forward`, {
        method: 'POST',
        headers: {
            'X-User-Role': actorRole,
        },
    });

    const carriedForwardGoal = await readJsonResponse<GoalApiRecord>(response);
    return normalizeGoal(carriedForwardGoal);
}
