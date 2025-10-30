// stage9.tsx
import { StageData, ObservationRenderProps } from '../types/audit';

const RearGlassLoadingObservations = {
    renderRearGlassLoadingStatus: (props: ObservationRenderProps) => (
        <div className="flex flex-col space-y-1">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            />
        </div>
    ),

    renderUsageValidity: (props: ObservationRenderProps) => (
        <select
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Status</option>
            <option value="WITHIN_8_HOURS">Within 8 hours</option>
            <option value="EXPIRED">Expired</option>
            <option value="NA">N/A</option>
        </select>
    ),

    renderAestheticCondition: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Sample-1": "", "Sample-2": "", "Sample-3": "",
                "Sample-4": "", "Sample-5": "", "Sample-6": ""
            }
            : props.value as Record<string, string>;

        return (
            <div className="flex flex-col rounded-lg bg-white shadow-sm border">
                {/* Top 3 samples */}
                <div className="flex justify-between p-2 gap-2">
                    {['Sample-1', 'Sample-2', 'Sample-3'].map((sample) => (
                        <div key={sample} className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">{sample}</span>
                            <select
                                value={sampleValue[sample] || ''}
                                onChange={(e) => {
                                    const updatedValue = { ...sampleValue, [sample]: e.target.value };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                            >
                                <option value="">Select</option>
                                <option value="OK">Checked OK</option>
                                <option value="NOT OK">Checked NOT OK</option>
                                <option value="OFF">OFF</option>
                            </select>
                        </div>
                    ))}
                </div>

                {/* Bottom 3 samples */}
                <div className="flex justify-between p-2 gap-2">
                    {['Sample-4', 'Sample-5', 'Sample-6'].map((sample) => (
                        <div key={sample} className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">{sample}</span>
                            <select
                                value={sampleValue[sample] || ''}
                                onChange={(e) => {
                                    const updatedValue = { ...sampleValue, [sample]: e.target.value };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                            >
                                <option value="">Select</option>
                                <option value="OK">Checked OK</option>
                                <option value="NOT OK">Checked NOT OK</option>
                                <option value="OFF">OFF</option>
                            </select>
                        </div>
                    ))}
                </div>
            </div>
        );
    },

    renderDimensions: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? { "Sample-1": "", "Sample-2": "", "Sample-3": "", "Sample-4": "" }
            : props.value as Record<string, string>;

        return (
            <div className="flex flex-col p-2 rounded-lg bg-white shadow-sm border">
                <div className="flex justify-between p-2 gap-2">
                    {['Sample-1', 'Sample-2', 'Sample-3', 'Sample-4'].map((sample) => (
                        <div key={sample} className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">{sample}</span>
                            <input
                                type="number"
                                value={sampleValue[sample] || ''}
                                onChange={(e) => {
                                    const updatedValue = { ...sampleValue, [sample]: e.target.value };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                }}
                                placeholder="mm"
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                                step="0.001"
                                min="0"
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    },

    renderInputNumber: (props: ObservationRenderProps) => (
        <div className="flex flex-col items-center">
            <input
                type="number"
                min={0}
                step={0.001}
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                placeholder="mm"
            />
            <span className="text-xs text-gray-500 mt-1">mm</span>
        </div>
    ),
};

export const rearGlassLoadingStage: StageData = {
    id: 11,
    name: "Rear Glass Loading",
    parameters: [
        {
            id: "11-1",
            parameters: "Rear Glass Status",
            criteria: "Supplier, Type, Lot No. and Expiry Date",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "Type", value: "" },
                { timeSlot: "Lot No.", value: "" },
                { timeSlot: "Expiry Date", value: "" }
            ],
            renderObservation: RearGlassLoadingObservations.renderRearGlassLoadingStatus
        },
        {
            id: "11-2",
            parameters: "Rear Glass Aesthetic Condition",
            criteria: "Ensure terminal shouldn't get bend and check the string to string gap and also paste the back side barcode on 5 no. string position on middle of the module",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                {
                    timeSlot: "4 hours",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": "",
                        "Sample-5": "",
                        "Sample-6": ""
                    }
                },
                {
                    timeSlot: "8 hours",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": "",
                        "Sample-5": "",
                        "Sample-6": ""
                    }
                }
            ],
            renderObservation: RearGlassLoadingObservations.renderAestheticCondition
        },
        {
            id: "11-4",
            parameters: "Length",
            criteria: "As per Engg. drawing  ± 1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                {
                    timeSlot: "Line-3",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": ""
                    }
                },
                {
                    timeSlot: "Line-4",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": ""
                    }
                }
            ],
            renderObservation: RearGlassLoadingObservations.renderDimensions
        },
        {
            id: "11-5",
            parameters: "Width",
            criteria: "As per Engg. drawing  ± 1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                {
                    timeSlot: "Line-3",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": ""
                    }
                },
                {
                    timeSlot: "Line-4",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": ""
                    }
                }
            ],
            renderObservation: RearGlassLoadingObservations.renderDimensions
        },
        {
            id: "10-6",
            parameters: "Thickness",
            criteria: "As per Engg. drawing  ± 0.2mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                {
                    timeSlot: "Line-3",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": ""
                    }
                },
                {
                    timeSlot: "Line-4",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": ""
                    }
                }
            ],
            renderObservation: RearGlassLoadingObservations.renderDimensions
        },
        {
            id: "10-7",
            parameters: "Glass Alignment",
            criteria: "For Frame less module : error ≤3mm; For Framed module : error ≤1.5mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hours", value: "" },
                { timeSlot: "8 hours", value: "" }
            ],
            renderObservation: RearGlassLoadingObservations.renderInputNumber
        }
    ]
};