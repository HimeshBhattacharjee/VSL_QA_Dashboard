import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, type ReactNode } from 'react';
import { BarChart3, ClipboardList, FlaskConical, Home, ShieldCheck, X } from 'lucide-react';
import SidebarItem from './SidebarItem';
import {
    getCurrentTaskManagementRole,
    getTaskManagementPermissions,
} from '../utilities/taskAccess';

interface ChildItem {
    id: string;
    label: string;
    path: string | null;
    children?: ChildItem[] | null;
}

interface MenuItem {
    id: string;
    label: string;
    icon: ReactNode;
    path: string | null;
    children: ChildItem[] | null;
}

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const hasActiveChildPath = (children: ChildItem[] | null, pathname: string): boolean => {
    if (!children) {
        return false;
    }

    return children.some((child) => child.path === pathname || hasActiveChildPath(child.children || null, pathname));
};

const MENU_ITEMS: MenuItem[] = [
    {
        id: 'home',
        label: 'Home',
        icon: <Home size={18} />,
        path: '/home',
        children: null,
    },
    {
        id: 'task-management',
        label: 'Task Management',
        icon: <ClipboardList size={18} />,
        path: null,
        children: [
            { id: 'daily-meeting', label: 'Daily Meeting', path: '/daily-meeting' },
            { id: 'goal-meeting', label: 'Goal Meeting', path: '/goal-meeting' },
        ],
    },
    {
        id: 'quality-tests',
        label: 'Quality Tests',
        icon: <FlaskConical size={18} />,
        path: null,
        children: [
            { id: 'adhesion-test', label: 'Adhesion Test', path: '/adhesion-test' },
            { id: 'frame-sealant-wt', label: 'Frame Sealant Weight Report', path: '/frame-sealant-wt' },
            { id: 'gel-test', label: 'Gel Content Test', path: '/gel-test' },
            { id: 'jb-sealant-wt', label: 'JB Sealant Weight Measurement', path: '/jb-sealant-wt' },
            { id: 'potting', label: 'Potting Ratio Measurement', path: '/potting' },
            { id: 'rot-test', label: 'Robustness of Termination Test', path: '/rot-test' },
            { id: 'ssh-test', label: 'Sealant Shore Hardness Test', path: '/ssh-test' },
            { id: 'peel-test', label: 'Solar Cell Peel Strength Test', path: '/peel-test' },
            { id: 'wet-leakage-test', label: 'Wet Leakage Test', path: '/wet-leakage-test' },
        ],
    },
    {
        id: 'quality-analysis',
        label: 'Quality Analysis',
        icon: <BarChart3 size={18} />,
        path: null,
        children: [
            { id: 'b-grade', label: 'B-Grade', path: '/b-grade-trend' },
            { id: 'fqc-analysis', label: 'FQC Analysis', path: '/fqc' },
            { id: 'lam-qc', label: 'Lam QC', path: '/lamqc' },
            { id: 'pre-lam', label: 'Pre Lam', path: '/prelam' },
        ],
    },
    {
        id: 'audits',
        label: 'Audits',
        icon: <ShieldCheck size={18} />,
        path: null,
        children: [
            { id: 'ipqc-audit', label: 'IPQC Audits', path: '/quality-audit' },
        ],
    },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
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

    useEffect(() => {
        const nextMenuItems = permissions.canAccessTaskManagement
            ? MENU_ITEMS
            : MENU_ITEMS.filter((item) => item.id !== 'task-management');
        const newExpanded = new Set<string>();
        nextMenuItems.forEach((item) => {
            if (item.children) {
                const hasActiveChild = hasActiveChildPath(item.children, location.pathname);
                if (hasActiveChild) newExpanded.add(item.id);
            }
        });
        setExpandedItems(newExpanded);
    }, [location.pathname, permissions.canAccessTaskManagement]);

    const toggleExpand = (itemId: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(itemId)) newExpanded.delete(itemId);
        else newExpanded.add(itemId);
        setExpandedItems(newExpanded);
    };

    const handleMenuItemClick = (path: string | null) => {
        if (path) {
            navigate(path);
            if (isMobile) onClose();
        }
    };

    const isItemActive = (item: MenuItem): boolean => {
        if (item.path === location.pathname) return true;
        if (item.children) return hasActiveChildPath(item.children, location.pathname);
        return false;
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
                            isExpanded={expandedItems.has(item.id)}
                            isActive={isItemActive(item)}
                            onToggleExpand={() => toggleExpand(item.id)}
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