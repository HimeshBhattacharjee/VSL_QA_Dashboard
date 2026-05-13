import { useMemo } from 'react';
import { PencilLine } from 'lucide-react';
import { type TaskCardData } from './TaskCard';
import { formatISTDate } from '../utilities/istDate';
import {
    formatAssignedToSummary,
    getUserInitials,
    sortUserNamesByDisplayName,
} from '../utilities/taskAssignments';
import { useResizableTable } from '../utilities/useResizableTable';

interface MeetingModeTableProps {
    tasks: TaskCardData[];
    onEditTask: (task: TaskCardData) => void;
}

const columnDefinitions = [
    { key: 'title', label: 'Title', defaultSize: 300, minSize: 240, maxSize: 560 },
    { key: 'assignedTo', label: 'Assigned To', defaultSize: 220, minSize: 180, maxSize: 360 },
    { key: 'createdAt', label: 'Creation Date', defaultSize: 170, minSize: 140, maxSize: 240 },
    { key: 'deadline', label: 'Deadline', defaultSize: 160, minSize: 130, maxSize: 220 },
    { key: 'remarks', label: 'Remarks', defaultSize: 260, minSize: 180, maxSize: 420 },
    { key: 'actions', label: 'Actions', defaultSize: 140, minSize: 120, maxSize: 200 },
] as const;

const headerCellClass =
    'sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 text-center align-middle text-xs font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
const bodyCellClass = 'px-4 py-3 text-left align-middle';
const resizeHandleClass =
    'absolute inset-y-0 right-0 flex w-4 translate-x-1/2 touch-none items-center justify-center';
const rowHandleClass =
    'absolute bottom-1.5 left-1/2 flex h-4 w-14 -translate-x-1/2 touch-none items-center justify-center rounded-full';

const formatDeadline = (value?: string) => (value ? formatISTDate(value) : '--');

export default function MeetingModeTable({
    tasks,
    onEditTask,
}: MeetingModeTableProps) {
    const rowDefinitions = useMemo(
        () =>
            tasks.map((task) => ({
                key: task.id,
                defaultSize: 112,
                minSize: 92,
                maxSize: 280,
            })),
        [tasks],
    );

    const { columnSizes, rowSizes, startColumnResize, startRowResize } = useResizableTable({
        columns: columnDefinitions,
        rows: rowDefinitions,
    });
    const tableMinWidth = columnDefinitions.reduce(
        (totalWidth, column) => totalWidth + (columnSizes[column.key] ?? column.defaultSize),
        0,
    );

    return (
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80 sm:p-4">
            <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <span className="mr-2 h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-green-600 shadow-[0_0_0_3px_rgba(37,99,235,0.2)] dark:bg-green-400 dark:shadow-[0_0_0_3px_rgba(96,165,250,0.3)]" />
                    {tasks.length} active task{tasks.length === 1 ? '' : 's'}
                </div>
            </div>
            <div className="h-full overflow-x-auto overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-inner dark:border-slate-700 dark:bg-slate-900">
                <table
                    className="w-full border-separate border-spacing-0 text-left"
                    style={{ minWidth: `${tableMinWidth}px` }}
                >
                    <colgroup>
                        {columnDefinitions.map((column) => (
                            <col
                                key={column.key}
                                style={{
                                    width: `${columnSizes[column.key] ?? column.defaultSize}px`,
                                }}
                            />
                        ))}
                    </colgroup>

                    <thead>
                        <tr>
                            {columnDefinitions.map((column) => (
                                <th key={column.key} className={`${headerCellClass} relative`}>
                                    <span className="block pr-3">{column.label}</span>
                                    <button
                                        type="button"
                                        aria-label={`Resize ${column.label} column`}
                                        onPointerDown={(event) =>
                                            startColumnResize(column.key, event)
                                        }
                                        className={resizeHandleClass}
                                    >
                                        <span className="h-8 w-1 rounded-full bg-slate-200 transition-colors hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-400" />
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {tasks.length > 0 ? (
                            tasks.map((task) => {
                                const rowHeight = rowSizes[task.id] ?? 112;
                                const visibleAssignees = sortUserNamesByDisplayName(
                                    task.assignedTo,
                                ).slice(0, 2);
                                const remainingAssigneeCount =
                                    task.assignedTo.length - visibleAssignees.length;

                                return (
                                    <tr
                                        key={task.id}
                                        className="bg-slate-50 transition-colors hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-700/60"
                                        style={{ height: `${rowHeight}px` }}
                                    >
                                        <td
                                            className={bodyCellClass}
                                            style={{ height: `${rowHeight}px` }}
                                        >
                                            <div className="space-y-2">
                                                <p className="break-words whitespace-normal text-sm font-semibold leading-5 text-slate-900 dark:text-white">
                                                    {task.title}
                                                </p>
                                            </div>
                                        </td>

                                        <td
                                            className={bodyCellClass}
                                            style={{ height: `${rowHeight}px` }}
                                        >
                                            <div className="flex h-full flex-col justify-center gap-2">
                                                <div className="flex items-center justify-center gap-1.5 overflow-hidden">
                                                    {visibleAssignees.length > 0 ? (
                                                        visibleAssignees.map((assignee) => (
                                                            <div
                                                                key={assignee}
                                                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                                                            >
                                                                {getUserInitials(assignee)}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-200">
                                                            --
                                                        </div>
                                                    )}

                                                    {remainingAssigneeCount > 0 && (
                                                        <div className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[10px] font-semibold text-white dark:bg-slate-600">
                                                            +{remainingAssigneeCount}
                                                        </div>
                                                    )}
                                                </div>

                                                <p className="break-words text-sm leading-5 text-slate-700 dark:text-slate-200">
                                                    {formatAssignedToSummary(task.assignedTo)}
                                                </p>
                                            </div>
                                        </td>

                                        <td
                                            className={bodyCellClass}
                                            style={{ height: `${rowHeight}px` }}
                                        >
                                            <span className="whitespace-nowrap text-sm font-medium text-slate-600 dark:text-slate-300">
                                                {formatISTDate(task.createdAt)}
                                            </span>
                                        </td>

                                        <td
                                            className={bodyCellClass}
                                            style={{ height: `${rowHeight}px` }}
                                        >
                                            <span className="whitespace-nowrap text-sm font-medium text-slate-600 dark:text-slate-300">
                                                {formatDeadline(task.deadline)}
                                            </span>
                                        </td>

                                        <td
                                            className={bodyCellClass}
                                            style={{ height: `${rowHeight}px` }}
                                        >
                                            <p className="break-words text-sm leading-5 text-slate-600 dark:text-slate-300">
                                                {task.remarks?.trim() || '--'}
                                            </p>
                                        </td>

                                        <td
                                            className={`${bodyCellClass} relative`}
                                            style={{ height: `${rowHeight}px` }}
                                        >
                                            <div className="flex h-full items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => onEditTask(task)}
                                                    className="inline-flex h-10 min-w-[88px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                >
                                                    <PencilLine className="h-4 w-4" />
                                                    <span>Edit</span>
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                aria-label="Resize row height"
                                                onPointerDown={(event) =>
                                                    startRowResize(task.id, event)
                                                }
                                                className={rowHandleClass}
                                            >
                                                <span className="h-1 w-8 rounded-full bg-slate-300 transition-colors hover:bg-slate-500 dark:bg-slate-600 dark:hover:bg-slate-400" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td
                                    colSpan={columnDefinitions.length}
                                    className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                                >
                                    No active tasks available for the meeting view.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
