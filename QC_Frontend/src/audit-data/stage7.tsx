import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

// Helper function to get line configuration based on lineNumber
const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[7];
    if (!stageConfig) return ['Line-4', 'Line-5']; // Default fallback

    const lineOptions = stageConfig.lineMapping[lineNumber];
    return Array.isArray(lineOptions) ? lineOptions : ['Line-4', 'Line-5'];
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
        if (upperValue === 'NG') return 'bg-red-100';
        if (upperValue === 'OK') return 'bg-green-100';
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
    TimeBasedSection: ({ line, value, onUpdate, children }: {
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

    SingleInputSection: ({ line, value, onUpdate, children }: {
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

    BusRibbonStatusSection: ({ line, value, onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (label: 'Supplier' | 'Width' | 'Thickness' | 'Expiry Date') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Bussing - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-2 justify-between">
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Supplier</span>
                    {children('Supplier')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Width</span>
                    {children('Width')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Thickness</span>
                    {children('Thickness')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Expiry Date</span>
                    {children('Expiry Date')}
                </div>
            </div>
        </div>
    ),

    SolderingTimeSection: ({ line, value, onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (position: 'Front TCA 1 L' | 'Middle TCA 1 L' | 'Back TCA 1 L' | 'Front TCA 1 R' | 'Middle TCA 1 R' | 'Back TCA 1 R') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Auto Bussing - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-2 justify-between">
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Front TCA 1</span>
                    {children('Front TCA 1 L')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Middle TCA 1</span>
                    {children('Middle TCA 1 L')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Back TCA 1</span>
                    {children('Back TCA 1 L')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Front TCA 1</span>
                    {children('Front TCA 1 R')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Middle TCA 1</span>
                    {children('Middle TCA 1 R')}
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Back TCA 1</span>
                    {children('Back TCA 1 R')}
                </div>
            </div>
        </div>
    ),

    SolderingTraceSection: ({ line, value, onUpdate, children }: {
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

    BusBarCutLength: ({ line, value, onUpdate, children }: {
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

    PeelStrengthSection: ({ line, value, onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: {
            byPosition: (position: number) => React.ReactNode;
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
            <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(position => (
                    <div key={position} className="flex flex-col items-center">
                        <span className="text-xs text-gray-500 mb-1">Pos {position}</span>
                        {children.byPosition(position)}
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
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${getBackgroundColor(value, type)} ${className}`}
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
                className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center ${getBackgroundColor(value, type)} ${className}`}
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
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center ${getBackgroundColor(value, 'date')} ${className}`}
        />
    )
};

const AutoBussingObservations = {
    renderBusRibbonStatus: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['Supplier', 'Width', 'Thickness', 'Expiry Date'].map(label =>
                        [`${line}-${label}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, label: 'Supplier' | 'Width' | 'Thickness' | 'Expiry Date', value: string) => {
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
                                    { value: "JUREN", label: "Juren" },
                                    { value: "SUNBY", label: "Sunby" },
                                    { value: "YB", label: "YourBest" },
                                    { value: "NA", label: "N/A" }
                                ]}
                                type="status"
                            />
                        ) : (label === 'Expiry Date') ? (
                            <InputComponents.DateInput
                                value={sampleValue[`${line}-${label}`] || ''}
                                onChange={(value) => handleUpdate(line, label, value)}
                            />
                        ) : (
                            <InputComponents.TextInput
                                value={sampleValue[`${line}-${label}`] || ''}
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
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['Front TCA 1 L', 'Middle TCA 1 L', 'Back TCA 1 L', 'Front TCA 1 R', 'Middle TCA 1 R', 'Back TCA 1 R'].map(position =>
                        [`${line}-${position}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, position: 'Front TCA 1 L' | 'Middle TCA 1 L' | 'Back TCA 1 L' | 'Front TCA 1 R' | 'Middle TCA 1 R' | 'Back TCA 1 R', value: string) => {
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
                            value={sampleValue[line] || ''}
                            onChange={(value) => handleUpdate(line, value)}
                            options={[
                                { value: "OK", label: "Checked OK" },
                                { value: "NG", label: "Checked Not OK" },
                                { value: "NA", label: "N/A" }
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

    renderPeelStrength: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    [
                        ['Line', ''], ['Position', ''], ['Side', ''],
                        ...Array.from({ length: 20 }, (_, i) => [`Pos${i + 1}`, ''])
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
                    byPosition: (position) => (
                        <InputComponents.TextInput
                            value={sampleValue[`${line}-Pos${position}`] || ''}
                            onChange={(value) => handleUpdate(`${line}-Pos${position}`, value)}
                            placeholder=""
                            type="measurement"
                        />
                    ),
                }}
            />
        );

        return (
            <div className="flex gap-4">
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
                    { timeSlot: "", value: "" }
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

// Keep the original export for backward compatibility
export const autoBussingStage: StageData = createAutoBussingStage('II');