import { useState } from 'react';
import {
    DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
    type DragEndEvent, type DragStartEvent, type UniqueIdentifier
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import TaskCard, { type TaskCardData, type TaskStatus } from './TaskCard';
import { formatAssignedToGroupLabel, getAssignedToGroupKey } from '../utilities/taskAssignments';
import { getTasksByStatus, processTasks, type TaskFilters, type TaskSortOption } from '../utilities/taskUtils';

interface EmployeeTaskSection {
    groupKey: string;
    label: string;
    tasks: TaskCardData[];
}

const columns: Array<{
    id: string;
    title: TaskStatus;
    accentBar: string;
    headerBadge: string;
    border: string;
    dropzoneId: string;
}> = [
        {
            id: 'todo',
            title: 'To Do',
            accentBar: 'bg-rose-500',
            headerBadge: 'bg-rose-100 text-rose-700',
            border: 'border-slate-200 dark:border-slate-700',
            dropzoneId: 'column-To Do',
        },
        {
            id: 'done',
            title: 'Done',
            accentBar: 'bg-emerald-500',
            headerBadge: 'bg-emerald-100 text-emerald-700',
            border: 'border-slate-200 dark:border-slate-700',
            dropzoneId: 'column-Done',
        },
    ];

const initialCollapsedState: Record<TaskStatus, boolean> = {
    'To Do': false,
    Done: false,
};
const UNASSIGNED_GROUP_KEY = 'Unassigned';

const groupTasksByEmployee = (tasks: TaskCardData[]): EmployeeTaskSection[] => {
    const sections = new Map<string, EmployeeTaskSection>();

    tasks.forEach((task) => {
        const groupKey = getAssignedToGroupKey(task.assignedTo);
        const existingSection = sections.get(groupKey);

        if (existingSection) {
            existingSection.tasks.push(task);
            return;
        }

        sections.set(groupKey, {
            groupKey,
            label: formatAssignedToGroupLabel(task.assignedTo),
            tasks: [task],
        });
    });

    return Array.from(sections.values())
        .sort((leftSection, rightSection) => {
            if (leftSection.groupKey === UNASSIGNED_GROUP_KEY) {
                return 1;
            }

            if (rightSection.groupKey === UNASSIGNED_GROUP_KEY) {
                return -1;
            }

            return (
                leftSection.label.localeCompare(rightSection.label, undefined, {
                    sensitivity: 'base',
                }) || leftSection.groupKey.localeCompare(rightSection.groupKey)
            );
        });
};

const getSectionKey = (columnTitle: TaskStatus, groupKey: string) =>
    `${columnTitle}:${groupKey}`;

const findTaskById = (tasks: TaskCardData[], taskId: string) =>
    tasks.find((task) => task.id === taskId) ?? null;

const findTaskStatus = (tasks: TaskCardData[], taskId: string): TaskStatus | null =>
    findTaskById(tasks, taskId)?.status ?? null;

const getColumnFromOverId = (
    tasks: TaskCardData[],
    overId: UniqueIdentifier | null | undefined,
): TaskStatus | null => {
    if (!overId) {
        return null;
    }

    const rawOverId = String(overId);
    const column = columns.find((item) => item.dropzoneId === rawOverId);
    if (column) {
        return column.title;
    }

    return findTaskStatus(tasks, rawOverId);
};

const getOppositeExtremeColumn = (currentTitle: TaskStatus): TaskStatus => {
    const currentIndex = columns.findIndex((column) => column.title === currentTitle);
    const leftDistance = currentIndex;
    const rightDistance = columns.length - 1 - currentIndex;

    return rightDistance >= leftDistance
        ? columns[columns.length - 1].title
        : columns[0].title;
};

const toTransformString = (
    transform: { x: number; y: number; scaleX: number; scaleY: number } | null | undefined,
) => {
    if (!transform) {
        return undefined;
    }

    return `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`;
};

function SortableTaskCard({
    task,
    onDoubleClick,
    isDragEnabled,
}: {
    task: TaskCardData;
    onDoubleClick: () => void;
    isDragEnabled: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
        disabled: !isDragEnabled,
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: toTransformString(transform),
                transition,
            }}
            className={isDragging ? 'z-10' : undefined}
        >
            <TaskCard
                task={task}
                isDragging={isDragging}
                onDoubleClick={onDoubleClick}
                dragHandleProps={isDragEnabled ? { ...attributes, ...listeners } : undefined}
            />
        </div>
    );
}

