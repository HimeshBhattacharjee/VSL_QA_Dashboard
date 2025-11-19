import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

type TimeSlot = '2hrs' | '4hrs' | '6hrs' | '8hrs';

const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[22];
    if (!stageConfig) return ['Line-3', 'Line-4'];
    const lineOptions = stageConfig.lineMapping[lineNumber];
    return Array.isArray(lineOptions) ? lineOptions : ['Line-3', 'Line-4'];
};

const getBackgroundColor = (value: string, type: 'status' | 'temperature' | 'measurement' | 'date' = 'status') => {
    if (!value) return 'bg-white';
    const upperValue = value.toUpperCase();
    if (upperValue === 'OFF') return 'bg-yellow-100';
    if (type === 'status') {
        if (upperValue === 'N/A') return 'bg-yellow-100';
        if (upperValue === 'CHECKED NOT OK') return 'bg-red-100';
    }
    return 'bg-white';
};

const LineSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (timeSlot: TimeSlot) => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Filing - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-2">
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500 mb-1">2 hours</span>
                    {children('2hrs')}
                </div>
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500 mb-1">4 hours</span>
                    {children('4hrs')}
                </div>
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500 mb-1">6 hours</span>
                    {children('6hrs')}
                </div>
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500 mb-1">8 hours</span>
                    {children('8hrs')}
                </div>
            </div>
        </div>
    ),

    SingleInputSection: ({ line, value, onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Filing - {line.split('-')[1]}</span>
            </div>
            {children}
        </div>
    )
};

const InputComponents = {
    Select: ({ value, onChange, options, className = "", type = "status" }: {
        value: string;
        onChange: (value: string) => void;
        options: { value: string; label: string }[];
        className?: string;
        type?: 'status' | 'temperature' | 'measurement' | 'date';
    }) => (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${getBackgroundColor(value, type)} ${className}`}
        >
            <option value="">Select</option>
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    )
};

const AutoFilingObservations = {
    renderFrameCornerBurr: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['2hrs', '4hrs', '6hrs', '8hrs'].map(timeSlot =>
                        [`${line}-${timeSlot}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, timeSlot: TimeSlot, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <LineSection.TimeBasedSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(timeSlot) => (
                            <InputComponents.Select
                                value={sampleValue[`${line}-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate(line, timeSlot, value)}
                                options={[
                                    { value: "Checked OK", label: "Checked OK" },
                                    { value: "Checked Not OK", label: "Checked Not OK" },
                                    { value: "OFF", label: "OFF" }
                                ]}
                                type="status"
                            />
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderFilingBeltChange: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.map(line => [`${line}`, ""])
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, value: string) => {
            const updatedValue = { ...sampleValue, [line]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <LineSection.SingleInputSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        <InputComponents.Select
                            value={sampleValue[line] || ''}
                            onChange={(value) => handleUpdate(line, value)}
                            options={[
                                { value: "Checked OK", label: "Checked OK" },
                                { value: "Checked Not OK", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                            type="status"
                        />
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    }
};

export const createAutoFilingStage = (lineNumber: string): StageData => {
    return {
        id: 22,
        name: "Auto Filing",
        parameters: [
            {
                id: "22-1",
                parameters: "Frame Corner Burr",
                criteria: "No Burr allowed",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 2 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFilingObservations.renderFrameCornerBurr({ ...props, lineNumber })
            },
            {
                id: "22-2",
                parameters: "Filing Belt Change Frequency",
                criteria: "Sand paper belt should be changed after 150000 nos cycles",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFilingObservations.renderFilingBeltChange({ ...props, lineNumber })
            }
        ]
    };
};

export const autoFilingStage: StageData = createAutoFilingStage('II');