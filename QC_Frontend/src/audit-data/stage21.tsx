import { StageData, ObservationRenderProps } from '../types/audit';

const LineSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: 'Line-3' | 'Line-4';
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Curing - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-2">
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500">2 hours</span>
                    {children('2hrs')}
                </div>
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500">4 hours</span>
                    {children('4hrs')}
                </div>
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500">6 hours</span>
                    {children('6hrs')}
                </div>
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500">8 hours</span>
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
                <span className="text-sm font-semibold text-gray-700">Curing - {line.split('-')[1]}</span>
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

const CuringObservations = {
    renderHumidity: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-2hrs": "", "Line-3-4hrs": "", "Line-3-6hrs": "", "Line-3-8hrs": "",
                "Line-4-2hrs": "", "Line-4-4hrs": "", "Line-4-6hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <LineSection.TimeBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500">%</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500">%</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    },

    renderTemperature: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-2hrs": "", "Line-3-4hrs": "", "Line-3-6hrs": "", "Line-3-8hrs": "",
                "Line-4-2hrs": "", "Line-4-4hrs": "", "Line-4-6hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <LineSection.TimeBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500">°C</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500">°C</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    },

    renderCuringTime: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-2hrs": "", "Line-3-4hrs": "", "Line-3-6hrs": "", "Line-3-8hrs": "",
                "Line-4-2hrs": "", "Line-4-4hrs": "", "Line-4-6hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <LineSection.TimeBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500">Hours</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500">Hours</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    },

    renderStacking: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-2hrs": "", "Line-3-4hrs": "", "Line-3-6hrs": "", "Line-3-8hrs": "",
                "Line-4-2hrs": "", "Line-4-4hrs": "", "Line-4-6hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <LineSection.TimeBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500">Nos</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>

                {/* Line-4 Section */}
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500">Nos</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    },

    renderCuringQuality: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-2hrs": "", "Line-3-4hrs": "", "Line-3-6hrs": "", "Line-3-8hrs": "",
                "Line-4-2hrs": "", "Line-4-4hrs": "", "Line-4-6hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <LineSection.TimeBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Line-3-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                            options={[
                                { value: "OK", label: "Checked OK" },
                                { value: "NG", label: "Checked NG" }
                            ]}
                        />
                    )}
                </LineSection.TimeBasedSection>

                {/* Line-4 Section */}
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Line-4-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                            options={[
                                { value: "OK", label: "Checked OK" },
                                { value: "NG", label: "Checked NG" }
                            ]}
                        />
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    }
};

export const curingStage: StageData = {
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
            renderObservation: CuringObservations.renderHumidity
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
            renderObservation: CuringObservations.renderTemperature
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
            renderObservation: CuringObservations.renderCuringTime
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
            renderObservation: CuringObservations.renderStacking
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
            renderObservation: CuringObservations.renderCuringQuality
        }
    ]
};