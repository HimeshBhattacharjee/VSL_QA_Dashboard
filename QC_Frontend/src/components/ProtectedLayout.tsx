import { Outlet, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import '../styles/Layout.css';

/**
 * ProtectedLayout Component
 * 
 * Wraps all authenticated routes with:
 * - Sidebar navigation
 * - Header with user info
 * - Main content area
 * 
 * This component maintains sidebar state across page navigation.
 * Authentication is checked by parent route guards in App.tsx
 */
export default function ProtectedLayout() {
    // Responsive state
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);

    const isLoggedIn = sessionStorage.getItem("isLoggedIn");

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (mobile) {
                // Optional: Auto-close on resize to mobile? 
                // Requirement says "Mobile ... Initial Load ... CLOSED". 
                // But resizing behavior isn't explicitly defined. 
                // Standard behavior: if switching to mobile, close it to avoid full screen block.
                // But if user opened it, maybe keep it? Let's stick to "Closed by default" logic implies mostly initial state.
                // However, I'll close it if we switch from desktop to mobile to be safe.
                if (!isMobile && mobile) setIsSidebarOpen(false);
            } else {
                // Switching to desktop
                if (isMobile && !mobile) setIsSidebarOpen(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMobile]);

    if (!isLoggedIn) return <Navigate to="/login" replace />;

    const sidebarWidth = 280; // Match Sidebar.tsx width

    return (
        <div className="layout-container min-h-screen bg-gray-50 flex flex-col transition-all duration-300">
            {/* Sidebar - Controlled by state */}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div
                className="layout-main flex flex-col flex-1 transition-all duration-300 ease-in-out"
                style={{
                    marginLeft: !isMobile && isSidebarOpen ? `${sidebarWidth}px` : '0px',
                }}
            >
                {/* Header - User info */}
                <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

                {/* Page Content - Routes rendered here */}
                <main className="layout-content flex-1 p-4 md:p-6 overflow-y-auto w-full relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
