import { StageData, ObservationRenderProps } from '../types/audit';

const JBSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: 'Line-3' | 'Line-4';
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

    SingleInputSection: ({ line, value, onUpdate, children }: {
        line: 'Line-3' | 'Line-4';
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

    SampleBasedSection: ({ line, value, onUpdate, children }: {
        line: 'Line-3' | 'Line-4';
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

const JunctionBoxFixingObservations = {
    renderJBStatus: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-supplier": "", "Line-3-type": "", "Line-3-diode": "",
                "Line-3-maxVoltage": "", "Line-3-maxCurrent": "", "Line-3-diodeType": "",
                "Line-4-supplier": "", "Line-4-type": "", "Line-4-diode": "",
                "Line-4-maxVoltage": "", "Line-4-maxCurrent": "", "Line-4-diodeType": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <JBSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Supplier</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-supplier"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'supplier', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Type</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-type"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'type', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Blocking Diode</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-diode"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'diode', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Max Voltage</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-maxVoltage"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'maxVoltage', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Max Current</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-maxCurrent"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'maxCurrent', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Diode Type</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-diodeType"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'diodeType', value)}
                                placeholder=""
                            />
                        </div>
                    </div>
                </JBSection.SingleInputSection>
                <JBSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Supplier</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-supplier"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'supplier', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Type</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-type"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'type', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Blocking Diode</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-diode"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'diode', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Max Voltage</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-maxVoltage"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'maxVoltage', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Max Current</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-maxCurrent"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'maxCurrent', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500">Diode Type</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-diodeType"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'diodeType', value)}
                                placeholder=""
                            />
                        </div>
                    </div>
                </JBSection.SingleInputSection>
            </div>
        );
    },

    renderConnectorCableStatus: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-cableSupplier": "", "Line-3-connectorType": "",
                "Line-4-cableSupplier": "", "Line-4-connectorType": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <JBSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex gap-2">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Cable Supplier</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-cableSupplier"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'cableSupplier', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Connector Type</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-connectorType"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'connectorType', value)}
                                placeholder=""
                            />
                        </div>
                    </div>
                </JBSection.SingleInputSection>
                <JBSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex gap-2">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Cable Supplier</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-cableSupplier"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'cableSupplier', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Connector Type</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-connectorType"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'connectorType', value)}
                                placeholder=""
                            />
                        </div>
                    </div>
                </JBSection.SingleInputSection>
            </div>
        );
    },

    renderJBSealant: (props: ObservationRenderProps) => {
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
                <JBSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex gap-2">
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
                </JBSection.SingleInputSection>
                <JBSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex gap-2">
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
                </JBSection.SingleInputSection>
            </div>
        );
    },

    renderGlueAroundJB: (props: ObservationRenderProps) => {
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
                <JBSection.SampleBasedSection
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
                </JBSection.SampleBasedSection>
                <JBSection.SampleBasedSection
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
                </JBSection.SampleBasedSection>
            </div>
        );
    },

    renderCableLength: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-positive": "", "Line-3-negative": "",
                "Line-4-positive": "", "Line-4-negative": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', cableType: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${cableType}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <JBSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">(+) ve Cable Length</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-positive"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'positive', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">(-) ve Cable Length</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-negative"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'negative', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                    </div>
                </JBSection.SingleInputSection>
                <JBSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">(+) ve Cable Length</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-positive"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'positive', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">(-) ve Cable Length</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-negative"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'negative', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                    </div>
                </JBSection.SingleInputSection>
            </div>
        );
    },

    renderSealantWeight: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-left": "", "Line-3-middle": "", "Line-3-right": "",
                "Line-4-left": "", "Line-4-middle": "", "Line-4-right": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', position: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${position}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <JBSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="grid grid-rows-3 gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Left Split JB (HC)</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-left"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'left', value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Middle Split JB (HC)</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-middle"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'middle', value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Right Split JB (HC)</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-right"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'right', value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                    </div>
                </JBSection.SingleInputSection>
                <JBSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="grid grid-rows-3 gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Left Split JB (HC)</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-left"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'left', value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Middle Split JB (HC)</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-middle"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'middle', value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">Right Split JB (HC)</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-right"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'right', value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500 mt-1">gm</span>
                        </div>
                    </div>
                </JBSection.SingleInputSection>
            </div>
        );
    }
};

export const junctionBoxFixingStage: StageData = {
    id: 18,
    name: "Junction Box Fixing",
    parameters: [
        {
            id: "18-1",
            parameters: "Junction Box Status",
            criteria: "As per Production Order / BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: JunctionBoxFixingObservations.renderJBStatus
        },
        {
            id: "18-2",
            parameters: "Junction Box Connector & Cable Status",
            criteria: "As per Production Order / BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: JunctionBoxFixingObservations.renderConnectorCableStatus
        },
        {
            id: "18-3",
            parameters: "Junction Box sealant",
            criteria: "As per Production Order / BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: JunctionBoxFixingObservations.renderJBSealant
        },
        {
            id: "18-4",
            parameters: "Glue around JB profile",
            criteria: "No silicon glue missing, continuous flow, no gap between glue and rear glass/back sheet",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: JunctionBoxFixingObservations.renderGlueAroundJB
        },
        {
            id: "18-5",
            parameters: "Junction Box Cable Length",
            criteria: "As per Production Order / BOM Engineering Specification",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: JunctionBoxFixingObservations.renderCableLength
        },
        {
            id: "18-6",
            parameters: "JB sealant Weight",
            criteria: "Sealant Weight for Split JB 6 ± 2 gm/JB",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: JunctionBoxFixingObservations.renderSealantWeight
        }
    ]
};