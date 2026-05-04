import type { HTMLAttributes } from 'react';
import { CalendarDays } from 'lucide-react';
import {
    formatAssignedToSummary,
    getUserInitials,
} from '../utilities/taskAssignments';

export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'To Do' | 'Done';

export interface TaskCardData {
    id: string;
    title: string;
    description: string;
    assignedTo: string[];
    assignedBy: string;
    priority: TaskPriority;
    deadline?: string;
    status: TaskStatus;
    remarks?: string;
    createdAt: string;
}

interface TaskCardProps {
    task: TaskCardData;
    dragHandleProps?: HTMLAttributes<HTMLElement>;
    isDragging?: boolean;
    isOverlay?: boolean;
    onDoubleClick?: () => void;
}

const priorityStyles: Record<TaskPriority, string> = {
    Low: 'bg-slate-100 text-slate-700',
    Medium: 'bg-amber-100 text-amber-700',
    High: 'bg-rose-100 text-rose-700',
};

const statusStyles: Record<TaskStatus, { dot: string; pill: string }> = {
    'To Do': {
        dot: 'bg-rose-500',
        pill: 'border-rose-100 bg-rose-50 text-rose-700',
    },
    Done: {
        dot: 'bg-emerald-500',
        pill: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    },
};

const formatDate = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-IN', options).format(new Date(value));

export default function TaskCard({
    task,
    dragHandleProps,
    isDragging = false,
    isOverlay = false,
    onDoubleClick,
}: TaskCardProps) {
    const statusStyle = statusStyles[task.status];
    const visibleAssignees = task.assignedTo.slice(0, 2);
    const remainingAssigneeCount = task.assignedTo.length - visibleAssignees.length;
    const assigneeSummary = formatAssignedToSummary(task.assignedTo);

    return (
        <article
            {...dragHandleProps}
            onDoubleClick={onDoubleClick}
            className={`
                rounded-xl border border-slate-200 bg-white dark:bg-gray-800 p-4 shadow-sm
                transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
                ${dragHandleProps ? 'cursor-grab active:cursor-grabbing touch-none' : ''}
                ${isDragging ? 'opacity-60 shadow-xl' : ''}
                ${isOverlay ? 'rotate-[1deg] shadow-xl ring-2 ring-slate-200' : ''}
            `}
        >
            <header className="flex items-start justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityStyles[task.priority]}`}>
                    {task.priority} Priority
                </span>

                <div className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusStyle.pill}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${statusStyle.dot}`} />
                    <span>{task.status}</span>
                </div>
            </header>

            <div className="mt-2">
                <p className="overflow-hidden text-sm font-bold text-slate-900 dark:text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                    {task.title}
                </p>
            </div>

            <footer className="pt-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex shrink-0 items-center">
                            {visibleAssignees.length > 0 ? (
                                visibleAssignees.map((assignee) => (
                                    <div
                                        key={assignee}
                                        className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-semibold text-slate-700 first:ml-0 dark:border-slate-800 dark:bg-slate-700 dark:text-slate-100"
                                    >
                                        {getUserInitials(assignee)}
                                    </div>
                                ))
                            ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-700 dark:text-slate-200">
                                    --
                                </div>
                            )}

                            {remainingAssigneeCount > 0 && (
                                <div className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[11px] font-semibold text-white dark:border-slate-800 dark:bg-slate-600">
                                    +{remainingAssigneeCount}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-300">
                                {assigneeSummary}
                            </p>
                            {task.deadline && (
                                <div className="shrink-0 text-left text-xs text-slate-500">
                                    <div className="mt-1 flex items-center justify-start gap-2">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        <span>Due {formatDate(task.deadline, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mt-3 text-[11px] text-slate-400">
                    Created {formatDate(task.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
            </footer>
        </article>
    );
}
