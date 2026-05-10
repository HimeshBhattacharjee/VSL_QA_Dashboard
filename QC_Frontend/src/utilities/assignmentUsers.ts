import {
    compareUserNamesByDisplayName,
    formatUserDisplayName,
    getUserInitials,
    sortNamesAlphabetically,
} from './taskAssignments';

export type AssignmentScope = 'daily' | 'goal';

export interface AssignmentUserRecord {
    id: string;
    name: string;
    employeeId: string;
    role: string;
    status?: string;
    avatar?: string | null;
}

export interface AssignmentUserOption {
    id: string;
    value: string;
    name: string;
    displayName: string;
    employeeId: string;
    role: string;
    avatar: string;
}

const USER_API_BASE_URL = `${import.meta.env.VITE_API_URL}/user`;
const EXCLUDED_ASSIGNMENT_USER_NAME = 'Sanjit Basu';
const EXCLUDED_ASSIGNMENT_USER_EMPLOYEE_ID = '400061';

const ASSIGNMENT_SCOPE_ROLES: Record<AssignmentScope, Set<string>> = {
    daily: new Set(['Manager', 'Supervisor']),
    goal: new Set(['Manager', 'Supervisor', 'Operator']),
};

const compareAssignmentUsersByName = (
    left: Pick<AssignmentUserOption, 'name'>,
    right: Pick<AssignmentUserOption, 'name'>,
) => compareUserNamesByDisplayName(left.name, right.name);

const isExcludedAssignmentUser = (user: Pick<AssignmentUserRecord, 'name' | 'employeeId'>) =>
    user.name.trim() === EXCLUDED_ASSIGNMENT_USER_NAME ||
    user.employeeId.trim() === EXCLUDED_ASSIGNMENT_USER_EMPLOYEE_ID;

const toAssignmentUserOption = (user: AssignmentUserRecord): AssignmentUserOption => {
    const name = user.name.trim();

    return {
        id: user.id,
        value: name,
        name,
        displayName: formatUserDisplayName(name),
        employeeId: user.employeeId.trim(),
        role: user.role.trim(),
        avatar: getUserInitials(name),
    };
};

export const filterAssignmentUsers = (
    users: AssignmentUserRecord[],
    scope: AssignmentScope,
): AssignmentUserOption[] =>
    users
        .filter((user) => {
            const name = user.name.trim();
            const role = user.role.trim();
            const status = user.status?.trim() ?? 'Active';

            return (
                Boolean(name) &&
                status === 'Active' &&
                ASSIGNMENT_SCOPE_ROLES[scope].has(role) &&
                !isExcludedAssignmentUser(user)
            );
        })
        .map(toAssignmentUserOption)
        .sort(compareAssignmentUsersByName);

export const getAssignmentUserNames = (users: AssignmentUserOption[]) =>
    sortNamesAlphabetically(users.map((user) => user.name));

export const createFallbackAssignmentUser = (name: string): AssignmentUserOption => ({
    id: `fallback-${name}`,
    value: name,
    name,
    displayName: formatUserDisplayName(name),
    employeeId: '',
    role: '',
    avatar: getUserInitials(name),
});

export const findAssignmentUserOption = (
    options: AssignmentUserOption[],
    name: string,
) => options.find((option) => option.value === name) ?? createFallbackAssignmentUser(name);

export async function fetchAssignmentUsers(
    scope: AssignmentScope,
): Promise<AssignmentUserOption[]> {
    const response = await fetch(`${USER_API_BASE_URL}/users`);

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    const users = (await response.json()) as AssignmentUserRecord[];
    return filterAssignmentUsers(users, scope);
}
