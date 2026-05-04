import { PencilLine } from 'lucide-react';
import { type TaskCardData, type TaskStatus } from './TaskCard';
import {
    formatAssignedToSummary,
    getUserInitials,
} from '../utilities/taskAssignments';

interface MeetingModeTableProps {
    tasks: TaskCardData[];
    onEditTask: (task: TaskCardData) => void;
}

const headerCellClass =
    'sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 text-center align-middle text-xs font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
const bodyCellClass =
    'px-4 py-3 text-left align-middle';

const statusStyles: Record<TaskStatus, string> = {
    'To Do': 'border-rose-200 bg-rose-50 text-rose-700',
    'Done': 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const formatDeadline = (value?: string) => {
    if (!value) {
        return '--';
    }

    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
};

const formatCreationDate = (value: string) =>
    new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));

export default function MeetingModeTable({
    tasks,
    onEditTask,
}: MeetingModeTableProps) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <span className="flex-shrink-0 mr-2 w-2.5 h-2.5 rounded-full bg-green-600 dark:bg-green-400 shadow-[0_0_0_3px_rgba(37,99,235,0.2)] dark:shadow-[0_0_0_3px_rgba(96,165,250,0.3)] animate-pulse" />
                    {tasks.length} active task{tasks.length === 1 ? '' : 's'}
                </div>
            </div>
            <div className="h-full overflow-x-auto overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-inner dark:border-slate-700 dark:bg-slate-900">
                <table className="min-w-[780px] w-full border-separate border-spacing-0 text-left">
                    <thead>
                        <tr>
                            <th className={`${headerCellClass} w-[240px]`}>
                                Title
                            </th>
                            <th className={`${headerCellClass} w-[180px]`}>
                                Assigned To
                            </th>
                            <th className={`${headerCellClass} w-[150px]`}>
                                Creation Date
                            </th>
                            <th className={`${headerCellClass} w-[140px]`}>
                                Deadline
                            </th>
                            <th className={`${headerCellClass} w-[220px]`}>
                                Remarks
                            </th>
                            <th className={`${headerCellClass} w-[120px]`}>
                                Actions
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {tasks.length > 0 ? (
                            tasks.map((task) => {
                                const visibleAssignees = task.assignedTo.slice(0, 2);
                                const remainingAssigneeCount =
                                    task.assignedTo.length - visibleAssignees.length;

                                return (
                                    <tr
                                        key={task.id}
                                        className="bg-slate-50 transition-colors hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-700/60"
                                    >
                                        <td className={`${bodyCellClass}`}>
                                            <div className="space-y-2">
                                                <p className="overflow-hidden break-words text-sm font-semibold leading-5 text-slate-900 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] dark:text-white">
                                                    {task.title}
                                                </p>
                                                <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[task.status]}`}>
                                                    {task.status}
                                                </span>
                                            </div>
                                        </td>

                                        <td className={`${bodyCellClass}`}>
                                            <div className="space-y-2">
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

                                                <p className="overflow-hidden break-words text-sm leading-5 text-slate-700 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] dark:text-slate-200">
                                                    {formatAssignedToSummary(task.assignedTo)}
                                                </p>
                                            </div>
                                        </td>
                                        <td className={`${bodyCellClass}`}>
                                            <span className="whitespace-nowrap text-sm font-medium text-slate-600 dark:text-slate-300">
                                                {formatCreationDate(task.createdAt)}
                                            </span>
                                        </td>
                                        <td className={`${bodyCellClass}`}>
                                            <span className="whitespace-nowrap text-sm font-medium text-slate-600 dark:text-slate-300">
                                                {formatDeadline(task.deadline)}
                                            </span>
                                        </td>
                                        <td className={`${bodyCellClass}`}>
                                            <p className="overflow-hidden break-words text-sm leading-5 text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] dark:text-slate-300">
                                                {task.remarks?.trim() || '--'}
                                            </p>
                                        </td>
                                        <td className={`${bodyCellClass}`}>
                                            <div className="flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => onEditTask(task)}
                                                    className="inline-flex h-10 min-w-[88px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                >
                                                    <PencilLine className="h-4 w-4" />
                                                    <span>Edit</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td
                                    colSpan={6}
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