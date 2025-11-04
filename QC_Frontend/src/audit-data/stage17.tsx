import { StageData, ObservationRenderProps } from '../types/audit';

const FramingSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: 'Line-3' | 'Line-4';
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
        line: 'Line-3' | 'Line-4';
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
        line: 'Line-3' | 'Line-4';
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

const AutoFramingObservations = {
    renderStatusCheck: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-shift": "", "Line-3-4hrs": "",
                "Line-4-shift": "", "Line-4-4hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <FramingSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-xs text-gray-500">Supplier</span>
                        <InputComponents.TextInput
                            value={sampleValue["Line-3-supplier"] || ''}
                            onChange={(value) => handleUpdate('Line-3', 'supplier', value)}
                            placeholder=""
                        />
                    </div>
                </FramingSection.SingleInputSection>
                <FramingSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-xs text-gray-500">Supplier</span>
                        <InputComponents.TextInput
                            value={sampleValue["Line-4-supplier"] || ''}
                            onChange={(value) => handleUpdate('Line-4', 'supplier', value)}
                            placeholder=""
                        />
                    </div>
                </FramingSection.SingleInputSection>
            </div>
        );
    },

    renderSupplierInfo: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-supplier": "", "Line-3-type": "", "Line-3-exp": "",
                "Line-4-supplier": "", "Line-4-type": "", "Line-4-exp": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <FramingSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex flex-row gap-2">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Supplier</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-supplier"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'supplier', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Type</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-type"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'type', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Expiry Date</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-exp"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'exp', value)}
                                placeholder=""
                            />
                        </div>
                    </div>
                </FramingSection.SingleInputSection>
                <FramingSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex flex-row gap-2">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Supplier</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-supplier"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'supplier', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Type</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-type"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'type', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Expiry Date</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-exp"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'exp', value)}
                                placeholder=""
                            />
                        </div>
                    </div>
                </FramingSection.SingleInputSection>
            </div>
        );
    },

    renderGroundingHole: (props: ObservationRenderProps) => {
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
                <FramingSection.TimeBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Line-3-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                            options={[
                                { value: "Both side of length", label: "Both side of length" },
                                { value: "Both side of width", label: "Both side of width" },
                                { value: "One side only", label: "One side only" },
                                { value: "OFF", label: "OFF" }
                            ]}
                        />
                    )}
                </FramingSection.TimeBasedSection>
                <FramingSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Line-4-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                            options={[
                                { value: "Both side of length", label: "Both side of length" },
                                { value: "Both side of width", label: "Both side of width" },
                                { value: "One side only", label: "One side only" },
                                { value: "OFF", label: "OFF" }
                            ]}
                        />
                    )}
                </FramingSection.TimeBasedSection>
            </div>
        );
    },

    renderSampleCheck: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-Sample-1-4hrs": "", "Line-3-Sample-2-4hrs": "", "Line-3-Sample-3-4hrs": "",
                "Line-3-Sample-4-4hrs": "", "Line-3-Sample-5-4hrs": "", "Line-3-Sample-6-4hrs": "",
                "Line-3-Sample-1-8hrs": "", "Line-3-Sample-2-8hrs": "", "Line-3-Sample-3-8hrs": "",
                "Line-3-Sample-4-8hrs": "", "Line-3-Sample-5-8hrs": "", "Line-3-Sample-6-8hrs": "",
                "Line-4-Sample-1-4hrs": "", "Line-4-Sample-2-4hrs": "", "Line-4-Sample-3-4hrs": "",
                "Line-4-Sample-4-4hrs": "", "Line-4-Sample-5-4hrs": "", "Line-4-Sample-6-4hrs": "",
                "Line-4-Sample-1-8hrs": "", "Line-4-Sample-2-8hrs": "", "Line-4-Sample-3-8hrs": "",
                "Line-4-Sample-4-8hrs": "", "Line-4-Sample-5-8hrs": "", "Line-4-Sample-6-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', sample: string, timeSlot: '4hrs' | '8hrs', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${sample}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex flex-col justify-between gap-4">
                <FramingSection.SampleBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(sample, timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Line-3-${sample}-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Line-3', sample, timeSlot, value)}
                            options={[
                                { value: "OK", label: "Checked OK" },
                                { value: "NG", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                        />
                    )}
                </FramingSection.SampleBasedSection>
                <FramingSection.SampleBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(sample, timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Line-4-${sample}-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Line-4', sample, timeSlot, value)}
                            options={[
                                { value: "OK", label: "Checked OK" },
                                { value: "NG", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                        />
                    )}
                </FramingSection.SampleBasedSection>
            </div>
        );
    },

    renderSealantWeight: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-Length1": "", "Line-3-Length2": "", "Line-3-Width1": "", "Line-3-Width2": "",
                "Line-4-Length1": "", "Line-4-Length2": "", "Line-4-Width1": "", "Line-4-Width2": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', position: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${position}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <FramingSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Length 1</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-Length1"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'Length1', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Length 2</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-Length2"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'Length2', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Width 1</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-Width1"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'Width1', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Width 2</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-Width2"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'Width2', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                    </div>
                </FramingSection.SingleInputSection>
                <FramingSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Length 1</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-Length1"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'Length1', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Length 2</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-Length2"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'Length2', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Width 1</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-Width1"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'Width1', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Width 2</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-Width2"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'Width2', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                    </div>
                </FramingSection.SingleInputSection>
            </div>
        );
    },

    renderMeasurement: (props: ObservationRenderProps) => {
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
                <FramingSection.TimeBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500 mt-1">
                                {props.paramId.includes('coating-thickness') ? 'μn' : 'mm'}
                            </span>
                        </div>
                    )}
                </FramingSection.TimeBasedSection>
                <FramingSection.TimeBasedSection
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
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500 mt-1">
                                {props.paramId.includes('coating-thickness') ? 'μn' : 'mm'}
                            </span>
                        </div>
                    )}
                </FramingSection.TimeBasedSection>
            </div>
        );
    },

    renderDimensionMeasurement: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-Length": "", "Line-3-Width": "",
                "Line-4-Length": "", "Line-4-Width": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', dimension: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${dimension}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <FramingSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Length</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-Length"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'Length', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Width</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-Width"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'Width', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                    </div>
                </FramingSection.SingleInputSection>
                <FramingSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Length</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-Length"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'Length', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Width</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-Width"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'Width', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                    </div>
                </FramingSection.SingleInputSection>
            </div>
        );
    }
};

export const autoFramingStage: StageData = {
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
            renderObservation: AutoFramingObservations.renderStatusCheck
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
            renderObservation: AutoFramingObservations.renderSupplierInfo
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
            renderObservation: AutoFramingObservations.renderGroundingHole
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
            renderObservation: AutoFramingObservations.renderSampleCheck
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
            renderObservation: AutoFramingObservations.renderSealantWeight
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
            renderObservation: AutoFramingObservations.renderMeasurement
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
            renderObservation: AutoFramingObservations.renderDimensionMeasurement
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
            renderObservation: AutoFramingObservations.renderMeasurement
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
            renderObservation: AutoFramingObservations.renderMeasurement
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
            renderObservation: AutoFramingObservations.renderMeasurement
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
            renderObservation: AutoFramingObservations.renderMeasurement
        },
        {
            id: "17-12-coating-thickness",
            parameters: "Anodizing coating thickness",
            criteria: "≥ 15 μn",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoFramingObservations.renderMeasurement
        }
    ]
};