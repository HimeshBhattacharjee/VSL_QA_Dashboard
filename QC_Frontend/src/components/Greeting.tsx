import React from 'react';

const Greeting: React.FC = () => {
    const getGreeting = (): string => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    return (
        <div className="text-center">
            <div className="greeting text-3xl md:text-4xl font-bold text-slate-900 dark:text-gray-100 text-shadow-md">
                {getGreeting()}, Viking!
            </div>
        </div>
    );
};

export default Greeting;