import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

type TimeSlot = '2hrs' | '4hrs' | '6hrs' | '8hrs';

const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[21];
    if (!stageConfig) return ['Line-3', 'Line-4'];
    const lineOptions = stageConfig.lineMapping[lineNumber];
    return Array.isArray(lineOptions) ? lineOptions : ['Line-3', 'Line-4'];
};

const getBackgroundColor = (value: string, type: 'status' | 'temperature' | 'measurement' | 'date' = 'status', criteria?: string) => {
    if (!value) return 'bg-white';
    const upperValue = value.toUpperCase();
    if (upperValue === 'OFF') return 'bg-yellow-100';
    if (type === 'status') {
        if (upperValue === 'N/A') return 'bg-yellow-100';
        if (upperValue === 'CHECKED NOT OK') return 'bg-red-100';
    }
    if (type === 'measurement' || type === 'temperature') {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return 'bg-white';
        if (criteria) {
            if (criteria.includes('≥ 65%')) return numValue >= 65 ? 'bg-white' : 'bg-red-100';
            if (criteria.includes('25 ± 2 °C')) return (numValue >= 23 && numValue <= 27) ? 'bg-white' : 'bg-red-100';
            if (criteria.includes('≥ 4 hours')) return numValue >= 4 ? 'bg-white' : 'bg-red-100';
            if (criteria.includes('≤ 30 no')) return numValue <= 30 ? 'bg-white' : 'bg-red-100';
        }
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
                <span className="text-sm font-semibold text-gray-700">Curing - {line.split('-')[1]}</span>
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
                <span className="text-sm font-semibold text-gray-700">Curing - {line.split('-')[1]}</span>
            </div>
            {children}
        </div>
    )
};

const InputComponents = {
    Select: ({ value, onChange, options, className = "", type = "status", criteria }: {
        value: string;
        onChange: (value: string) => void;
        options: { value: string; label: string }[];
        className?: string;
        type?: 'status' | 'temperature' | 'measurement' | 'date';
        criteria?: string;
    }) => (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${getBackgroundColor(value, type, criteria)} ${className}`}
        >
            <option value="">Select</option>
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    ),

    TextInput: ({ value, onChange, placeholder, className = "w-full", type = "status", criteria }: {
        value: string;
        onChange: (value: string) => void;
        placeholder: string;
        className?: string;
        type?: 'status' | 'temperature' | 'measurement' | 'date';
        criteria?: string;
    }) => (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center ${getBackgroundColor(value, type, criteria)} ${className}`}
        />
    )
};

const CuringObservations = {
    renderHumidity: (props: ObservationRenderProps & { lineNumber?: string }) => {
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
                            <div className="flex flex-col items-center gap-2">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="measurement"
                                    criteria="≥ 65%"
                                />
                                <span className="text-xs text-gray-500">%</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderTemperature: (props: ObservationRenderProps & { lineNumber?: string }) => {
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
                            <div className="flex flex-col items-center gap-2">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="temperature"
                                    criteria="25 ± 2 °C"
                                />
                                <span className="text-xs text-gray-500">°C</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderCuringTime: (props: ObservationRenderProps & { lineNumber?: string }) => {
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
                            <div className="flex flex-col items-center gap-2">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="measurement"
                                    criteria="≥ 4 hours"
                                />
                                <span className="text-xs text-gray-500">Hours</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderStacking: (props: ObservationRenderProps & { lineNumber?: string }) => {
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
                            <div className="flex flex-col items-center gap-2">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="measurement"
                                    criteria="≤ 30 no's"
                                />
                                <span className="text-xs text-gray-500">Nos</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderCuringQuality: (props: ObservationRenderProps & { lineNumber?: string }) => {
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
    }
};

export const createCuringStage = (lineNumber: string): StageData => {
    return {
        id: 21,
        name: "Curing",
        parameters: [
            {
                id: "21-1",
                parameters: "Humidity",
                criteria: "≥ 65%",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 2 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    CuringObservations.renderHumidity({ ...props, lineNumber })
            },
            {
                id: "21-2",
                parameters: "Temperature",
                criteria: "25 ± 2 °C",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 2 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    CuringObservations.renderTemperature({ ...props, lineNumber })
            },
            {
                id: "21-3",
                parameters: "Curing time",
                criteria: "≥ 4 hours/until cure",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 2 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    CuringObservations.renderCuringTime({ ...props, lineNumber })
            },
            {
                id: "21-4",
                parameters: "Stacking",
                criteria: "≤ 30 no's on conveyor in Zigzag orientation",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 2 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    CuringObservations.renderStacking({ ...props, lineNumber })
            },
            {
                id: "21-5",
                parameters: "Curing Quality",
                criteria: "Sealant cured properly, not sticking to finger",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 2 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    CuringObservations.renderCuringQuality({ ...props, lineNumber })
            }
        ]
    };
};

export const curingStage: StageData = createCuringStage('II');