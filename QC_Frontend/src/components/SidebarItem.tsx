import type { ReactNode } from "react";

interface SidebarItemProps {
    item: {
        id: string;
        label: string;
        icon: ReactNode;
        path: string;
    };
    isActive: boolean;
    onItemClick: (path: string) => void;
}

export default function SidebarItem({
    item,
    isActive,
    onItemClick,
}: SidebarItemProps) {
    const handleParentClick = () => {
        onItemClick(item.path);
    };

    return (
        <div className="flex flex-col w-full">
            <button
                type="button"
                onClick={handleParentClick}
                className={`
                    group relative w-full flex items-center gap-3
                    rounded-xl px-3 py-2.5 text-left font-medium
                    transition-all duration-300
                    ${isActive
                        ? `
                        bg-brand-primary/10 dark:bg-brand-primary/15
                        text-slate-900 dark:text-white
                        shadow-sm
                        `
                                    : `
                        text-slate-700 dark:text-slate-200
                        hover:bg-slate-100/80 dark:hover:bg-slate-800/60
                    `}
                `}
            >
                <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full transition-all duration-300
                        ${isActive
                            ? "bg-brand-primary dark:bg-brand-primary-light opacity-100"
                            : "opacity-0 group-hover:opacity-30 bg-slate-400"}
                        `}
                />
                <span
                    className={`
            flex items-center justify-center
            h-9 w-9 rounded-xl
            transition-all duration-300
            ${isActive
                        ? "bg-white/70 dark:bg-white/10 text-brand-primary dark:text-brand-primary-light"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 group-hover:text-brand-primary dark:group-hover:text-brand-primary-light"}
          `}
                >
                    {item.icon}
                </span>

                <span className="min-w-0 flex-1 text-[14px] tracking-wide">
                    {item.label}
                </span>
            </button>
        </div>
    );
}
