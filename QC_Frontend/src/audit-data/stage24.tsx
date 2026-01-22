import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[24];
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

const LineSection = {
    TimeBasedSection: ({ line, value, onUpdate, children }: {
        line: string;
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
        line: string;
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
            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${getBackgroundColor(value, type)} ${className}`}
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

const SunSimulatorObservations = {
    renderSupplier: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.map(line => [line, ""]))
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
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.TextInput
                                value={sampleValue[line] || ''}
                                onChange={(value) => handleUpdate(line, value)}
                                placeholder=""
                                type="status"
                            />
                        </div>
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderHardwareCleaning: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.map(line => [line, ""]))
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
                                { value: "Checked OK", label: "Checked OK" },
                                { value: "Checked Not OK", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                            type="status"
                        />
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderBlackCover: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.map(line => [line, ""]))
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
                                { value: "Checked OK", label: "Checked OK" },
                                { value: "Checked Not OK", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                            type="status"
                        />
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderRoomTemp: (props: ObservationRenderProps & { lineNumber?: string }) => {
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

        const handleUpdate = (line: string, timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs', value: string) => {
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
                            <div className="flex flex-col items-center gap-2">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="temperature"
                                />
                                <span className="text-xs text-gray-500">°C</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderHumidity: (props: ObservationRenderProps & { lineNumber?: string }) => {
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

        const handleUpdate = (line: string, timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs', value: string) => {
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
                            <div className="flex flex-col items-center gap-2">
                                <InputComponents.TextInput
                                    value={sampleValue[`${line}-${timeSlot}`] || ''}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    placeholder=""
                                    type="measurement"
                                />
                                <span className="text-xs text-gray-500">%</span>
                            </div>
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderIrradiance: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.map(line => [line, ""]))
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
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.TextInput
                                value={sampleValue[line] || ''}
                                onChange={(value) => handleUpdate(line, value)}
                                placeholder=""
                                type="measurement"
                            />
                            <span className="text-xs text-gray-500">W/M<sup>2</sup></span>
                        </div>
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderCalibrationData: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['2hrs', '4hrs', '6hrs', '8hrs'].flatMap(timeSlot =>
                        [
                            [`${line}-${timeSlot}-calibrationTime`, ""],
                            [`${line}-${timeSlot}-moduleId`, ""],
                            [`${line}-${timeSlot}-pmax`, ""],
                            [`${line}-${timeSlot}-voc`, ""],
                            [`${line}-${timeSlot}-isc`, ""],
                            [`${line}-${timeSlot}-moduleTemp`, ""],
                            [`${line}-${timeSlot}-roomTemp`, ""]
                        ]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs', field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        const CalibrationInputGroup = (line: string, timeSlot: '2hrs' | '4hrs' | '6hrs' | '8hrs') => (
            <div className="p-2 border border-gray-200 rounded bg-gray-50">
                <div className="text-center text-xs font-medium text-gray-700 mb-2">{timeSlot.replace('hrs', ' hours')}</div>
                <div className="flex flex-col gap-1 mb-2">
                    <span className="text-gray-500 text-xs">Last Calibration Time</span>
                    <InputComponents.TextInput
                        value={sampleValue[`${line}-${timeSlot}-calibrationTime`] || ''}
                        onChange={(value) => handleUpdate(line, timeSlot, 'calibrationTime', value)}
                        placeholder=""
                        type="measurement"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">Module ID</span>
                        <InputComponents.TextInput
                            value={sampleValue[`${line}-${timeSlot}-moduleId`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'moduleId', value)}
                            placeholder=""
                            type="measurement"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">P<sub>max</sub> (W)</span>
                        <InputComponents.TextInput
                            value={sampleValue[`${line}-${timeSlot}-pmax`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'pmax', value)}
                            placeholder=""
                            type="measurement"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">V<sub>OC</sub> (V)</span>
                        <InputComponents.TextInput
                            value={sampleValue[`${line}-${timeSlot}-voc`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'voc', value)}
                            placeholder=""
                            type="measurement"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">I<sub>SC</sub> (A)</span>
                        <InputComponents.TextInput
                            value={sampleValue[`${line}-${timeSlot}-isc`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'isc', value)}
                            placeholder=""
                            type="measurement"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">Module Temp (°C)</span>
                        <InputComponents.TextInput
                            value={sampleValue[`${line}-${timeSlot}-moduleTemp`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'moduleTemp', value)}
                            placeholder=""
                            type="temperature"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">Room Temp (°C)</span>
                        <InputComponents.TextInput
                            value={sampleValue[`${line}-${timeSlot}-roomTemp`] || ''}
                            onChange={(value) => handleUpdate(line, timeSlot, 'roomTemp', value)}
                            placeholder=""
                            type="temperature"
                        />
                    </div>
                </div>
            </div>
        );

        return (
            <div className="flex gap-4">
                {lines.map(line => (
                    <div key={line} className="border border-gray-300 rounded-lg bg-white shadow-sm p-2 flex-1">
                        <div className="text-center mb-4">
                            <span className="text-sm font-semibold text-gray-700">Sun Simulator - {line.split('-')[1]} Calibration Data</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {CalibrationInputGroup(line, "2hrs")}
                            {CalibrationInputGroup(line, "4hrs")}
                            {CalibrationInputGroup(line, "6hrs")}
                            {CalibrationInputGroup(line, "8hrs")}
                        </div>
                    </div>
                ))}
            </div>
        );
    },

    renderCurrentSorting: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.map(line => [line, ""]))
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
                                { value: "Checked OK", label: "Checked OK" },
                                { value: "Checked Not OK", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                            type="status"
                        />
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderModuleBinning: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(lines.map(line => [line, ""]))
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
                                { value: "Checked OK", label: "Checked OK" },
                                { value: "Checked Not OK", label: "Checked Not OK" },
                                { value: "OFF", label: "OFF" }
                            ]}
                            type="status"
                        />
                    </LineSection.SingleInputSection>
                ))}
            </div>
        );
    },

    renderContactBlockResistance: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    ['contact-block', 'positive', 'negative'].map(type =>
                        [`${line}-${type}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, index: number, type: 'contact-block' | 'positive' | 'negative', value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${index}-${type}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {lines.map(line => (
                    <div key={line} className="flex flex-col border border-gray-300 rounded-lg bg-white shadow-sm p-2 flex-1">
                        <div className="text-center mb-2">
                            <span className="text-sm font-semibold text-gray-700">Sun Simulator - {line.split('-')[1]}</span>
                        </div>
                        {[1, 2].map(index => (
                            <div key={index} className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col items-center gap-1 mb-2">
                                    <span className="text-xs text-gray-500">Contact Block No.</span>
                                    <div className="flex flex-col items-center gap-2">
                                        <InputComponents.TextInput
                                            value={sampleValue[`${line}-${index}-contact-block`] || ''}
                                            onChange={(value) => handleUpdate(line, index, 'contact-block', value)}
                                            placeholder=""
                                            type="measurement"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-xs text-gray-500">Positive</span>
                                    <div className="flex flex-col items-center gap-2">
                                        <InputComponents.TextInput
                                            value={sampleValue[`${line}-${index}-positive`] || ''}
                                            onChange={(value) => handleUpdate(line, index, 'positive', value)}
                                            placeholder=""
                                            type="measurement"
                                        />
                                        <span className="text-xs text-gray-500 mb-2">mΩ</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-xs text-gray-500">Negative</span>
                                    <div className="flex flex-col items-center gap-2">
                                        <InputComponents.TextInput
                                            value={sampleValue[`${line}-${index}-negative`] || ''}
                                            onChange={(value) => handleUpdate(line, index, 'negative', value)}
                                            placeholder=""
                                            type="measurement"
                                        />
                                        <span className="text-xs text-gray-500 mb-2">mΩ</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }
};

export const createSunSimulatorStage = (lineNumber: string): StageData => {
    return {
        id: 24,
        name: "Sun Simulator Calibration and Testing",
        parameters: [
            {
                id: "24-1",
                parameters: "Sun Simulator Supplier Name",
                criteria: "Supplier",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every shift",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    SunSimulatorObservations.renderSupplier({ ...props, lineNumber })
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
                renderObservation: (props: ObservationRenderProps) =>
                    SunSimulatorObservations.renderHardwareCleaning({ ...props, lineNumber })
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
                renderObservation: (props: ObservationRenderProps) =>
                    SunSimulatorObservations.renderBlackCover({ ...props, lineNumber })
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
                renderObservation: (props: ObservationRenderProps) =>
                    SunSimulatorObservations.renderRoomTemp({ ...props, lineNumber })
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
                renderObservation: (props: ObservationRenderProps) =>
                    SunSimulatorObservations.renderHumidity({ ...props, lineNumber })
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
                renderObservation: (props: ObservationRenderProps) =>
                    SunSimulatorObservations.renderIrradiance({ ...props, lineNumber })
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
                renderObservation: (props: ObservationRenderProps) =>
                    SunSimulatorObservations.renderCalibrationData({ ...props, lineNumber })
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
                renderObservation: (props: ObservationRenderProps) =>
                    SunSimulatorObservations.renderCurrentSorting({ ...props, lineNumber })
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
                renderObservation: (props: ObservationRenderProps) =>
                    SunSimulatorObservations.renderModuleBinning({ ...props, lineNumber })
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
                renderObservation: (props: ObservationRenderProps) =>
                    SunSimulatorObservations.renderContactBlockResistance({ ...props, lineNumber })
            }
        ]
    };
};

export const sunSimulatorStage: StageData = createSunSimulatorStage('II');