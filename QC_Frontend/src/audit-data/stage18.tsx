import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[18];
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

const JBSection = {
    TimeBasedSection: ({ line, value: _value, onUpdate: _onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (timeSlot: 'shift' | '4hrs') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Junction Box Fixing - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-2">
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500">Shift</span>
                    {children('shift')}
                </div>
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500">4 hours</span>
                    {children('4hrs')}
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
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Junction Box Fixing - {line.split('-')[1]}</span>
            </div>
            {children}
        </div>
    ),

    SampleBasedSection: ({ line, value: _value, onUpdate: _onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (sample: string, timeSlot: '4hrs' | '8hrs') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Junction Box Fixing - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-4">
                <div className="flex-1">
                    <div className="text-center text-xs text-gray-500 mb-2">4 hours</div>
                    <div className="grid grid-cols-3 gap-2 border border-gray-200 rounded-lg p-2">
                        {['Sample-1', 'Sample-2', 'Sample-3', 'Sample-4', 'Sample-5', 'Sample-6'].map(sample => (
                            <div key={`4hrs-${sample}`} className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">{sample}</span>
                                {children(sample, '4hrs')}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1">
                    <div className="text-center text-xs text-gray-500 mb-2">8 hours</div>
                    <div className="grid grid-cols-3 gap-2 border border-gray-200 rounded-lg p-2">
                        {['Sample-1', 'Sample-2', 'Sample-3', 'Sample-4', 'Sample-5', 'Sample-6'].map(sample => (
                            <div key={`8hrs-${sample}`} className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">{sample}</span>
                                {children(sample, '8hrs')}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
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
        type?: 'status' | 'temperature' | 'measurement' | 'date';
    }) => (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center ${getBackgroundColor(value, type)} ${className}`}
        />
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
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center ${getBackgroundColor(value, 'date')} ${className}`}
        />
    )
};

const JunctionBoxFixingObservations = {
    renderJBStatus: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['supplier', 'type', 'diode', 'maxVoltage', 'maxCurrent', 'diodeType'].map(field =>
                        [`${line}-${field}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <JBSection.SingleInputSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500">Supplier</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-supplier`] || ''}
                                    onChange={(value) => handleUpdate(line, 'supplier', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500">Type</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-type`] || ''}
                                    onChange={(value) => handleUpdate(line, 'type', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500">Blocking Diode</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-diode`] || ''}
                                    onChange={(value) => handleUpdate(line, 'diode', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500">Max Voltage</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-maxVoltage`] || ''}
                                    onChange={(value) => handleUpdate(line, 'maxVoltage', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500">Max Current</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-maxCurrent`] || ''}
                                    onChange={(value) => handleUpdate(line, 'maxCurrent', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500">Diode Type</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-diodeType`] || ''}
                                    onChange={(value) => handleUpdate(line, 'diodeType', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                        </div>
                    </JBSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderConnectorCableStatus: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['cableSupplier', 'connectorType'].map(field =>
                        [`${line}-${field}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <JBSection.SingleInputSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        <div className="flex gap-2">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Cable Supplier</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-cableSupplier`] || ''}
                                    onChange={(value) => handleUpdate(line, 'cableSupplier', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Connector Type</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-connectorType`] || ''}
                                    onChange={(value) => handleUpdate(line, 'connectorType', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                        </div>
                    </JBSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderJBSealant: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['supplier', 'type', 'exp'].map(field =>
                        [`${line}-${field}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <JBSection.SingleInputSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Supplier</span>
                                <InputComponents.Select
                                    value={sampleValue[`${line}-supplier`] || ''}
                                    onChange={(value) => handleUpdate(line, 'supplier', value)}
                                    options={[
                                        { value: "Huitan", label: "Huitan" },
                                        { value: "Tonsan (HB fuller)", label: "Tonsan (HB fuller)" },
                                        { value: "Adarsha Speciality", label: "Adarsha Speciality" },
                                        { value: "N/A", label: "N/A" }
                                    ]}
                                    type="status"
                                />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Type</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-type`] || ''}
                                    onChange={(value) => handleUpdate(line, 'type', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Expiry Date</span>
                                <InputComponents.DateInput
                                    value={sampleValue[`${line}-exp`] || ''}
                                    onChange={(value) => handleUpdate(line, 'exp', value)}
                                />
                            </div>
                        </div>
                    </JBSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderGlueAroundJB: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['Sample-1', 'Sample-2', 'Sample-3', 'Sample-4', 'Sample-5', 'Sample-6'].flatMap(sample =>
                        ['4hrs', '8hrs'].map(timeSlot => [`${line}-${sample}-${timeSlot}`, ""])
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, sample: string, timeSlot: '4hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${sample}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex flex-col justify-between gap-4">
                {lines.map(line => (
                    <JBSection.SampleBasedSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(sample, timeSlot) => (
                            <InputComponents.Select
                                value={sampleValue[`${line}-${sample}-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate(line, sample, timeSlot, value)}
                                options={[
                                    { value: "Checked OK", label: "Checked OK" },
                                    { value: "Checked Not OK", label: "Checked Not OK" },
                                    { value: "OFF", label: "OFF" }
                                ]}
                                type="status"
                            />
                        )}
                    </JBSection.SampleBasedSection>
                ))}
            </div>
        );
    },

    renderCableLength: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['positive', 'negative'].map(cableType =>
                        [`${line}-${cableType}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, cableType: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${cableType}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <JBSection.SingleInputSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        <div className="flex gap-2">
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">(+) ve Cable Length</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-positive`] || ''}
                                    onChange={(value) => handleUpdate(line, 'positive', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500 mt-1">mm</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">(-) ve Cable Length</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-negative`] || ''}
                                    onChange={(value) => handleUpdate(line, 'negative', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500 mt-1">mm</span>
                            </div>
                        </div>
                    </JBSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderSealantWeight: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['left', 'middle', 'right'].map(position =>
                        [`${line}-${position}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, position: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${position}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <JBSection.SingleInputSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        <div className="grid grid-rows-3 gap-2">
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">Left Split JB (HC)</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-left`] || ''}
                                    onChange={(value) => handleUpdate(line, 'left', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500 mt-1">gm</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">Middle Split JB (HC)</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-middle`] || ''}
                                    onChange={(value) => handleUpdate(line, 'middle', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500 mt-1">gm</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">Right Split JB (HC)</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-right`] || ''}
                                    onChange={(value) => handleUpdate(line, 'right', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500 mt-1">gm</span>
                            </div>
                        </div>
                    </JBSection.SingleInputSection>
                ))}
            </div>
        );
    }
};

export const createJunctionBoxFixingStage = (lineNumber: string): StageData => {
    return {
        id: 18,
        name: "Junction Box Fixing",
        parameters: [
            {
                id: "18-1",
                parameters: "Junction Box Status",
                criteria: "As per Production Order / BOM Engineering Specification",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    JunctionBoxFixingObservations.renderJBStatus({ ...props, lineNumber })
            },
            {
                id: "18-2",
                parameters: "Junction Box Connector & Cable Status",
                criteria: "As per Production Order / BOM Engineering Specification",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    JunctionBoxFixingObservations.renderConnectorCableStatus({ ...props, lineNumber })
            },
            {
                id: "18-3",
                parameters: "Junction Box sealant",
                criteria: "As per Production Order / BOM Engineering Specification",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    JunctionBoxFixingObservations.renderJBSealant({ ...props, lineNumber })
            },
            {
                id: "18-4",
                parameters: "Glue around JB profile",
                criteria: "No silicon glue missing, continuous flow, no gap between glue and rear glass/back sheet",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    JunctionBoxFixingObservations.renderGlueAroundJB({ ...props, lineNumber })
            },
            {
                id: "18-5",
                parameters: "Junction Box Cable Length",
                criteria: "As per Production Order / BOM Engineering Specification",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every shift",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    JunctionBoxFixingObservations.renderCableLength({ ...props, lineNumber })
            },
            {
                id: "18-6",
                parameters: "JB sealant Weight",
                criteria: "Sealant Weight for Split JB 6 ± 2 gm/JB",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every shift",
                observations: [{ timeSlot: "", value: "" }],
                renderObservation: (props: ObservationRenderProps) =>
                    JunctionBoxFixingObservations.renderSealantWeight({ ...props, lineNumber })
            }
        ]
    };
};

export const junctionBoxFixingStage: StageData = createJunctionBoxFixingStage('II');