import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

const getLineConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[26];
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
        if (upperValue === 'FAIL') return 'bg-red-100';
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

type SafetyTimeSlot = '4hrs' | '8hrs';
type SafetyLineSlot = 'lineA' | 'lineB';
type SafetyModuleIdKey =
    | 'lineA_4hr_moduleId'
    | 'lineA_8hr_moduleId'
    | 'lineB_4hr_moduleId'
    | 'lineB_8hr_moduleId';
type LegacySafetyModuleIdKey = 'moduleId4Hours' | 'moduleId8Hours';

const SAFETY_TIME_SLOTS: SafetyTimeSlot[] = ['4hrs', '8hrs'];
const SAFETY_STATUS_OPTIONS = [
    { value: "Pass", label: "Pass" },
    { value: "Fail", label: "Fail" },
    { value: "OFF", label: "OFF" }
];
const MODULE_ID_KEY_BY_SLOT: Record<SafetyLineSlot, Record<SafetyTimeSlot, SafetyModuleIdKey>> = {
    lineA: {
        '4hrs': 'lineA_4hr_moduleId',
        '8hrs': 'lineA_8hr_moduleId'
    },
    lineB: {
        '4hrs': 'lineB_4hr_moduleId',
        '8hrs': 'lineB_8hr_moduleId'
    }
};
const LEGACY_MODULE_ID_KEY_BY_TIME: Record<SafetyTimeSlot, LegacySafetyModuleIdKey> = {
    '4hrs': 'moduleId4Hours',
    '8hrs': 'moduleId8Hours'
};

const getLineSlot = (lineIndex: number): SafetyLineSlot => lineIndex === 0 ? 'lineA' : 'lineB';

const getModuleIdKey = (lineIndex: number, timeSlot: SafetyTimeSlot): SafetyModuleIdKey =>
    MODULE_ID_KEY_BY_SLOT[getLineSlot(lineIndex)][timeSlot];

const getModuleIdValue = (
    sampleValue: Record<string, string>,
    lineIndex: number,
    timeSlot: SafetyTimeSlot
): string => {
    const moduleIdKey = getModuleIdKey(lineIndex, timeSlot);
    if (Object.prototype.hasOwnProperty.call(sampleValue, moduleIdKey)) {
        return sampleValue[moduleIdKey] || '';
    }
    return sampleValue[LEGACY_MODULE_ID_KEY_BY_TIME[timeSlot]] || '';
};

const LineSection = {
    TimeBasedSection: ({ line, value: _value, onUpdate: _onUpdate, children }: {
        line: string;
        value: Record<string, string>;
        onUpdate: (updatedValue: Record<string, string>) => void;
        children: (timeSlot: SafetyTimeSlot) => React.ReactNode;
    }) => (
        <div className="flex flex-col border border-gray-200 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Safety Test - {line.split('-')[1]}</span>
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
        <div className="flex flex-col border border-gray-200 rounded-lg bg-white shadow-sm p-2">
            <div className="text-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Safety Test - {line.split('-')[1]}</span>
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
            className={`w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${getBackgroundColor(value, type)} ${className}`}
        >
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
                className={`px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center ${getBackgroundColor(value, type)} ${className}`}
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
            className={`px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center ${getBackgroundColor(value, 'date')} ${className}`}
        />
    )
};

