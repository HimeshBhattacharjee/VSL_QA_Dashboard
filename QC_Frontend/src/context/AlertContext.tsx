import React, { createContext, useContext, useRef, ReactNode } from 'react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertContextType { showAlert: (type: AlertType, message: string) => void; }

const AlertContext = createContext<AlertContextType | undefined>(undefined);

interface AlertProviderProps { children: ReactNode; }

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
    const alertContainerRef = useRef<HTMLDivElement>(null);
    const showAlert = (type: AlertType, message: string) => {
        const alertContainer = alertContainerRef.current;
        if (!alertContainer) return;
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        alert.innerHTML = `
            <div class="alert-icon">${icons[type]}</div>
            <div class="alert-content">
                <div class="alert-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="alert-message">${message}</div>
            </div>
            <button class="alert-close">&times;</button>
        `;
        const closeButton = alert.querySelector('.alert-close') as HTMLButtonElement;
        closeButton.addEventListener('click', () => {
            alert.classList.add('fade-out');
            setTimeout(() => {
                if (alert.parentNode) alert.parentNode.removeChild(alert);
            }, 500);
        });
        alertContainer.appendChild(alert);
        setTimeout(() => {
            if (alert.parentNode) {
                alert.classList.add('fade-out');
                setTimeout(() => {
                    if (alert.parentNode) alert.parentNode.removeChild(alert);
                }, 500);
            }
        }, 5000);
    };

    return (
        <AlertContext.Provider value={{ showAlert }}>
            {children}
            <div ref={alertContainerRef} className="fixed top-4 right-4 z-50 w-80"></div>
        </AlertContext.Provider>
    );
};

export const useAlert = (): AlertContextType => {
    const context = useContext(AlertContext);
    if (context === undefined) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};