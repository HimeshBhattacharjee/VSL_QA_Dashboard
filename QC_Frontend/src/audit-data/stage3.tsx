// stage3.tsx
import { StageData, ObservationRenderProps } from '../types/audit';

const FrontEncapsulantObservations = {
    renderStorageConditions: (props: ObservationRenderProps) => (
        <div className="flex flex-col items-center">
            <input
                type="number"
                value={props.value}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder={props.paramId.includes('Humidity') ? 'Enter %' : 'Enter °C'}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm"
                min={props.paramId.includes('Humidity') ? '0' : '15'}
                max={props.paramId.includes('Humidity') ? '100' : '35'}
                step="0.1"
            />
            <span className="text-xs text-gray-500 mt-1">
                {props.paramId.includes('Humidity') ? '%' : '°C'}
            </span>
        </div>
    ),

    renderEncapsulantStatus: (props: ObservationRenderProps) => (
        <div className="flex flex-col space-y-1">
            <input
                type="text"
                value={props.value}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Supplier, Lot No."
                className="w-40 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            />
        </div>
    ),

    renderUsageValidity: (props: ObservationRenderProps) => (
        <select
            value={props.value}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Validity</option>
            <option value="Within 8 hrs">Within 8 hrs</option>
            <option value="Expired">Expired</option>
            <option value="NA">N/A</option>
        </select>
    ),

    renderAlignment: (props: ObservationRenderProps) => (
        <div className="flex flex-col items-center">
            <input
                type="number"
                value={props.value}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter mm"
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm"
                min="-10"
                max="10"
                step="0.1"
            />
            <span className="text-xs text-gray-500 mt-1">mm</span>
        </div>
    ),

    renderAestheticCondition: (props: ObservationRenderProps) => (
        <select
            value={props.value}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Condition</option>
            <option value="Good">Good - No Issues</option>
            <option value="Minor Issues">Minor Issues</option>
            <option value="Major Issues">Major Issues</option>
            <option value="Rejected">Rejected</option>
        </select>
    ),

    renderDimensions: (props: ObservationRenderProps) => (
        <div className="flex flex-col items-center">
            <input
                type="number"
                value={props.value}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter value"
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm"
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
            criteria: "≤60%",
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
            criteria: "25±5°C",
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
            criteria: "Supplier, Lot NO and Expiry date",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
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
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
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
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
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
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
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
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
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
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
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
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderDimensions
        }
    ]
};