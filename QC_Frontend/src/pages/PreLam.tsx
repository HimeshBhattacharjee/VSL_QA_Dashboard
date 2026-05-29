import { useState, useEffect } from 'react';
import SummaryGraph from '../components/SummaryGraph';

export default function PreLam() {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoaded(true);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const reportSections = [
        {
            type: 'pre-el' as const,
            title: 'Pre-EL Inspection Report',
            subtitle: 'Pre-EL Quality Control Metrics',
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
        <>
            <div className="mx-auto">
                <div className="reports-container grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </>
    );
}