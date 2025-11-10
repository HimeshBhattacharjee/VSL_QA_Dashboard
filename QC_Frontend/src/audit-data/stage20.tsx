import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

type TimeSlot2H = '2hrs';
type TimeSlot4H = '4hrs';
type TimeSlot6H = '6hrs';
type TimeSlot8H = '8hrs';
type AllTimeSlots = TimeSlot2H | TimeSlot4H | TimeSlot6H | TimeSlot8H;
type TimeSlots4H8H = TimeSlot4H | TimeSlot8H;

const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[20];
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
        if (upperValue === 'NG') return 'bg-red-100';
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
    TimeBasedSection: <T extends AllTimeSlots>({ line, value, onUpdate, children, timeSlots }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (timeSlot: T) => React.ReactNode;
        timeSlots: T[];
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Potting - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-2 justify-center">
                {timeSlots.map((timeSlot) => (
                    <div key={timeSlot} className="flex flex-col items-center justify-between">
                        <span className="text-xs text-gray-500 mb-1">{timeSlot}</span>
                        {children(timeSlot)}
                    </div>
                ))}
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
                <span className="text-sm font-semibold text-gray-700">Auto Potting - {line.split('-')[1]}</span>
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
            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 ${getBackgroundColor(value, type)} ${className}`}
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
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center ${(placeholder === 'Auto') ? 'bg-gray-200' : getBackgroundColor(value, type)} ${className}`}
            disabled={(placeholder === 'Auto') ? true : false}
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

