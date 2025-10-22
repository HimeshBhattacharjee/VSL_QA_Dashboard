import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useAlert } from '../context/AlertContext';

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const [pageTitle, setPageTitle] = useState<string>('Home');
    const [pageSubTitle, setPageSubTitle] = useState<string>('');
    const [username, setUsername] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { showAlert } = useAlert();

    useEffect(() => {
        const storedUsername = sessionStorage.getItem("username");
        const storedIsLoggedIn = sessionStorage.getItem("isLoggedIn");
        setUsername(storedUsername);
        setIsLoggedIn(storedIsLoggedIn === "true");
    }, [location.pathname]);

    useEffect(() => {
        switch (location.pathname) {
            case '/':
                setPageTitle("VSL Quality Portal Login");
                setPageSubTitle("");
                break;
            case '/home':
                setPageTitle("Welcome to VSL's Quality Department");
                setPageSubTitle("Real-time access to test reports and quality checks");
                break;
            case '/quality-tests':
                setPageTitle("Quality Tests");
                setPageSubTitle("Access detailed quality test reports and analysis");
                break;
            case '/gel-test':
                setPageTitle("Gel Test");
                setPageSubTitle("Detailed Results of Gel Test");
                break;
            case '/peel-test':
                setPageTitle("Peel Test");
                setPageSubTitle("Detailed Results of Peel Test");
                break;
            case '/b-grade-trend':
                setPageTitle("B-Grade Trend Analysis");
                setPageSubTitle("Detailed Analysis of B-Grade Trend");
                break;
            case '/quality-analysis':
                setPageTitle("Quality Analysis");
                setPageSubTitle("Real-time Monitoring of Production Line Quality Metrics");
                break;
            case '/prelam':
                setPageTitle("Pre-Lamination Detailed Analysis");
                setPageSubTitle("Detailed quality metrics for Pre-Lamination process");
                break;
            case '/pre-el':
                setPageTitle("Pre-EL Detailed Analysis");
                setPageSubTitle("Detailed quality metrics for Pre-EL process");
                break;
            case '/visual':
                setPageTitle("Visual Detailed Analysis");
                setPageSubTitle("Detailed quality metrics for Visual Check process");
                break;
            case '/lamqc':
                setPageTitle("Post-Lamination Detailed Analysis");
                setPageSubTitle("Detailed quality metrics for Post-Lamination process");
                break;
            case '/fqc':
                setPageTitle("FQC Detailed Analysis");
                setPageSubTitle("Detailed quality metrics for Final QC process");
                break;
            case '/quality-audit':
                setPageTitle("Quality Audit");
                setPageSubTitle("Detailed Audit Checksheet Maintenance");
                break;
            default:
                setPageTitle("VSL Quality Portal");
                setPageSubTitle("");
        }
    }, [location.pathname]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setDropdownOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        sessionStorage.removeItem("isLoggedIn");
        sessionStorage.removeItem("username");
        setIsLoggedIn(false);
        setUsername(null);
        setDropdownOpen(false);
        showAlert('success', 'Logged out successfully!');
        navigate("/");
    };

    const handleUserIconClick = () => { if (isLoggedIn) setDropdownOpen(!dropdownOpen) };

    return (
        <div className="w-full mb-5 pt-2">
            <nav className="flex justify-between items-center py-4 px-5 relative min-h-20">
                <div className="flex items-center gap-5 flex-1">
                    <img src="../LOGOS/VSL_Logo (1).png" alt="VSL Logo"
                        className="cursor-pointer h-10 transition-all duration-300 hover:scale-105"
                        onClick={() => navigate('/home')}
                    />
                </div>
                <div className="absolute left-1/2 transform -translate-x-1/2 pt-4 text-center flex-2">
                    <h1 className="text-3xl text-white mb-1 drop-shadow-lg font-bold">{pageTitle}</h1>
                    {pageSubTitle && (<p className="text-white text-md opacity-90">{pageSubTitle}</p>)}
                </div>
                <div className="flex items-center justify-end flex-1 relative" ref={dropdownRef}>
                    {isLoggedIn ? (
                        <>
                            <div onClick={handleUserIconClick}
                                className="h-10 w-10 flex items-center justify-center rounded-full cursor-pointer border-2 border-white/80 bg-indigo-600 text-white font-semibold transition-all duration-300 hover:scale-110 hover:border-white hover:shadow-lg hover:shadow-white/30 select-none"
                            >
                                {username ? username.charAt(0).toUpperCase() : <span className="text-gray-300">?</span>}
                            </div>
                            {dropdownOpen && (
                                <div className="absolute right-0 mt-2 w-36 bg-white text-gray-800 rounded-lg shadow-lg py-2 border border-gray-200 animate-fade-in">
                                    <button onClick={handleLogout} className="block w-full text-left px-4 py-2 hover:bg-gray-100 font-medium">
                                        Logout
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="h-10 w-10 flex items-center justify-center rounded-full cursor-none border-2 border-white/80 bg-gray-700 text-white font-semibold select-none">
                            <span className="text-gray-300">?</span>
                        </div>
                    )}
                </div>
            </nav>
        </div>
    );
}