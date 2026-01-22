import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

const getLineConfiguration = (lineNumber: string): ('Line-3' | 'Line-4')[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[17];
    if (!stageConfig) return ['Line-3', 'Line-4'];
    const lineOptions = stageConfig.lineMapping[lineNumber];
    return Array.isArray(lineOptions) ? lineOptions as ('Line-3' | 'Line-4')[] : ['Line-3', 'Line-4'];
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

const FramingSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (timeSlot: '4hrs' | '8hrs') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Framing - {line.split('-')[1]}</span>
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
                <span className="text-sm font-semibold text-gray-700">Auto Framing - {line.split('-')[1]}</span>
            </div>
            {children}
        </div>
    ),

    SampleBasedSection: ({ line, value, onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (sample: string, timeSlot: '4hrs' | '8hrs') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Framing - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-4">
                <div className="flex-1">
                    <div className="text-center text-xs text-gray-500 mb-1">4 hours</div>
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
                    <div className="text-center text-xs text-gray-500 mb-1">8 hours</div>
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

const AutoFramingObservations = {
    renderStatusCheck: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line => ['supplier'].map(field => [`${line}-${field}`, ""]))
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <FramingSection.SingleInputSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Supplier</span>
                            <InputComponents.Select
                                value={sampleValue[`${line}-supplier`] || ''}
                                onChange={(value) => handleUpdate(line, 'supplier', value)}
                                options={[
                                    { value: "Taihe new energy", label: "Taihe new energy" },
                                    { value: "Yuejja Metallic (Davin)", label: "Yuejja Metallic (Davin)" },
                                    { value: "Anan", label: "Anan" },
                                    { value: "YONZ TECHNOLOGY", label: "YONZ TECHNOLOGY" },
                                    { value: "Juixin", label: "Juixin" },
                                    { value: "Yihua", label: "Yihua" },
                                    { value: "Ralpro", label: "Ralpro" },
                                    { value: "Vishakha Renewables", label: "Vishakha Renewables" },
                                    { value: "N/A", label: "N/A" }
                                ]}
                                type="status"
                            />
                        </div>
                    </FramingSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderSupplierInfo: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line => ['supplier', 'type', 'exp'].map(field => [`${line}-${field}`, ""]))
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <FramingSection.SingleInputSection
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
                    </FramingSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderGroundingHole: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line => ['4hrs', '8hrs'].map(timeSlot => [`${line}-${timeSlot}`, ""]))
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, timeSlot: '4hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <FramingSection.TimeBasedSection
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
                                    { value: "Both side of length", label: "Both side of length" },
                                    { value: "Both side of width", label: "Both side of width" },
                                    { value: "One side only", label: "One side only" },
                                    { value: "OFF", label: "OFF" }
                                ]}
                                type="status"
                            />
                        )}
                    </FramingSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderSampleCheck: (props: ObservationRenderProps & { lineNumber?: string }) => {
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
                    <FramingSection.SampleBasedSection
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
                    </FramingSection.SampleBasedSection>
                ))}
            </div>
        );
    },

    renderSealantWeight: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line => ['Length1', 'Length2', 'Width1', 'Width2'].map(position => [`${line}-${position}`, ""]))
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, position: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${position}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <FramingSection.SingleInputSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">Length 1</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-Length1`] || ''}
                                    onChange={(value) => handleUpdate(line, 'Length1', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500 mt-1">gm</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">Length 2</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-Length2`] || ''}
                                    onChange={(value) => handleUpdate(line, 'Length2', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500 mt-1">gm</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">Width 1</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-Width1`] || ''}
                                    onChange={(value) => handleUpdate(line, 'Width1', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500 mt-1">gm</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500 mb-1">Width 2</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-Width2`] || ''}
                                    onChange={(value) => handleUpdate(line, 'Width2', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500 mt-1">gm</span>
                            </div>
                        </div>
                    </FramingSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderMeasurement: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line => ['4hrs', '8hrs'].map(timeSlot => [`${line}-${timeSlot}`, ""]))
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, timeSlot: '4hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <FramingSection.TimeBasedSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(timeSlot) => (
                            <div className="flex flex-col items-center">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500 mt-1">
                                    {props.paramId.includes('coating-thickness') ? 'μm' : 'mm'}
                                </span>
                            </div>
                        )}
                    </FramingSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderDimensionMeasurement: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line => ['Length', 'Width'].map(dimension => [`${line}-${dimension}`, ""]))
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, timeSlot: '4hrs' | '8hrs', dimension: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}-${dimension}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <FramingSection.TimeBasedSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(timeSlot) => (
                            <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
                                <div className="flex gap-2">
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs text-gray-500 mb-1">Length</span>
                                        <InputComponents.TextInput
                                            value={sampleValue[`${line}-${timeSlot}-Length`] || ''}
                                            onChange={(value) => handleUpdate(line, timeSlot, 'Length', value)}
                                            placeholder=""
                                            type="measurement"
                                        />
                                        <span className="text-xs text-gray-500 mt-1">mm</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs text-gray-500 mb-1">Width</span>
                                        <InputComponents.TextInput
                                            value={sampleValue[`${line}-${timeSlot}-Width`] || ''}
                                            onChange={(value) => handleUpdate(line, timeSlot, 'Width', value)}
                                            placeholder=""
                                            type="measurement"
                                        />
                                        <span className="text-xs text-gray-500 mt-1">mm</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </FramingSection.TimeBasedSection>
                ))}
            </div>
        );
    }
};

export const createAutoFramingStage = (lineNumber: string): StageData => {
    return {
        id: 17,
        name: "Auto Framing",
        parameters: [
            {
                id: "17-1",
                parameters: "Frame status",
                criteria: "As per Production Order /BOM Engineering Specification",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderStatusCheck({ ...props, lineNumber })
            },
            {
                id: "17-2",
                parameters: "Frame sealant status",
                criteria: "As per Production Order /BOM Engineering Specification",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderSupplierInfo({ ...props, lineNumber })
            },
            {
                id: "17-3",
                parameters: "Grounding Hole",
                criteria: "Grounding hole should be there in Length (L) & Width (W) section frame",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderGroundingHole({ ...props, lineNumber })
            },
            {
                id: "17-4",
                parameters: "Back side glue around frame",
                criteria: "No silicon glue missing, continuous flow, no gap between glue and rear glass/back sheet",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderSampleCheck({ ...props, lineNumber })
            },
            {
                id: "17-5",
                parameters: "Frame sealant weight",
                criteria: "Sealant weight should be: 40 ± 7 gm./m for Glass Groove (5.6 ± 0.15 mm), 49 ± 7 gm./m for Glass Groove (6.1 + 0.3/-0 mm)",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderSealantWeight({ ...props, lineNumber })
            },
            {
                id: "17-6",
                parameters: "Frame Corner matching",
                criteria: "Corner gap & up down ≤ 0.5 mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderMeasurement({ ...props, lineNumber })
            },
            {
                id: "17-7",
                parameters: "Length & Width",
                criteria: "± 1mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderDimensionMeasurement({ ...props, lineNumber })
            },
            {
                id: "17-8",
                parameters: "Mounting hole CD-1",
                criteria: "± 1mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderMeasurement({ ...props, lineNumber })
            },
            {
                id: "17-9",
                parameters: "Mounting hole CD-2",
                criteria: "± 1mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderMeasurement({ ...props, lineNumber })
            },
            {
                id: "17-10",
                parameters: "Mounting hole CD-3",
                criteria: "± 1mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderMeasurement({ ...props, lineNumber })
            },
            {
                id: "17-11",
                parameters: "Diagonal Difference",
                criteria: "≤ 2mm max",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderMeasurement({ ...props, lineNumber })
            },
            {
                id: "17-12-coating-thickness",
                parameters: "Anodizing coating thickness",
                criteria: "≥ 15 μm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoFramingObservations.renderMeasurement({ ...props, lineNumber })
            }
        ]
    };
};

export const autoFramingStage: StageData = createAutoFramingStage('II');