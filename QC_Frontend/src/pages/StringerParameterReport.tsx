import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CheckSquare2, ChevronLeft, ChevronRight, Download,
    Eraser, Redo2, RefreshCw, Save, Search, Undo2, X
} from 'lucide-react';
import { useAlert } from '../context/AlertContext';

type ReportLine = 'I' | 'II';
type ManualField = 'moduleType' | 'cellType' | 'cellWp';

interface ManualValues { moduleType: string; cellType: string; cellWp: string; }

interface AuditColumn { key: string; label: string; excel: string; }

interface AuditValues { unitA: Record<string, string>; unitB: Record<string, string>; }

interface StringerReportRow extends ManualValues {
    rowKey: string;
    date: string;
    shift: string;
    line: ReportLine;
    poNumber: string;
    machine: number;
    auditValues: AuditValues;
    auditSource?: {
        auditId: string;
        updatedTimestamp: string;
        name: string;
    } | null;
}

interface StringerReportResponse {
    year: number;
    month: number;
    line: ReportLine;
    rows: StringerReportRow[];
    auditColumns: AuditColumn[];
    shifts: string[];
    machineNumbers: number[];
    auditSourceCount?: number;
    syncedAt?: string;
}

type ManualValuesMap = Record<string, ManualValues>;
type SortOption = 'date-asc' | 'date-desc' | 'machine-asc' | 'po-asc';

const MANUAL_FIELDS: { key: ManualField; label: string }[] = [
    { key: 'moduleType', label: 'Module Type' },
    { key: 'cellType', label: 'Cell Type' },
    { key: 'cellWp', label: 'Cell WP' },
];
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const HISTORY_LIMIT = 50;

const createManualValues = (row?: Partial<ManualValues>): ManualValues => ({
    moduleType: String(row?.moduleType || ''),
    cellType: String(row?.cellType || ''),
    cellWp: String(row?.cellWp || ''),
});

const buildManualValuesMap = (rows: StringerReportRow[]): ManualValuesMap =>
    Object.fromEntries(rows.map(row => [row.rowKey, createManualValues(row)]));

const cloneManualValuesMap = (values: ManualValuesMap): ManualValuesMap =>
    Object.fromEntries(
        Object.entries(values).map(([rowKey, manual]) => [rowKey, { ...manual }])
    );

const manualValuesEqual = (left?: ManualValues, right?: ManualValues) =>
    MANUAL_FIELDS.every(field => String(left?.[field.key] || '') === String(right?.[field.key] || ''));

const normalizeSearchValue = (value: unknown) => String(value || '').trim().toLowerCase();

