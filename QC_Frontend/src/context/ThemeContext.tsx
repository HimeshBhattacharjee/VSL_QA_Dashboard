import React, { createContext, useContext, useState, ReactNode } from 'react';

type ThemeMode = 'Light' | 'Dark';

type ContextType = {
    currentMode: ThemeMode;
    setCurrentMode: (mode: ThemeMode) => void;
    setMode: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    themeSettings: boolean;
    setThemeSettings: (settings: boolean) => void;
};

const ThemeContext = createContext<ContextType | undefined>(undefined);

type ContextProviderProps = {
    children: ReactNode;
};

export const ThemeProvider: React.FC<ContextProviderProps> = ({ children }) => {
    const [currentMode, setCurrentMode] = useState<ThemeMode>('Light');
    const [themeSettings, setThemeSettings] = useState<boolean>(false);

    const setMode = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const mode = e.target.value as ThemeMode;
        setCurrentMode(mode);
        localStorage.setItem('themeMode', mode);
    };

    const value: ContextType = {
        currentMode,
        setCurrentMode,
        setMode,
        themeSettings,
        setThemeSettings,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useThemeContext = (): ContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useThemeContext must be used within a ThemeProvider');
    }
    return context;
};