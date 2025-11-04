import { StageData, ObservationRenderProps } from '../types/audit';

type TimeSlot2H = '2hrs';
type TimeSlot4H = '4hrs';
type TimeSlot6H = '6hrs';
type TimeSlot8H = '8hrs';
type AllTimeSlots = TimeSlot2H | TimeSlot4H | TimeSlot6H | TimeSlot8H;
type TimeSlots4H8H = TimeSlot4H | TimeSlot8H;

const LineSection = {
    TimeBasedSection: <T extends AllTimeSlots>({ line, value, onUpdate, children, timeSlots }: {
        line: 'Line-3' | 'Line-4';
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
        line: 'Line-3' | 'Line-4';
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

// Reusable input components
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

const AutoPottingObservations = {
    renderJBPottingStatus: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-SupplierA": "", "Line-3-TypeA": "", "Line-3-ExpA": "",
                "Line-3-SupplierB": "", "Line-3-TypeB": "", "Line-3-ExpB": "",
                "Line-4-SupplierA": "", "Line-4-TypeA": "", "Line-4-ExpA": "",
                "Line-4-SupplierB": "", "Line-4-TypeB": "", "Line-4-ExpB": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {/* Line-3 Section */}
                <LineSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Supplier A</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-SupplierA"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'SupplierA', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Type A</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-TypeA"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'TypeA', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Expiry Date A</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-ExpA"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'ExpA', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Supplier B</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-SupplierB"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'SupplierB', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Type B</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-TypeB"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'TypeB', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Expiry Date B</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-ExpB"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'ExpB', value)}
                                placeholder=""
                            />
                        </div>
                    </div>
                </LineSection.SingleInputSection>

                {/* Line-4 Section */}
                <LineSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Supplier A</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-SupplierA"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'SupplierA', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Type A</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-TypeA"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'TypeA', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Expiry Date A</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-ExpA"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'ExpA', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Supplier B</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-SupplierB"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'SupplierB', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Type B</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-TypeB"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'TypeB', value)}
                                placeholder=""
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Expiry Date B</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-ExpB"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'ExpB', value)}
                                placeholder=""
                            />
                        </div>
                    </div>
                </LineSection.SingleInputSection>
            </div>
        );
    },

    renderAestheticCondition: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-2hrs": "", "Line-3-4hrs": "", "Line-3-6hrs": "", "Line-3-8hrs": "",
                "Line-4-2hrs": "", "Line-4-4hrs": "", "Line-4-6hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: AllTimeSlots, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {/* Line-3 Section - Every 2 hours (2hrs, 4hrs, 6hrs, 8hrs) */}
                <LineSection.TimeBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    timeSlots={['2hrs', '4hrs', '6hrs', '8hrs']}
                >
                    {(timeSlot) => (
                        <div className="flex flex-col items-center gap-2">
                            <InputComponents.Select
                                value={sampleValue[`Line-3-${timeSlot}`] || ''}
                                onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                                options={[
                                    { value: "OK", label: "Checked OK" },
                                    { value: "NG", label: "Checked NG" }
                                ]}
                            />
                        </div>
                    )}
                </LineSection.TimeBasedSection>

                {/* Line-4 Section - Every 2 hours (2hrs, 4hrs, 6hrs, 8hrs) */}
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    timeSlots={['2hrs', '4hrs', '6hrs', '8hrs']}
                >
                    {(timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Line-4-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                            options={[
                                { value: "OK", label: "Checked OK" },
                                { value: "NG", label: "Checked NG" }
                            ]}
                        />
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    },

    renderMixingRatio: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-PartA": "", "Line-3-PartB": "", "Line-3-Ratio": "",
                "Line-4-PartA": "", "Line-4-PartB": "", "Line-4-Ratio": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', field: string, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${field}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        const calculateRatio = (partA: string, partB: string) => {
            const numA = parseFloat(partA);
            const numB = parseFloat(partB);
            if (!isNaN(numA) && !isNaN(numB) && numB !== 0) {
                return (numA / numB).toFixed(2);
            }
            return '';
        };

        return (
            <div className="flex justify-between gap-4">
                {/* Line-3 Section */}
                <LineSection.SingleInputSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex gap-2">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Part A</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-PartA"] || ''}
                                onChange={(value) => {
                                    handleUpdate('Line-3', 'PartA', value);
                                    const ratio = calculateRatio(value, sampleValue["Line-3-PartB"] || '');
                                    if (ratio) handleUpdate('Line-3', 'Ratio', ratio);
                                }}
                                placeholder=""
                                step={0.01}
                            />
                            <span className="text-xs text-gray-500">gm</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Part B</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-3-PartB"] || ''}
                                onChange={(value) => {
                                    handleUpdate('Line-3', 'PartB', value);
                                    const ratio = calculateRatio(sampleValue["Line-3-PartA"] || '', value);
                                    if (ratio) handleUpdate('Line-3', 'Ratio', ratio);
                                }}
                                placeholder=""
                                step={0.01}
                            />
                            <span className="text-xs text-gray-500">gm</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Ratio</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-3-Ratio"] || ''}
                                onChange={(value) => handleUpdate('Line-3', 'Ratio', value)}
                                placeholder="Auto-calculated"
                            />
                        </div>
                    </div>
                </LineSection.SingleInputSection>

                {/* Line-4 Section */}
                <LineSection.SingleInputSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                >
                    <div className="flex gap-2">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Part A</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-PartA"] || ''}
                                onChange={(value) => {
                                    handleUpdate('Line-4', 'PartA', value);
                                    const ratio = calculateRatio(value, sampleValue["Line-4-PartB"] || '');
                                    if (ratio) handleUpdate('Line-4', 'Ratio', ratio);
                                }}
                                placeholder=""
                                step={0.01}
                            />
                            <span className="text-xs text-gray-500">gm</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Part B</span>
                            <InputComponents.NumberInput
                                value={sampleValue["Line-4-PartB"] || ''}
                                onChange={(value) => {
                                    handleUpdate('Line-4', 'PartB', value);
                                    const ratio = calculateRatio(sampleValue["Line-4-PartA"] || '', value);
                                    if (ratio) handleUpdate('Line-4', 'Ratio', ratio);
                                }}
                                placeholder=""
                                step={0.01}
                            />
                            <span className="text-xs text-gray-500">gm</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-500">Ratio</span>
                            <InputComponents.TextInput
                                value={sampleValue["Line-4-Ratio"] || ''}
                                onChange={(value) => handleUpdate('Line-4', 'Ratio', value)}
                                placeholder="Auto-calculated"
                            />
                        </div>
                    </div>
                </LineSection.SingleInputSection>
            </div>
        );
    },

    renderCupTest: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-2hrs": "", "Line-3-4hrs": "", "Line-3-6hrs": "", "Line-3-8hrs": "",
                "Line-4-2hrs": "", "Line-4-4hrs": "", "Line-4-6hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: AllTimeSlots, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {/* Line-3 Section - Every 2 hours (2hrs, 4hrs, 6hrs, 8hrs) */}
                <LineSection.TimeBasedSection
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    timeSlots={['2hrs', '4hrs', '6hrs', '8hrs']}
                >
                    {(timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Line-3-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Line-3', timeSlot, value)}
                            options={[
                                { value: "OK", label: "Checked OK" },
                                { value: "NG", label: "Checked NG" }
                            ]}
                        />
                    )}
                </LineSection.TimeBasedSection>

                {/* Line-4 Section - Every 2 hours (2hrs, 4hrs, 6hrs, 8hrs) */}
                <LineSection.TimeBasedSection
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    timeSlots={['2hrs', '4hrs', '6hrs', '8hrs']}
                >
                    {(timeSlot) => (
                        <InputComponents.Select
                            value={sampleValue[`Line-4-${timeSlot}`] || ''}
                            onChange={(value) => handleUpdate('Line-4', timeSlot, value)}
                            options={[
                                { value: "OK", label: "Checked OK" },
                                { value: "NG", label: "Checked NG" }
                            ]}
                        />
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    },

    renderCuringQuality: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Line-3-4hrs": "", "Line-3-8hrs": "",
                "Line-4-4hrs": "", "Line-4-8hrs": ""
            }
            : props.value as Record<string, string>;

        const handleUpdate = (line: 'Line-3' | 'Line-4', timeSlot: TimeSlots4H8H, value: string) => {
            const updatedValue = { ...sampleValue, [`${line}-${timeSlot}`]: value };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        return (
            <div className="flex justify-between gap-4">
                {/* Line-3 Section - Every 4 hours (4hrs, 8hrs) */}
                <LineSection.TimeBasedSection<TimeSlots4H8H>
                    line="Line-3"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    timeSlots={['4hrs', '8hrs']}
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
                            <span className="text-xs text-gray-500">Shore A</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>

                {/* Line-4 Section - Every 4 hours (4hrs, 8hrs) */}
                <LineSection.TimeBasedSection<TimeSlots4H8H>
                    line="Line-4"
                    value={sampleValue}
                    onUpdate={(updatedValue) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue)}
                    timeSlots={['4hrs', '8hrs']}
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
                            <span className="text-xs text-gray-500">Shore A</span>
                        </div>
                    )}
                </LineSection.TimeBasedSection>
            </div>
        );
    }
};

export const autoPottingStage: StageData = {
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
            renderObservation: AutoPottingObservations.renderJBPottingStatus
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
            renderObservation: AutoPottingObservations.renderAestheticCondition
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
            renderObservation: AutoPottingObservations.renderMixingRatio
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
            renderObservation: AutoPottingObservations.renderCupTest
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
            renderObservation: AutoPottingObservations.renderCuringQuality
        }
    ]
};