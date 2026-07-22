import type { LineStatus } from '../utilities/lineStatus';

interface Props {
    status?: LineStatus;
    disabled?: boolean;
    onChange: (status: LineStatus) => void;
}

export default function LineStatusControl({ status = 'ON', disabled, onChange }: Props) {
    const isOn = status !== 'OFF';
    return (
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
            <span>Line</span>
            <button
                type="button"
                role="switch"
                aria-checked={isOn}
                disabled={disabled}
                onClick={() => onChange(isOn ? 'OFF' : 'ON')}
                className={`relative h-6 w-12 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${isOn ? 'bg-green-600' : 'bg-gray-400 dark:bg-gray-600'}`}
            >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${isOn ? 'left-6' : 'left-0.5'}`} />
            </button>
            <span className={isOn ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>{isOn ? 'ON' : 'OFF'}</span>
        </label>
    );
}

export function OffLinePlaceholder() {
    return <div className="rounded-lg border border-dashed border-gray-400 bg-gray-100 p-5 text-center font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">OFF</div>;
}
