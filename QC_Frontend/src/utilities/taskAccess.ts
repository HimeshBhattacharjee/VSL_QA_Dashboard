export type TaskManagementRole = 'Manager' | 'Supervisor' | 'Operator';

export interface TaskManagementPermissions {
    canAccessTaskManagement: boolean;
    canCreateTasks: boolean;
    canDeleteTasks: boolean;
    canDragTasks: boolean;
    canEditTasks: boolean;
    canEditAllTaskFields: boolean;
    canEditRemarksOnly: boolean;
    canManageMeetingVisibility: boolean;
}

export interface GoalManagementPermissions {
    canAccessGoalManagement: boolean;
    canCreateGoals: boolean;
    canDeleteGoals: boolean;
    canDropGoals: boolean;
    canEditGoalDetails: boolean;
    canReviveGoals: boolean;
    canCarryForwardGoals: boolean;
    canUpdateMilestones: boolean;
}

// Temporary fallback until task management identity is wired to backend auth.
export const MOCK_CURRENT_TASK_USER = {
    role: 'Manager' as TaskManagementRole,
};

const TASK_MANAGEMENT_ROLES: TaskManagementRole[] = ['Manager', 'Supervisor', 'Operator'];

export const isTaskManagementRole = (value: string | null): value is TaskManagementRole =>
    TASK_MANAGEMENT_ROLES.includes(value as TaskManagementRole);

export const getCurrentTaskManagementRole = (): TaskManagementRole => {
    const storedRole = sessionStorage.getItem('userRole');

    if (isTaskManagementRole(storedRole)) {
        return storedRole;
    }

    return MOCK_CURRENT_TASK_USER.role;
};

export const getCurrentTaskManagementUser = () => ({
    employeeId: sessionStorage.getItem('employeeId')?.trim() || '',
    employeeName: sessionStorage.getItem('username')?.trim() || '',
    role: getCurrentTaskManagementRole(),
});

const isBlockedMeetingVisibilityUser = (employeeId?: string, employeeName?: string) =>
    employeeId?.trim() === '4000061' ||
    employeeName?.trim().toLowerCase() === 'sanjit basu';

export const getTaskManagementPermissions = (
    role: TaskManagementRole,
    user: { employeeId?: string; employeeName?: string } = {},
): TaskManagementPermissions => ({
    canAccessTaskManagement: role !== 'Operator',
    canCreateTasks: role === 'Manager',
    canDeleteTasks: role === 'Manager',
    canDragTasks: role === 'Manager',
    canEditTasks: role === 'Manager' || role === 'Supervisor',
    canEditAllTaskFields: role === 'Manager',
    canEditRemarksOnly: role === 'Supervisor',
    canManageMeetingVisibility:
        (role === 'Manager' || role === 'Supervisor') &&
        !isBlockedMeetingVisibilityUser(user.employeeId, user.employeeName),
});

export const getGoalManagementPermissions = (
    role: TaskManagementRole,
): GoalManagementPermissions => ({
    canAccessGoalManagement: role !== 'Operator',
    canCreateGoals: role === 'Manager',
    canDeleteGoals: role === 'Manager',
    canDropGoals: role === 'Manager',
    canEditGoalDetails: role === 'Manager',
    canReviveGoals: role === 'Manager',
    canCarryForwardGoals: role === 'Manager',
    canUpdateMilestones: role === 'Manager' || role === 'Supervisor',
});
