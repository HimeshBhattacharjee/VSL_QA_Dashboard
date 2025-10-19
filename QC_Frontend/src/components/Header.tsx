// Header.tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const [pageTitle, setPageTitle] = useState<string>('Home');
    const [pageSubTitle, setPageSubTitle] = useState<string>('');

    useEffect(() => {
        switch (location.pathname) {
            case '/':
                setPageTitle("Welcome to VSL's Quality Department");
                setPageSubTitle("Real-time access to test reports and quality checks");
                break;
            case '/quality-tests':
                setPageTitle("Quality Tests");
                setPageSubTitle("Access detailed quality test reports and analysis");
                break;
            case '/quality-analysis':
                setPageTitle("Quality Analysis");
                setPageSubTitle("Real-time Monitoring of Production Line Quality Metrics");
                break;
            case '/quality-audit':
                setPageTitle("Quality Audit");
                setPageSubTitle("Detailed Audit Checksheet Maintenance");
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
            default:
                setPageTitle("VSL Quality Portal");
                setPageSubTitle("");
        }
    }, [location.pathname]);

    return (
        <div className="w-full mb-5 pt-2">
            <nav className="flex justify-between items-center py-4 px-5 relative min-h-20">
                <div className="flex items-center gap-5 flex-1">
                    <img
                        src="../LOGOS/VSL_Logo (1).png"
                        alt="VSL Logo"
                        className="cursor-pointer h-10 transition-all duration-300 hover:scale-105"
                        onClick={() => navigate('/')}
                    />
                </div>
                <div className="absolute left-1/2 transform -translate-x-1/2 pt-4 text-center flex-2">
                    <h1 className="text-3xl text-white mb-1 drop-shadow-lg font-bold">{pageTitle}</h1>
                    {pageSubTitle && (<p className="text-white text-md opacity-90">{pageSubTitle}</p>)}
                </div>
                <div className="flex items-center justify-end flex-1">
                    <div className="relative">
                        <img
                            src="../LOGOS/user.png"
                            alt="User"
                            className="h-10 w-10 rounded-full object-cover cursor-pointer border-2 border-white/80 transition-all duration-300 hover:scale-110 hover:border-white hover:shadow-lg hover:shadow-white/30"
                        />
                    </div>
                </div>
            </nav>
        </div>
    );
}