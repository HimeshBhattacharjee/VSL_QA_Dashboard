import {
    useEffect,
    useId,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import {
    createFallbackAssignmentUser,
    type AssignmentUserOption,
} from '../utilities/assignmentUsers';

interface UserSingleSelectProps {
    options: AssignmentUserOption[];
    value: string;
    onChange: (value: string) => void;
    allOptionLabel: string;
    allOptionValue: string;
    disabled?: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
}

interface DropdownPosition {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
}

export default function UserSingleSelect({
    options,
    value,
    onChange,
    allOptionLabel,
    allOptionValue,
    disabled = false,
    placeholder = 'Select a user',
    searchPlaceholder = 'Search users',
}: UserSingleSelectProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
    const inputId = useId();

    useEffect(() => {
        if (!disabled) {
            return;
        }

        setIsOpen(false);
        setQuery('');
    }, [disabled]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;

            if (
                !containerRef.current ||
                !(target instanceof Node) ||
                containerRef.current.contains(target) ||
                dropdownRef.current?.contains(target)
            ) {
                return;
            }

            setIsOpen(false);
            setQuery('');
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, []);

    useEffect(() => {
        if (!isOpen || disabled) {
            setDropdownPosition(null);
            return;
        }

        const updateDropdownPosition = () => {
            const triggerElement = triggerRef.current;
            if (!triggerElement) {
                return;
            }

            const rect = triggerElement.getBoundingClientRect();
            const viewportPadding = 16;
            const dropdownSpacing = 8;
            const desiredMaxHeight = 320;
            const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
            const spaceAbove = rect.top - viewportPadding;
            const shouldOpenAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
            const availableHeight = shouldOpenAbove ? spaceAbove : spaceBelow;
            const maxHeight = Math.min(
                desiredMaxHeight,
                Math.max(availableHeight - dropdownSpacing, 96),
            );
            const unclampedTop = shouldOpenAbove
                ? rect.top - maxHeight - dropdownSpacing
                : rect.bottom + dropdownSpacing;
            const top = Math.min(
                Math.max(unclampedTop, viewportPadding),
                window.innerHeight - viewportPadding - maxHeight,
            );
            const width = Math.max(rect.width, 220);
            const left = Math.min(
                Math.max(rect.left, viewportPadding),
                window.innerWidth - viewportPadding - width,
            );

            setDropdownPosition({
                top,
                left,
                width,
                maxHeight,
            });
        };

        updateDropdownPosition();
        window.addEventListener('resize', updateDropdownPosition);
        window.addEventListener('scroll', updateDropdownPosition, true);

        return () => {
            window.removeEventListener('resize', updateDropdownPosition);
            window.removeEventListener('scroll', updateDropdownPosition, true);
        };
    }, [disabled, isOpen]);

    const normalizedQuery = query.trim().toLowerCase();
    const filteredOptions = options.filter((option) => {
        if (!normalizedQuery) {
            return true;
        }

        return [option.name, option.displayName, option.role, option.employeeId]
            .filter(Boolean)
            .some((field) => field.toLowerCase().includes(normalizedQuery));
    });

    const selectedOption =
        value && value !== allOptionValue
            ? options.find((option) => option.value === value) ?? createFallbackAssignmentUser(value)
            : null;

    const openDropdown = () => {
        if (disabled) {
            return;
        }

        setIsOpen(true);
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
    };

    const closeDropdown = () => {
        setIsOpen(false);
        setQuery('');
    };

    const handleSelect = (nextValue: string) => {
        onChange(nextValue);
        closeDropdown();
    };

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDropdown();
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={`${inputId}-options`}
                onClick={() => {
                    if (isOpen) {
                        closeDropdown();
                        return;
                    }

                    openDropdown();
                }}
                onKeyDown={handleKeyDown}
                className={`
                    flex w-full items-center justify-between gap-2 rounded-2xl border p-3 text-left text-sm transition-colors
                    ${disabled
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-slate-600'}
                `}
            >
                {value === allOptionValue ? (
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                        {allOptionLabel}
                    </span>
                ) : selectedOption ? (
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                                {selectedOption.avatar}
                            </span>
                            <span className="truncate font-medium">{selectedOption.displayName}</span>
                        </div>
                        {selectedOption.role && (
                            <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {selectedOption.role}
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="text-slate-400">{placeholder}</span>
                )}

                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-black dark:text-white transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && !disabled && dropdownPosition
                ? createPortal(
                    <div
                        ref={dropdownRef}
                        id={`${inputId}-options`}
                        role="listbox"
                        style={{
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                            width: dropdownPosition.width,
                            maxHeight: dropdownPosition.maxHeight,
                        }}
                        className="fixed z-[220] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                    >
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                            <Search className="h-4 w-4 shrink-0 text-slate-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        closeDropdown();
                                    }
                                }}
                                placeholder={searchPlaceholder}
                                className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                            />
                        </div>

                        <div
                            className="custom-scrollbar mt-2 overflow-y-auto"
                            style={{
                                maxHeight: Math.max(dropdownPosition.maxHeight - 72, 96),
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => handleSelect(allOptionValue)}
                                className="flex w-full items-center justify-between rounded-xl p-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <span className="font-medium">{allOptionLabel}</span>
                            </button>

                            {filteredOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className="flex w-full items-center justify-between gap-2 rounded-xl p-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                                            {option.avatar}
                                        </span>
                                        <span className="truncate font-medium">{option.displayName}</span>
                                    </div>
                                    <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        {option.role}
                                    </span>
                                </button>
                            ))}

                            {filteredOptions.length === 0 && (
                                <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
                                    No matching users found.
                                </p>
                            )}
                        </div>
                    </div>,
                    document.body,
                )
                : null}
        </div>
    );
}
