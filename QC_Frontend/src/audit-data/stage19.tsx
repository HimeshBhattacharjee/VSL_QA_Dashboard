import { StageData, ObservationRenderProps } from '../types/audit';

const JBSolderingSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: 'Line-3' | 'Line-4';
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
        line: 'Line-3' | 'Line-4';
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
    Select: ({ value, onChange, options, className = "w-full" }: {
        value: string;
        onChange: (value: string) => void;
        options: { value: string; label: string }[];
        className?: string;
    }) => (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${className}`}
        >
            <option value="">Select</option>
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    ),

    TextInput: ({ value, onChange, placeholder, className = "w-full" }: {
        value: string;
        onChange: (value: string) => void;
        placeholder: string;
        className?: string;
    }) => (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white ${className}`}
        />
    ),

    NumberInput: ({ value, onChange, placeholder, min = 0, step = 1, className = "w-full" }: {
        value: string;
        onChange: (value: string) => void;
        placeholder: string;
        min?: number;
        step?: number;
        className?: string;
    }) => (
        <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white ${className}`}
            min={min}
            step={step}
        />
    )
};

const AutoJBSolderingObservations = {
    renderESDBand: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-4hrs": "", "Line-3-shift": "",
                "Line-4-4hrs": "", "Line-4-shift": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '4hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <JBSolderingSection.TimeBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Line-3-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                            options={[
                                { value: "ESD band used", label: "ESD band used" },
                                { value: "ESD band not used", label: "ESD band not used" },
                                { value: "OFF", label: "OFF" }
                            ]}
                        />
                    )}
                </JBSolderingSection.TimeBasedSection>
                <JBSolderingSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Line-4-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                            options={[
                                { value: "ESD band used", label: "ESD band used" },
                                { value: "ESD band not used", label: "ESD band not used" },
                                { value: "OFF", label: "OFF" }
                            ]}
                        />
                    )}
                </JBSolderingSection.TimeBasedSection>
            </div>
        );
    },

    renderTerminalInsertion: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-4hrs": "", "Line-3-shift": "",
                "Line-4-4hrs": "", "Line-4-shift": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '4hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <JBSolderingSection.TimeBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center justify-between">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                    )}
                </JBSolderingSection.TimeBasedSection>
                <JBSolderingSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center justify-between">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                    )}
                </JBSolderingSection.TimeBasedSection>
            </div>
        );
    },

    renderPullStrength: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3": "", "Line-4": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', value: string) => {
            const updatedValue = { ...sampleValue, [line]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <JBSolderingSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex flex-col items-center justify-between">
                        <InputComponents.NumberInput
                            value={sampleValue["Line-3"] || ''}
                            onChange={(value) => handleUpdate('Line-3', value)}
                            placeholder=""
                            min={0}
                            step={0.1}
                        />
                        <span className="text-xs text-gray-500 mt-1">Newton (N)</span>
                    </div>
                </JBSolderingSection.SingleInputSection>
                <JBSolderingSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex flex-col items-center justify-between">
                        <InputComponents.NumberInput
                            value={sampleValue["Line-4"] || ''}
                            onChange={(value) => handleUpdate('Line-4', value)}
                            placeholder=""
                            min={0}
                            step={0.1}
                        />
                        <span className="text-xs text-gray-500 mt-1">Newton (N)</span>
                    </div>
                </JBSolderingSection.SingleInputSection>
            </div>
        );
    }
};

export const autoJBSolderingStage: StageData = {
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
            renderObservation: AutoJBSolderingObservations.renderESDBand
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
            renderObservation: AutoJBSolderingObservations.renderTerminalInsertion
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
            renderObservation: AutoJBSolderingObservations.renderPullStrength
        }
    ]
};