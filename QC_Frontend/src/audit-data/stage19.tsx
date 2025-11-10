import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[19];
    if (!stageConfig) return ['Line-3', 'Line-4'];
    const lineOptions = stageConfig.lineMapping[lineNumber];
    return Array.isArray(lineOptions) ? lineOptions : ['Line-3', 'Line-4'];
};

const getBackgroundColor = (value: string, type: 'status' | 'measurement') => {
    if (!value) return 'bg-white';
    const upperValue = value.toUpperCase();
    if (upperValue === 'OFF') return 'bg-yellow-100';
    if (type === 'status') {
        if (upperValue === 'NA') return 'bg-yellow-100';
        if (upperValue === 'NG') return 'bg-red-100';
    }
    return 'bg-white';
};

const JBSolderingSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (timeSlot: '4hrs' | '8hrs') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto JB Soldering - {line.split('-')[1]}</span>
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
    
    SingleInputSection: ({ line, value, onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto JB Soldering - {line.split('-')[1]}</span>
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
        type?: 'status' | 'measurement';
    }) => (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${getBackgroundColor(value, type)} ${className}`}
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
        type?: 'status' | 'measurement';
    }) => (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center ${getBackgroundColor(value, type)} ${className}`}
        />
    )
};

const AutoJBSolderingObservations = {
    renderESDBand: (props: ObservationRenderProps & { lineNumber?: string }) => {
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
                    <JBSolderingSection.TimeBasedSection
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
                                    { value: "OK", label: "ESD band used" },
                                    { value: "NG", label: "ESD band not used" },
                                    { value: "OFF", label: "OFF" }
                                ]}
                                type="status"
                            />
                        )}
                    </JBSolderingSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderTerminalInsertion: (props: ObservationRenderProps & { lineNumber?: string }) => {
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
                    <JBSolderingSection.TimeBasedSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(timeSlot) => (
                            <div className="flex flex-col items-center justify-between">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500 mt-1">mm</span>
                            </div>
                        )}
                    </JBSolderingSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderPullStrength: (props: ObservationRenderProps & { lineNumber?: string }) => {
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
                    <JBSolderingSection.SingleInputSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        <div className="flex flex-col items-center justify-between">
                            <InputComponents.TextInput
                                value={sampleValue[line] || ''}
                                onChange={(value) => handleUpdate(line, value)}
                                placeholder=""
                                type="measurement"
                            />
                            <span className="text-xs text-gray-500 mt-1">Newton (N)</span>
                        </div>
                    </JBSolderingSection.SingleInputSection>
                ))}
            </div>
        );
    }
};

export const createAutoJBSolderingStage = (lineNumber: string): StageData => {
    return {
        id: 19,
        name: "Auto JB Soldering",
        parameters: [
            {
                id: "19-1",
                parameters: "ESD band use",
                criteria: "Manual JB Soldering Operator shall wear ESD band",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoJBSolderingObservations.renderESDBand({ ...props, lineNumber })
            },
            {
                id: "19-2",
                parameters: "Terminal Insertion / As per Auto soldering M/c",
                criteria: "Inserted terminal soldering length ≥ 5mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoJBSolderingObservations.renderTerminalInsertion({ ...props, lineNumber })
            },
            {
                id: "19-3",
                parameters: "Attachment of Bus ribbon to JB terminal",
                criteria: "Pull strength ≥ 25 N",
                typeOfInspection: "Functionality",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoJBSolderingObservations.renderPullStrength({ ...props, lineNumber })
            }
        ]
    };
};

export const autoJBSolderingStage: StageData = createAutoJBSolderingStage('II');