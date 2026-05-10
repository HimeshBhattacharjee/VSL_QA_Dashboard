import {
    useEffect,
    useId,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Search, X } from 'lucide-react';
import {
    findAssignmentUserOption,
    type AssignmentUserOption,
} from '../utilities/assignmentUsers';
import { sortNamesAlphabetically } from '../utilities/taskAssignments';

interface MultiUserSelectProps {
    options: AssignmentUserOption[];
    selectedUsers: string[];
    onChange: (users: string[]) => void;
    disabled?: boolean;
    hasError?: boolean;
    placeholder?: string;
}

export default function MultiUserSelect({
    options,
    selectedUsers,
    onChange,
    disabled = false,
    hasError = false,
    placeholder = 'Search and select users',
}: MultiUserSelectProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
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
                containerRef.current.contains(target)
            ) {
                return;
            }

            setIsOpen(false);
            setQuery('');
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, []);

    const normalizedQuery = query.trim().toLowerCase();
    const filteredOptions = options.filter((option) => {
        if (selectedUsers.includes(option.value)) {
            return false;
        }

        if (!normalizedQuery) {
            return true;
        }

        return [option.name, option.displayName, option.role, option.employeeId]
            .filter(Boolean)
            .some((field) => field.toLowerCase().includes(normalizedQuery));
    });
    const sortedSelectedUsers = sortNamesAlphabetically(selectedUsers);

    const handleSelectUser = (user: AssignmentUserOption) => {
        onChange(sortNamesAlphabetically([...selectedUsers, user.value]));
        setQuery('');
        setIsOpen(true);
        inputRef.current?.focus();
    };

    const handleRemoveUser = (user: string) => {
        onChange(
            sortNamesAlphabetically(
                selectedUsers.filter((selectedUser) => selectedUser !== user),
            ),
        );
        inputRef.current?.focus();
    };

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Backspace' && !query && selectedUsers.length > 0) {
            handleRemoveUser(sortedSelectedUsers[sortedSelectedUsers.length - 1]);
            return;
        }

        if (event.key === 'Enter' && filteredOptions.length > 0) {
            event.preventDefault();
            handleSelectUser(filteredOptions[0]);
            return;
        }

        if (event.key === 'Escape') {
            setIsOpen(false);
            setQuery('');
        }
    };

    const fieldClass = `
        flex min-h-[52px] w-full flex-wrap items-center gap-2 rounded-2xl border px-3 py-2
        text-sm transition-colors
        ${hasError ? 'border-rose-300 focus-within:border-rose-500 dark:border-rose-500/70' : 'border-slate-200 focus-within:border-slate-400 dark:border-slate-700'}
        ${disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-300' : 'bg-white dark:bg-slate-800 dark:text-white'}
    `;

    const emptyStateMessage =
        filteredOptions.length > 0
            ? ''
            : options.length === selectedUsers.length
                ? 'All available users are already selected.'
                : 'No matching users found.';

    return (
        <div ref={containerRef} className="relative">
            <div
                className={fieldClass}
                onClick={() => {
                    if (disabled) {
                        return;
                    }

                    setIsOpen(true);
                    inputRef.current?.focus();
                }}
            >
                {sortedSelectedUsers.map((user) => {
                    const userOption = findAssignmentUserOption(options, user);

                    return (
                        <span
                            key={user}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700/80 dark:text-slate-100"
                        >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-200">
                                {userOption.avatar}
                            </span>
                            <span>{userOption.displayName}</span>
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        handleRemoveUser(user);
                                    }}
                                    className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-white"
                                    aria-label={`Remove ${user}`}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </span>
                    );
                })}

                <div className="flex min-w-[12rem] flex-1 items-center gap-2">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                        id={inputId}
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => {
                            if (!disabled) {
                                setIsOpen(true);
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        autoComplete="off"
                        aria-expanded={isOpen}
                        aria-controls={`${inputId}-options`}
                        placeholder={selectedUsers.length === 0 ? placeholder : 'Add another user'}
                        className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-white"
                    />
                </div>
            </div>

            {isOpen && !disabled && (
                <div
                    id={`${inputId}-options`}
                    className="custom-scrollbar absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => handleSelectUser(option)}
                                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                                        {option.avatar}
                                    </span>
                                    <span className="truncate font-medium">{option.displayName}</span>
                                </div>
                                <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    {option.role}
                                </span>
                            </button>
                        ))
                    ) : (
                        <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                            {emptyStateMessage}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
