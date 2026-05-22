import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useLocation } from "react-router-dom";

interface Child {
    id: string;
    label: string;
    path: string | null;
    children?: Child[] | null;
}

interface SidebarItemProps {
    item: {
        id: string;
        label: string;
        icon: ReactNode;
        path: string | null;
        children: Child[] | null;
    };
    isExpanded: boolean;
    isActive: boolean;
    onToggleExpand: () => void;
    onItemClick: (path: string | null) => void;
}

export default function SidebarItem({
    item,
    isExpanded,
    isActive,
    onToggleExpand,
    onItemClick,
}: SidebarItemProps) {
    const location = useLocation();
    const [expandedChildren, setExpandedChildren] = useState<Set<string>>(new Set());
    const hasChildren = item.children && item.children.length > 0;

    const handleParentClick = () => {
        if (hasChildren) onToggleExpand();
        else onItemClick(item.path);
    };

    const isNodeActive = (node: Child): boolean => {
        if (node.path === location.pathname) {
            return true;
        }

        return Boolean(node.children?.some(isNodeActive));
    };

    const isNodeExpanded = (node: Child): boolean => {
        return expandedChildren.has(node.id) || Boolean(node.children?.some(isNodeActive));
    };

    const toggleChildExpand = (childId: string) => {
        setExpandedChildren((currentExpanded) => {
            const nextExpanded = new Set(currentExpanded);

            if (nextExpanded.has(childId)) {
                nextExpanded.delete(childId);
            } else {
                nextExpanded.add(childId);
            }

            return nextExpanded;
        });
    };

    const renderChildren = (children: Child[], depth = 0) => {
        const wrapperClass = depth === 0 ? "mt-2 ml-11 flex flex-col gap-1" : "mt-1 ml-4 flex flex-col gap-1";

        return (
            <div className={wrapperClass}>
                {children.map((child) => {
                    const hasNestedChildren = Boolean(child.children?.length);
                    const active = isNodeActive(child);
                    const expanded = hasNestedChildren ? isNodeExpanded(child) : false;

                    return (
                        <div key={child.id} className="flex flex-col">
                            <button
                                onClick={() => {
                                    if (hasNestedChildren) {
                                        toggleChildExpand(child.id);
                                        return;
                                    }

                                    onItemClick(child.path);
                                }}
                                aria-expanded={hasNestedChildren ? expanded : undefined}
                                className={`
                  group flex items-center gap-2
                  px-3 py-2 rounded-xl
                  text-left text-[13px]
                  transition-all duration-300
                  ${active
                                        ? `
                      bg-indigo-500/10 dark:bg-indigo-400/15
                      text-indigo-700 dark:text-indigo-200
                      shadow-sm
                    `
                                        : `
                      text-slate-600 dark:text-slate-300
                      hover:bg-slate-100/70 dark:hover:bg-slate-800/60
                      hover:text-slate-900 dark:hover:text-white
                    `}
                `}
                                style={depth > 0 ? { paddingLeft: `${12 + depth * 12}px` } : undefined}
                            >
                                <span
                                    className={`
                    h-2 w-2 rounded-full
                    transition-all duration-300
                    ${active
                                            ? "bg-indigo-600 dark:bg-indigo-300 scale-110"
                                            : "bg-slate-300 dark:bg-slate-600 group-hover:bg-indigo-400"}
                  `}
                                />
                                <span className="flex-1">{child.label}</span>
                                {hasNestedChildren && (
                                    <ChevronDown
                                        size={16}
                                        className={`
                      text-slate-500 transition-transform duration-300 dark:text-slate-300
                      ${expanded ? "rotate-180" : "rotate-0"}
                    `}
                                    />
                                )}
                            </button>
                            {hasNestedChildren && expanded && child.children && renderChildren(child.children, depth + 1)}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col w-full">
            <button
                onClick={handleParentClick}
                aria-expanded={hasChildren ? isExpanded : undefined}
                className={`
                    group relative w-full flex items-center gap-3
                    px-3 py-2.5 rounded-xl
                    text-left font-medium
                    transition-all duration-300
                    ${isActive
                                    ? `
                        bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-transparent
                        dark:from-indigo-400/20 dark:via-sky-400/10 dark:to-transparent
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
                            ? "bg-indigo-500 dark:bg-indigo-400 opacity-100"
                            : "opacity-0 group-hover:opacity-30 bg-slate-400"}
                        `}
                />
                <span
                    className={`
            flex items-center justify-center
            h-9 w-9 rounded-xl
            transition-all duration-300
            ${isActive
                            ? "bg-white/70 dark:bg-white/10 text-indigo-600 dark:text-indigo-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300"}
          `}
                >
                    {item.icon}
                </span>

                <span className="flex-1 text-[14px] tracking-wide">
                    {item.label}
                </span>

                {hasChildren && (
                    <ChevronDown
                        size={18}
                        className={`
              transition-transform duration-300
              text-slate-500 dark:text-slate-300
              ${isExpanded ? "rotate-180" : "rotate-0"}
              group-hover:text-slate-700 dark:group-hover:text-white
            `}
                    />
                )}
            </button>

            {hasChildren && isExpanded && item.children && renderChildren(item.children)}
        </div>
    );
}