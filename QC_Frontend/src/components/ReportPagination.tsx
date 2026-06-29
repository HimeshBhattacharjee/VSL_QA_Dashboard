const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

interface ReportPaginationProps {
    totalItems: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    itemLabel?: string;
    pageSizeOptions?: readonly number[];
}

export default function ReportPagination({
    totalItems,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    itemLabel = 'records',
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: ReportPaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const endItem = Math.min(totalItems, safePage * pageSize);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex flex-wrap items-center justify-center gap-2">
                <span>
                    {totalItems === 0
                        ? `0 ${itemLabel}`
                        : `Showing ${startItem}-${endItem} of ${totalItems} ${itemLabel}`}
                </span>
                <select
                    value={pageSize}
                    onChange={(event) => onPageSizeChange(Number(event.target.value))}
                    className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    aria-label="Items per page"
                >
                    {pageSizeOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(Math.max(1, safePage - 1))}
                    disabled={safePage <= 1}
                    className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-50 disabled:hover:border-gray-300 disabled:hover:text-inherit dark:hover:border-brand-primary-light dark:hover:text-brand-primary-light dark:disabled:hover:border-gray-700"
                >
                    Previous
                </button>
                <span>Page {safePage} of {totalPages}</span>
                <button
                    onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
                    disabled={safePage >= totalPages}
                    className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-50 disabled:hover:border-gray-300 disabled:hover:text-inherit dark:hover:border-brand-primary-light dark:hover:text-brand-primary-light dark:disabled:hover:border-gray-700"
                >
                    Next
                </button>
            </div>
        </div>
    );
}
