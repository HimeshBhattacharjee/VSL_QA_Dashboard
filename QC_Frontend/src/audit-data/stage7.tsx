import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

type FieldDefinition = {
    key: string;
    label: string;
};

type PatchSampleKey = 'sample_1' | 'sample_2';
type PatchMeasurementKey = 'length' | 'height' | 'width';
type PatchSampleValue = Record<PatchSampleKey, Record<PatchMeasurementKey, string>>;
type PatchMeasurementValue = Record<string, PatchSampleValue>;

const PATCH_SAMPLE_KEYS: PatchSampleKey[] = ['sample_1', 'sample_2'];
const PATCH_MEASUREMENT_FIELDS: { key: PatchMeasurementKey; label: string }[] = [
    { key: 'length', label: 'Length' },
    { key: 'height', label: 'Height' },
    { key: 'width', label: 'Width' },
];

const LINE_II_SOLDERING_TIME_FIELDS: FieldDefinition[] = [
    { key: 'Front TCA 1 L', label: 'Front TCA 1' },
    { key: 'Middle TCA 1 L', label: 'Middle TCA 1' },
    { key: 'Back TCA 1 L', label: 'Back TCA 1' },
    { key: 'Front TCA 1 R', label: 'Front TCA 1' },
    { key: 'Middle TCA 1 R', label: 'Middle TCA 1' },
    { key: 'Back TCA 1 R', label: 'Back TCA 1' },
];

const LINE_I_SOLDERING_TIME_FIELDS: FieldDefinition[] = Array.from({ length: 6 }, (_, index) => index + 1)
    .flatMap(tcaNumber => [
        { key: `front_tca_${tcaNumber}`, label: `Front TCA ${tcaNumber}` },
        { key: `middle_tca_${tcaNumber}`, label: `Middle TCA ${tcaNumber}` },
        { key: `back_tca_${tcaNumber}`, label: `Back TCA ${tcaNumber}` },
    ]);

const LEGACY_LINE_I_SOLDERING_TIME_FALLBACKS: Record<string, string> = {
    front_tca_1: 'Front TCA 1 L',
    middle_tca_1: 'Middle TCA 1 L',
    back_tca_1: 'Back TCA 1 L',
    front_tca_2: 'Front TCA 1 R',
    middle_tca_2: 'Middle TCA 1 R',
    back_tca_2: 'Back TCA 1 R',
};

// Helper function to get line configuration based on lineNumber
const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[7];
    if (!stageConfig) return ['Line-4', 'Line-5']; // Default fallback

    const lineOptions = stageConfig.lineMapping[lineNumber];
    return Array.isArray(lineOptions) ? lineOptions : ['Line-4', 'Line-5'];
};

const isLineI = (lineNumber?: string) => lineNumber === 'I';

const createLineISolderingTimeParameters = (lineNumber: string): Record<string, Record<string, string>> => {
    const lines = getLineConfiguration(lineNumber);
    return Object.fromEntries(
        lines.map(line => [
            line,
            Object.fromEntries(LINE_I_SOLDERING_TIME_FIELDS.map(field => [field.key, ""]))
        ])
    );
};

const createPatchMeasurementParameters = (lineNumber: string): PatchMeasurementValue => {
    const lines = getLineConfiguration(lineNumber);
    return Object.fromEntries(
        lines.map(line => [
            line,
            Object.fromEntries(
                PATCH_SAMPLE_KEYS.map(sampleKey => [
                    sampleKey,
                    Object.fromEntries(PATCH_MEASUREMENT_FIELDS.map(field => [field.key, ""]))
                ])
            )
        ])
    ) as PatchMeasurementValue;
};

