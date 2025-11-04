import { StageData, ObservationRenderProps } from '../types/audit';

const LineSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: 'Line-3' | 'Line-4';
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs') => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Sun Simulator - {line.split('-')[1]}</span>
            </div>
            <div className="flex gap-2">
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500 mb-1">2 hours</span>
                    {children('2hrs')}
                </div>
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500 mb-1">4 hours</span>
                    {children('4hrs')}
                </div>
                <div className="flex flex-col items-center justify-between">
                    <span className="text-xs text-gray-500 mb-1">6 hours</span>
                    {children('6hrs')}
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
                <span className="text-sm font-semibold text-gray-700">Sun Simulator - {line.split('-')[1]}</span>
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
            className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${className}`}
        />
    )
};

const SunSimulatorObservations = {
    renderSupplierName: (props: ObservationRenderProps) => {
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
                    <InputComponents.TextInput
                        value={sampleValue["Line-3"] || ''}
                        onChange={(value) => handleUpdate('Line-3', value)}
                        placeholder=""
                    />
                </LineSection.SingleInputSection>

                <LineSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <InputComponents.TextInput
                        value={sampleValue["Line-4"] || ''}
                        onChange={(value) => handleUpdate('Line-4', value)}
                        placeholder=""
                    />
                </LineSection.SingleInputSection>
            </div>
        );
    },

    renderHardwareCleaning: (props: ObservationRenderProps) => {
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
                            { value: "OK", label: "Checked OK" },
                            { value: "NG", label: "Checked Not OK" },
                            { value: "OFF", label: "OFF" }
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
                            { value: "OK", label: "Checked OK" },
                            { value: "NG", label: "Checked Not OK" },
                            { value: "OFF", label: "OFF" }
                        ]}
                    />
                </LineSection.SingleInputSection>
            </div>
        );
    },

    renderBlackCover: (props: ObservationRenderProps) => {
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
                            { value: "OK", label: "Checked OK" },
                            { value: "NG", label: "Checked Not OK" },
                            { value: "OFF", label: "OFF" }
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
                            { value: "OK", label: "Checked OK" },
                            { value: "NG", label: "Checked Not OK" },
                            { value: "OFF", label: "OFF" }
                        ]}
                    />
                </LineSection.SingleInputSection>
            </div>
        );
    },

    renderRoomTemp: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-2hrs": "", "Line-3-4hrs": "", "Line-3-6hrs": "", "Line-3-8hrs": "",
                "Line-4-2hrs": "", "Line-4-4hrs": "", "Line-4-6hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs', value: string) => {
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
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500">°C</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500">°C</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    },

    renderHumidity: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-2hrs": "", "Line-3-4hrs": "", "Line-3-6hrs": "", "Line-3-8hrs": "",
                "Line-4-2hrs": "", "Line-4-4hrs": "", "Line-4-6hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs', value: string) => {
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
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500">%</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue[`Line-4-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                                placeholder=""
                                min={0}
                                step={0.1}
                            />
                            <span className="text-xs text-gray-500">%</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    },

    renderIrradiance: (props: ObservationRenderProps) => {
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
                    <div className="flex flex-col items-center gap-2">
                        <InputComponents.NumberInput
                            value={sampleValue["Line-3"] || ''}
                            onChange={(value) => handleUpdate('Line-3', value)}
                            placeholder=""
                            min={0}
                            step={1}
                        />
                        <span className="text-xs text-gray-500">W/M<sup>2</sup></span>
                    </div>
                </LineSection.SingleInputSection>
                <LineSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex flex-col items-center gap-2">
                        <InputComponents.NumberInput
                            value={sampleValue["Line-4"] || ''}
                            onChange={(value) => handleUpdate('Line-4', value)}
                            placeholder=""
                            min={0}
                            step={1}
                        />
                        <span className="text-xs text-gray-500">W/M<sup>2</sup></span>
                    </div>
                </LineSection.SingleInputSection>
            </div>
        );
    },

    renderCalibrationData: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-2hrs-calibrationTime": "", "Line-3-2hrs-moduleId": "", "Line-3-2hrs-pmax": "", "Line-3-2hrs-voc": "", "Line-3-2hrs-isc": "", "Line-3-2hrs-moduleTemp": "", "Line-3-2hrs-roomTemp": "",
                "Line-3-4hrs-calibrationTime": "", "Line-3-4hrs-moduleId": "", "Line-3-4hrs-pmax": "", "Line-3-4hrs-voc": "", "Line-3-4hrs-isc": "", "Line-3-4hrs-moduleTemp": "", "Line-3-4hrs-roomTemp": "",
                "Line-3-6hrs-calibrationTime": "", "Line-3-6hrs-moduleId": "", "Line-3-6hrs-pmax": "", "Line-3-6hrs-voc": "", "Line-3-6hrs-isc": "", "Line-3-6hrs-moduleTemp": "", "Line-3-6hrs-roomTemp": "",
                "Line-3-8hrs-calibrationTime": "", "Line-3-8hrs-moduleId": "", "Line-3-8hrs-pmax": "", "Line-3-8hrs-voc": "", "Line-3-8hrs-isc": "", "Line-3-8hrs-moduleTemp": "", "Line-3-8hrs-roomTemp": "",
                "Line-4-2hrs-calibrationTime": "", "Line-4-2hrs-moduleId": "", "Line-4-2hrs-pmax": "", "Line-4-2hrs-voc": "", "Line-4-2hrs-isc": "", "Line-4-2hrs-moduleTemp": "", "Line-4-2hrs-roomTemp": "",
                "Line-4-4hrs-calibrationTime": "", "Line-4-4hrs-moduleId": "", "Line-4-4hrs-pmax": "", "Line-4-4hrs-voc": "", "Line-4-4hrs-isc": "", "Line-4-4hrs-moduleTemp": "", "Line-4-4hrs-roomTemp": "",
                "Line-4-6hrs-calibrationTime": "", "Line-4-6hrs-moduleId": "", "Line-4-6hrs-pmax": "", "Line-4-6hrs-voc": "", "Line-4-6hrs-isc": "", "Line-4-6hrs-moduleTemp": "", "Line-4-6hrs-roomTemp": "",
                "Line-4-8hrs-calibrationTime": "", "Line-4-8hrs-moduleId": "", "Line-4-8hrs-pmax": "", "Line-4-8hrs-voc": "", "Line-4-8hrs-isc": "", "Line-4-8hrs-moduleTemp": "", "Line-4-8hrs-roomTemp": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs', field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        const CalibrationInputGroup = ({ line, timeSlot }: { line: 'Line-3' | 'Line-4', timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs' }) => (
            <div className="p-2 border border-gray-200 rounded bg-gray-50">
                <div className="text-center text-xs font-medium text-gray-700 mb-2">{timeSlot.replace('hrs', ' hours')}</div>
                <div className="flex flex-col gap-1 mb-2">
                    <span className="text-gray-500 text-xs">Last Calibration Time</span>
                    <InputComponents.TextInput
                        value={sampleValue[`${line}-${timeSlot}-calibrationTime`] || ''}
                        onChange={(value) => handleUpdate(line, timeSlot, 'calibrationTime', value)}
                        placeholder=""
                    />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">Module ID</span>
                        <InputComponents.TextInput
                            value={sampleValue[`${line}-${timeSlot}-moduleId`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'moduleId', value)}
                            placeholder=""
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">P<sub>max</sub> (W)</span>
                        <InputComponents.NumberInput
                            value={sampleValue[`${line}-${timeSlot}-pmax`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'pmax', value)}
                            placeholder=""
                            step={0.001}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">V<sub>OC</sub> (V)</span>
                        <InputComponents.NumberInput
                            value={sampleValue[`${line}-${timeSlot}-voc`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'voc', value)}
                            placeholder=""
                            step={0.001}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">I<sub>SC</sub> (A)</span>
                        <InputComponents.NumberInput
                            value={sampleValue[`${line}-${timeSlot}-isc`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'isc', value)}
                            placeholder=""
                            step={0.001}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">Module Temp (°C)</span>
                        <InputComponents.NumberInput
                            value={sampleValue[`${line}-${timeSlot}-moduleTemp`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'moduleTemp', value)}
                            placeholder=""
                            step={0.1}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">Room Temp (°C)</span>
                        <InputComponents.NumberInput
                            value={sampleValue[`${line}-${timeSlot}-roomTemp`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'roomTemp', value)}
                            placeholder=""
                            step={0.1}
                        />
                    </div>
                </div>
            </div>
        );

        return (
            <div className="space-y-4">
                <div className="border border-gray-300 rounded-lg bg-white shadow-sm p-2">
                    <div className="text-center mb-4">
                        <span className="text-sm font-semibold text-gray-700">Sun Simulator - 3 Calibration Data</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <CalibrationInputGroup line="Line-3" timeSlot="2hrs" />
                        <CalibrationInputGroup line="Line-3" timeSlot="4hrs" />
                        <CalibrationInputGroup line="Line-3" timeSlot="6hrs" />
                        <CalibrationInputGroup line="Line-3" timeSlot="8hrs" />
                    </div>
                </div>
                <div className="border border-gray-300 rounded-lg bg-white shadow-sm p-2">
                    <div className="text-center mb-4">
                        <span className="text-sm font-semibold text-gray-700">Sun Simulator - 4 Calibration Data</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <CalibrationInputGroup line="Line-4" timeSlot="2hrs" />
                        <CalibrationInputGroup line="Line-4" timeSlot="4hrs" />
                        <CalibrationInputGroup line="Line-4" timeSlot="6hrs" />
                        <CalibrationInputGroup line="Line-4" timeSlot="8hrs" />
                    </div>
                </div>
            </div>
        );
    },

    renderCurrentSorting: (props: ObservationRenderProps) => {
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
                            { value: "OK", label: "Checked OK" },
                            { value: "NG", label: "Checked Not OK" },
                            { value: "OFF", label: "OFF" }
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
                            { value: "OK", label: "Checked OK" },
                            { value: "NG", label: "Checked Not OK" },
                            { value: "OFF", label: "OFF" }
                        ]}
                    />
                </LineSection.SingleInputSection>
            </div>
        );
    },

    renderModuleBinning: (props: ObservationRenderProps) => {
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
                            { value: "OK", label: "Checked OK" },
                            { value: "NG", label: "Checked Not OK" },
                            { value: "OFF", label: "OFF" }
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
                            { value: "OK", label: "Checked OK" },
                            { value: "NG", label: "Checked Not OK" },
                            { value: "OFF", label: "OFF" }
                        ]}
                    />
                </LineSection.SingleInputSection>
            </div>
        );
    },

    renderContactBlockResistance: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-contact-block": "", "Line-3-positive": "", "Line-3-negative": "",
                "Line-4-contact-block": "", "Line-4-positive": "", "Line-4-negative": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', type: 'contact-block' | 'positive' | 'negative', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${type}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2 flex-1">
                    <div className="text-center mb-2">
                        <span className="text-sm font-semibold text-gray-700">Sun Simulator - 3</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 mb-2">
                        <span className="text-xs text-gray-500">Contact Block No.</span>
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-contact-block"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'contact-block', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-500">Positive</span>
                            <div className="flex flex-col items-center gap-2">
                                <InputComponents.NumberInput
                                    value={sampleValue["Line-3-positive"] || ''}
                                    onChange={(value) => handleUpdate('Line-3', 'positive', value)}
                                    placeholder=""
                                    min={0}
                                    step={0.1}
                                />
                                <span className="text-xs text-gray-500">mΩ</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-500">Negative</span>
                            <div className="flex flex-col items-center gap-2">
                                <InputComponents.NumberInput
                                    value={sampleValue["Line-3-negative"] || ''}
                                    onChange={(value) => handleUpdate('Line-3', 'negative', value)}
                                    placeholder=""
                                    min={0}
                                    step={0.1}
                                />
                                <span className="text-xs text-gray-500">mΩ</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Line-4 Section */}
                <div className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2 flex-1">
                    <div className="text-center mb-2">
                        <span className="text-sm font-semibold text-gray-700">Sun Simulator - 4</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 mb-2">
                        <span className="text-xs text-gray-500">Contact Block No.</span>
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-contact-block"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'contact-block', value)}
                                placeholder=""
                                min={0}
                                step={1}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-500">Positive</span>
                            <div className="flex flex-col items-center gap-2">
                                <InputComponents.NumberInput
                                    value={sampleValue["Line-4-positive"] || ''}
                                    onChange={(value) => handleUpdate('Line-4', 'positive', value)}
                                    placeholder=""
                                    min={0}
                                    step={0.1}
                                />
                                <span className="text-xs text-gray-500">mΩ</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-500">Negative</span>
                            <div className="flex flex-col items-center gap-2">
                                <InputComponents.NumberInput
                                    value={sampleValue["Line-4-negative"] || ''}
                                    onChange={(value) => handleUpdate('Line-4', 'negative', value)}
                                    placeholder=""
                                    min={0}
                                    step={0.1}
                                />
                                <span className="text-xs text-gray-500">mΩ</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
};