const AutoPottingObservations = {
    renderJBPottingStatus: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['SupplierA', 'TypeA', 'ExpA', 'SupplierB', 'TypeB', 'ExpB'].map(field =>
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
                    <LineSection.SingleInputSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Supplier A</span>
                                <InputComponents.Select
                                    value={sampleValue[`${line}-SupplierA`] || ''}
                                    onChange={(value) => handleUpdate(line, 'SupplierA', value)}
                                    options={[
                                        { value: "HUITAN", label: "Huitan" },
                                        { value: "TONSAN", label: "Tonsan (HB fuller)" },
                                        { value: "ADARSHA", label: "Adarsha Speciality" },
                                        { value: "NA", label: "N/A" }
                                    ]}
                                    type="status"
                                />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Type A</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-TypeA`] || ''}
                                    onChange={(value) => handleUpdate(line, 'TypeA', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Expiry Date A</span>
                                <InputComponents.DateInput
                                    value={sampleValue[`${line}-ExpA`] || ''}
                                    onChange={(value) => handleUpdate(line, 'ExpA', value)}
                                />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Supplier B</span>
                                <InputComponents.Select
                                    value={sampleValue[`${line}-SupplierB`] || ''}
                                    onChange={(value) => handleUpdate(line, 'SupplierB', value)}
                                    options={[
                                        { value: "HUITAN", label: "Huitan" },
                                        { value: "TONSAN", label: "Tonsan (HB fuller)" },
                                        { value: "ADARSHA", label: "Adarsha Speciality" },
                                        { value: "NA", label: "N/A" }
                                    ]}
                                    type="status"
                                />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Type B</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-TypeB`] || ''}
                                    onChange={(value) => handleUpdate(line, 'TypeB', value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Expiry Date B</span>
                                <InputComponents.DateInput
                                    value={sampleValue[`${line}-ExpB`] || ''}
                                    onChange={(value) => handleUpdate(line, 'ExpB', value)}
                                />
                            </div>
                        </div>
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderAestheticCondition: (props: ObservationRenderProps & { lineNumber?: string }) => {
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

        const handleUpdate = (line: string, timeSlot: AllTimeSlots, value: string) => {
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
                        timeSlots={['2hrs', '4hrs', '6hrs', '8hrs']}
                    >
                        {(timeSlot) => (
                            <InputComponents.Select
                                value={sampleValue[`${line}-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate(line, timeSlot, value)}
                                options={[
                                    { value: "OK", label: "Checked OK" },
                                    { value: "NG", label: "Checked Not OK" },
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

    renderMixingRatio: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['PartA', 'PartB', 'Ratio'].map(field =>
                        [`${line}-${field}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleBulkUpdate = (updated: Record<string, string>) => {
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updated);
        };

        const parseNumberSafe = (s: string) => {
            if (s === null || s === undefined || s.trim() === '') return NaN;
            const n = parseFloat(s);
            return isFinite(n) ? n : NaN;
        };

        const gcd = (a: number, b: number) => {
            if (a === 0 || b === 0) return 1;
            const scale = Math.pow(10, Math.max(decimalPlaces(a), decimalPlaces(b)));
            let intA = Math.round(Math.abs(a) * scale);
            let intB = Math.round(Math.abs(b) * scale);
            while (intB) {
                const temp = intA % intB;
                intA = intB;
                intB = temp;
            }
            return intA / scale;
        };

        const decimalPlaces = (num: number) => {
            const str = num.toString();
            if (str.includes('.')) return str.split('.')[1].length;
            return 0;
        };

        const formatRatio = (aStr: string, bStr: string) => {
            const a = parseNumberSafe(aStr);
            const b = parseNumberSafe(bStr);
            if (isNaN(a) || isNaN(b) || b === 0) return '';
            const divisor = gcd(a, b) || 1;
            const simpA = a / divisor;
            const simpB = b / divisor;
            const normalizedA = simpA / simpB;
            const normalizedB = simpB / simpB;
            return `${normalizedA.toFixed(2)}:${normalizedB.toFixed(0)}`;
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
                        <div className="flex gap-2">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Part A</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-PartA`] || ''}
                                    onChange={(value) => {
                                        const updated: Record<string, string> = {
                                            ...sampleValue,
                                            [`${line}-PartA`]: value
                                        };
                                        updated[`${line}-Ratio`] = formatRatio(updated[`${line}-PartA`], updated[`${line}-PartB`]);
                                        handleBulkUpdate(updated);
                                    }}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500">gm</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Part B</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-PartB`] || ''}
                                    onChange={(value) => {
                                        const updated: Record<string, string> = {
                                            ...sampleValue,
                                            [`${line}-PartB`]: value
                                        };
                                        updated[`${line}-Ratio`] = formatRatio(updated[`${line}-PartA`], updated[`${line}-PartB`]);
                                        handleBulkUpdate(updated);
                                    }}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500">gm</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-gray-500">Ratio</span>
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-Ratio`] || ''}
                                    onChange={(value) => {
                                        const updated = { ...sampleValue, [`${line}-Ratio`]: value };
                                        handleBulkUpdate(updated);
                                    }}
                                    placeholder="Auto"
                                    type="measurement"
                                />
                            </div>
                        </div>
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderCupTest: (props: ObservationRenderProps & { lineNumber?: string }) => {
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

        const handleUpdate = (line: string, timeSlot: AllTimeSlots, value: string) => {
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
                        timeSlots={['2hrs', '4hrs', '6hrs', '8hrs']}
                    >
                        {(timeSlot) => (
                            <InputComponents.Select
                                value={sampleValue[`${line}-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate(line, timeSlot, value)}
                                options={[
                                    { value: "OK", label: "Checked OK" },
                                    { value: "NG", label: "Checked Not OK" },
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

    renderCuringQuality: (props: ObservationRenderProps & { lineNumber?: string }) => {
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

        const handleUpdate = (line: string, timeSlot: TimeSlots4H8H, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <LineSection.TimeBasedSection<TimeSlots4H8H>
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                        timeSlots={['4hrs', '8hrs']}
                    >
                        {(timeSlot) => (
                            <div className="flex flex-col items-center gap-2">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500">Shore A</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    }
};

export const createAutoPottingStage = (lineNumber: string): StageData => {
    return {
        id: 20,
        name: "Auto Potting",
        parameters: [
            {
                id: "20-1",
                parameters: "JB Potting status",
                criteria: "As per Production Order /BOM Engineering Specification",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoPottingObservations.renderJBPottingStatus({ ...props, lineNumber })
            },
            {
                id: "20-2",
                parameters: "Aesthetic Condition of Poured Potting Material",
                criteria: "Potting shall not come out of JB",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 2 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoPottingObservations.renderAestheticCondition({ ...props, lineNumber })
            },
            {
                id: "20-3",
                parameters: "Potting Material Mixing Ratio",
                criteria: "Potting material mixing ratio as per set process recipe ((5 ± 1) : 1)",
                typeOfInspection: "Functionality",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoPottingObservations.renderMixingRatio({ ...props, lineNumber })
            },
            {
                id: "20-4",
                parameters: "Cup test",
                criteria: "Potting material should be cured",
                typeOfInspection: "Functionality",
                inspectionFrequency: "Every 2 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoPottingObservations.renderCupTest({ ...props, lineNumber })
            },
            {
                id: "20-5",
                parameters: "Curing Quality",
                criteria: "Hardness should be ≥ 12 Shore A after 4 hours of curing",
                typeOfInspection: "Functionality",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoPottingObservations.renderCuringQuality({ ...props, lineNumber })
            }
        ]
    };
};

export const autoPottingStage: StageData = createAutoPottingStage('II');