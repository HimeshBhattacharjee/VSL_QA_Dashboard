import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[15];
    if (!stageConfig) return ['Auto trimming - 3', 'Auto trimming - 4'];
    const lineOptions = stageConfig.lineMapping[lineNumber];
    return Array.isArray(lineOptions) ? lineOptions : ['Auto trimming - 3', 'Auto trimming - 4'];
};

const getBackgroundColor = (value: string) => {
    if (!value) return 'bg-white';
    if (value === 'OFF') return 'bg-yellow-100';
    if (value === 'Checked Not OK') return 'bg-red-100';
    return 'bg-white';
};

const TrimmingSection = {
    TimeBasedSection: ({ machine, value, onUpdate, children }: {
        machine: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (timeSlot: '4hrs' | '8hrs') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">{machine}</span>
            </div>
            <div className="flex gap-2">
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500 mb-1">4 hours</span>
                    {children('4hrs')}
                </div>
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500 mb-1">8 hours</span>
                    {children('8hrs')}
                </div>
            </div>
        </div>
    ),

    SingleInputSection: ({ machine, value, onUpdate, children }: {
        machine: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">{machine}</span>
            </div>
            {children}
        </div>
    )
};

const InputComponents = {
    Select: ({ value, onChange, options, className = "" }: {
        value: string;
        onChange: (value: string) => void;
        options: { value: string; label: string }[];
        className?: string;
    }) => (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${getBackgroundColor(value)} ${className}`}
        >
            <option value="">Select</option>
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    )
};

const AutoTrimmingObservations = {
    renderCuttingAesthetics: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const machines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                machines.flatMap(machine =>
                    ['4hrs', '8hrs'].map(timeSlot =>
                        [`${machine}-${timeSlot}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (machine: string, timeSlot: '4hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${machine}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {machines.map(machine => (
                    <TrimmingSection.TimeBasedSection
                        key={machine}
                        machine={machine}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(timeSlot) => (
                            <InputComponents.Select
                                value={sampleValue[`${machine}-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate(machine, timeSlot, value)}
                                options={[
                                    { value: "Checked OK", label: "Checked OK" },
                                    { value: "Checked Not OK", label: "Checked Not OK" },
                                    { value: "OFF", label: "OFF" }
                                ]}
                            />
                        )}
                    </TrimmingSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderBladeChangeFrequency: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const machines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                machines.map(machine => [machine, ""])
            )
            : props.value as Record<string, string>;

        const handleUpdate = (machine: string, value: string) => {
            const updatedValue = { ...sampleValue, [machine]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {machines.map(machine => (
                    <TrimmingSection.SingleInputSection
                        key={machine}
                        machine={machine}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        <InputComponents.Select
                            value={sampleValue[machine] || ''}
                            onChange={(value) => handleUpdate(machine, value)}
                            options={[
                                { value: "Checked OK", label: "Checked OK" },
                                { value: "Checked Not OK", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                            className="w-full"
                        />
                    </TrimmingSection.SingleInputSection>
                ))}
            </div>
        );
    }
};

export const createAutoTrimmingStage = (lineNumber: string): StageData => {
    return {
        id: 15,
        name: "Auto Trimming",
        parameters: [
            {
                id: "15-1",
                parameters: "Trimmed portion cutting aesthetics",
                criteria: "Trimmed edges & corners should be smooth",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTrimmingObservations.renderCuttingAesthetics({ ...props, lineNumber })
            },
            {
                id: "15-2",
                parameters: "Trimming Blade change frequency",
                criteria: "Reverse the blade after 37500 nos cycles, then replace it after next 37500 nos cycles",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTrimmingObservations.renderBladeChangeFrequency({ ...props, lineNumber })
            }
        ]
    };
};

export const autoTrimmingStage: StageData = createAutoTrimmingStage('II');