export const sunSimulatorStage: StageData = {
    id: 24,
    name: "Sun Simulator Calibration and Testing",
    parameters: [
        {
            id: "24-1",
            parameters: "Sun-simulator Supplier name",
            criteria: "Supplier",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: SunSimulatorObservations.renderSupplierName
        },
        {
            id: "24-2",
            parameters: "Cleaning of Sun Simulator Hardware parts",
            criteria: "Aesthetics check",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: SunSimulatorObservations.renderHardwareCleaning
        },
        {
            id: "24-3",
            parameters: "Presence of black cover in Sun Simulator",
            criteria: "Aesthetics check",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: SunSimulatorObservations.renderBlackCover
        },
        {
            id: "24-4",
            parameters: "Room Temp",
            criteria: "25± 2°C",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: SunSimulatorObservations.renderRoomTemp
        },
        {
            id: "24-5",
            parameters: "Humidity",
            criteria: "50-80%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: SunSimulatorObservations.renderHumidity
        },
        {
            id: "24-6",
            parameters: "Irradiance",
            criteria: "1000W/M²",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: SunSimulatorObservations.renderIrradiance
        },
        {
            id: "24-7",
            parameters: "Calibration Data",
            criteria: "Each sun simulator calibrated every 2 hours using valid second reference PV module. Calibration performed at 25 ± 2 ˚C room temperature and 25 ± 2 ˚C reference PV module temperature. Calibration Limit of Pmax, Voc and Isc ± 0.2%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: SunSimulatorObservations.renderCalibrationData
        },
        {
            id: "24-8",
            parameters: "Current Sorting",
            criteria: "Current binning as per customer requirement",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: SunSimulatorObservations.renderCurrentSorting
        },
        {
            id: "24-9",
            parameters: "Module binning as per Wp",
            criteria: "As per production Order",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: SunSimulatorObservations.renderModuleBinning
        },
        {
            id: "24-10",
            parameters: "Contact block verification by measuring the resistance",
            criteria: "Resistance of the contact block ≤20 mΩ",
            typeOfInspection: "Functionality",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: SunSimulatorObservations.renderContactBlockResistance
        }
    ]
};