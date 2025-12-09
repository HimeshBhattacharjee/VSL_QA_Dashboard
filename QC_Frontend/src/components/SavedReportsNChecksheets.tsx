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
            <div className="saved-reports-container bg-white p-5 rounded-md shadow-lg">
                <h2 className="text-2xl font-bold mb-4 text-center">Saved Reports</h2>
                <div className="text-center py-8">
                    <p className="text-gray-500 text-lg">{emptyMessage.title}</p>
                    <p className="text-gray-400 mt-2">{emptyMessage.description}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="saved-reports-container bg-white p-5 rounded-md shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-center">Saved Reports</h2>
            <div className="reports-list">
                {reports.map((report, index) => (
                    <div
                        key={report.id || `${report.name}-${index}`}
                        className="report-item border border-gray-200 rounded-lg p-4 mb-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-center">
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-gray-800">{report.name}</h3>
                                <p className="text-gray-500 text-sm mt-1">
                                    Saved on: {new Date(report.timestamp).toLocaleString()}
                                </p>
                                {showAdditionalInfo && showAdditionalInfo(report)}
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    className="excel-export-btn cursor-pointer px-4 py-2 bg-blue-500 text-white text-sm rounded-md font-medium transition-colors hover:bg-green-500 flex items-center"
                                    onClick={() => onExportExcel(index)}
                                    title="Export to Excel"
                                >
                                    <img src="/IMAGES/Excel.svg" />
                                </button>
                                <button
                                    className="pdf-export-btn cursor-pointer px-4 py-2 bg-blue-500 text-white text-sm rounded-md font-medium transition-colors hover:bg-red-500 flex items-center"
                                    onClick={() => onExportPdf(index)}
                                    title="Export to PDF"
                                >
                                    <img src="/IMAGES/PDF.svg" />
                                </button>
                                <button
                                    className="edit-btn cursor-pointer px-4 py-2 bg-green-500 text-white text-sm rounded-md font-medium transition-colors hover:bg-green-600"
                                    onClick={() => onEdit(index)}
                                >
                                    Edit
                                </button>
                                {customActions && customActions(report, index)}
                                <button
                                    className="delete-btn cursor-pointer px-4 py-2 bg-red-500 text-white text-sm rounded-md font-medium transition-colors hover:bg-red-600"
                                    onClick={() => handleDelete(index, report.name)}
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