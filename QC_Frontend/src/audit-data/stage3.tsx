// stage3.tsx
import { StageData, ObservationRenderProps } from '../types/audit';

const FrontEncapsulantObservations = {
    renderStorageConditions: (props: ObservationRenderProps) => (
        <div className="flex flex-col items-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder={props.paramId === '3-1' ? 'Enter %' : 'Enter °C'}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm"
                min="0"
                max="100"
                step="0.1"
            />
            <span className="text-xs text-gray-500 mt-1">
                {props.paramId === '3-1' ? '%' : '°C'}
            </span>
        </div>
    ),

    renderEncapsulantStatus: (props: ObservationRenderProps) => (
        <div className="flex flex-col space-y-1">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            />
        </div>
    ),

    renderUsageValidity: (props: ObservationRenderProps) => (
        <select
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Validity</option>
            <option value="Used within 8 hrs">Used within 8 hrs</option>
            <option value="Expired">Expired</option>
            <option value="NA">N/A</option>
        </select>
    ),

    renderAlignment: (props: ObservationRenderProps) => (
        <div className="flex flex-col items-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter mm"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm"
                min="-10"
                max="10"
                step="0.1"
            />
            <span className="text-xs text-gray-500 mt-1">mm</span>
        </div>
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
                <div className="flex justify-between px-2 py-2 gap-2">
                    {['Sample-1', 'Sample-2', 'Sample-3'].map((sample) => (
                        <div key={sample} className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">{sample}</span>
                            <select
                                value={sampleValue[sample] || ''}
                                onChange={(e) => {
                                    const updatedValue = { ...sampleValue, [sample]: e.target.value };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                }}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                            >
                                <option value="">Select</option>
                                <option value="OK">Checked OK</option>
                                <option value="NG">Checked NG</option>
                                <option value="NA">N/A</option>
                            </select>
                        </div>
                    ))}
                </div>

                {/* Bottom 3 samples */}
                <div className="flex justify-between px-2 py-2">
                    {['Sample-4', 'Sample-5', 'Sample-6'].map((sample) => (
                        <div key={sample} className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">{sample}</span>
                            <select
                                value={sampleValue[sample] || ''}
                                onChange={(e) => {
                                    const updatedValue = { ...sampleValue, [sample]: e.target.value };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                }}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                            >
                                <option value="">Select</option>
                                <option value="OK">Checked OK</option>
                                <option value="NG">Checked NG</option>
                                <option value="NA">N/A</option>
                            </select>
                        </div>
                    ))}
                </div>
            </div>
        );
    },

    renderDimensions: (props: ObservationRenderProps) => (
        <div className="flex flex-col items-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter value"
                className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm"
                step="0.01"
                min="0"
            />
            <span className="text-xs text-gray-500 mt-1">mm</span>
        </div>
    )
};

export const frontEncapsulantStage: StageData = {
    id: 3,
    name: "Front Encapsulant Storage & Cutting",
    parameters: [
        {
            id: "3-1",
            parameters: "Storage Humidity",
            criteria: "≤ 60%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hrs",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderStorageConditions
        },
        {
            id: "3-2",
            parameters: "Storage Temperature",
            criteria: "25 ± 5 °C",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hrs",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderStorageConditions
        },
        {
            id: "3-3",
            parameters: "Encapsulant Status",
            criteria: "Supplier, Type, Lot No. and Expiry Date",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "Type", value: "" },
                { timeSlot: "Lot No.", value: "" },
                { timeSlot: "Expiry Date", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderEncapsulantStatus
        },
        {
            id: "3-4",
            parameters: "Usage Validity",
            criteria: "Use within 8 hours after opening inner packaging",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderUsageValidity
        },
        {
            id: "3-5",
            parameters: "Encapsulant Alignment",
            criteria: "±5mm",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderAlignment
        },
        {
            id: "3-6",
            parameters: "Aesthetic Condition",
            criteria: "No hair, dust, foreign particle, deep cut, damage outer layer",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderAestheticCondition
        },
        {
            id: "3-7",
            parameters: "Length",
            criteria: "±2mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "Line-3", value: "" },
                { timeSlot: "Line-4", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderDimensions
        },
        {
            id: "3-8",
            parameters: "Width",
            criteria: "±2mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "Line-3", value: "" },
                { timeSlot: "Line-4", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderDimensions
        },
        {
            id: "3-9",
            parameters: "Thickness",
            criteria: "±0.05mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "Line-3", value: "" },
                { timeSlot: "Line-4", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderDimensions
        }
    ]
};