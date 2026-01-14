import { Outlet, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function ProtectedLayout() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (mobile) {
                if (!isMobile && mobile) setIsSidebarOpen(false);
            } else {
                if (isMobile && !mobile) setIsSidebarOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMobile]);

    if (!isLoggedIn) return <Navigate to="/login" replace />;

    const sidebarWidth = 280; // Match Sidebar.tsx width

    return (
        <div className="layout-container flex flex-col transition-all duration-300">
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
            <div
                className="layout-main flex flex-col flex-1 transition-all duration-300 ease-in-out"
                style={{
                    marginLeft: !isMobile && isSidebarOpen ? `${sidebarWidth}px` : '0px',
                }}
            >
                <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
                <main className="layout-content flex-1 p-2 md:p-4 w-full relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}