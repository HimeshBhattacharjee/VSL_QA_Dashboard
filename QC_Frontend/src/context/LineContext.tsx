import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LineContextType { lineNumber: string; setLineNumber: (line: string) => void; }

const LineContext = createContext<LineContextType | undefined>(undefined);

export const LineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [lineNumber, setLineNumber] = useState<string>('');
    return (
        <LineContext.Provider value={{ lineNumber, setLineNumber }}>
            {children}
        </LineContext.Provider>
    );
};

export const useLine = () => {
    const context = useContext(LineContext);
    if (context === undefined) throw new Error('useLine must be used within a LineProvider');
    return context;
};