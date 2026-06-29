import { useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff, Plus, RotateCcw } from 'lucide-react';
import KanbanBoard from '../components/KanbanBoard';
import MeetingModeTable from '../components/MeetingModeTable';
import TaskEditModal, {
    type TaskFormValues,
} from '../components/TaskEditModal';
import { type TaskCardData } from '../components/TaskCard';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import {
    fetchAssignmentUsers,
    type AssignmentUserOption,
} from '../utilities/assignmentUsers';
import { normalizeAssignedTo } from '../utilities/taskAssignments';
import {
    getCurrentTaskManagementUser,
    getTaskManagementPermissions,
} from '../utilities/taskAccess';
import {
    DEFAULT_TASK_FILTERS,
    DEFAULT_TASK_SORT_OPTION,
    areTasksEqual,
    getTasksByStatus,
    getTaskSerialNumberMap,
    moveTaskToStatus,
    processTasks,
    type TaskFilters,
    type TaskSortOption,
} from '../utilities/taskUtils';
import {
    createTaskMutationPayloadFromTask,
    createTask as createTaskRequest,
    deleteTask as deleteTaskRequest,
    fetchTasks,
    updateTask as updateTaskRequest,
    updateTaskVisibility,
} from '../utilities/taskApi';

type TaskModalState =
    | {
        mode: 'create';
        task: null;
    }
    | {
        mode: 'edit';
        task: TaskCardData;
    };

interface TaskViewControlsProps {
    searchQuery: string;
    sortOption: TaskSortOption;
    filters: TaskFilters;
    onSearchChange: (value: string) => void;
    onSortChange: (value: TaskSortOption) => void;
    onPriorityChange: (value: TaskFilters['priority']) => void;
}

interface ExcludedTasksSectionProps {
    tasks: TaskCardData[];
    onRestoreTask: (task: TaskCardData) => void;
}

const applyPendingTaskStatusUpdates = (
    taskList: TaskCardData[],
    pendingStatusUpdates: Record<string, { requestId: number; status: TaskCardData['status'] }>,
) =>
    taskList.map((task) => {
        const pendingUpdate = pendingStatusUpdates[task.id];

        if (!pendingUpdate || task.status === pendingUpdate.status) {
            return task;
        }

        return {
            ...task,
            status: pendingUpdate.status,
        };
    });

function TaskViewControls({
    searchQuery,
    sortOption,
    filters,
    onSearchChange,
    onSortChange,
    onPriorityChange,
}: TaskViewControlsProps) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Search
                    </label>
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search by task title or assignee"
                        className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-brand-primary-light"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Sort
                    </label>
                    <select
                        value={sortOption}
                        onChange={(event) => onSortChange(event.target.value as TaskSortOption)}
                        className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-brand-primary-light"
                    >
                        <option value="serialNumberAsc">Sl. No. (Asc)</option>
                        <option value="serialNumberDesc">Sl. No. (Desc)</option>
                        <option value="priorityAsc">Priority (Asc)</option>
                        <option value="priorityDesc">Priority (Desc)</option>
                        <option value="deadlineAsc">Deadline (Asc)</option>
                        <option value="deadlineDesc">Deadline (Desc)</option>
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Priority
                    </label>
                    <select
                        value={filters.priority}
                        onChange={(event) => onPriorityChange(event.target.value as TaskFilters['priority'])}
                        className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-brand-primary-light"
                    >
                        <option value="All">All Priorities</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                    </select>
                </div>

            </div>
        </section>
    );
}

function ExcludedTasksSection({ tasks, onRestoreTask }: ExcludedTasksSectionProps) {
    if (tasks.length === 0) {
        return null;
    }

    return (
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <EyeOff className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                <span>Excluded from Meeting</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    {tasks.length}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {tasks.map((task) => (
                    <div
                        key={task.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="break-words text-sm font-semibold text-slate-900 dark:text-white">
                                    {task.title}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {task.status} - {task.priority} Priority
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onRestoreTask(task)}
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Restore</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default function DailyMeetingPage() {
    const [tasks, setTasks] = useState<TaskCardData[]>([]);
    const [assigneeOptions, setAssigneeOptions] = useState<AssignmentUserOption[]>([]);
    const [modalState, setModalState] = useState<TaskModalState | null>(null);
    const [isMeetingMode, setIsMeetingMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<TaskSortOption>(DEFAULT_TASK_SORT_OPTION);
    const [filters, setFilters] = useState<TaskFilters>(DEFAULT_TASK_FILTERS);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const pendingTaskStatusUpdatesRef = useRef<
        Record<string, { requestId: number; status: TaskCardData['status'] }>
    >({});
    const deletingTaskIdsRef = useRef<Set<string>>(new Set());

    const currentTaskUser = getCurrentTaskManagementUser();
    const currentUserRole = currentTaskUser.role;
    const permissions = getTaskManagementPermissions(currentUserRole, currentTaskUser);
    const taskSerialNumberById = useMemo(() => getTaskSerialNumberMap(tasks), [tasks]);
    const visibleTasks = useMemo(
        () => tasks.filter((task) => task.visibleInMeeting),
        [tasks],
    );
    const excludedTasks = useMemo(
        () => tasks.filter((task) => !task.visibleInMeeting),
        [tasks],
    );
    const meetingModeTasks = useMemo(
        () =>
            processTasks(
                getTasksByStatus(visibleTasks, 'To Do'),
                searchQuery,
                filters,
                sortOption,
                taskSerialNumberById,
            ),
        [filters, searchQuery, sortOption, taskSerialNumberById, visibleTasks],
    );

    useEffect(() => {
        let isActive = true;

        const syncTasks = async (shouldShowAlert = false) => {
            try {
                const latestTasks = await fetchTasks();
                if (!isActive) {
                    return;
                }

                const syncedTasks = applyPendingTaskStatusUpdates(
                    latestTasks,
                    pendingTaskStatusUpdatesRef.current,
                );
                setTasks((current) => (areTasksEqual(current, syncedTasks) ? current : syncedTasks));
            } catch (error) {
                console.error('Failed to fetch tasks:', error);
                if (shouldShowAlert) {
                    showAlert('error', 'Failed to load tasks from the server.');
                }
            }
        };

        void syncTasks(true);
        const pollTimer = window.setInterval(() => {
            void syncTasks(false);
        }, 10000);

        return () => {
            isActive = false;
            window.clearInterval(pollTimer);
        };
    }, [showAlert]);

    useEffect(() => {
        let isActive = true;

        const loadAssignableUsers = async () => {
            try {
                const users = await fetchAssignmentUsers('daily');
                if (!isActive) {
                    return;
                }

                setAssigneeOptions(users);
            } catch (error) {
                console.error('Failed to load assignable users:', error);
                showAlert('error', 'Failed to load employee options.');
            }
        };

        void loadAssignableUsers();

        return () => {
            isActive = false;
        };
    }, [showAlert]);

    function handleOpenCreateModal() {
        if (!permissions.canCreateTasks) {
            return;
        }

        setModalState({
            mode: 'create',
            task: null,
        });
    }

    function handleOpenEditModal(task: TaskCardData) {
        if (!permissions.canEditTasks) {
            return;
        }

        setModalState({
            mode: 'edit',
            task,
        });
    }

    function handleCloseModal() {
        setModalState(null);
    }

    async function handleTaskStatusChange(taskId: string, nextStatus: TaskCardData['status']) {
        if (!permissions.canDragTasks) {
            return;
        }

        let previousTaskSnapshot: TaskCardData | null = null;

        setTasks((current) => {
            const currentTask = current.find((task) => task.id === taskId) ?? null;

            if (!currentTask || currentTask.status === nextStatus) {
                return current;
            }

            previousTaskSnapshot = currentTask;
            return moveTaskToStatus(current, taskId, nextStatus);
        });

        const taskBeforeUpdate = previousTaskSnapshot;
        if (!taskBeforeUpdate) {
            return;
        }

        const requestId = (pendingTaskStatusUpdatesRef.current[taskId]?.requestId ?? 0) + 1;
        pendingTaskStatusUpdatesRef.current[taskId] = {
            requestId,
            status: nextStatus,
        };

        try {
            const updatedTask = await updateTaskRequest(
                taskId,
                createTaskMutationPayloadFromTask(taskBeforeUpdate, {
                    status: nextStatus,
                }),
            );

            const pendingUpdate = pendingTaskStatusUpdatesRef.current[taskId];
            if (!pendingUpdate || pendingUpdate.requestId !== requestId) {
                return;
            }

            delete pendingTaskStatusUpdatesRef.current[taskId];
            setTasks((current) =>
                current.map((task) => (task.id === updatedTask.id ? updatedTask : task)),
            );
        } catch (error) {
            const pendingUpdate = pendingTaskStatusUpdatesRef.current[taskId];
            if (!pendingUpdate || pendingUpdate.requestId !== requestId) {
                return;
            }

            delete pendingTaskStatusUpdatesRef.current[taskId];
            console.error('Failed to update task status:', error);
            showAlert('error', 'Failed to update task status.');
            setTasks((current) =>
                current.map((task) =>
                    task.id === taskId && task.status === nextStatus
                        ? taskBeforeUpdate
                        : task,
                ),
            );
        }
    }

    const FIXED_ASSIGNED_BY = 'Sanjit Basu';

    async function handleCreateTask(formValues: TaskFormValues) {
        if (!permissions.canCreateTasks) {
            return;
        }

        try {
            const createdTask = await createTaskRequest({
                title: formValues.title.trim(),
                description: formValues.description.trim(),
                assignedTo: normalizeAssignedTo(formValues.assignedTo),
                assignedBy: FIXED_ASSIGNED_BY,
                createdAt: formValues.creationDate,
                priority: formValues.priority,
                visibleInMeeting: true,
                deadline: formValues.deadline || undefined,
                status: 'To Do',
                remarks: formValues.remarks.trim() || undefined,
            });

            setTasks((current) => [createdTask, ...current]);
            setModalState(null);
        } catch (error) {
            console.error('Failed to create task:', error);
            showAlert('error', 'Failed to create task.');
        }
    }

    async function handleUpdateTask(formValues: TaskFormValues) {
        if (!modalState || modalState.mode !== 'edit' || !permissions.canEditTasks) {
            return;
        }

        try {
            const updatedTask = await updateTaskRequest(
                modalState.task.id,
                createTaskMutationPayloadFromTask(
                    modalState.task,
                    permissions.canEditAllTaskFields
                        ? {
                            title: formValues.title.trim(),
                            description: formValues.description.trim(),
                            assignedTo: normalizeAssignedTo(formValues.assignedTo),
                            assignedBy: FIXED_ASSIGNED_BY,
                            priority: formValues.priority,
                            deadline: formValues.deadline || undefined,
                            status: formValues.status,
                            remarks: formValues.remarks.trim() || undefined,
                        }
                        : {
                            remarks: formValues.remarks.trim() || undefined,
                        },
                ),
            );

            setTasks((current) =>
                current.map((task) => (task.id === updatedTask.id ? updatedTask : task)),
            );
            setModalState(null);
        } catch (error) {
            console.error('Failed to update task:', error);
            showAlert('error', 'Failed to update task.');
        }
    }

    async function deleteConfirmedTask(taskId: string) {
        if (!permissions.canDeleteTasks) {
            return;
        }

        if (deletingTaskIdsRef.current.has(taskId)) {
            return;
        }

        deletingTaskIdsRef.current.add(taskId);
        try {
            await deleteTaskRequest(taskId);
            setTasks((current) => current.filter((task) => task.id !== taskId));
            setModalState(null);
        } catch (error) {
            console.error('Failed to delete task:', error);
            showAlert('error', 'Failed to delete task.');
        } finally {
            deletingTaskIdsRef.current.delete(taskId);
        }
    }

    function handleDeleteTask(taskId: string) {
        if (!permissions.canDeleteTasks || deletingTaskIdsRef.current.has(taskId)) {
            return;
        }
        showConfirm({
            title: 'Delete Task',
            message: 'Are you sure you want to delete this task?',
            type: 'warning',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            onConfirm: () => {
                void deleteConfirmedTask(taskId);
            },
        });
    }

    async function handleTaskVisibilityChange(task: TaskCardData, visibleInMeeting: boolean) {
        if (!permissions.canManageMeetingVisibility) {
            return;
        }

        const previousTask = task;
        setTasks((current) =>
            current.map((currentTask) =>
                currentTask.id === task.id
                    ? { ...currentTask, visibleInMeeting }
                    : currentTask,
            ),
        );

        try {
            const updatedTask = await updateTaskVisibility(task.id, visibleInMeeting);
            setTasks((current) =>
                current.map((currentTask) =>
                    currentTask.id === updatedTask.id ? updatedTask : currentTask,
                ),
            );
        } catch (error) {
            console.error('Failed to update task visibility:', error);
            showAlert('error', 'Failed to update task visibility.');
            setTasks((current) =>
                current.map((currentTask) =>
                    currentTask.id === previousTask.id ? previousTask : currentTask,
                ),
            );
        }
    }

    return (
        <div className="min-h-[85vh] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950 sm:p-4">
            <div className="mx-auto flex h-full max-w-[96rem] flex-col gap-3 custom-scrollbar">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                            Daily Meeting
                        </h1>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button
                            type="button"
                            onClick={() => setIsMeetingMode((current) => !current)}
                            aria-pressed={isMeetingMode}
                            className={`inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${isMeetingMode
                                    ? 'border-brand-primary bg-brand-primary text-white hover:bg-brand-primary-hover dark:border-brand-primary-light dark:bg-brand-primary dark:text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-primary-muted hover:bg-brand-primary-soft hover:text-brand-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-primary/50 dark:hover:bg-brand-primary/10 dark:hover:text-brand-primary-light'
                                }`}
                        >
                            Meeting Mode {isMeetingMode ? 'On' : 'Off'}
                        </button>

                        {permissions.canCreateTasks && (
                            <button
                                type="button"
                                onClick={handleOpenCreateModal}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Create New Task</span>
                            </button>
                        )}
                    </div>
                </div>

                <TaskViewControls
                    searchQuery={searchQuery}
                    sortOption={sortOption}
                    filters={filters}
                    onSearchChange={setSearchQuery}
                    onSortChange={setSortOption}
                    onPriorityChange={(value) =>
                        setFilters((current) => ({
                            ...current,
                            priority: value,
                        }))
                    }
                />

                {!isMeetingMode && permissions.canManageMeetingVisibility && (
                    <ExcludedTasksSection
                        tasks={excludedTasks}
                        onRestoreTask={(task) => {
                            void handleTaskVisibilityChange(task, true);
                        }}
                    />
                )}

                {isMeetingMode ? (
                    <MeetingModeTable
                        tasks={meetingModeTasks}
                        serialNumberByTaskId={taskSerialNumberById}
                        onEditTask={handleOpenEditModal}
                        onDoneTask={(taskId) => {
                            void handleTaskStatusChange(taskId, 'Done');
                        }}
                        canMarkDone={permissions.canDragTasks}
                    />
                ) : (
                    <KanbanBoard
                        tasks={visibleTasks}
                        onTaskDoubleClick={handleOpenEditModal}
                        onTaskStatusChange={handleTaskStatusChange}
                        onExcludeTaskFromMeeting={(task) => {
                            void handleTaskVisibilityChange(task, false);
                        }}
                        searchQuery={searchQuery}
                        filters={filters}
                        sortOption={sortOption}
                        serialNumberByTaskId={taskSerialNumberById}
                        canDragTasks={permissions.canDragTasks}
                        canExcludeFromMeeting={permissions.canManageMeetingVisibility}
                    />
                )}
            </div>

            <TaskEditModal
                isOpen={Boolean(modalState)}
                mode={modalState?.mode ?? 'create'}
                task={modalState?.task ?? null}
                role={currentUserRole}
                assigneeOptions={assigneeOptions}
                onClose={handleCloseModal}
                onCreateTask={handleCreateTask}
                onUpdateTask={handleUpdateTask}
                onDelete={handleDeleteTask}
            />
        </div>
    );
}