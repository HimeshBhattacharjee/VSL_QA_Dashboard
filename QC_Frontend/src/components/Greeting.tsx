import React, { useEffect, useState } from 'react';

const Greeting: React.FC = () => {
    const getGreeting = (): string => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    const [greeting, setGreeting] = useState(getGreeting());

    useEffect(() => {
        const interval = setInterval(() => {
            setGreeting(getGreeting());
        }, 60000); // update every 1 minute

        return () => clearInterval(interval);
    }, []);

    return (
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {greeting},{" "}
            <span className="text-[#e31e24] dark:text-[#ff3b41]">
                Viking!
            </span>
        </h1>
    );
};

export default Greeting;