const formatDate = (value: string) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${day}-${month}-${year}`;
};

const formatDateTime = (value?: string) => {
    if (!value) return 'Not synced yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
};

const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
};

export default function StringerParameterReport() {
    const now = useMemo(() => new Date(), []);
    const { showAlert } = useAlert();
    const API_BASE_URL = `${import.meta.env.VITE_API_URL}/stringer-parameter-reports`;
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [line, setLine] = useState<ReportLine>('I');
    const [report, setReport] = useState<StringerReportResponse | null>(null);
    const [rows, setRows] = useState<StringerReportRow[]>([]);
    const [manualValues, setManualValues] = useState<ManualValuesMap>({});
    const [savedManualValues, setSavedManualValues] = useState<ManualValuesMap>({});
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [past, setPast] = useState<ManualValuesMap[]>([]);
    const [future, setFuture] = useState<ManualValuesMap[]>([]);
    const [shiftFilter, setShiftFilter] = useState('');
    const [machineFilter, setMachineFilter] = useState('');
    const [poFilter, setPoFilter] = useState('');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortOption>('date-asc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [bulkField, setBulkField] = useState<ManualField>('moduleType');
    const [bulkValue, setBulkValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const manualValuesRef = useRef(manualValues);
    const savedManualValuesRef = useRef(savedManualValues);
    const dirtyCountRef = useRef(0);

    useEffect(() => {
        manualValuesRef.current = manualValues;
    }, [manualValues]);

    useEffect(() => {
        savedManualValuesRef.current = savedManualValues;
    }, [savedManualValues]);

    const authHeaders = useCallback((includeJson = false): HeadersInit => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        'X-Employee-Id': sessionStorage.getItem('employeeId') || '',
        'X-User-Name': sessionStorage.getItem('username') || '',
        'X-User-Role': sessionStorage.getItem('userRole') || '',
    }), []);

    const dirtyRowKeys = useMemo(
        () => rows
            .filter(row => !manualValuesEqual(manualValues[row.rowKey], savedManualValues[row.rowKey]))
            .map(row => row.rowKey),
        [manualValues, rows, savedManualValues]
    );

    useEffect(() => {
        dirtyCountRef.current = dirtyRowKeys.length;
    }, [dirtyRowKeys.length]);

    const applyReportPayload = useCallback((
        payload: StringerReportResponse,
        preserveLocalManualValues = false
    ) => {
        const serverManualValues = buildManualValuesMap(payload.rows || []);
        setReport(payload);
        setRows(payload.rows || []);
        setSavedManualValues(serverManualValues);
        setManualValues(previous => preserveLocalManualValues
            ? {
                ...serverManualValues,
                ...Object.fromEntries(
                    Object.entries(previous).filter(([rowKey, values]) =>
                        !manualValuesEqual(values, savedManualValuesRef.current[rowKey])
                    )
                ),
            }
            : serverManualValues
        );
        if (!preserveLocalManualValues) {
            setSelectedRows(new Set());
            setPast([]);
            setFuture([]);
        }
    }, []);

    const loadReport = useCallback(async (
        forceRefresh = false,
        preserveLocalManualValues = false,
        silent = false
    ) => {
        if (!silent) setIsLoading(true);
        try {
            const query = new URLSearchParams({
                year: String(year),
                month: String(month),
                line,
                refresh: String(forceRefresh),
            });
            const response = await fetch(`${API_BASE_URL}/monthly?${query}`, {
                headers: authHeaders(),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to load report');
            }
            const result = await response.json();
            applyReportPayload(result.data as StringerReportResponse, preserveLocalManualValues);
            if (forceRefresh && !silent) showAlert('success', 'Report refreshed from IPQC audits');
        } catch (error) {
            console.error('Error loading Stringer Parameter Report:', error);
            if (!silent) {
                showAlert('error', error instanceof Error ? error.message : 'Failed to load report');
            }
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [API_BASE_URL, applyReportPayload, authHeaders, line, month, showAlert, year]);

    useEffect(() => {
        setPage(1);
        setShiftFilter('');
        setMachineFilter('');
        setPoFilter('');
        setSearch('');
        loadReport();
    }, [line, loadReport, month, year]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            if (dirtyCountRef.current === 0) {
                loadReport(false, true, true);
            }
        }, 60_000);
        return () => window.clearInterval(interval);
    }, [loadReport]);

    const commitManualValues = useCallback((nextValues: ManualValuesMap) => {
        setPast(previous => [...previous.slice(-(HISTORY_LIMIT - 1)), cloneManualValuesMap(manualValuesRef.current)]);
        setFuture([]);
        setManualValues(nextValues);
    }, []);

    const handleUndo = useCallback(() => {
        setPast(previous => {
            if (previous.length === 0) return previous;
            const restored = previous[previous.length - 1];
            setFuture(next => [cloneManualValuesMap(manualValuesRef.current), ...next].slice(0, HISTORY_LIMIT));
            setManualValues(cloneManualValuesMap(restored));
            return previous.slice(0, -1);
        });
    }, []);

    const handleRedo = useCallback(() => {
        setFuture(previous => {
            if (previous.length === 0) return previous;
            const restored = previous[0];
            setPast(next => [...next.slice(-(HISTORY_LIMIT - 1)), cloneManualValuesMap(manualValuesRef.current)]);
            setManualValues(cloneManualValuesMap(restored));
            return previous.slice(1);
        });
    }, []);

    useEffect(() => {
        const handleKeyboardShortcut = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) return;
            if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
                event.preventDefault();
                handleUndo();
            } else if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
                event.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handleKeyboardShortcut);
        return () => window.removeEventListener('keydown', handleKeyboardShortcut);
    }, [handleRedo, handleUndo]);

    const updateManualField = (rowKey: string, field: ManualField, value: string) => {
        const nextValues = cloneManualValuesMap(manualValuesRef.current);
        nextValues[rowKey] = {
            ...createManualValues(nextValues[rowKey]),
            [field]: value,
        };
        commitManualValues(nextValues);
    };

    const filteredRows = useMemo(() => {
        const normalizedPo = normalizeSearchValue(poFilter);
        const normalizedSearch = normalizeSearchValue(search);
        const filtered = rows.filter(row => {
            const manual = manualValues[row.rowKey] || createManualValues();
            if (shiftFilter && row.shift !== shiftFilter) return false;
            if (machineFilter && String(row.machine) !== machineFilter) return false;
            if (normalizedPo && !normalizeSearchValue(row.poNumber).includes(normalizedPo)) return false;
            if (normalizedSearch) {
                const searchable = [
                    row.date,
                    row.shift,
                    row.poNumber,
                    row.machine,
                    manual.moduleType,
                    manual.cellType,
                    manual.cellWp,
                ].map(normalizeSearchValue).join(' ');
                if (!searchable.includes(normalizedSearch)) return false;
            }
            return true;
        });

        return filtered.sort((left, right) => {
            if (sort === 'date-desc') return right.rowKey.localeCompare(left.rowKey);
            if (sort === 'machine-asc') return left.machine - right.machine || left.rowKey.localeCompare(right.rowKey);
            if (sort === 'po-asc') return left.poNumber.localeCompare(right.poNumber) || left.rowKey.localeCompare(right.rowKey);
            return left.rowKey.localeCompare(right.rowKey);
        });
    }, [machineFilter, manualValues, poFilter, rows, search, shiftFilter, sort]);

    useEffect(() => {
        setPage(1);
    }, [machineFilter, pageSize, poFilter, search, shiftFilter, sort]);

    const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const allFilteredSelected = filteredRows.length > 0 && filteredRows.every(row => selectedRows.has(row.rowKey));
    const selectedCount = selectedRows.size;

    const toggleRowSelection = (rowKey: string) => {
        setSelectedRows(previous => {
            const next = new Set(previous);
            if (next.has(rowKey)) next.delete(rowKey);
            else next.add(rowKey);
            return next;
        });
    };

    const toggleFilteredSelection = () => {
        setSelectedRows(previous => {
            const next = new Set(previous);
            if (allFilteredSelected) {
                filteredRows.forEach(row => next.delete(row.rowKey));
            } else {
                filteredRows.forEach(row => next.add(row.rowKey));
            }
            return next;
        });
    };

    const applyBulkValue = (value: string) => {
        if (selectedRows.size === 0) {
            showAlert('error', 'Select at least one row');
            return;
        }
        const nextValues = cloneManualValuesMap(manualValuesRef.current);
        selectedRows.forEach(rowKey => {
            nextValues[rowKey] = {
                ...createManualValues(nextValues[rowKey]),
                [bulkField]: value,
            };
        });
        commitManualValues(nextValues);
    };

    const saveChanges = async () => {
        if (dirtyRowKeys.length === 0) return;
        setIsSaving(true);
        try {
            const changes = dirtyRowKeys.map(rowKey => ({
                rowKey,
                ...manualValues[rowKey],
            }));
            const response = await fetch(`${API_BASE_URL}/manual-fields`, {
                method: 'PUT',
                headers: authHeaders(true),
                body: JSON.stringify({ year, month, line, changes }),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to save changes');
            }
            const result = await response.json();
            applyReportPayload(result.data as StringerReportResponse);
            showAlert('success', result.message || 'Changes saved');
        } catch (error) {
            console.error('Error saving Stringer Parameter Report:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const exportExcel = async () => {
        if (dirtyRowKeys.length > 0) {
            showAlert('error', 'Save manual changes before exporting');
            return;
        }
        setIsLoading(true);
        try {
            const exportPayload = {
                year,
                month,
                line,
                filters: {
                    shift: shiftFilter,
                    machine: machineFilter,
                    poNumber: poFilter,
                    search,
                    sort,
                    page: currentPage,
                    pageSize,
                },
            };
            const response = await fetch(`${API_BASE_URL}/export/excel`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify(exportPayload),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || 'Failed to export report');
            }
            const blob = await response.blob();
            downloadBlob(blob, `Stringer_Parameter_Report_Line-${line}_${year}_${String(month).padStart(2, '0')}.xlsx`);
            showAlert('success', 'Excel report generated');
        } catch (error) {
            console.error('Error exporting Stringer Parameter Report:', error);
            showAlert('error', error instanceof Error ? error.message : 'Failed to export report');
        } finally {
            setIsLoading(false);
        }
    };

    const resetFilters = () => {
        setShiftFilter('');
        setMachineFilter('');
        setPoFilter('');
        setSearch('');
        setSort('date-asc');
    };

    const years = useMemo(
        () => Array.from({ length: 7 }, (_, index) => now.getFullYear() - 4 + index),
        [now]
    );
    const months = useMemo(
        () => Array.from({ length: 12 }, (_, index) =>
            new Date(2026, index, 1).toLocaleString(undefined, { month: 'long' })
        ),
        []
    );
    const summary = useMemo(() => {
        let syncedFromAudit = 0;
        let missingModuleType = 0;
        let missingCellType = 0;
        let missingCellWp = 0;

        rows.forEach(row => {
            const manual = manualValues[row.rowKey] || createManualValues();
            if (row.auditSource) syncedFromAudit += 1;
            if (!manual.moduleType.trim()) missingModuleType += 1;
            if (!manual.cellType.trim()) missingCellType += 1;
            if (!manual.cellWp.trim()) missingCellWp += 1;
        });

        return {
            totalRecords: rows.length,
            syncedFromAudit,
            missingModuleType,
            missingCellType,
            missingCellWp,
        };
    }, [manualValues, rows]);
    const summaryCards = [
        { label: 'Total Records', value: summary.totalRecords, accent: 'bg-slate-400 dark:bg-slate-500' },
        { label: 'Synced From Audit', value: summary.syncedFromAudit, accent: 'bg-emerald-500 dark:bg-emerald-400' },
        { label: 'Missing Module Type', value: summary.missingModuleType, accent: 'bg-amber-400 dark:bg-amber-500' },
        { label: 'Missing Cell Type', value: summary.missingCellType, accent: 'bg-amber-400 dark:bg-amber-500' },
        { label: 'Missing Cell WP', value: summary.missingCellWp, accent: 'bg-amber-400 dark:bg-amber-500' },
    ];
    const fieldClassName = 'w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-800 shadow-sm outline-none transition-all duration-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-brand-primary-light';

    return (
        <div className="min-w-0 space-y-2">
            {(isLoading || isSaving) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35">
                    <div className="rounded-md bg-white px-6 py-5 shadow-xl dark:bg-gray-800">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-brand-primary" />
                        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                            {isSaving ? 'Saving changes...' : 'Loading report...'}
                        </p>
                    </div>
                </div>
            )}

            <header className="flex flex-col gap-2 border-b border-slate-200 pb-2 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-3">
                        <span className="h-12 w-1 rounded-full bg-brand-primary" aria-hidden="true" />
                        <div>
                            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Stringer Parameter Report</h1>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Line-{line} | {months[month - 1]} {year} | {rows.length} machine records
                            </p>
                        </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 pl-4 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">Last Synced:</span>{' '}
                            {formatDateTime(report?.syncedAt)}
                        </span>
                        <span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">Audit Source:</span>{' '}
                            IPQC Audit ({report?.auditSourceCount || 0} linked)
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleUndo}
                        disabled={past.length === 0}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        title="Undo"
                    >
                        <Undo2 className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={handleRedo}
                        disabled={future.length === 0}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        title="Redo"
                    >
                        <Redo2 className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => loadReport(true, dirtyRowKeys.length > 0)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-brand-primary hover:text-brand-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={saveChanges}
                        disabled={dirtyRowKeys.length === 0 || isSaving}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-primary px-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                        <Save className="h-4 w-4" />
                        Save {dirtyRowKeys.length > 0 ? `(${dirtyRowKeys.length})` : ''}
                    </button>
                    <button
                        type="button"
                        onClick={exportExcel}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:border-emerald-600 hover:bg-transparent hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                        <Download className="h-4 w-4" />
                        Excel
                    </button>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {summaryCards.map(card => (
                    <div
                        key={card.label}
                        className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                        <span className={`absolute inset-y-0 left-0 w-1 ${card.accent}`} aria-hidden="true" />
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                        <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{card.value}</p>
                    </div>
                ))}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-200 pb-1 dark:border-slate-700">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Filters &amp; Search</h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Refine the monthly machine records shown below.</p>
                    </div>
                    {(search || shiftFilter || machineFilter || poFilter || sort !== 'date-asc') && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-600 transition-colors hover:border-brand-primary hover:text-brand-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                            <X className="h-3.5 w-3.5" />
                            Clear
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Month
                        <select value={month} onChange={event => setMonth(Number(event.target.value))} className={fieldClassName}>
                            {months.map((monthName, index) => <option key={monthName} value={index + 1}>{monthName}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Year
                        <select value={year} onChange={event => setYear(Number(event.target.value))} className={fieldClassName}>
                            {years.map(yearOption => <option key={yearOption} value={yearOption}>{yearOption}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Line
                        <select value={line} onChange={event => setLine(event.target.value as ReportLine)} className={fieldClassName}>
                            <option value="I">Line-I</option>
                            <option value="II">Line-II</option>
                        </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Shift
                        <select value={shiftFilter} onChange={event => setShiftFilter(event.target.value)} className={fieldClassName}>
                            <option value="">All shifts</option>
                            {(report?.shifts || ['A', 'B', 'C']).map(shift => <option key={shift} value={shift}>Shift-{shift}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Machine
                        <select value={machineFilter} onChange={event => setMachineFilter(event.target.value)} className={fieldClassName}>
                            <option value="">All machines</option>
                            {(report?.machineNumbers || []).map(machine => <option key={machine} value={machine}>Stringer-{machine}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        PO Number
                        <input value={poFilter} onChange={event => setPoFilter(event.target.value)} placeholder="Filter PO" className={fieldClassName} />
                    </label>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Sort
                        <select value={sort} onChange={event => setSort(event.target.value as SortOption)} className={fieldClassName}>
                            <option value="date-asc">Date ascending</option>
                            <option value="date-desc">Date descending</option>
                            <option value="machine-asc">Machine ascending</option>
                            <option value="po-asc">PO ascending</option>
                        </select>
                    </label>
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Search
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search rows" className={`${fieldClassName} pl-9 pr-9`} />
                            {(search || shiftFilter || machineFilter || poFilter) && (
                                <button type="button" onClick={resetFilters} className="absolute right-2 top-2.5 text-slate-400 hover:text-brand-primary" title="Clear filters">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 border-b border-slate-200 pb-1 dark:border-slate-700">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bulk Actions</h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Apply or clear editable values across selected records.</p>
                </div>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={toggleFilteredSelection} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:border-brand-primary hover:text-brand-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                            <CheckSquare2 className="h-4 w-4" />
                            {allFilteredSelected ? 'Unselect filtered' : 'Select filtered'}
                        </button>
                        <button type="button" onClick={() => setSelectedRows(new Set())} disabled={selectedCount === 0} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-600 hover:border-brand-primary hover:text-brand-primary disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                            Clear selection
                        </button>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{selectedCount} selected</span>
                    </div>
                    <div className="flex flex-1 flex-wrap items-end gap-2 lg:justify-end">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Field
                            <select value={bulkField} onChange={event => setBulkField(event.target.value as ManualField)} className="block h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-sm outline-none transition-all duration-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                                {MANUAL_FIELDS.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}
                            </select>
                        </label>
                        <label className="min-w-44 flex-1 space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300 lg:max-w-64">
                            Value
                            <input value={bulkValue} onChange={event => setBulkValue(event.target.value)} className="block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-sm outline-none transition-all duration-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
                        </label>
                        <button type="button" onClick={() => applyBulkValue(bulkValue)} className="h-9 rounded-md bg-brand-primary px-2 text-xs font-medium text-white hover:bg-brand-primary-hover">
                            Apply
                        </button>
                        <button type="button" onClick={() => applyBulkValue('')} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:border-brand-primary hover:text-brand-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                            <Eraser className="h-4 w-4" />
                            Clear
                        </button>
                    </div>
                </div>
            </section>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Monthly Records</h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {filteredRows.length} records shown | {selectedCount} selected
                        </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            Audit synced
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-brand-primary" />
                            User editable
                        </span>
                    </div>
                </div>
                <div className="max-h-[65vh] min-h-96 overflow-auto">
                    <table className="min-w-max border-collapse text-xs">
                        <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            <tr>
                                <th className="sticky left-0 z-40 w-10 min-w-10 border-b border-r border-slate-300 bg-slate-100 px-2 py-2 dark:border-slate-700 dark:bg-slate-800">
                                    <input
                                        type="checkbox"
                                        checked={pageRows.length > 0 && pageRows.every(row => selectedRows.has(row.rowKey))}
                                        onChange={() => {
                                            const pageSelected = pageRows.every(row => selectedRows.has(row.rowKey));
                                            setSelectedRows(previous => {
                                                const next = new Set(previous);
                                                pageRows.forEach(row => pageSelected ? next.delete(row.rowKey) : next.add(row.rowKey));
                                                return next;
                                            });
                                        }}
                                    />
                                </th>
                                <th className="sticky left-10 z-40 w-24 min-w-24 border-b border-r border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold dark:border-slate-700 dark:bg-slate-800">Date</th>
                                <th className="sticky left-[8.5rem] z-40 w-14 min-w-14 border-b border-r border-slate-300 bg-slate-100 px-2 py-2 text-center font-semibold dark:border-slate-700 dark:bg-slate-800">Shift</th>
                                <th className="sticky left-48 z-40 w-24 min-w-24 border-b border-r border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold shadow-[2px_0_0_0_rgb(203_213_225)] dark:border-slate-700 dark:bg-slate-800 dark:shadow-[2px_0_0_0_rgb(51_65_85)]">Machine</th>
                                <th className="min-w-24 border-b border-r border-slate-300 px-3 py-2 text-left font-semibold dark:border-slate-700">Status</th>
                                <th className="min-w-32 border-b border-r border-slate-300 px-3 py-2 text-left font-semibold dark:border-slate-700">PO Number</th>
                                {MANUAL_FIELDS.map(field => (
                                    <th key={field.key} className="min-w-32 border-b border-r border-slate-300 bg-brand-primary-soft/70 px-3 py-2 text-left font-semibold text-slate-800 dark:border-slate-700 dark:bg-brand-primary/10 dark:text-slate-100">{field.label}</th>
                                ))}
                                {(report?.auditColumns || []).map(column => (
                                    <th key={column.key} className="min-w-28 max-w-36 border-b border-r border-slate-300 px-3 py-2 text-left font-semibold dark:border-slate-700">{column.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map(row => {
                                const manual = manualValues[row.rowKey] || createManualValues();
                                const isSelected = selectedRows.has(row.rowKey);
                                const isComplete = MANUAL_FIELDS.every(field => manual[field.key].trim());
                                const stickyCellBackground = isSelected
                                    ? 'bg-brand-primary-soft dark:bg-brand-primary/15'
                                    : 'bg-slate-50 group-hover:bg-slate-100 dark:bg-slate-900 dark:group-hover:bg-slate-800';
                                return (
                                    <tr key={row.rowKey} className={`group transition-colors duration-150 ${isSelected ? 'bg-brand-primary-soft/50 dark:bg-brand-primary/10' : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50'}`}>
                                        <td className={`sticky left-0 z-20 border-b border-r border-slate-200 px-2 py-1.5 text-center dark:border-slate-700 ${stickyCellBackground}`}>
                                            <input type="checkbox" checked={isSelected} onChange={() => toggleRowSelection(row.rowKey)} />
                                        </td>
                                        <td className={`sticky left-10 z-20 w-24 min-w-24 whitespace-nowrap border-b border-r border-slate-200 px-3 py-1.5 text-slate-700 dark:border-slate-700 dark:text-slate-200 ${stickyCellBackground}`}>{formatDate(row.date)}</td>
                                        <td className={`sticky left-[8.5rem] z-20 w-14 min-w-14 border-b border-r border-slate-200 px-2 py-1.5 text-center text-slate-700 dark:border-slate-700 dark:text-slate-200 ${stickyCellBackground}`}>{row.shift}</td>
                                        <td className={`sticky left-48 z-20 w-24 min-w-24 whitespace-nowrap border-b border-r border-slate-200 px-3 py-1.5 font-medium text-slate-700 shadow-[2px_0_0_0_rgb(226_232_240)] dark:border-slate-700 dark:text-slate-200 dark:shadow-[2px_0_0_0_rgb(51_65_85)] ${stickyCellBackground}`}>Stringer-{row.machine}</td>
                                        <td className="border-b border-r border-slate-200 bg-slate-50/80 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900/70">
                                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-medium ${isComplete
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                                }`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                {isComplete ? 'Complete' : 'Incomplete'}
                                            </span>
                                        </td>
                                        <td className="max-w-36 truncate border-b border-r border-slate-200 bg-slate-50/80 px-3 py-1.5 text-slate-700 group-hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:group-hover:bg-slate-800" title={row.poNumber}>{row.poNumber || '-'}</td>
                                        {MANUAL_FIELDS.map(field => (
                                            <td key={field.key} className="border-b border-r border-slate-200 bg-white p-1.5 group-hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:group-hover:bg-slate-800/60">
                                                <input
                                                    value={manual[field.key]}
                                                    onChange={event => updateManualField(row.rowKey, field.key, event.target.value)}
                                                    className="h-8 w-full min-w-28 rounded-md border border-slate-300 bg-brand-primary-soft/45 px-2 text-xs text-slate-800 outline-none transition-all duration-200 focus:border-brand-primary focus:bg-white focus:shadow-[0_0_0_3px_rgba(207,24,31,0.10)] focus:ring-1 focus:ring-brand-primary dark:border-slate-600 dark:bg-brand-primary/10 dark:text-white dark:focus:bg-slate-800"
                                                />
                                            </td>
                                        ))}
                                        {(report?.auditColumns || []).map(column => {
                                            const unitA = String(row.auditValues?.unitA?.[column.key] || '');
                                            const unitB = String(row.auditValues?.unitB?.[column.key] || '');
                                            return (
                                                <td key={column.key} className="border-b border-r border-slate-200 bg-slate-50/80 px-2 py-1 group-hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:group-hover:bg-slate-800">
                                                    <div className="min-w-24 space-y-0.5 text-slate-600 dark:text-slate-300">
                                                        <div className="truncate" title={unitA}><span className="font-semibold text-slate-400">A</span> {unitA || '-'}</div>
                                                        <div className="truncate" title={unitB}><span className="font-semibold text-slate-400">B</span> {unitB || '-'}</div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                            {pageRows.length === 0 && (
                                <tr>
                                    <td colSpan={9 + (report?.auditColumns.length || 0)} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                                        No rows match the current filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <footer className="flex flex-col gap-3 border-t border-slate-300 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        {filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                        {' - '}
                        {Math.min(currentPage * pageSize, filteredRows.length)}
                        {' of '}
                        {filteredRows.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="h-8 rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-600 dark:bg-slate-800">
                            {PAGE_SIZE_OPTIONS.map(option => <option key={option} value={option}>{option} rows</option>)}
                        </select>
                        <button type="button" onClick={() => setPage(previous => Math.max(1, previous - 1))} disabled={currentPage === 1} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 disabled:opacity-40 dark:border-slate-600">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="min-w-20 text-center text-xs">Page {currentPage} / {pageCount}</span>
                        <button type="button" onClick={() => setPage(previous => Math.min(pageCount, previous + 1))} disabled={currentPage === pageCount} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 disabled:opacity-40 dark:border-slate-600">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
