export type ReportSortOption =
    | 'newest-created'
    | 'oldest-created'
    | 'newest-updated'
    | 'oldest-updated'
    | 'name-asc'
    | 'name-desc';

export interface ReportListRecord {
    name?: string;
    timestamp?: string | number | null;
    updatedAt?: string | number | null;
    workflowState?: string | null;
    status?: string | null;
    createdByEmployeeName?: string | null;
    createdByEmployeeId?: string | null;
    createdBy?: string | null;
    submittedBy?: string | null;
    returnedBy?: string | null;
}

interface ReportListControlsProps {
    searchTerm: string;
    sortOption: ReportSortOption;
    totalCount: number;
    filteredCount: number;
    onSearchTermChange: (value: string) => void;
    onSortOptionChange: (value: ReportSortOption) => void;
    searchPlaceholder?: string;
}

const getTimeValue = (value: string | number | null | undefined) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
};

const getSearchText = (report: ReportListRecord) => [
    report.name,
    report.createdByEmployeeName,
    report.createdByEmployeeId,
    report.createdBy,
    report.workflowState,
    report.status,
    report.submittedBy,
    report.returnedBy,
].filter(Boolean).join(' ').toLowerCase();

export const filterSortReports = <T extends ReportListRecord>(
    reports: T[],
    searchTerm: string,
    sortOption: ReportSortOption
) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = normalizedSearch
        ? reports.filter(report => getSearchText(report).includes(normalizedSearch))
        : [...reports];

    filtered.sort((left, right) => {
        switch (sortOption) {
            case 'oldest-created':
                return getTimeValue(left.timestamp) - getTimeValue(right.timestamp);
            case 'newest-updated':
                return getTimeValue(right.updatedAt || right.timestamp) - getTimeValue(left.updatedAt || left.timestamp);
            case 'oldest-updated':
                return getTimeValue(left.updatedAt || left.timestamp) - getTimeValue(right.updatedAt || right.timestamp);
            case 'name-asc':
                return (left.name || '').localeCompare(right.name || '');
            case 'name-desc':
                return (right.name || '').localeCompare(left.name || '');
            case 'newest-created':
            default:
                return getTimeValue(right.timestamp) - getTimeValue(left.timestamp);
        }
    });

    return filtered;
};

export default function ReportListControls({
    searchTerm,
    sortOption,
    totalCount,
    filteredCount,
    onSearchTermChange,
    onSortOptionChange,
    searchPlaceholder = 'Search reports...',
}: ReportListControlsProps) {
    return (
        <div className="mb-2 flex flex-col gap-3 rounded-md md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor="report-list-search">Search reports</label>
                <input
                    id="report-list-search"
                    type="text"
                    value={searchTerm}
                    onChange={(event) => onSearchTermChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {filteredCount} of {totalCount}
                </span>
                <label className="sr-only" htmlFor="report-list-sort">Sort reports</label>
                <select
                    id="report-list-sort"
                    value={sortOption}
                    onChange={(event) => onSortOptionChange(event.target.value as ReportSortOption)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    aria-label="Sort reports"
                >
                    <option value="newest-created">Newest Created</option>
                    <option value="oldest-created">Oldest Created</option>
                    <option value="newest-updated">Newest Updated</option>
                    <option value="oldest-updated">Oldest Updated</option>
                    <option value="name-asc">A - Z</option>
                    <option value="name-desc">Z - A</option>
                </select>
            </div>
        </div>
    );
}
