import React from 'react';

interface TestHeaderProps {
    heading: string;
    criteria: string;
}

const TestHeading: React.FC<TestHeaderProps> = ({ heading, criteria }) => {
    return (
        <div className="w-full my-2">
            <div className="flex flex-wrap items-stretch justify-between gap-2 bg-white/70 dark:bg-[#1e252e]/90 backdrop-blur-md shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_28px_-8px_#00000080] border border-white/40 dark:border-gray-700/50 rounded-[2.5rem] md:rounded-[3rem] p-3 transition-colors duration-200">
                <div className="flex items-center gap-4 flex-1 min-w-[240px]">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 shadow-[0_0_0_3px_rgba(37,99,235,0.2)] dark:shadow-[0_0_0_3px_rgba(96,165,250,0.3)] animate-pulse" />
                    <h2 className="text-lg font-semibold tracking-tight text-gray-800 dark:text-gray-100">
                        {heading}
                    </h2>
                </div>
                <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-full pr-1 flex-wrap justify-end">
                    <span className="text-xs font-medium uppercase tracking-wider text-green-600 dark:text-green-100 bg-green-200/70 dark:bg-green-600 p-1 rounded-full border border-transparent dark:border-gray-600/40 whitespace-nowrap">
                        criteria
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100 break-words text-right">
                        {criteria}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default TestHeading;