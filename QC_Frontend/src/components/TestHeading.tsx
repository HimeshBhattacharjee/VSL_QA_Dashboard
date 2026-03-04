import React from "react";
import { Info } from "lucide-react";

interface TestHeaderProps {
    heading: string;
    criteria: string;
}

const TestHeading: React.FC<TestHeaderProps> = ({ heading, criteria }) => {
    return (
        <div className="w-full mb-2">
            <div className="flex items-center gap-3 bg-white/70 dark:bg-[#1e252e]/90 backdrop-blur-md border border-white/40 dark:border-gray-700/50 rounded-2xl p-3">
                <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 shadow-[0_0_0_3px_rgba(37,99,235,0.2)] dark:shadow-[0_0_0_3px_rgba(96,165,250,0.3)] animate-pulse" />
                <div className="flex items-center gap-3 group">
                    <h2 className="text-md font-bold text-gray-800 dark:text-gray-100">
                        {heading}
                    </h2>
                    <div className="relative">
                        <span className="text-xs cursor-pointer text-blue-500"><Info className="w-5 h-5" /></span>
                        <div className="absolute hidden group-hover:block w-64 text-xs bg-gray-900 text-white p-2 rounded shadow-lg top-6 left-0">
                            {criteria}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestHeading;