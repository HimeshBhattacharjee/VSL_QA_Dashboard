import { X } from 'lucide-react';
import { LINE_GROUPS, type LineGroup, getLineGroupLabel } from '../utilities/lineWiseTestUtils';

interface FabLineSelectionModalProps {
    isOpen: boolean;
    title: string;
    question: string;
    selectedLineGroup?: LineGroup;
    onLineSelect: (lineGroup: LineGroup) => void;
    onClose: () => void;
}

export default function FabLineSelectionModal({
    isOpen,
    title,
    question,
    selectedLineGroup,
    onLineSelect,
    onClose
}: FabLineSelectionModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold dark:text-white">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 dark:text-white" />
                    </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{question}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {LINE_GROUPS.map(lineGroup => (
                        <button
                            key={lineGroup}
                            onClick={() => onLineSelect(lineGroup)}
                            className={`p-3 rounded-lg border-2 text-sm font-semibold transition-colors ${selectedLineGroup === lineGroup
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white hover:border-blue-300 dark:hover:border-blue-600'
                                }`}
                        >
                            {getLineGroupLabel(lineGroup)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