const SafetyTestObservations = {
    renderHipotTest: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    SAFETY_TIME_SLOTS.map(timeSlot =>
                        [`${line}-${timeSlot}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleModuleIdUpdate = (key: SafetyModuleIdKey, value: string) => {
            const updatedValue = { ...sampleValue, [key]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        const handleUpdate = (line: string, timeSlot: SafetyTimeSlot, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-2">
                    {lines.map((line, lineIndex) => (
                        <div key={`${line}-module-id`} className="flex flex-col gap-2">
                            <span className="text-xs font-medium text-gray-600">{line} Module ID</span>
                            <div className="grid grid-cols-2 gap-2">
                                {SAFETY_TIME_SLOTS.map(timeSlot => (
                                    <div key={`${line}-${timeSlot}-module-id`} className="flex flex-col">
                                        <span className="text-xs text-gray-500 mb-1">{timeSlot === '4hrs' ? '4 Hr' : '8 Hr'}</span>
                                        <InputComponents.TextInput
                                            value={getModuleIdValue(sampleValue, lineIndex, timeSlot)}
                                            onChange={(value) => handleModuleIdUpdate(getModuleIdKey(lineIndex, timeSlot), value)}
                                            placeholder=""
                                            type="status"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-center gap-4">
                    {lines.map(line => (
                        <LineSection.TimeBasedSection
                            key={line}
                            line={line}
                            value={sampleValue}
                            onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                        >
                            {(timeSlot) => (
                                <InputComponents.Select
                                    value={sampleValue[`${line}-${timeSlot}`] || 'Pass'}
                                    onChange={(value) => handleUpdate(line, timeSlot, value)}
                                    options={SAFETY_STATUS_OPTIONS}
                                    type="status"
                                />
                            )}
                        </LineSection.TimeBasedSection>
                    ))}
                </div>
            </div>
        );
    },

    renderInsulatingResistanceTest: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    SAFETY_TIME_SLOTS.map(timeSlot =>
                        [`${line}-${timeSlot}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, timeSlot: SafetyTimeSlot, value: string) => {
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
                            <InputComponents.Select
                                value={sampleValue[`${line}-${timeSlot}`] || 'Pass'}
                                onChange={(value) => handleUpdate(line, timeSlot, value)}
                                options={SAFETY_STATUS_OPTIONS}
                                type="status"
                            />
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    },

    renderGroundingTest: (props: ObservationRenderProps & { lineNumber?: string }) => {
        const lines = getLineConfiguration(props.lineNumber || 'II');
        const sampleValue = typeof props.value === 'string'
            ? Object.fromEntries(
                lines.flatMap(line =>
                    SAFETY_TIME_SLOTS.map(timeSlot =>
                        [`${line}-${timeSlot}`, ""]
                    )
                )
            )
            : props.value as Record<string, string>;

        const handleUpdate = (line: string, timeSlot: SafetyTimeSlot, value: string) => {
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
                            <InputComponents.Select
                                value={sampleValue[`${line}-${timeSlot}`] || 'Pass'}
                                onChange={(value) => handleUpdate(line, timeSlot, value)}
                                options={SAFETY_STATUS_OPTIONS}
                                type="status"
                            />
                        )}
                    </LineSection.TimeBasedSection>
                ))}
            </div>
        );
    }
};

export const createSafetyTestStage = (lineNumber: string): StageData => {
    return {
        id: 26,
        name: "Safety test HV, IR and GC Test",
        parameters: [
            {
                id: "26-1",
                parameters: "Hipot test (DCW)",
                criteria: "Leakage current < 50 µA, (IEC61215)",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    SafetyTestObservations.renderHipotTest({ ...props, lineNumber })
            },
            {
                id: "26-2",
                parameters: "Insulating resistance test (IR)",
                criteria: "> 40 MΩ/m2 (IEC61215)",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    SafetyTestObservations.renderInsulatingResistanceTest({ ...props, lineNumber })
            },
            {
                id: "26-3",
                parameters: "Grounding test (GD)",
                criteria: "Resistance < 100 mΩ, (IEC61730)",
                typeOfInspection: "Aesthetics",
                inspectionFrequency: "Every 4 hours",
                observations: [
                    { timeSlot: "", value: "" }
                ],
                renderObservation: (props: ObservationRenderProps) =>
                    SafetyTestObservations.renderGroundingTest({ ...props, lineNumber })
            }
        ]
    };
};

export const safetyTestStage: StageData = createSafetyTestStage('II');
