import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextType = {
    theme: Theme;
    setTheme: (t: Theme, persist?: boolean) => void;
    toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

type Props = { children: ReactNode };

const applyThemeToHtml = (theme: Theme) => {
    const html = document.documentElement;
    if (!html) return;
    if (theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
};

export const ThemeProvider = ({ children }: Props) => {
    const getInitialTheme = (): Theme => {
        try {
            const stored = localStorage.getItem('theme');
            if (stored === 'light' || stored === 'dark') return stored;
        } catch (e) {
            // ignore
        }
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    };

    const [theme, setThemeState] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        // Apply immediately on mount to avoid flicker
        applyThemeToHtml(theme);
    }, []); // run once

    const setTheme = async (t: Theme, persist = true) => {
        setThemeState(t);
        try { localStorage.setItem('theme', t); } catch (e) {}
        applyThemeToHtml(t);

        if (persist) {
            const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
            const employeeId = sessionStorage.getItem('employeeId');
            if (isLoggedIn && employeeId) {
                try {
                    const API_BASE = import.meta.env.VITE_API_URL;
                    await fetch(`${API_BASE}/user/me/theme`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ employeeId, theme: t })
                    });
                } catch (e) {
                    console.error('Failed to persist theme to backend', e);
                }
            }
        }
    };

    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};