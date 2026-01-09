import { ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface Child {
    id: string;
    label: string;
    path: string;
}

interface SidebarItemProps {
    item: {
        id: string;
        label: string;
        icon: string;
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
    const hasChildren = item.children && item.children.length > 0;

    const handleParentClick = () => {
        if (hasChildren) {
            onToggleExpand();
        } else {
            onItemClick(item.path);
        }
    };

    const isChildActive = (childPath: string): boolean => {
        return location.pathname === childPath;
    };

    return (
        <div className="sidebar-item-container">
            {/* Main Menu Item */}
            <button
                className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
                onClick={handleParentClick}
                aria-expanded={hasChildren ? isExpanded : undefined}
            >
                <span className="sidebar-item-icon">{item.icon}</span>
                <span className="sidebar-item-label">{item.label}</span>
                {hasChildren && (
                    <ChevronDown
                        size={18}
                        className={`sidebar-item-chevron ${isExpanded ? 'sidebar-item-chevron-expanded' : ''
                            }`}
                    />
                )}
            </button>

            {/* Nested Children */}
            {hasChildren && isExpanded && item.children && (
                <div className="sidebar-children">
                    {item.children.map((child) => (
                        <button
                            key={child.id}
                            className={`sidebar-child-item ${isChildActive(child.path) ? 'active' : ''}`}
                            onClick={() => onItemClick(child.path)}
                        >
                            <span className="sidebar-child-dot" />
                            <span className="sidebar-child-label">{child.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
