import { StageData, ObservationRenderProps } from '../types/audit';

const LineSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: 'Line-3' | 'Line-4';
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (timeSlot: '4hrs' | '8hrs') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Tapping & Layup - {line.split('-')[1]}</span>
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
                <span className="text-sm font-semibold text-gray-700">Auto Tapping & Layup - {line.split('-')[1]}</span>
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

const AutoTapingNLayupObservations = {
    renderStatusCheck: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-4hrs": "", "Line-3-8hrs": "",
                "Line-4-4hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '4hrs' | '8hrs', value: string) => {
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
                                { value: "NG", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                        />
                    )}
                </LineSection.TimeBasedSection>
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
                                { value: "NG", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                        />
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    },

    renderRFID: (props: ObservationRenderProps) => {
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
                <LineSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <InputComponents.Select
                        value={sampleValue["Line-3"] || ''}
                        onChange={(value) => handleUpdate('Line-3', value)}
                        options={[
                            { value: "Inside", label: "Laminate Inside" },
                            { value: "Outside", label: "Outside RFID" },
                            { value: "NotRequired", label: "Not required" }
                        ]}
                    />
                </LineSection.SingleInputSection>
                <LineSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <InputComponents.Select
                        value={sampleValue["Line-4"] || ''}
                        onChange={(value) => handleUpdate('Line-4', value)}
                        options={[
                            { value: "Inside", label: "Laminate Inside" },
                            { value: "Outside", label: "Outside RFID" },
                            { value: "NotRequired", label: "Not required" }
                        ]}
                    />
                </LineSection.SingleInputSection>
            </div>
        );
    },

    renderCellFixingTape: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3": "", "Line-4": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', field: 'Supplier' | 'Type' | 'Quantity', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <LineSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex justify-between gap-2">
                        <div className="flex flex-col gap-1 items-center">
                            <span className="text-xs text-gray-500">Supplier</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-Supplier"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'Supplier', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                            <span className="text-xs text-gray-500">Type</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-Type"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'Type', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                            <span className="text-xs text-gray-500">Quantity</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-Quantity"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'Quantity', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                        </div>
                    </div>
                </LineSection.SingleInputSection>
                <LineSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex justify-between gap-2">
                        <div className="flex flex-col gap-1 items-center">
                            <span className="text-xs text-gray-500">Supplier</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-Supplier"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'Supplier', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                            <span className="text-xs text-gray-500">Type</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-Type"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'Type', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                            <span className="text-xs text-gray-500">Quantity</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-Quantity"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'Quantity', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                        </div>
                    </div>
                </LineSection.SingleInputSection>
            </div>
        );
    },

    renderGap: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-4hrs": "", "Line-3-8hrs": "",
                "Line-4-4hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '4hrs' | '8hrs', value: string) => {
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
                        <div className="flex flex-col items-center gap-1">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.01}
                            />
                            <span className="text-xs text-gray-500">mm</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-1">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.01}
                            />
                            <span className="text-xs text-gray-500">mm</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    },

    renderDistance: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-4hrs": "", "Line-3-8hrs": "",
                "Line-4-4hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '4hrs' | '8hrs', value: string) => {
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
                        <div className="flex flex-col items-center gap-1">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.01}
                            />
                            <span className="text-xs text-gray-500">mm</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-1">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.01}
                            />
                            <span className="text-xs text-gray-500">mm</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    },

    renderTapeLength: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-4hrs": "", "Line-3-8hrs": "",
                "Line-4-4hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '4hrs' | '8hrs', value: string) => {
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
                        <div className="flex flex-col items-center gap-1">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.01}
                            />
                            <span className="text-xs text-gray-500">mm</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-1">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.01}
                            />
                            <span className="text-xs text-gray-500">mm</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    }
};

export const autoTapingNLayupStage: StageData = {
    id: 8,
    name: "Auto Taping and Layup",
    parameters: [
        {
            id: "8-1",
            parameters: "Gap between cell edge to Label",
            criteria: "Uniform gap",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderStatusCheck
        },
        {
            id: "8-2",
            parameters: "RFID Tag Position",
            criteria: "Laminate Inside/Not required",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderRFID
        },
        {
            id: "8-3",
            parameters: "Logo Watt Peak & Vikram Logo",
            criteria: "Module Watt Peak tolerance as per PO No.",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderStatusCheck
        },
        {
            id: "8-4",
            parameters: "Barcode Serial No",
            criteria: "Module SL No. as per PO No.",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderStatusCheck
        },
        {
            id: "8-5",
            parameters: "Foreign particles",
            criteria: "Not allowed",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderStatusCheck
        },
        {
            id: "8-6",
            parameters: "Cell fixing tape - Supplier, Type & Quantity",
            criteria: "Tape Qty should be 45 ± 15",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderCellFixingTape
        },
        {
            id: "8-9",
            parameters: "Cell to Cell Gap",
            criteria: "0.8 mm to 1.8 mm for M10, 0.3 mm to 1.3 mm for M10R & G12",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderGap
        },
        {
            id: "8-10",
            parameters: "String to String Gap",
            criteria: "1.5 ± 0.5 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderGap
        },
        {
            id: "8-11",
            parameters: "Creep edge distance - Left side",
            criteria: "Left Side Gap ≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderDistance
        },
        {
            id: "8-12",
            parameters: "Creep edge distance - Right side",
            criteria: "Right Side Gap ≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderDistance
        },
        {
            id: "8-13",
            parameters: "Creep edge distance - Top side",
            criteria: "Top Side Gap ≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderDistance
        },
        {
            id: "8-14",
            parameters: "Creep edge distance - Bottom side",
            criteria: "Bottom Side Gap ≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderDistance
        },
        {
            id: "8-15",
            parameters: "Space between 2 portions of half cut cell module",
            criteria: "Middle Gap 15 ± 5 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderDistance
        },
        {
            id: "8-16",
            parameters: "Cell fixing tape dimension",
            criteria: "Tape length 21 ± 5 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderTapeLength
        }
    ]
};