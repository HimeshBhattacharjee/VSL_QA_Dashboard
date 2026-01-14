import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ConfirmType = 'success' | 'error' | 'warning' | 'info';

interface ConfirmOptions {
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
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    return (
        <ConfirmModalContext.Provider value={{ showConfirm }}>
            {children}
            {isVisible && confirmOptions && (
                <div
                    className="custom-confirm-modal fixed inset-0 bg-[rgba(0,0,0,0.7)] flex items-center justify-center z-50"
                    onClick={handleBackdropClick}
                >
                    <div className="custom-confirm-content bg-white rounded-lg shadow-lg max-w-sm">
                        <div className="custom-confirm-header p-5 text-center">
                            <span className="custom-confirm-icon text-4xl">
                                {icons[confirmOptions.type] || '⚠'}
                            </span>
                        </div>
                        <div className="custom-confirm-body p-2 text-center">
                            <h3 className="custom-confirm-title text-xl font-bold mb-2">
                                {confirmOptions.title}
                            </h3>
                            <p className="custom-confirm-message text-gray-600">
                                {confirmOptions.message}
                            </p>
                        </div>
                        <div className="custom-confirm-footer flex justify-center gap-2 p-4">
                            <button
                                className="custom-confirm-btn custom-confirm-cancel cursor-pointer w-[50%] px-4 py-2 bg-gray-200 text-black rounded-md font-medium hover:bg-gray-300"
                                onClick={handleCancel}
                            >
                                {confirmOptions.cancelText || 'Cancel'}
                            </button>
                            <button
                                className="custom-confirm-btn custom-confirm-ok cursor-pointer w-[50%] px-4 py-2 bg-red-500 text-white rounded-md font-medium hover:bg-red-600"
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