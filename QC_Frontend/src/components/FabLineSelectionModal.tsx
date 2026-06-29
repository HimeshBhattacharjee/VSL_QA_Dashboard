import { CircleDot, CircleOff, X } from 'lucide-react';
import { LINE_GROUPS, type LineGroup, getLineGroupLabel } from '../utilities/lineWiseTestUtils';

interface FabLineOption {
    value: string;
    label: string;
    description?: string;
    isFilled?: boolean;
}

interface FabLineSelectionModalProps {
    isOpen: boolean;
    title: string;
    question?: string;
    selectedLineGroup?: LineGroup;
    selectedValue?: string;
    options?: FabLineOption[];
    onLineSelect?: (lineGroup: LineGroup) => void;
    onSelect?: (value: string) => void;
    onClose: () => void;
}

export default function FabLineSelectionModal({
    isOpen,
    title,
    question,
    selectedLineGroup,
    selectedValue,
    options,
    onLineSelect,
    onSelect,
    onClose
}: FabLineSelectionModalProps) {
    if (!isOpen) return null;

    const modalOptions: FabLineOption[] = options || LINE_GROUPS.map(lineGroup => ({
        value: lineGroup,
        label: getLineGroupLabel(lineGroup),
        description: lineGroup === 'Line-I' ? 'Line - 1, Line - 2' : 'Line - 3, Line - 4'
    }));

    const handleSelect = (value: string) => {
        if (onSelect) {
            onSelect(value);
            return;
        }
        onLineSelect?.(value as LineGroup);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold dark:text-white">{title}</h3>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <X className="h-5 w-5 dark:text-white" />
                    </button>
                </div>
                {question && <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{question}</p>}
                <div className="space-y-3">
                    {modalOptions.map(option => {
                        const isSelected = (selectedValue || selectedLineGroup) === option.value;
                        const hasStatus = typeof option.isFilled === 'boolean';
                        return (
                            <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`flex w-full items-center justify-between rounded-lg border-2 p-4 text-left transition-colors hover:border-brand-primary hover:bg-brand-primary-soft dark:hover:border-brand-primary-light dark:hover:bg-brand-primary/10 ${
                                    isSelected
                                        ? 'border-brand-primary bg-brand-primary-soft dark:border-brand-primary-light dark:bg-brand-primary/15'
                                        : option.isFilled
                                            ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                                            : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                                }`}
                            >
                                <span>
                                    <span className={`block font-semibold ${isSelected ? 'text-brand-primary dark:text-brand-primary-light' : 'text-gray-900 dark:text-white'}`}>
                                        {option.label}
                                    </span>
                                    {option.description && (
                                        <span className="text-sm text-gray-500 dark:text-gray-400">{option.description}</span>
                                    )}
                                </span>
                                {hasStatus && (
                                    option.isFilled ? (
                                        <CircleDot className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <CircleOff className="h-4 w-4 text-gray-400" />
                                    )
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
