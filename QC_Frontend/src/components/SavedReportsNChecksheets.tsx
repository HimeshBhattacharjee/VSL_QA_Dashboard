import { useConfirmModal } from '../context/ConfirmModalContext';

export interface SavedReport {
    id?: string;
    name: string;
    timestamp: string | number;
    [key: string]: any;
}

interface SavedReportsProps {
    reports: SavedReport[];
    onExportExcel: (index: number) => void;
    onExportPdf: (index: number) => void;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
    emptyMessage?: {
        title: string;
        description: string;
    };
    showAdditionalInfo?: (report: SavedReport) => React.ReactNode;
    customActions?: (report: SavedReport, index: number) => React.ReactNode;
}

export default function SavedReportsNChecksheets({
    reports,
    onExportExcel,
    onExportPdf,
    onEdit,
    onDelete,
    emptyMessage = {
        title: 'No saved reports found.',
        description: 'Create and save your first report in the "Edit Report" tab.'
    },
    showAdditionalInfo,
    customActions
}: SavedReportsProps) {
    const { showConfirm } = useConfirmModal();
    const handleDelete = (index: number, reportName: string) => {
        showConfirm({
            title: 'Delete Report',
            message: `Are you sure you want to delete "${reportName}"? This action cannot be undone.`,
            type: 'warning',
            confirmText: 'Delete',
            onConfirm: () => onDelete(index)
        });
    };

    if (reports.length === 0) {
        return (
            <div className="saved-reports-container bg-white dark:bg-gray-900 p-4 md:p-5 rounded-md shadow-lg dark:shadow-gray-900/30">
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-center text-gray-800 dark:text-gray-100">
                    Saved Reports
                </h2>
                <div className="text-center py-6 md:py-8">
                    <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg">
                        {emptyMessage.title}
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 mt-2">
                        {emptyMessage.description}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="saved-reports-container bg-white dark:bg-gray-900 p-4 md:p-5 rounded-md shadow-lg dark:shadow-gray-900/30">
            <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-center text-gray-800 dark:text-gray-100">
                Saved Reports
            </h2>
            <div className="reports-list">
                {reports.map((report, index) => (
                    <div
                        key={report.id || `${report.name}-${index}`}
                        className="report-item border border-gray-200 dark:border-gray-700 rounded-lg p-3 md:p-4 mb-3 md:mb-4 shadow-sm hover:shadow-md dark:hover:shadow-gray-900/40 transition-all duration-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0">
                            <div className="flex-1">
                                <h3 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 break-words">
                                    {report.name}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mt-1">
                                    Saved on: {new Date(report.timestamp).toLocaleString()}
                                </p>
                                {showAdditionalInfo && (
                                    <div className="mt-2 md:mt-3">
                                        {showAdditionalInfo(report)}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 md:gap-2 md:flex-nowrap justify-start md:justify-end">
                                <button
                                    className="excel-export-btn cursor-pointer px-3 md:px-4 py-1.5 md:py-2 bg-blue-500 dark:bg-blue-600 text-white text-xs md:text-sm rounded-md font-medium transition-all hover:bg-green-500 dark:hover:bg-green-600 hover:scale-105 active:scale-95 flex items-center justify-center min-w-[36px] md:min-w-[44px]"
                                    onClick={() => onExportExcel(index)}
                                    title="Export to Excel"
                                    aria-label="Export to Excel"
                                >
                                    <img 
                                        src="/IMAGES/Excel.svg" 
                                        alt="Excel" 
                                        className="w-4 h-4 md:w-5 md:h-5 filter brightness-0 invert dark:brightness-0 dark:invert"
                                    />
                                </button>
                                <button
                                    className="pdf-export-btn cursor-pointer px-3 md:px-4 py-1.5 md:py-2 bg-blue-500 dark:bg-blue-600 text-white text-xs md:text-sm rounded-md font-medium transition-all hover:bg-red-500 dark:hover:bg-red-600 hover:scale-105 active:scale-95 flex items-center justify-center min-w-[36px] md:min-w-[44px]"
                                    onClick={() => onExportPdf(index)}
                                    title="Export to PDF"
                                    aria-label="Export to PDF"
                                >
                                    <img 
                                        src="/IMAGES/PDF.svg" 
                                        alt="PDF" 
                                        className="w-4 h-4 md:w-5 md:h-5 filter brightness-0 invert dark:brightness-0 dark:invert"
                                    />
                                </button>
                                <button
                                    className="edit-btn cursor-pointer px-3 md:px-4 py-1.5 md:py-2 bg-green-500 dark:bg-green-600 text-white text-xs md:text-sm rounded-md font-medium transition-all hover:bg-green-600 dark:hover:bg-green-700 hover:scale-105 active:scale-95 whitespace-nowrap"
                                    onClick={() => onEdit(index)}
                                    aria-label={`Edit ${report.name}`}
                                >
                                    Edit
                                </button>
                                {customActions && customActions(report, index)}
                                <button
                                    className="delete-btn cursor-pointer px-3 md:px-4 py-1.5 md:py-2 bg-red-500 dark:bg-red-600 text-white text-xs md:text-sm rounded-md font-medium transition-all hover:bg-red-600 dark:hover:bg-red-700 hover:scale-105 active:scale-95 whitespace-nowrap"
                                    onClick={() => handleDelete(index, report.name)}
                                    aria-label={`Delete ${report.name}`}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}