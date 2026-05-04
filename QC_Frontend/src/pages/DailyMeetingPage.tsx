import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import KanbanBoard from '../components/KanbanBoard';
import MeetingModeTable from '../components/MeetingModeTable';
import TaskEditModal, {
    type TaskFormValues,
} from '../components/TaskEditModal';
import { type TaskCardData } from '../components/TaskCard';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import { normalizeAssignedTo } from '../utilities/taskAssignments';
import {
    getCurrentTaskManagementRole,
    getTaskManagementPermissions,
} from '../utilities/taskAccess';
import {
    ALL_ASSIGNEES_FILTER_VALUE,
    DEFAULT_TASK_FILTERS,
    DEFAULT_TASK_SORT_OPTION,
    areTasksEqual,
    getTaskAssigneeOptions,
    getTasksByStatus,
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
    assigneeOptions: string[];
    onSearchChange: (value: string) => void;
    onSortChange: (value: TaskSortOption) => void;
    onPriorityChange: (value: TaskFilters['priority']) => void;
    onAssigneeChange: (value: string) => void;
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
    assigneeOptions,
    onSearchChange,
    onSortChange,
    onPriorityChange,
    onAssigneeChange,
}: TaskViewControlsProps) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80 sm:p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Search
                    </label>
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search by task title or assignee"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Sort
                    </label>
                    <select
                        value={sortOption}
                        onChange={(event) => onSortChange(event.target.value as TaskSortOption)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                        <option value="createdAt">Creation Date</option>
                        <option value="priority">Priority</option>
                        <option value="deadline">Deadline</option>
                    </select>
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Priority
                    </label>
                    <select
                        value={filters.priority}
                        onChange={(event) => onPriorityChange(event.target.value as TaskFilters['priority'])}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                        <option value="All">All Priorities</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                    </select>
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Assigned User
                    </label>
                    <select
                        value={filters.assignedUser}
                        onChange={(event) => onAssigneeChange(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                        <option value={ALL_ASSIGNEES_FILTER_VALUE}>All Employees</option>
                        {assigneeOptions.map((assignee) => (
                            <option key={assignee} value={assignee}>
                                {assignee}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </section>
    );
}

export default function DailyMeetingPage() {
    const [tasks, setTasks] = useState<TaskCardData[]>([]);
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

    const currentUserRole = getCurrentTaskManagementRole();
    const permissions = getTaskManagementPermissions(currentUserRole);
    const assigneeOptions = getTaskAssigneeOptions(tasks);
    const meetingModeTasks = processTasks(
        getTasksByStatus(tasks, 'To Do'),
        searchQuery,
        filters,
        sortOption,
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
                priority: formValues.priority,
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

    return (
        <div className="relative min-h-[85vh] overflow-hidden rounded-3xl bg-slate-50 p-4 transition-colors duration-300 dark:bg-slate-900 sm:p-6">
            <div className="pointer-events-none absolute left-[-10%] top-[-5%] h-72 w-72 rounded-full bg-red-500/15 blur-[90px] dark:bg-red-400/20" />
            <div className="pointer-events-none absolute bottom-[-15%] right-[-5%] h-80 w-80 rounded-full bg-blue-500/10 blur-[110px] dark:bg-blue-400/10" />

            <div className="relative z-10 mx-auto flex h-full max-w-[96rem] flex-col gap-4 custom-scrollbar">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                        Daily Meeting
                    </h1>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button
                            type="button"
                            onClick={() => setIsMeetingMode((current) => !current)}
                            aria-pressed={isMeetingMode}
                            className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                                isMeetingMode
                                    ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-700 dark:border-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            Meeting Mode {isMeetingMode ? 'On' : 'Off'}
                        </button>

                        {permissions.canCreateTasks && (
                            <button
                                type="button"
                                onClick={handleOpenCreateModal}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
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
                    assigneeOptions={assigneeOptions}
                    onSearchChange={setSearchQuery}
                    onSortChange={setSortOption}
                    onPriorityChange={(value) =>
                        setFilters((current) => ({
                            ...current,
                            priority: value,
                        }))
                    }
                    onAssigneeChange={(value) =>
                        setFilters((current) => ({
                            ...current,
                            assignedUser: value,
                        }))
                    }
                />

                {isMeetingMode ? (
                    <MeetingModeTable
                        tasks={meetingModeTasks}
                        onEditTask={handleOpenEditModal}
                    />
                ) : (
                    <KanbanBoard
                        tasks={tasks}
                        onTaskDoubleClick={handleOpenEditModal}
                        onTaskStatusChange={handleTaskStatusChange}
                        searchQuery={searchQuery}
                        filters={filters}
                        sortOption={sortOption}
                        canDragTasks={permissions.canDragTasks}
                    />
                )}
            </div>

            <TaskEditModal
                isOpen={Boolean(modalState)}
                mode={modalState?.mode ?? 'create'}
                task={modalState?.task ?? null}
                role={currentUserRole}
                fixedAssignedBy={FIXED_ASSIGNED_BY}
                onClose={handleCloseModal}
                onCreateTask={handleCreateTask}
                onUpdateTask={handleUpdateTask}
                onDelete={handleDeleteTask}
            />
        </div>
    );
}
