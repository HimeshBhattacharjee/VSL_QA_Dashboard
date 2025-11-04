import { StageData, ObservationRenderProps } from '../types/audit';

const RearEncapsulantObservations = {
    renderHumidityTemp: (props: ObservationRenderProps) => (
        <div className="flex flex-col">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="w-full px-2 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                step="0.1"
            />
            <span className="text-xs text-gray-500 mt-1">
                {props.paramId.includes('humidity') ? '%' : '°C'}
            </span>
        </div>
    ),

    renderEncapsulantStatus: (props: ObservationRenderProps) => (
        <div className="flex flex-col space-y-1">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            />
        </div>
    ),

    renderUsageValidity: (props: ObservationRenderProps) => (
        <select
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select</option>
            <option value="4_hrs">Within 4 hours</option>
            <option value="8_hrs">Within 8 hours</option>
            <option value="Expired">Expired</option>
            <option value="OFF">OFF</option>
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
            <div className="flex flex-col rounded-lg bg-white shadow-sm border border-gray-200">
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
                                <option value="NG">Checked Not OK</option>
                                <option value="OFF">OFF</option>
                            </select>
                        </div>
                    ))}
                </div>
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
                                <option value="NG">Checked Not OK</option>
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
            <div className="flex flex-col p-2 rounded-lg bg-white shadow-sm border border-gray-200">
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
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
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

    renderStripDimensions: (props: ObservationRenderProps) => (
        <div className="flex flex-col space-y-1">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            />
        </div>
    )
};

export const rearEncapsulantStage: StageData = {
    id: 9,
    name: "Rear Encapsulant Cutting",
    parameters: [
        {
            id: "9-1-humidity",
            parameters: "Humidity",
            criteria: "≤ 60%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hrs",
            observations: [
                { timeSlot: "2 hours", value: "" },
                { timeSlot: "4 hours", value: "" },
                { timeSlot: "6 hours", value: "" },
                { timeSlot: "8 hours", value: "" }
            ],
            renderObservation: RearEncapsulantObservations.renderHumidityTemp
        },
        {
            id: "9-2-temperature",
            parameters: "Temperature",
            criteria: "25 ± 5˚ C",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hrs",
            observations: [
                { timeSlot: "2 hours", value: "" },
                { timeSlot: "4 hours", value: "" },
                { timeSlot: "6 hours", value: "" },
                { timeSlot: "8 hours", value: "" }
            ],
            renderObservation: RearEncapsulantObservations.renderHumidityTemp
        },
        {
            id: "9-3",
            parameters: "Rear Encapsulant Status",
            criteria: "Supplier, Type, Lot No. and Expiry Date",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "Type", value: "" },
                { timeSlot: "Lot No.", value: "" },
                { timeSlot: "Expiry Date", value: "" }
            ],
            renderObservation: RearEncapsulantObservations.renderEncapsulantStatus
        },
        {
            id: "9-4",
            parameters: "Usage validity",
            criteria: "Use within 8 hours after opening of the inner packaging",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Status", value: "" }
            ],
            renderObservation: RearEncapsulantObservations.renderUsageValidity
        },
        {
            id: "9-5",
            parameters: "Rear encapsulant aesthetic condition",
            criteria: "No hair, dust and foreign particle, deep cut, damage outer layer",
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
            renderObservation: RearEncapsulantObservations.renderAestheticCondition
        },
        {
            id: "9-6",
            parameters: "Length",
            criteria: "± 2mm",
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
            renderObservation: RearEncapsulantObservations.renderDimensions
        },
        {
            id: "9-7",
            parameters: "Width",
            criteria: "± 2mm",
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
            renderObservation: RearEncapsulantObservations.renderDimensions
        },
        {
            id: "9-8",
            parameters: "Thickness",
            criteria: "± 0.05 mm",
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
            renderObservation: RearEncapsulantObservations.renderDimensions
        },
        {
            id: "9-9",
            parameters: "Rear Encapsulant Strip Length & Width",
            criteria: "As per specification VSL/PDN/SC/05",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Length", value: "" },
                { timeSlot: "Width", value: "" }
            ],
            renderObservation: RearEncapsulantObservations.renderStripDimensions
        }
    ]
};