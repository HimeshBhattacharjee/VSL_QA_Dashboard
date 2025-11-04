import { StageData, ObservationRenderProps } from '../types/audit';

const TrimmingSection = {
    TimeBasedSection: ({ machine, value, onUpdate, children }: {
        machine: 'Auto trimming - 3' | 'Auto trimming - 4';
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
        machine: 'Auto trimming - 3' | 'Auto trimming - 4';
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

const AutoTrimmingObservations = {
    renderCuttingAesthetics: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Auto trimming - 3-4hrs": "", "Auto trimming - 3-8hrs": "",
                "Auto trimming - 4-4hrs": "", "Auto trimming - 4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (machine: 'Auto trimming - 3' | 'Auto trimming - 4', timeSlot: '4hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${machine}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <TrimmingSection.TimeBasedSection
                    machine="Auto trimming - 3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Auto trimming - 3-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Auto trimming - 3', timeSlot, value)}
                            options={[
                                { value: "OK", label: "Checked OK" },
                                { value: "NG", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                        />
                    )}
                </TrimmingSection.TimeBasedSection>
                <TrimmingSection.TimeBasedSection
                    machine="Auto trimming - 4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Auto trimming - 4-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Auto trimming - 4', timeSlot, value)}
                            options={[
                                { value: "OK", label: "Checked OK" },
                                { value: "NG", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                        />
                    )}
                </TrimmingSection.TimeBasedSection>
            </div>
        );
    },

    renderBladeChangeFrequency: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Auto trimming - 3": "",
                "Auto trimming - 4": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (machine: 'Auto trimming - 3' | 'Auto trimming - 4', value: string) => {
            const updatedValue = { ...sampleValue, [machine]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <TrimmingSection.SingleInputSection
                    machine="Auto trimming - 3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <InputComponents.Select
                        value={sampleValue["Auto trimming - 3"] || ''}
                        onChange={(value) => handleUpdate('Auto trimming - 3', value)}
                        options={[
                            { value: "OK", label: "Checked OK" },
                            { value: "NG", label: "Checked Not OK" },
                            { value: "OFF", label: "OFF" }
                        ]}
                        className="w-full"
                    />
                </TrimmingSection.SingleInputSection>
                <TrimmingSection.SingleInputSection
                    machine="Auto trimming - 4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <InputComponents.Select
                        value={sampleValue["Auto trimming - 4"] || ''}
                        onChange={(value) => handleUpdate('Auto trimming - 4', value)}
                        options={[
                            { value: "OK", label: "Checked OK" },
                            { value: "NG", label: "Checked Not OK" },
                            { value: "OFF", label: "OFF" }
                        ]}
                        className="w-full"
                    />
                </TrimmingSection.SingleInputSection>
            </div>
        );
    }
};

export const autoTrimmingStage: StageData = {
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
                {
                    timeSlot: "",
                    value: {
                        "Auto trimming - 3-4hrs": "",
                        "Auto trimming - 3-8hrs": "",
                        "Auto trimming - 4-4hrs": "",
                        "Auto trimming - 4-8hrs": ""
                    }
                }
            ],
            renderObservation: AutoTrimmingObservations.renderCuttingAesthetics
        },
        {
            id: "15-2",
            parameters: "Trimming Blade change frequency",
            criteria: "Reverse the blade after 37500 nos cycles, then replace it after next 37500 nos cycles",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                {
                    timeSlot: "",
                    value: {
                        "Auto trimming - 3": "",
                        "Auto trimming - 4": ""
                    }
                }
            ],
            renderObservation: AutoTrimmingObservations.renderBladeChangeFrequency
        }
    ]
};