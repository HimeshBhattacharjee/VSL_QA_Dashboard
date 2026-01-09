import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import SummaryGraph from '../components/SummaryGraph';

export default function PreLam() {
    const navigate = useNavigate();
    const [isLoaded, setIsLoaded] = useState(false);

    const handleBackToHome = () => {
        navigate('/home');
    };

    useEffect(() => {
        // Simulate initial loading and setup
        const timer = setTimeout(() => {
            setIsLoaded(true);
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    const reportSections = [
        {
            type: 'pre-el' as const,
            title: 'Pre-EL Inspection Report',
            subtitle: 'Pre-Electrical Quality Control Metrics',
            dashboardLink: '/pre-el'
        },
        {
            type: 'visual' as const,
            title: 'Visual Inspection Report',
            subtitle: 'Visual Quality Control Metrics',
            dashboardLink: '/visual'
        }
    ];

    return (
        <div className="pb-4">        
            <div className="max-w-7xl mx-auto">
                <div className="text-center text-white mb-6">
                    <button
                        onClick={handleBackToHome}
                        className="bg-white/20 text-white border-2 border-white px-4 py-1 rounded-3xl cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-x-1"
                    >
                        <span className="font-bold text-md">⇐</span> Back to Home
                    </button>
                </div>
                <div className="reports-container grid grid-cols-1 md:grid-cols-2 gap-6 px-6">
                    {reportSections.map((section, index) => (
                        <div
                            key={section.type}
                            className={`transition-all duration-500 ${
                                isLoaded 
                                    ? 'opacity-100 translate-y-0' 
                                    : 'opacity-0 translate-y-8'
                            }`}
                            style={{ transitionDelay: `${index * 100}ms` }}
                        >
                            <SummaryGraph {...section} />
                        </div>
                    ))}
                </div>
            </div>
            <div id="alert-container" className="fixed top-5 right-5 z-50 w-80"></div>
        </div>
    );
}