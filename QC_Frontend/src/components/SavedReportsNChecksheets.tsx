import { useConfirmModal } from '../context/ConfirmModalContext';
import { useState, useMemo } from 'react';

export interface SavedReport {
    id?: string;
    name: string;
    timestamp: string | number;
    shift?: string;
    date?: string;
    [key: string]: any;
}

export interface FilterConfig {
    type: 'date' | 'shift' | 'custom';
    label: string;
    options?: string[]; // For dropdown filters like shift
    customFilter?: (report: SavedReport, filterValue: string) => boolean;
}

interface SavedReportsProps {
    reports: SavedReport[];
    onExportExcel: (index: number) => void;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
    emptyMessage?: {
        title: string;
        description: string;
    };
    showAdditionalInfo?: (report: SavedReport) => React.ReactNode;
    customActions?: (report: SavedReport, index: number) => React.ReactNode;
    // New props for search and filter
    enableSearch?: boolean;
    enableFilters?: boolean;
    filterConfigs?: FilterConfig[];
    searchPlaceholder?: string;
    onSearch?: (searchTerm: string) => void; // Optional callback for external search handling
    onFilter?: (filterType: string, filterValue: string) => void; // Optional callback for external filter handling
}

export default function SavedReportsNChecksheets({
    reports,
    onExportExcel,
    onEdit,
    onDelete,
    emptyMessage = {
        title: 'No saved reports found.',
        description: 'Create and save your first report in the "Edit Report" tab.'
    },
    showAdditionalInfo,
    customActions,
    // New props with defaults
    enableSearch = true,
    enableFilters = true,
    filterConfigs = [],
    searchPlaceholder = "Search reports by name...",
    onSearch,
    onFilter
}: SavedReportsProps) {
    const { showConfirm } = useConfirmModal();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
    const [showFilters, setShowFilters] = useState(false);

    // Filter and search reports
    const filteredReports = useMemo(() => {
        let filtered = [...reports];

        // Apply search filter
        if (searchTerm.trim()) {
            filtered = filtered.filter(report => 
                report.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply active filters
        Object.entries(activeFilters).forEach(([filterType, filterValue]) => {
            if (!filterValue) return;
            
            const filterConfig = filterConfigs.find(f => f.type === filterType);
            
            filtered = filtered.filter(report => {
                if (filterConfig?.customFilter) {
                    return filterConfig.customFilter(report, filterValue);
                }
                
                // Default filtering based on type
                switch (filterType) {
                    case 'date':
                        const reportDate = new Date(report.timestamp).toDateString();
                        return reportDate === new Date(filterValue).toDateString();
                    case 'shift':
                        return report.shift === filterValue;
                    default:
                        return true;
                }
            });
        });

        return filtered;
    }, [reports, searchTerm, activeFilters, filterConfigs]);

    const handleDelete = (index: number, reportName: string) => {
        // Find the original index in the unfiltered reports array
        const originalIndex = reports.findIndex(r => r.id === filteredReports[index].id);
        showConfirm({
            title: 'Delete Report',
            message: `Are you sure you want to delete "${reportName}"? This action cannot be undone.`,
            type: 'warning',
            confirmText: 'Delete',
            onConfirm: () => onDelete(originalIndex)
        });
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (onSearch) {
            onSearch(value);
        }
    };

    const handleFilterChange = (filterType: string, value: string) => {
        setActiveFilters(prev => ({
            ...prev,
            [filterType]: value
        }));
        if (onFilter) {
            onFilter(filterType, value);
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setActiveFilters({});
    };

    const hasActiveFilters = searchTerm || Object.values(activeFilters).some(v => v);

    const renderEmptyState = () => (
        <div className="text-center py-6 md:py-8">
            <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg">
                {hasActiveFilters ? 'No matching reports found' : emptyMessage.title}
            </p>
            <p className="text-gray-400 dark:text-gray-500 mt-2">
                {hasActiveFilters ? 'Try adjusting your search or filters' : emptyMessage.description}
            </p>
            {hasActiveFilters && (
                <button
                    onClick={clearFilters}
                    className="mt-4 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white text-sm rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
                >
                    Clear all filters
                </button>
            )}
        </div>
    );

    return (
        <div className="saved-reports-container bg-white dark:bg-gray-900 p-4 md:p-5 rounded-md shadow-lg dark:shadow-gray-900/30">
            <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-center text-gray-800 dark:text-gray-100">
                Saved Reports
            </h2>

            {/* Search and Filter Bar */}
            {(enableSearch || enableFilters) && (
                <div className="mb-4 md:mb-5 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {enableSearch && (
                            <div className="flex-1">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        placeholder={searchPlaceholder}
                                        className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                                    />
                                    <svg
                                        className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                        />
                                    </svg>
                                </div>
                            </div>
                        )}
                        
                        {enableFilters && filterConfigs.length > 0 && (
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`px-4 py-2 border rounded-lg transition-all flex items-center justify-center gap-2 ${
                                    showFilters 
                                        ? 'bg-blue-500 dark:bg-blue-600 text-white border-blue-500 dark:border-blue-600' 
                                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                Filters
                                {Object.values(activeFilters).some(v => v) && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                                        {Object.values(activeFilters).filter(v => v).length}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Filter Options */}
                    {showFilters && enableFilters && filterConfigs.length > 0 && (
                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                            <div className="flex flex-wrap gap-4">
                                {filterConfigs.map((config) => (
                                    <div key={config.type} className="flex-1 min-w-[150px]">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            {config.label}
                                        </label>
                                        {config.type === 'date' ? (
                                            <input
                                                type="date"
                                                value={activeFilters[config.type] || ''}
                                                onChange={(e) => handleFilterChange(config.type, e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                            />
                                        ) : (
                                            <select
                                                value={activeFilters[config.type] || ''}
                                                onChange={(e) => handleFilterChange(config.type, e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                            >
                                                <option value="">All {config.label}</option>
                                                {config.options?.map(option => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            {hasActiveFilters && (
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={clearFilters}
                                        className="text-sm text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                                    >
                                        Clear all filters
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Reports List */}
            <div className="reports-list">
                {filteredReports.length === 0 ? (
                    renderEmptyState()
                ) : (
                    filteredReports.map((report, index) => (
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
                                        {report.shift && ` • Shift: ${report.shift}`}
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
                                        onClick={() => onExportExcel(reports.findIndex(r => r.id === report.id))}
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
                                        className="edit-btn cursor-pointer px-3 md:px-4 py-1.5 md:py-2 bg-green-500 dark:bg-green-600 text-white text-xs md:text-sm rounded-md font-medium transition-all hover:bg-green-600 dark:hover:bg-green-700 hover:scale-105 active:scale-95 whitespace-nowrap"
                                        onClick={() => onEdit(reports.findIndex(r => r.id === report.id))}
                                        aria-label={`Edit ${report.name}`}
                                    >
                                        Edit
                                    </button>
                                    {customActions && customActions(report, reports.findIndex(r => r.id === report.id))}
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
                    ))
                )}
            </div>
            
            {/* Results count */}
            {filteredReports.length > 0 && (
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Showing {filteredReports.length} of {reports.length} reports
                </div>
            )}
        </div>
    );
}