import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import SidebarItem from './SidebarItem';
import '../styles/Sidebar.css';

interface ChildItem {
    id: string;
    label: string;
    path: string;
}

interface MenuItem {
    id: string;
    label: string;
    icon: string;
    path: string | null;
    children: ChildItem[] | null;
}

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

// Menu structure with main items and nested sub-items
const MENU_ITEMS: MenuItem[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: '📊',
        path: '/home',
        children: null,
    },
    {
        id: 'quality-tests',
        label: 'Quality Tests',
        icon: '🧪',
        path: null, // Parent doesn't navigate
        children: [
            { id: 'gel-test', label: 'Gel Test', path: '/gel-test' },
            { id: 'peel-test', label: 'Peel Test', path: '/peel-test' },
            { id: 'b-grade', label: 'B-Grade', path: '/b-grade-trend' },
        ],
    },
    {
        id: 'quality-analysis',
        label: 'Quality Analysis',
        icon: '📈',
        path: null,
        children: [
            { id: 'pre-lam', label: 'Pre Lam', path: '/prelam' },
            { id: 'lam-qc', label: 'Lam QC', path: '/lamqc' },
            { id: 'fqc-analysis', label: 'FQC Analysis', path: '/fqc' },
        ],
    },
    {
        id: 'audits',
        label: 'Audits',
        icon: '📋',
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

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-expand parent when child is active
    useEffect(() => {
        const newExpanded = new Set<string>();
        MENU_ITEMS.forEach((item) => {
            if (item.children) {
                const hasActiveChild = item.children.some(
                    (child) => child.path === location.pathname
                );
                if (hasActiveChild) {
                    newExpanded.add(item.id);
                }
            }
        });
        setExpandedItems(newExpanded);
    }, [location.pathname]);

    const toggleExpand = (itemId: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(itemId)) {
            newExpanded.delete(itemId);
        } else {
            newExpanded.add(itemId);
        }
        setExpandedItems(newExpanded);
    };

    const handleMenuItemClick = (path: string | null) => {
        if (path) {
            navigate(path);
            // Close sidebar on mobile after navigation
            if (isMobile) {
                onClose();
            }
        }
    };

    const isItemActive = (item: MenuItem): boolean => {
        if (item.path === location.pathname) return true;
        if (item.children) {
            return item.children.some((child) => child.path === location.pathname);
        }
        return false;
    };

    const handleLogoClick = () => {
        navigate('/home');
    };

    return (
        <>
            {/* Overlay for Mobile Only */}
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`
                    fixed top-0 left-0 h-full bg-white shadow-xl z-50 transition-transform duration-300 ease-in-out
                    w-[280px] flex flex-col
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                `}

            >
                {/* Branding / Logo Section */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-br from-indigo-50 to-white">
                    <div
                        className="cursor-pointer ml-12"
                        onClick={handleLogoClick}
                    >
                        <img
                            src="../LOGOS/VSL_Logo (1).png"
                            alt="VSL Logo"
                            className="h-10 transition-transform hover:scale-105"
                        />
                    </div>

                    {/* Mobile Close Button */}
                    {isMobile && (
                        <button
                            onClick={onClose}
                            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                    {MENU_ITEMS.map((item) => (
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

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <div className="text-center">
                        <p className="text-xs font-semibold text-gray-500">VSL Quality Control</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">© 2026</p>
                    </div>
                </div>
            </aside>
        </>
    );
}
