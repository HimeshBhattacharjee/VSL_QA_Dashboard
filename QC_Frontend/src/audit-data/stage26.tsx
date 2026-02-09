import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[26];
    if (!stageConfig) return ['Line-3', 'Line-4'];
    const lineOptions = stageConfig.lineMapping[lineNumber];
    return Array.isArray(lineOptions) ? lineOptions : ['Line-3', 'Line-4'];
};

const getBackgroundColor = (value: string, type: 'status' | 'temperature' | 'measurement' | 'date' = 'status') => {
    if (!value) return 'bg-white';
    const upperValue = value.toUpperCase();
    if (upperValue === 'OFF') return 'bg-yellow-100';
    if (type === 'status') {
        if (upperValue === 'NA') return 'bg-yellow-100';
        if (upperValue === 'FAIL') return 'bg-red-100';
    }
    if (type === 'date') {
        if (value) {
            const inputDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            inputDate.setHours(0, 0, 0, 0);
            if (inputDate < today) return 'bg-red-100';
        }
    }
    return 'bg-white';
};

const LineSection = {
    TimeBasedSection: ({ line, value: _value, onUpdate: _onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (timeSlot: '4hrs' | '8hrs') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-200 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Safety Test - {line.split('-')[1]}</span>
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

    SingleInputSection: ({ line, value: _value, onUpdate: _onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-200 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Safety Test - {line.split('-')[1]}</span>
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
            className={`w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${getBackgroundColor(value, type)} ${className}`}
        >
            <option value="">Select</option>
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    ),

    TextInput: ({ value, onChange, placeholder, className = "w-full", type = "status" }: {
        value: string;
        onChange: (value: string) => void;
        placeholder: string;
        className?: string;
        type?: 'status' | 'temperature' | 'measurement' | 'date';
    }) => (
        <div className="flex flex-col items-center">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center ${getBackgroundColor(value, type)} ${className}`}
            />
        </div>
    ),

    DateInput: ({ value, onChange, className = "w-full" }: {
        value: string;
        onChange: (value: string) => void;
        className?: string;
    }) => (
        <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center ${getBackgroundColor(value, 'date')} ${className}`}
        />
    )
};

const SafetyTestObservations = {
    renderHipotTest: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['4hrs', '8hrs'].map(timeSlot =>
                        [`${line}-${timeSlot}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, timeSlot: '4hrs' | '8hrs', value: string) => {
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
                                    { value: "Pass", label: "Pass" },
                                    { value: "Fail", label: "Fail" },
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

    renderInsulatingResistanceTest: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['4hrs', '8hrs'].map(timeSlot =>
                        [`${line}-${timeSlot}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, timeSlot: '4hrs' | '8hrs', value: string) => {
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
                            <InputComponents.TextInput
                                value={sampleValue[`${line}-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate(line, timeSlot, value)}
                                placeholder=""
                                type="measurement"
                            />
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderGroundingTest: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['4hrs', '8hrs'].map(timeSlot =>
                        [`${line}-${timeSlot}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, timeSlot: '4hrs' | '8hrs', value: string) => {
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
                                    { value: "Pass", label: "Pass" },
                                    { value: "Fail", label: "Fail" },
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

export const createSafetyTestStage = (lineNumber: string): StageData => {
    return {
        id: 26,
        name: "Safety test HV, IR and GC Test",
        parameters: [
            {
                id: "26-1",
                parameters: "Hipot test (DCW)",
                criteria: "Leakage current < 50 µA, (IEC61215)",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    SafetyTestObservations.renderHipotTest({ ...props, lineNumber })
            },
            {
                id: "26-2",
                parameters: "Insulating resistance test (IR)",
                criteria: "> 40 MΩ/m2 (IEC61215)",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    SafetyTestObservations.renderInsulatingResistanceTest({ ...props, lineNumber })
            },
            {
                id: "26-3",
                parameters: "Grounding test (GD)",
                criteria: "Resistance < 100 mΩ, (IEC61730)",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    SafetyTestObservations.renderGroundingTest({ ...props, lineNumber })
            }
        ]
    };
};

export const safetyTestStage: StageData = createSafetyTestStage('II');