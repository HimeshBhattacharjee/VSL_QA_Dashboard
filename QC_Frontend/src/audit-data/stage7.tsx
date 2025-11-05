import { StageData, ObservationRenderProps } from '../types/audit';

const LineSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: 'Line-4' | 'Line-5';
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
        line: 'Line-4' | 'Line-5';
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
        line: 'Line-4' | 'Line-5';
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
        line: 'Line-4' | 'Line-5';
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
        line: 'Line-4' | 'Line-5';
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
        line: 'Line-4' | 'Line-5';
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
        line: 'Line-4' | 'Line-5';
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
    Select: ({ value, onChange, options, className = "" }: {
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
            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white ${className}`}
        />
    )
};

const AutoBussingObservations = {
    renderBusRibbonStatus: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-4-Supplier": "", "Line-4-Width": "", "Line-4-Thickness": "", "Line-4-Expiry Date": "",
                "Line-5-Supplier": "", "Line-5-Width": "", "Line-5-Thickness": "", "Line-5-Expiry Date": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-4' | 'Line-5', label: 'Supplier' | 'Width' | 'Thickness' | 'Expiry Date', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${label}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex flex-col justify-between gap-4">
                <LineSection.BusRibbonStatusSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(label) => (label === 'Supplier') ? (
                        <InputComponents.Select
                            value={sampleValue[`Line-4-${label}`] || ''}
                            onChange={(value) => handleUpdate('Line-4', label, value)}
                            options={[
                                { value: "JUREN", label: "Juren" },
                                { value: "SUNBY", label: "Sunby" },
                                { value: "YB", label: "YourBest" },
                                { value: "NA", label: "N/A" }
                            ]}
                        />
                    ) : (label === 'Expiry Date') ? (
                        <InputComponents.DateInput
                            value={sampleValue[`Line-4-${label}`] || ''}
                            onChange={(value) => handleUpdate('Line-4', label, value)}
                        />
                    ) : (
                        <InputComponents.TextInput
                            value={sampleValue[`Line-4-${label}`] || ''}
                            onChange={(value) => handleUpdate('Line-4', label, value)}
                            placeholder=""
                        />
                    )}
                </LineSection.BusRibbonStatusSection>
                <LineSection.BusRibbonStatusSection
                    line="Line-5"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(label) => (label === 'Supplier') ? (
                        <InputComponents.Select
                            value={sampleValue[`Line-5-${label}`] || ''}
                            onChange={(value) => handleUpdate('Line-5', label, value)}
                            options={[
                                { value: "JUREN", label: "Juren" },
                                { value: "SUNBY", label: "Sunby" },
                                { value: "YB", label: "YourBest" },
                                { value: "NA", label: "N/A" }
                            ]}
                        />
                    ) : (label === 'Expiry Date') ? (
                        <InputComponents.DateInput
                            value={sampleValue[`Line-5-${label}`] || ''}
                            onChange={(value) => handleUpdate('Line-5', label, value)}
                        />
                    ) : (
                        <InputComponents.TextInput
                            value={sampleValue[`Line-5-${label}`] || ''}
                            onChange={(value) => handleUpdate('Line-5', label, value)}
                            placeholder=""
                        />
                    )}
                </LineSection.BusRibbonStatusSection>
            </div >
        );
    },

renderSolderingTime: (props: ObservationRenderProps) => {
    const sampleValue = typeof props.value === 'string'
        ? {
            "Line-4-Front TCA 1": "", "Line-4-Middle TCA 1": "", "Line-4-Back TCA 1": "",
            "Line-5-Front TCA 1": "", "Line-5-Middle TCA 1": "", "Line-5-Back TCA 1": ""
        }
        : props.value as Record<string, string>;

    const handleUpdate = (line: 'Line-4' | 'Line-5', position: 'Front TCA 1 L' | 'Middle TCA 1 L' | 'Back TCA 1 L' | 'Front TCA 1 R' | 'Middle TCA 1 R' | 'Back TCA 1 R', value: string) => {
        const updatedValue = { ...sampleValue, [`${line}-${position}`]: value };
        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
    };

    return (
        <div className="flex flex-col justify-between gap-4">
            <LineSection.SolderingTimeSection
                line="Line-4"
                value={sampleValue}
                onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
            >
                {(position) => (
                    <div className="flex flex-col items-center">
                        <InputComponents.NumberInput
                            value={sampleValue[`Line-4-${position}`] || ''}
                            onChange={(value) => handleUpdate('Line-4', position, value)}
                            placeholder=""
                            min={0}
                            step={0.1}
                        />
                        <span className="text-xs text-gray-500 mt-1">seconds</span>
                    </div>
                )}
            </LineSection.SolderingTimeSection>
            <LineSection.SolderingTimeSection
                line="Line-5"
                value={sampleValue}
                onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
            >
                {(position) => (
                    <div className="flex flex-col items-center">
                        <InputComponents.NumberInput
                            value={sampleValue[`Line-5-${position}`] || ''}
                            onChange={(value) => handleUpdate('Line-5', position, value)}
                            placeholder=""
                            min={0}
                            step={0.1}
                        />
                        <span className="text-xs text-gray-500 mt-1">seconds</span>
                    </div>
                )}
            </LineSection.SolderingTimeSection>
        </div>
    );
},

    renderCoolingTemperature: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? { "Line-4-left": "", "Line-4-right": "", "Line-5-left": "", "Line-5-right": "" }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-4' | 'Line-5', section: 'left' | 'right', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${section}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <LineSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex justify-between gap-2">
                        <div className="flex flex-col items-center">
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-left"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'left', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">°C</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-right"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'right', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">°C</span>
                        </div>
                    </div >
                </LineSection.SingleInputSection >
                < LineSection.SingleInputSection
                    line="Line-5"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex justify-between gap-2">
                        <div className="flex flex-col items-center">
                            <InputComponents.NumberInput
                                value={sampleValue["Line-5-left"] || ''}
                                onChange={(value) => handleUpdate('Line-5', 'left', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">°C</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <InputComponents.NumberInput
                                value={sampleValue["Line-5-right"] || ''}
                                onChange={(value) => handleUpdate('Line-5', 'right', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">°C</span>
                        </div>
                    </div >
                </LineSection.SingleInputSection >
            </div >
        );
    },

        renderSolderingIronTemperature: (props: ObservationRenderProps) => {
            const sampleValue = typeof props.value === 'string'
                ? {
                    "Line-4-4hrs": "", "Line-4-8hrs": "",
                    "Line-5-4hrs": "", "Line-5-8hrs": ""
                }
                : props.value as Record<string, string>;

            const handleUpdate = (line: 'Line-4' | 'Line-5', timeSlot: '4hrs' | '8hrs', value: string) => {
                const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
                props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
            };

            return (
                <div className="flex justify-between gap-4">
                    <LineSection.TimeBasedSection
                        line="Line-4"
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(timeSlot) => (
                            <div className="flex flex-col items-center">
                                <InputComponents.NumberInput
                                    value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                    placeholder=""
                                    min={0}
                                    step={1}
                                />
                                <span className="text-xs text-gray-500 mt-1">°C</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                    <LineSection.TimeBasedSection
                        line="Line-5"
                        value={sampleValue}
                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    >
                        {(timeSlot) => (
                            <div className="flex flex-col items-center">
                                <InputComponents.NumberInput
                                    value={sampleValue[`Line-5-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate('Line-5', timeSlot, value)}
                                    placeholder=""
                                    min={0}
                                    step={1}
                                />
                                <span className="text-xs text-gray-500 mt-1">°C</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                </div>
            );
        },

            renderSolderingTripCalibration: (props: ObservationRenderProps) => {
                const sampleValue = typeof props.value === 'string'
                    ? { "Line-4": "", "Line-5": "" }
                    : props.value as Record<string, string>;

                const handleUpdate = (line: 'Line-4' | 'Line-5', value: string) => {
                    const updatedValue = { ...sampleValue, [line]: value };
                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                };

                return (
                    <div className="flex justify-between gap-4">
                        <LineSection.SingleInputSection
                            line="Line-4"
                            value={sampleValue}
                            onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                        >
                            <InputComponents.Select
                                value={sampleValue["Line-4"] || ''}
                                onChange={(value) => handleUpdate('Line-4', value)}
                                options={[
                                    { value: "OK", label: "Checked OK" },
                                    { value: "NG", label: "Checked Not OK" },
                                    { value: "NA", label: "N/A" }
                                ]}
                            />
                        </LineSection.SingleInputSection>
                        <LineSection.SingleInputSection
                            line="Line-5"
                            value={sampleValue}
                            onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                        >
                            <InputComponents.Select
                                value={sampleValue["Line-5"] || ''}
                                onChange={(value) => handleUpdate('Line-5', value)}
                                options={[
                                    { value: "OK", label: "Checked OK" },
                                    { value: "NG", label: "Checked Not OK" },
                                    { value: "NA", label: "N/A" }
                                ]}
                            />
                        </LineSection.SingleInputSection>
                    </div>
                );
            },

                renderSolderingTraces: (props: ObservationRenderProps) => {
                    const sampleValue = typeof props.value === 'string'
                        ? {
                            "Line-4-Top": "", "Line-4-Middle": "", "Line-4-Bottom": "",
                            "Line-5-Top": "", "Line-5-Middle": "", "Line-5-Bottom": ""
                        }
                        : props.value as Record<string, string>;

                    const handleUpdate = (line: 'Line-4' | 'Line-5', label: 'Top' | 'Middle' | 'Bottom', value: string) => {
                        const updatedValue = { ...sampleValue, [`${line}-${label}`]: value };
                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                    };

                    return (
                        <div className="flex flex-col justify-between gap-4">
                            <LineSection.SolderingTraceSection
                                line="Line-4"
                                value={sampleValue}
                                onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                            >
                                {(label) => (
                                    <div className="flex flex-col items-center">
                                        <InputComponents.NumberInput
                                            value={sampleValue[`Line-4-${label}`] || ''}
                                            onChange={(value) => handleUpdate('Line-4', label, value)}
                                            placeholder=""
                                            min={0}
                                            step={0.1}
                                        />
                                        <span className="text-xs text-gray-500 mt-1">%</span>
                                    </div>
                                )}
                            </LineSection.SolderingTraceSection>
                            <LineSection.SolderingTraceSection
                                line="Line-5"
                                value={sampleValue}
                                onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                            >
                                {(label) => (
                                    <div className="flex flex-col items-center">
                                        <InputComponents.NumberInput
                                            value={sampleValue[`Line-5-${label}`] || ''}
                                            onChange={(value) => handleUpdate('Line-5', label, value)}
                                            placeholder=""
                                            min={0}
                                            step={0.1}
                                        />
                                        <span className="text-xs text-gray-500 mt-1">%</span>
                                    </div>
                                )}
                            </LineSection.SolderingTraceSection>
                        </div>
                    );
                },

                    renderBusBarCutLength: (props: ObservationRenderProps) => {
                        const sampleValue = typeof props.value === 'string'
                            ? {
                                "Line-4-I": "", "Line-4-Small L": "", "Line-4-Big L": "", "Line-4-Terminal": "",
                                "Line-5-I": "", "Line-5-Small L": "", "Line-5-Big L": "", "Line-5-Terminal": ""
                            }
                            : props.value as Record<string, string>;

                        const handleUpdate = (line: 'Line-4' | 'Line-5', type: 'I' | 'Small L' | 'Big L' | 'Terminal', value: string) => {
                            const updatedValue = { ...sampleValue, [`${line}-${type}`]: value };
                            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                        };

                        return (
                            <div className="flex flex-col justify-between gap-4">
                                <LineSection.BusBarCutLength
                                    line="Line-4"
                                    value={sampleValue}
                                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                                >
                                    {(type) => (
                                        <div className="flex flex-col items-center">
                                            <InputComponents.NumberInput
                                                value={sampleValue[`Line-4-${type}`] || ''}
                                                onChange={(value) => handleUpdate('Line-4', type, value)}
                                                placeholder=""
                                                min={0}
                                                step={0.1}
                                            />
                                            <span className="text-xs text-gray-500 mt-1">mm</span>
                                        </div>
                                    )}
                                </LineSection.BusBarCutLength>
                                <LineSection.BusBarCutLength
                                    line="Line-5"
                                    value={sampleValue}
                                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                                >
                                    {(type) => (
                                        <div className="flex flex-col items-center">
                                            <InputComponents.NumberInput
                                                value={sampleValue[`Line-5-${type}`] || ''}
                                                onChange={(value) => handleUpdate('Line-5', type, value)}
                                                placeholder=""
                                                min={0}
                                                step={0.1}
                                            />
                                            <span className="text-xs text-gray-500 mt-1">mm</span>
                                        </div>
                                    )}
                                </LineSection.BusBarCutLength>
                            </div>
                        );
                    },

                        renderStringAlignment: (props: ObservationRenderProps) => {
                            const sampleValue = typeof props.value === 'string'
                                ? {
                                    "Line-4-4hrs": "", "Line-4-8hrs": "",
                                    "Line-5-4hrs": "", "Line-5-8hrs": ""
                                }
                                : props.value as Record<string, string>;

                            const handleUpdate = (line: 'Line-4' | 'Line-5', timeSlot: '4hrs' | '8hrs', value: string) => {
                                const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
                                props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                            };

                            return (
                                <div className="flex justify-between gap-4">
                                    <LineSection.TimeBasedSection
                                        line="Line-4"
                                        value={sampleValue}
                                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                                    >
                                        {(timeSlot) => (
                                            <div className="flex flex-col items-center">
                                                <InputComponents.NumberInput
                                                    value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                                    onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                                    placeholder=""
                                                    min={0}
                                                    step={0.01}
                                                />
                                                <span className="text-xs text-gray-500 mt-1">mm</span>
                                            </div>
                                        )}
                                    </LineSection.TimeBasedSection>
                                    <LineSection.TimeBasedSection
                                        line="Line-5"
                                        value={sampleValue}
                                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                                    >
                                        {(timeSlot) => (
                                            <div className="flex flex-col items-center">
                                                <InputComponents.NumberInput
                                                    value={sampleValue[`Line-5-${timeSlot}`] || ''}
                                                    onChange={(value) => handleUpdate('Line-5', timeSlot, value)}
                                                    placeholder=""
                                                    min={0}
                                                    step={0.01}
                                                />
                                                <span className="text-xs text-gray-500 mt-1">mm</span>
                                            </div>
                                        )}
                                    </LineSection.TimeBasedSection>
                                </div>
                            );
                        },

                            renderPeelStrength: (props: ObservationRenderProps) => {
                                const sampleValue = typeof props.value === 'string'
                                    ? {
                                        "Line-4-Line": "", "Line-4-Position": "", "Line-4-Side": "",
                                        ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(pos => [`Line-4-Pos${pos}`, ""])),
                                        "Line-5-Line": "", "Line-5-Position": "", "Line-5-Side": "",
                                        ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(pos => [`Line-5-Pos${pos}`, ""])),
                                    }
                                    : props.value as Record<string, string>;

                                const handleUpdate = (key: string, value: string) => {
                                    const updatedValue = { ...sampleValue, [key]: value };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                };

                                const renderLineSection = (line: 'Line-4' | 'Line-5') => (
                                    <LineSection.PeelStrengthSection
                                        line={line}
                                        value={sampleValue}
                                        onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                                        children={{
                                            byLabel: (label) => (label != 'Side') ? (
                                                <InputComponents.TextInput
                                                    value={sampleValue[`${line}-${label}`] || ''}
                                                    onChange={(value) => handleUpdate(`${line}-${label}`, value)}
                                                    placeholder=""
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
                                                />),
                                            byPosition: (position) => (
                                                <div className="flex flex-col items-center">
                                                    <InputComponents.NumberInput
                                                        value={sampleValue[`${line}-Pos${position}`] || ''}
                                                        onChange={(value) => handleUpdate(`${line}-Pos${position}`, value)}
                                                        placeholder=""
                                                        min={0}
                                                        step={0.01}
                                                    />
                                                    <span className="text-xs text-gray-500 mt-1">Newton (N)</span>
                                                </div>
                                            ),
                                        }}
                                    />
                                );

                                return (
                                    <div className="flex flex-col gap-4">
                                        {renderLineSection('Line-4')}
                                        {renderLineSection('Line-5')}
                                    </div>
                                );
                            }

};

export const autoBussingStage: StageData = {
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
            renderObservation: AutoBussingObservations.renderBusRibbonStatus
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
            renderObservation: AutoBussingObservations.renderSolderingTime
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
            renderObservation: AutoBussingObservations.renderCoolingTemperature
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
            renderObservation: AutoBussingObservations.renderSolderingIronTemperature
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
            renderObservation: AutoBussingObservations.renderSolderingTripCalibration
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
            renderObservation: AutoBussingObservations.renderSolderingTraces
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
            renderObservation: AutoBussingObservations.renderBusBarCutLength
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
            renderObservation: AutoBussingObservations.renderStringAlignment
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
            renderObservation: AutoBussingObservations.renderPeelStrength
        }
    ]
};