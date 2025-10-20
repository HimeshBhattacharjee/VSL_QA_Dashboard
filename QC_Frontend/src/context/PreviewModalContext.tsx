import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface PreviewModalContent {
    title: string;
    content: string | React.ReactNode;
    exportExcel?: () => void;
    exportPDF?: () => void;
}

interface PreviewModalContextType {
    showPreview: (content: PreviewModalContent) => void;
    hidePreview: () => void;
    isPreviewVisible: boolean;
    previewContent: PreviewModalContent | null;
}

interface PreviewModalProviderProps { children: ReactNode }

const PreviewModalContext = createContext<PreviewModalContextType | undefined>(undefined);

export const PreviewModalProvider: React.FC<PreviewModalProviderProps> = ({ children }) => {
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [previewContent, setPreviewContent] = useState<PreviewModalContent | null>(null);
    const showPreview = (content: PreviewModalContent) => {
        setPreviewContent(content);
        setIsPreviewVisible(true);
    };
    const hidePreview = () => {
        setIsPreviewVisible(false);
        setPreviewContent(null);
    };
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) hidePreview();
    };
    const renderContent = () => {
        if (!previewContent) return null;
        if (typeof previewContent.content === 'string') return <div className="preview-report p-4" dangerouslySetInnerHTML={{ __html: previewContent.content }} />;
        else return <div className="preview-report p-4">{previewContent.content}</div>;
    };

    return (
        <PreviewModalContext.Provider value={{ showPreview, hidePreview, isPreviewVisible, previewContent }}>
            {children}
            {isPreviewVisible && previewContent && (
                <div
                    className="preview-modal fixed inset-0 bg-[rgba(0,0,0,0.7)] flex items-center justify-center z-50"
                    onClick={handleBackdropClick}
                >
                    <div className="preview-content bg-white rounded-lg shadow-xl w-[90%] h-[90%] overflow-auto">
                        <div className="preview-header flex justify-between items-center p-4 border-b">
                            <div className="preview-title text-xl font-bold">
                                {previewContent.title}
                            </div>
                            <div className="preview-buttons flex gap-2">
                                {previewContent.exportExcel && (
                                    <button
                                        className="preview-btn preview-export-excel cursor-pointer px-4 py-2 bg-green-500 text-white text-sm rounded-md font-medium hover:bg-green-600"
                                        onClick={previewContent.exportExcel}
                                    >
                                        Export as Excel
                                    </button>
                                )}
                                {previewContent.exportPDF && (
                                    <button
                                        className="preview-btn preview-export-pdf cursor-pointer px-4 py-2 bg-red-500 text-white text-sm rounded-md font-medium hover:bg-red-600"
                                        onClick={previewContent.exportPDF}
                                    >
                                        Export as PDF
                                    </button>
                                )}
                                <button
                                    className="close-preview cursor-pointer text-2xl font-bold text-gray-500 hover:text-gray-700"
                                    onClick={hidePreview}
                                >
                                    &times;
                                </button>
                            </div>
                        </div>
                        {renderContent()}
                    </div>
                </div>
            )}
        </PreviewModalContext.Provider>
    );
};

export const usePreviewModal = (): PreviewModalContextType => {
    const context = useContext(PreviewModalContext);
    if (context === undefined) throw new Error('usePreviewModal must be used within a PreviewModalProvider');
    return context;
};