// Helper function for conditional formatting
const getBackgroundColor = (value: string, type: 'status' | 'temperature' | 'measurement' | 'date' = 'status') => {
    if (!value) return 'bg-white';

    const upperValue = value.toUpperCase();

    // OFF formatting (case insensitive)
    if (upperValue === 'OFF') return 'bg-yellow-100';

    // Status-based formatting
    if (type === 'status') {
        if (upperValue === 'N/A') return 'bg-yellow-100';
        if (upperValue === 'CHECKED NOT OK') return 'bg-red-100';
    }

    // Date-based formatting
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
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Bussing - {line.split('-')[1]}</span>
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
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Bussing - {line.split('-')[1]}</span>
            </div>
            {children}
        </div>
    ),

    BusRibbonStatusSection: ({ line, value: _value, onUpdate: _onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (label: 'Supplier' | 'Width Top & Bottom' | 'Width Middle' | 'Thickness Top & Bottom' | 'Thickness Middle' | 'Expiry Date Top & Bottom' | 'Expiry Date Middle') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Bussing - {line.split('-')[1]}</span>
            </div>
            <div className="flex flex-col mb-2 items-center">
                <span className="text-xs text-gray-500 mb-1">Supplier</span>
                {children('Supplier')}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Width (Top & Bottom)</span>
                    {children('Width Top & Bottom')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Width (Middle)</span>
                    {children('Width Middle')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Thickness (Top & Bottom)</span>
                    {children('Thickness Top & Bottom')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Thickness (Middle)</span>
                    {children('Thickness Middle')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Expiry Date (Top & Bottom)</span>
                    {children('Expiry Date Top & Bottom')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Expiry Date (Middle)</span>
                    {children('Expiry Date Middle')}
                </div>
            </div>
        </div>
    ),

    SolderingTimeSection: ({ line, fields = LINE_II_SOLDERING_TIME_FIELDS, value: _value, onUpdate: _onUpdate, children }: {
        line: string;
        fields?: FieldDefinition[];
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (position: string) => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Bussing - {line.split('-')[1]}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 justify-between">
                {fields.map(field => (
                    <div key={field.key} className="flex flex-col items-center">
                        <span className="text-xs text-gray-500 mb-1">{field.label}</span>
                        {children(field.key)}
                    </div>
                ))}
            </div>
        </div>
    ),

    SolderingTraceSection: ({ line, value: _value, onUpdate: _onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (label: 'Top' | 'Middle' | 'Bottom') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Bussing - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-2 justify-between">
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Top</span>
                    {children('Top')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Middle</span>
                    {children('Middle')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Bottom</span>
                    {children('Bottom')}
                </div>
            </div>
        </div>
    ),

    BusBarCutLength: ({ line, value: _value, onUpdate: _onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (type: 'I' | 'Small L' | 'Big L' | 'Terminal') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Bussing - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-2 justify-between">
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">I</span>
                    {children('I')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Small L</span>
                    {children('Small L')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Big L</span>
                    {children('Big L')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Terminal</span>
                    {children('Terminal')}
                </div>
            </div>
        </div>
    ),

    PatchMeasurementSection: ({ line, value: _value, onUpdate: _onUpdate, children }: {
        line: string;
        value: PatchSampleValue;
        onUpdate: (updatedValue: PatchSampleValue) => void;
        children: (sampleKey: PatchSampleKey, fieldKey: PatchMeasurementKey) => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-3">
            <div className="text-center mb-3">
                <span className="text-sm font-semibold text-gray-700">Auto Bussing - {line.split('-')[1]}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PATCH_SAMPLE_KEYS.map((sampleKey, sampleIndex) => (
                    <div
                        key={sampleKey}
                        className={sampleIndex === 1 ? 'sm:border-l sm:border-gray-200 sm:pl-3' : ''}
                    >
                        <div className="text-xs font-semibold text-gray-600 text-center mb-2">
                            Sample - {sampleIndex + 1}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {PATCH_MEASUREMENT_FIELDS.map(field => (
                                <div key={field.key} className="flex flex-col items-center min-w-0">
                                    <span className="text-xs text-gray-500 mb-1">{field.label}</span>
                                    {children(sampleKey, field.key)}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    ),

    PeelStrengthSection: ({ line, value: _value, onUpdate: _onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: {
            byPosition: (displayPosition: number, storagePosition: number) => React.ReactNode;
            byLabel: (label: 'Line' | 'Position' | 'Side') => React.ReactNode;
        };
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Bussing - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-2 justify-between mb-2">
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Line</span>
                    {children.byLabel('Line')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Position</span>
                    {children.byLabel('Position')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Side</span>
                    {children.byLabel('Side')}
                </div>
            </div>
            <div className="grid grid-cols-10 gap-2">
                {Array.from({ length: 40 }, (_, index) => ({
                    displayPosition: index < 20 ? index + 1 : index - 19,
                    storagePosition: index + 1
                })).map(({ displayPosition, storagePosition }) => (
                    <div key={storagePosition} className="flex flex-col items-center">
                        <span className="text-xs text-gray-500 mb-1">Pos {displayPosition}</span>
                        {children.byPosition(displayPosition, storagePosition)}
                    </div>
                ))}
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
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary ${getBackgroundColor(value, type)} ${className}`}
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
                className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-center ${getBackgroundColor(value, type)} ${className}`}
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
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-center ${getBackgroundColor(value, 'date')} ${className}`}
        />
    )
};

const AutoBussingObservations = {
    renderBusRibbonStatus: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['Supplier', 'Width Top & Bottom', 'Width Middle', 'Thickness Top & Bottom', 'Thickness Middle', 'Expiry Date Top & Bottom', 'Expiry Date Middle'].map(label =>
                        [`${line}-${label}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, label: 'Supplier' | 'Width Top & Bottom' | 'Width Middle' | 'Thickness Top & Bottom' | 'Thickness Middle' | 'Expiry Date Top & Bottom' | 'Expiry Date Middle', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${label}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <LineSection.BusRibbonStatusSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(label) => (label === 'Supplier') ? (
                            <InputComponents.Select
                                value={sampleValue[`${line}-${label}`] || ''}
                                onChange={(value) => handleUpdate(line, label, value)}
                                options={[
                                    { value: "Juren", label: "Juren" },
                                    { value: "Sunby", label: "Sunby" },
                                    { value: "YourBest", label: "YourBest" },
                                    { value: "N/A", label: "N/A" }
                                ]}
                                type="status"
                            />
                        ) : (label === 'Expiry Date Top & Bottom' || label === 'Expiry Date Middle') ? (
                            <InputComponents.DateInput
                                value={sampleValue[`${line}-${label}`] || (label === 'Expiry Date Top & Bottom' ? sampleValue[`${line}-Expiry Date`] : '') || ''}
                                onChange={(value) => handleUpdate(line, label, value)}
                            />
                        ) : (
                            <InputComponents.TextInput
                                value={sampleValue[`${line}-${label}`] || (label === 'Width Top & Bottom' ? sampleValue[`${line}-Width`] : label === 'Thickness Top & Bottom' ? sampleValue[`${line}-Thickness`] : '') || ''}
                                onChange={(value) => handleUpdate(line, label, value)}
                                placeholder=""
                                type="measurement"
                            />
                        )}
                    </LineSection.BusRibbonStatusSection>
                ))}
            </div>
        );
    },

    renderSolderingTime: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const lineISelected = isLineI(props.lineNumber);

        if (lineISelected) {
            const rawValue = typeof props.value === 'object' && props.value !== null
                ? props.value as Record<string, unknown>
                : {};
            const sampleValue = lines.reduce<Record<string, Record<string, string>>>((merged, line) => {
                const savedLineValue = rawValue[line];
                const lineValues = typeof savedLineValue === 'object' && savedLineValue !== null && !Array.isArray(savedLineValue)
                    ? savedLineValue as Record<string, string>
                    : {};

                merged[line] = Object.fromEntries(
                    LINE_I_SOLDERING_TIME_FIELDS.map(field => [
                        field.key,
                        lineValues[field.key]
                        || (typeof rawValue[`${line}-${LEGACY_LINE_I_SOLDERING_TIME_FALLBACKS[field.key]}`] === 'string'
                            ? rawValue[`${line}-${LEGACY_LINE_I_SOLDERING_TIME_FALLBACKS[field.key]}`] as string
                            : '')
                    ])
                );
                return merged;
            }, {});

            const handleUpdate = (line: string, position: string, value: string) => {
                const updatedValue = {
                    ...sampleValue,
                    [line]: {
                        ...sampleValue[line],
                        [position]: value
                    }
                };
                props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
            };

            return (
                <div className="flex flex-row gap-4">
                    {lines.map(line => (
                        <LineSection.SolderingTimeSection
                            key={line}
                            line={line}
                            fields={LINE_I_SOLDERING_TIME_FIELDS}
                            value={sampleValue[line]}
                            onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, {
                                ...sampleValue,
                                [line]: updatedValue
                            })}
                        >
                            {(position) => (
                                <InputComponents.TextInput
                                    value={sampleValue[line]?.[position] || ''}
                                    onChange={(value) => handleUpdate(line, position, value)}
                                    placeholder=""
                                    type="measurement"
                                />
                            )}
                        </LineSection.SolderingTimeSection>
                    ))}
                </div>
            );
        }

        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    LINE_II_SOLDERING_TIME_FIELDS.map(field =>
                        [`${line}-${field.key}`, ""]
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
                    <LineSection.SolderingTimeSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(position) => (
                            <InputComponents.TextInput
                                value={sampleValue[`${line}-${position}`] || ''}
                                onChange={(value) => handleUpdate(line, position, value)}
                                placeholder=""
                                type="measurement"
                            />
                        )}
                    </LineSection.SolderingTimeSection>
                ))}
            </div>
        );
    },

    renderCoolingTemperature: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['left', 'right'].map(section =>
                        [`${line}-${section}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, section: 'left' | 'right', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${section}`]: value };
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
                            <InputComponents.TextInput
                                value={sampleValue[`${line}-left`] || ''}
                                onChange={(value) => handleUpdate(line, 'left', value)}
                                placeholder=""
                                type="temperature"
                            />
                            <InputComponents.TextInput
                                value={sampleValue[`${line}-right`] || ''}
                                onChange={(value) => handleUpdate(line, 'right', value)}
                                placeholder=""
                                type="temperature"
                            />
                        </div>
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderSolderingIronTemperature: (props: ObservationRenderProps & { lineNumber?: string }) => {
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
                                type="temperature"
                            />
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderSolderingTripCalibration: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.map(line => [`${line}`, ""]))
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, value: string) => {
            const updatedValue = { ...sampleValue, [line]: value };
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
                        <InputComponents.Select
                            value={sampleValue[line] || 'Checked OK'}
                            onChange={(value) => handleUpdate(line, value)}
                            options={[
                                { value: "Checked OK", label: "Checked OK" },
                                { value: "Checked Not OK", label: "Checked Not OK" },
                                { value: "N/A", label: "N/A" }
                            ]}
                            type="status"
                        />
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderSolderingTraces: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['Top', 'Middle', 'Bottom'].map(label =>
                        [`${line}-${label}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, label: 'Top' | 'Middle' | 'Bottom', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${label}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <LineSection.SolderingTraceSection
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(label) => (
                            <InputComponents.TextInput
                                value={sampleValue[`${line}-${label}`] || ''}
                                onChange={(value) => handleUpdate(line, label, value)}
                                placeholder=""
                                type="measurement"
                            />
                        )}
                    </LineSection.SolderingTraceSection>
                ))}
            </div>
        );
    },

    renderBusBarCutLength: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['I', 'Small L', 'Big L', 'Terminal'].map(type =>
                        [`${line}-${type}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, type: 'I' | 'Small L' | 'Big L' | 'Terminal', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${type}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <LineSection.BusBarCutLength
                        key={line}
                        line={line}
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(type) => (
                            <InputComponents.TextInput
                                value={sampleValue[`${line}-${type}`] || ''}
                                onChange={(value) => handleUpdate(line, type, value)}
                                placeholder=""
                                type="measurement"
                            />
                        )}
                    </LineSection.BusBarCutLength>
                ))}
            </div>
        );
    },

    renderStringAlignment: (props: ObservationRenderProps & { lineNumber?: string }) => {
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

    renderPatchMeasurements: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const rawValue = typeof props.value === 'object' && props.value !== null
            ? props.value as Record<string, unknown>
            : {};
        const sampleValue = lines.reduce<PatchMeasurementValue>((normalized, line) => {
            const savedLine = typeof rawValue[line] === 'object' && rawValue[line] !== null
                ? rawValue[line] as Record<string, unknown>
                : {};

            normalized[line] = Object.fromEntries(
                PATCH_SAMPLE_KEYS.map(sampleKey => {
                    const savedSample = typeof savedLine[sampleKey] === 'object' && savedLine[sampleKey] !== null
                        ? savedLine[sampleKey] as Record<string, string>
                        : {};
                    return [
                        sampleKey,
                        Object.fromEntries(
                            PATCH_MEASUREMENT_FIELDS.map(field => [field.key, savedSample[field.key] || ""])
                        )
                    ];
                })
            ) as PatchSampleValue;
            return normalized;
        }, {});

        const handleUpdate = (
            line: string,
            sampleKey: PatchSampleKey,
            fieldKey: PatchMeasurementKey,
            value: string
        ) => {
            const updatedValue: PatchMeasurementValue = {
                ...sampleValue,
                [line]: {
                    ...sampleValue[line],
                    [sampleKey]: {
                        ...sampleValue[line][sampleKey],
                        [fieldKey]: value
                    }
                }
            };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {lines.map(line => (
                    <LineSection.PatchMeasurementSection
                        key={line}
                        line={line}
                        value={sampleValue[line]}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, {
                            ...sampleValue,
                            [line]: updatedValue
                        })}
                    >
                        {(sampleKey, fieldKey) => (
                            <InputComponents.TextInput
                                value={sampleValue[line][sampleKey][fieldKey]}
                                onChange={(value) => handleUpdate(line, sampleKey, fieldKey, value)}
                                placeholder=""
                                className="w-full min-w-0"
                                type="measurement"
                            />
                        )}
                    </LineSection.PatchMeasurementSection>
                ))}
            </div>
        );
    },

    renderPeelStrength: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    [
                        ['Line', ''], ['Position', ''], ['Side', ''],
                        ...Array.from({ length: 40 }, (_, i) => [`Pos${i + 1}`, ''])
                    ].map(([key]) => [`${line}-${key}`, ""])
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (key: string, value: string) => {
            const updatedValue = { ...sampleValue, [key]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        const renderLineSection = (line: string) => (
            <LineSection.PeelStrengthSection
                key={line}
                line={line}
                value={sampleValue}
                onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                children={{
                    byLabel: (label) => (label !== 'Side') ? (
                        <InputComponents.TextInput
                            value={sampleValue[`${line}-${label}`] || ''}
                            onChange={(value) => handleUpdate(`${line}-${label}`, value)}
                            placeholder=""
                            type="measurement"
                        />
                    ) : (
                        <InputComponents.Select
                            value={sampleValue[`${line}-${label}`] || ''}
                            onChange={(value) => handleUpdate(`${line}-${label}`, value)}
                            options={[
                                { value: "Top", label: "Top" },
                                { value: "Middle", label: "Middle" },
                                { value: "Bottom", label: "Bottom" },
                                { value: "OFF", label: "OFF" }
                            ]}
                            type="status"
                        />
                    ),
                    byPosition: (_displayPosition, storagePosition) => (
                        <InputComponents.TextInput
                            value={sampleValue[`${line}-Pos${storagePosition}`] || ''}
                            onChange={(value) => handleUpdate(`${line}-Pos${storagePosition}`, value)}
                            placeholder=""
                            type="measurement"
                        />
                    ),
                }}
            />
        );

        return (
            <div className="flex flex-col gap-4">
                {lines.map(renderLineSection)}
            </div>
        );
    }
};

// Factory function for creating auto bussing stage with line configuration
export const createAutoBussingStage = (lineNumber: string): StageData => {
    return {
        id: 7,
        name: "Auto Bussing",
        parameters: [
            {
                id: "7-1",
                parameters: "BUS Ribbon Status",
                criteria: "As per Production Order / BOM Engineering Specification",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoBussingObservations.renderBusRibbonStatus({ ...props, lineNumber })
            },
            {
                id: "7-2",
                parameters: "Soldering Time",
                criteria: "1.2 ± 0.4 Sec.",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: isLineI(lineNumber) ? createLineISolderingTimeParameters(lineNumber) : "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoBussingObservations.renderSolderingTime({ ...props, lineNumber })
            },
            {
                id: "7-3",
                parameters: "Soldering Cooling Temperature",
                criteria: "40° ± 15° C",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoBussingObservations.renderCoolingTemperature({ ...props, lineNumber })
            },
            {
                id: "7-4",
                parameters: "Soldering Iron Temperature",
                criteria: "370° C to 410° C (Manual Bussing)",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hrs",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoBussingObservations.renderSolderingIronTemperature({ ...props, lineNumber })
            },
            {
                id: "7-5",
                parameters: "Soldering Trip Calibration",
                criteria: "Calibration should be done once/day, SPC graph update",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every day",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoBussingObservations.renderSolderingTripCalibration({ ...props, lineNumber })
            },
            {
                id: "7-6",
                parameters: "Soldering Traces at Interconnect and Bus Ribbon Junction",
                criteria: "Soldering must cover ≥ 50% width of bus ribbon",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoBussingObservations.renderSolderingTraces({ ...props, lineNumber })
            },
            {
                id: "7-7",
                parameters: "Bus Bar Cut Length",
                criteria: "I = 345 ± 5 mm, Small L = 170 ± 5 mm, Big L = 365 ± 5 mm, Terminal height = 20 ± 5 mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoBussingObservations.renderBusBarCutLength({ ...props, lineNumber })
            },
            {
                id: "7-8",
                parameters: "String Alignment",
                criteria: "≤ 0.5mm",
                typeOfInspection: "Measurements",
                inspectionFrequency: "Every 4 hrs",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoBussingObservations.renderStringAlignment({ ...props, lineNumber })
            },
            {
                id: "7-10",
                parameters: "Place rear encapsulant patch at all 3 terminal areas",
                criteria: "Patch ('U'):\nLength + Height = 55 ± 5 mm\nWidth = 10 ± 5 mm",
                typeOfInspection: "Measurement",
                inspectionFrequency: "Every Shift",
                observations: [
                    { timeSlot: "", value: createPatchMeasurementParameters(lineNumber) }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoBussingObservations.renderPatchMeasurements({ ...props, lineNumber })
            },
            {
                id: "7-9",
                parameters: "Peel Strength Bus Ribbon to INTC Ribbon",
                criteria: "≥ 1.5 N (Average) (Multi BB Round Wire)",
                typeOfInspection: "Functionality",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    AutoBussingObservations.renderPeelStrength({ ...props, lineNumber })
            }
        ]
    };
};

export const autoBussingStage: StageData = createAutoBussingStage('II');
