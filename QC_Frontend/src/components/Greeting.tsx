import React from 'react';

const Greeting: React.FC = () => {
    const getGreeting = (): string => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    return (
        <div className="text-center my-8 py-4">
            <div className="greeting text-5xl font-bold text-[#321D53] text-shadow-md">
                {getGreeting()}, Viking!
            </div>
        </div>
    );
};

export default Greeting;