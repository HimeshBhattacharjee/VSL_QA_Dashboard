import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

export type ConfirmType = 'success' | 'error' | 'warning' | 'info';

export interface ConfirmOptions {
    title: string;
    message: string;
    type: ConfirmType;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

interface ConfirmModalContextType { showConfirm: (options: ConfirmOptions) => void; }

const ConfirmModalContext = createContext<ConfirmModalContextType | undefined>(undefined);

interface ConfirmModalProviderProps { children: ReactNode; }

export const ConfirmModalProvider: React.FC<ConfirmModalProviderProps> = ({ children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null);
    const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
    const showConfirm = (options: ConfirmOptions) => {
        setConfirmOptions(options);
        setIsVisible(true);
    };
    const hideConfirm = () => {
        setIsVisible(false);
        setConfirmOptions(null);
    };
    const handleConfirm = () => {
        confirmOptions?.onConfirm();
        hideConfirm();
    };
    const handleCancel = () => {
        confirmOptions?.onCancel?.();
        hideConfirm();
    };
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) handleCancel();
    };
    const modalIcons: Record<ConfirmType, ReactNode> = {
        success: <CheckCircle2 className="h-8 w-8" />,
        error: <XCircle className="h-8 w-8" />,
        warning: <AlertTriangle className="h-8 w-8" />,
        info: <Info className="h-8 w-8" />,
    };
    const iconClasses: Record<ConfirmType, string> = {
        success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
        error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
        info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
    };
    const primaryClasses: Record<ConfirmType, string> = {
        success: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
        error: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        warning: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
        info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    };

    useEffect(() => {
        if (!isVisible) return;
        const timer = window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                handleCancel();
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                handleConfirm();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isVisible, confirmOptions]);

    return (
        <ConfirmModalContext.Provider value={{ showConfirm }}>
            {children}
            {isVisible && confirmOptions && (
                <div
                    className="custom-confirm-modal fixed inset-0 z-110 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    onClick={handleBackdropClick}
                >
                    <div
                        className="custom-confirm-content w-full max-w-sm rounded-lg bg-white shadow-xl dark:bg-gray-900"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="confirm-modal-title"
                    >
                        <div className="custom-confirm-header flex justify-center px-5 pt-5">
                            <span className={`custom-confirm-icon flex h-14 w-14 items-center justify-center rounded-full ${iconClasses[confirmOptions.type]}`}>
                                {modalIcons[confirmOptions.type]}
                            </span>
                        </div>
                        <div className="custom-confirm-body px-5 py-4 text-center">
                            <h3 id="confirm-modal-title" className="custom-confirm-title mb-2 text-xl font-bold text-gray-900 dark:text-white">
                                {confirmOptions.title}
                            </h3>
                            <p className="custom-confirm-message whitespace-pre-line text-sm leading-6 text-gray-600 dark:text-gray-300">
                                {confirmOptions.message}
                            </p>
                        </div>
                        <div className="custom-confirm-footer flex justify-center gap-2 px-5 pb-5">
                            <button
                                className="custom-confirm-btn custom-confirm-cancel w-1/2 cursor-pointer rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-900 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-900"
                                onClick={handleCancel}
                            >
                                {confirmOptions.cancelText || 'Cancel'}
                            </button>
                            <button
                                ref={confirmButtonRef}
                                className={`custom-confirm-btn custom-confirm-ok w-1/2 cursor-pointer rounded-md px-4 py-2 font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${primaryClasses[confirmOptions.type]}`}
                                onClick={handleConfirm}
                            >
                                {confirmOptions.confirmText || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmModalContext.Provider>
    );
};

export const useConfirmModal = (): ConfirmModalContextType => {
    const context = useContext(ConfirmModalContext);
    if (context === undefined) {
        throw new Error('useConfirmModal must be used within a ConfirmModalProvider');
    }
    return context;
};
