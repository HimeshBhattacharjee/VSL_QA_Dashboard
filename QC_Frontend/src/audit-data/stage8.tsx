import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[8];
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
    if (type === 'date') {
        if (value) {
            const inputDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            inputDate.setHours(0, 0, 0, 0);
            if (inputDate < today) return 'bg-red-100';
        }
    }
    if (type === 'measurement' && criteria && value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return 'bg-white';

        // Cell to Cell Gap: 0.8 mm to 1.8 mm for M10, 0.3 mm to 1.3 mm for M10R & G12
        if (criteria.includes('0.8 mm to 1.8 mm') || criteria.includes('0.3 mm to 1.3 mm')) {
            if (numValue >= 0.8 && numValue <= 1.8) return 'bg-white';
            if (numValue >= 0.3 && numValue <= 1.3) return 'bg-white';
            return 'bg-red-100';
        }

        // String to String Gap: 1.5 ± 0.5 mm
        if (criteria.includes('1.5 ± 0.5 mm')) {
            if (numValue >= 1.0 && numValue <= 2.0) return 'bg-white';
            return 'bg-red-100';
        }

        // Creep edge distance: ≥ 12 mm
        if (criteria.includes('≥ 12 mm') || criteria.includes('Gap ≥ 12 mm')) {
            if (numValue >= 12) return 'bg-white';
            return 'bg-red-100';
        }

        // Space between portions: 15 ± 5 mm
        if (criteria.includes('15 ± 5 mm')) {
            if (numValue >= 10 && numValue <= 20) return 'bg-white';
            return 'bg-red-100';
        }

        // Tape length: 21 ± 5 mm
        if (criteria.includes('21 ± 5 mm')) {
            if (numValue >= 16 && numValue <= 26) return 'bg-white';
            return 'bg-red-100';
        }

        // Tape quantity: 45 ± 15
        if (criteria.includes('45 ± 15')) {
            if (numValue >= 30 && numValue <= 60) return 'bg-white';
            return 'bg-red-100';
        }
    }

    return 'bg-white';
};

const LineSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: string;
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
        line: string;
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
        <div className="flex flex-col items-center">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center ${getBackgroundColor(value, type, criteria)} ${className}`}
            />
        </div>
    )
};

const AutoTapingNLayupObservations = {
    renderStatusCheck: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.flatMap(line => ['4hrs', '8hrs'].map(timeSlot => [`${line}-${timeSlot}`, ""])))
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

    renderRFID: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.map(line => [line, ""]))
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
                                    { value: "Laminate Inside", label: "Laminate Inside" },
                                    { value: "Outside RFID", label: "Outside RFID" },
                                    { value: "Not Required", label: "Not Required" }
                                ]}
                                type="status"
                            />
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderCellFixingTape: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.flatMap(line => ['Supplier', 'Type', 'Quantity'].map(field => [`${line}-${field}`, ""])))
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, field: 'Supplier' | 'Type' | 'Quantity', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
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
                        <div className="flex justify-between gap-2">
                            <div className="flex flex-col gap-1 items-center">
                                <span className="text-xs text-gray-500">Supplier</span>
                                <InputComponents.Select
                                    value={sampleValue[`${line}-Supplier`] || ''}
                                    onChange={(value) => handleUpdate(line, 'Supplier', value)}
                                    options={[
                                        { value: "TERAOKA", label: "TERAOKA" },
                                        { value: "TESA", label: "TESA" },
                                        { value: "Cybrid", label: "Cybrid" },
                                        { value: "N/A", label: "N/A" }
                                    ]}
                                    type="status"
                                />
                            </div>
                            <div className="flex flex-col gap-1 items-center">
                                <span className="text-xs text-gray-500">Type</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-Type`] || ''}
                                    onChange={(value) => handleUpdate(line, 'Type', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                            <div className="flex flex-col gap-1 items-center">
                                <span className="text-xs text-gray-500">Quantity</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-Quantity`] || ''}
                                    onChange={(value) => handleUpdate(line, 'Quantity', value)}
                                    placeholder=""
                                    type="measurement"
                                    criteria="45 ± 15"
                                />
                            </div>
                        </div>
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderGap: (props: ObservationRenderProps & { lineNumber?: string, criteria: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.flatMap(line => ['4hrs', '8hrs'].map(timeSlot => [`${line}-${timeSlot}`, ""])))
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
                            <div className="flex flex-col items-center gap-1">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="measurement"
                                    criteria={props.criteria}
                                />
                                <span className="text-xs text-gray-500">mm</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderDistance: (props: ObservationRenderProps & { lineNumber?: string, criteria: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.flatMap(line => ['4hrs', '8hrs'].map(timeSlot => [`${line}-${timeSlot}`, ""])))
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
                            <div className="flex flex-col items-center gap-1">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="measurement"
                                    criteria={props.criteria}
                                />
                                <span className="text-xs text-gray-500">mm</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderTapeLength: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.flatMap(line => ['4hrs', '8hrs'].map(timeSlot => [`${line}-${timeSlot}`, ""])))
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
                            <div className="flex flex-col items-center gap-1">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="measurement"
                                    criteria="21 ± 5 mm"
                                />
                                <span className="text-xs text-gray-500">mm</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    }
};

export const createAutoTapingNLayupStage = (lineNumber: string): StageData => {
    return {
        id: 8,
        name: "Auto Taping and Layup",
        parameters: [
            {
                id: "8-1",
                parameters: "Gap between cell edge to Label",
                criteria: "Uniform gap",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderStatusCheck({ ...props, lineNumber })
            },
            {
                id: "8-2",
                parameters: "RFID Tag Position",
                criteria: "Laminate Inside/Not required",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderRFID({ ...props, lineNumber })
            },
            {
                id: "8-3",
                parameters: "Logo Watt Peak & Vikram Logo",
                criteria: "Module Watt Peak tolerance as per PO No.",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderStatusCheck({ ...props, lineNumber })
            },
            {
                id: "8-4",
                parameters: "Barcode Serial No",
                criteria: "Module SL No. as per PO No.",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderStatusCheck({ ...props, lineNumber })
            },
            {
                id: "8-5",
                parameters: "Foreign particles",
                criteria: "Not allowed",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderStatusCheck({ ...props, lineNumber })
            },
            {
                id: "8-6",
                parameters: "Cell fixing tape - Supplier, Type & Quantity",
                criteria: "Tape Qty should be 45 ± 15",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderCellFixingTape({ ...props, lineNumber })
            },
            {
                id: "8-9",
                parameters: "Cell to Cell Gap",
                criteria: "0.8 mm to 1.8 mm for M10, 0.3 mm to 1.3 mm for M10R & G12",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderGap({ ...props, lineNumber, criteria: "0.8 mm to 1.8 mm for M10, 0.3 mm to 1.3 mm for M10R & G12" })
            },
            {
                id: "8-10",
                parameters: "String to String Gap",
                criteria: "1.5 ± 0.5 mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderGap({ ...props, lineNumber, criteria: "1.5 ± 0.5 mm" })
            },
            {
                id: "8-11",
                parameters: "Creep edge distance - Left side",
                criteria: "Left Side Gap ≥ 12 mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderDistance({ ...props, lineNumber, criteria: "Left Side Gap ≥ 12 mm" })
            },
            {
                id: "8-12",
                parameters: "Creep edge distance - Right side",
                criteria: "Right Side Gap ≥ 12 mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderDistance({ ...props, lineNumber, criteria: "Right Side Gap ≥ 12 mm" })
            },
            {
                id: "8-13",
                parameters: "Creep edge distance - Top side",
                criteria: "Top Side Gap ≥ 12 mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderDistance({ ...props, lineNumber, criteria: "Top Side Gap ≥ 12 mm" })
            },
            {
                id: "8-14",
                parameters: "Creep edge distance - Bottom side",
                criteria: "Bottom Side Gap ≥ 12 mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderDistance({ ...props, lineNumber, criteria: "Bottom Side Gap ≥ 12 mm" })
            },
            {
                id: "8-15",
                parameters: "Space between 2 portions of half cut cell module",
                criteria: "Middle Gap 15 ± 5 mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderDistance({ ...props, lineNumber, criteria: "Middle Gap 15 ± 5 mm" })
            },
            {
                id: "8-16",
                parameters: "Cell fixing tape dimension",
                criteria: "Tape length 21 ± 5 mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoTapingNLayupObservations.renderTapeLength({ ...props, lineNumber })
            }
        ]
    };
};

export const autoTapingNLayupStage: StageData = createAutoTapingNLayupStage('I');