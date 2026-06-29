import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import SidebarItem from './SidebarItem';
import { sectionNavigation } from '../navigation/sectionNavigation';
import {
    getCurrentTaskManagementRole,
    getTaskManagementPermissions,
} from '../utilities/taskAccess';

interface MenuItem {
    id: string;
    label: string;
    icon: ReactNode;
    path: string;
    activePaths: string[];
}

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const MENU_ITEMS: MenuItem[] = sectionNavigation.map((section) => {
    const Icon = section.icon;

    return {
        id: section.id,
        label: section.label,
        icon: <Icon size={18} />,
        path: section.path,
        activePaths: section.children.map((child) => child.path),
    };
});

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const currentUserRole = getCurrentTaskManagementRole();
    const permissions = getTaskManagementPermissions(currentUserRole);
    const visibleMenuItems = permissions.canAccessTaskManagement
        ? MENU_ITEMS
        : MENU_ITEMS.filter((item) => item.id !== 'task-management');

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleMenuItemClick = (path: string) => {
        navigate(path);
        if (isMobile) onClose();
    };

    const isItemActive = (item: MenuItem): boolean => {
        if (item.path === location.pathname) return true;
        return item.activePaths.includes(location.pathname);
    };

    const handleLogoClick = () => { navigate('/home'); };

    return (
        <>
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-45 transition-opacity duration-300"
                    onClick={onClose}
                />
            )}
            <aside
                className={`
                    fixed top-0 left-0 h-full bg-gray-200 dark:bg-slate-900 shadow-xl z-50 transition-transform duration-300 ease-in-out
                    w-[280px] flex flex-col
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="p-6 flex items-center justify-between">
                    <div
                        className="cursor-pointer ml-12"
                        onClick={handleLogoClick}
                    >
                        <img
                            src="../LOGOS/VSL_Logo (1).png"
                            alt="VSL Logo"
                            className="h-10 transition-transform hover:scale-105 dark:invert dark:brightness-0"
                        />
                    </div>
                    {isMobile && (
                        <button
                            onClick={onClose}
                            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar text-slate-900 dark:text-white">
                    {visibleMenuItems.map((item) => (
                        <SidebarItem
                            key={item.id}
                            item={item}
                            isActive={isItemActive(item)}
                            onItemClick={handleMenuItemClick}
                        />
                    ))}
                </nav>
                <div className="p-4">
                    <div className="text-center">
                        <p className="text-xs font-semibold text-gray-500">VSL Quality Control</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">(c) 2026</p>
                    </div>
                </div>
            </aside>
        </>
    );
}