function KanbanColumn({
    column,
    taskCount,
    employeeSections,
    isCollapsed,
    onToggleCollapse,
    onTaskDoubleClick,
    canDragTasks,
    collapsedSections,
    onToggleSection,
}: {
    column: (typeof columns)[number];
    taskCount: number;
    employeeSections: EmployeeTaskSection[];
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onTaskDoubleClick: (task: TaskCardData) => void;
    canDragTasks: boolean;
    collapsedSections: Record<string, boolean>;
    onToggleSection: (groupKey: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: column.dropzoneId,
        disabled: !canDragTasks,
    });
    const visibleTaskIds = employeeSections.flatMap((section) =>
        collapsedSections[getSectionKey(column.title, section.groupKey)]
            ? []
            : section.tasks.map((task) => task.id),
    );

    return (
        <section
            ref={setNodeRef}
            className={`flex h-screen shrink-0 flex-col overflow-hidden rounded-2xl border bg-slate-50/80 shadow-sm dark:bg-slate-900/70 ${column.border}`}
            style={{
                width: isCollapsed ? 84 : undefined,
                minWidth: isCollapsed ? 84 : 320,
                flex: isCollapsed ? '0 0 84px' : '1 1 0%',
                transition: 'width 300ms ease, min-width 300ms ease, flex-basis 300ms ease',
            }}
        >
            {isCollapsed ? (
                <div
                    className={`flex h-full flex-col items-center justify-between p-2 transition-colors duration-200 ${isOver ? 'bg-slate-100/90 dark:bg-slate-800/80' : ''}`}
                >
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        aria-label={`Expand ${column.title}`}
                        className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>

                    <div className="flex flex-1 flex-col items-center justify-center gap-4">
                        <span className={`h-16 w-1.5 rounded-full ${column.accentBar}`} />
                        <span className="[writing-mode:vertical-rl] rotate-180 text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200">
                            {column.title}
                        </span>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${column.headerBadge}`}>
                            {taskCount}
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="border-b border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/90">
                        <div className={`mb-2 h-1.5 w-full rounded-full ${column.accentBar}`} />
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {column.title}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${column.headerBadge}`}>
                                    {taskCount}
                                </span>
                                <button
                                    type="button"
                                    onClick={onToggleCollapse}
                                    aria-label={`Collapse ${column.title}`}
                                    className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`flex-1 overflow-y-auto p-2 transition-colors duration-200 ${isOver ? 'bg-slate-100/80 dark:bg-slate-800/60' : ''}`}
                    >
                        <SortableContext items={visibleTaskIds} strategy={verticalListSortingStrategy}>
                            <div className="flex min-h-full flex-col gap-2">
                                {employeeSections.map((section) => {
                                    const sectionKey = getSectionKey(column.title, section.groupKey);
                                    const isSectionCollapsed = Boolean(collapsedSections[sectionKey]);

                                    return (
                                        <div
                                            key={sectionKey}
                                            className="rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => onToggleSection(section.groupKey)}
                                                className="flex w-full items-center justify-between gap-2 text-left"
                                            >
                                                <div className="flex flex-row gap-1 min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                        {section.label}
                                                    </p>
                                                    <p className="text-xs mt-0.5 text-slate-500 dark:text-slate-400">
                                                        ({section.tasks.length} task{section.tasks.length === 1 ? '' : 's'})
                                                    </p>
                                                </div>
                                                <ChevronRight
                                                    className={`h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-slate-300 ${isSectionCollapsed ? '' : 'rotate-90'}`}
                                                />
                                            </button>

                                            {!isSectionCollapsed && (
                                                <div className="mt-3 flex flex-col gap-4">
                                                    {section.tasks.map((task) => (
                                                        <SortableTaskCard
                                                            key={task.id}
                                                            task={task}
                                                            onDoubleClick={() => onTaskDoubleClick(task)}
                                                            isDragEnabled={canDragTasks}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {taskCount === 0 && (
                                    <div className="flex min-h-[240px] flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 text-center dark:border-slate-600 dark:bg-slate-800/60">
                                        <div className="space-y-2">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                No tasks in {column.title}
                                            </p>
                                            <p className="max-w-[14rem] text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                {canDragTasks
                                                    ? 'Drag a task here from another column to change its current status.'
                                                    : 'No tasks are available in this column.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </SortableContext>
                    </div>
                </>
            )}
        </section>
    );
}

interface KanbanBoardProps {
    tasks: TaskCardData[];
    onTaskDoubleClick: (task: TaskCardData) => void;
    onTaskStatusChange: (taskId: string, nextStatus: TaskStatus) => void;
    searchQuery: string;
    filters: TaskFilters;
    sortOption: TaskSortOption;
    serialNumberByTaskId: Record<string, number>;
    canDragTasks?: boolean;
}

export default function KanbanBoard({
    tasks,
    onTaskDoubleClick,
    onTaskStatusChange,
    searchQuery,
    filters,
    sortOption,
    serialNumberByTaskId,
    canDragTasks = true,
}: KanbanBoardProps) {
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const [collapsedColumns, setCollapsedColumns] = useState<Record<TaskStatus, boolean>>(initialCollapsedState);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
    );

    const activeTask = activeTaskId ? findTaskById(tasks, activeTaskId) : null;
    const processedTasksByColumn: Record<TaskStatus, TaskCardData[]> = {
        'To Do': processTasks(
            getTasksByStatus(tasks, 'To Do'),
            searchQuery,
            filters,
            sortOption,
            serialNumberByTaskId,
        ),
        Done: processTasks(
            getTasksByStatus(tasks, 'Done'),
            searchQuery,
            filters,
            sortOption,
            serialNumberByTaskId,
        ),
    };
    const groupedTasksByColumn: Record<TaskStatus, EmployeeTaskSection[]> = {
        'To Do': groupTasksByEmployee(processedTasksByColumn['To Do']),
        Done: groupTasksByEmployee(processedTasksByColumn.Done),
    };

    function handleDragStart(event: DragStartEvent) {
        if (!canDragTasks) {
            return;
        }

        setActiveTaskId(String(event.active.id));
    }

    function handleDragEnd(event: DragEndEvent) {
        setActiveTaskId(null);

        if (!canDragTasks) {
            return;
        }

        const { active, over } = event;
        if (!over) {
            return;
        }

        const activeId = String(active.id);
        const activeColumn = findTaskStatus(tasks, activeId);
        const overColumn = getColumnFromOverId(tasks, over.id);

        if (!activeColumn || !overColumn || activeColumn === overColumn) {
            return;
        }

        onTaskStatusChange(activeId, overColumn);
    }

    function handleDragCancel() {
        setActiveTaskId(null);
    }

    function handleToggleColumn(columnTitle: TaskStatus) {
        setCollapsedColumns((current) => {
            if (current[columnTitle]) {
                return {
                    ...current,
                    [columnTitle]: false,
                };
            }

            const expandedColumns = columns.filter((column) => !current[column.title]);
            if (expandedColumns.length === 1) {
                const oppositeColumn = getOppositeExtremeColumn(columnTitle);
                return {
                    ...current,
                    [columnTitle]: true,
                    [oppositeColumn]: false,
                };
            }

            return {
                ...current,
                [columnTitle]: true,
            };
        });
    }

    function handleToggleSection(columnTitle: TaskStatus, employeeName: string) {
        const sectionKey = getSectionKey(columnTitle, employeeName);

        setCollapsedSections((current) => ({
            ...current,
            [sectionKey]: !current[sectionKey],
        }));
    }

    return (
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="overflow-x-auto">
                    <div className="flex min-w-full items-stretch gap-3 custom-scrollbar">
                        {columns.map((column) => (
                            <KanbanColumn
                                key={column.id}
                                column={column}
                                taskCount={processedTasksByColumn[column.title].length}
                                employeeSections={groupedTasksByColumn[column.title]}
                                isCollapsed={collapsedColumns[column.title]}
                                onToggleCollapse={() => handleToggleColumn(column.title)}
                                onTaskDoubleClick={onTaskDoubleClick}
                                canDragTasks={canDragTasks}
                                collapsedSections={collapsedSections}
                                onToggleSection={(employeeName) => handleToggleSection(column.title, employeeName)}
                            />
                        ))}
                    </div>
                </div>

                <DragOverlay>
                    {canDragTasks && activeTask ? (
                        <div className="w-[320px]">
                            <TaskCard task={activeTask} isOverlay />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </section>
    );
}
