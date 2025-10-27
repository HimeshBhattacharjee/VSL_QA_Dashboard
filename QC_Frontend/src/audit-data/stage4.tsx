// stage4.tsx
import { StageData, ObservationRenderProps } from '../types/audit';

const CellSortingObservations = {
    renderCellStatus: (props: ObservationRenderProps) => (
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
        </select>
    ),

    renderStorageConditions: (props: ObservationRenderProps) => (
        <select
            value={props.value}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Status</option>
            <option value="Compliant">Compliant</option>
            <option value="Non-Compliant">Non-Compliant</option>
        </select>
    ),

    renderCellAppearance: (props: ObservationRenderProps) => (
        <select
            value={props.value}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Appearance</option>
            <option value="Good">Good - No Defects</option>
            <option value="Minor Defects">Minor Defects</option>
            <option value="Major Defects">Major Defects</option>
            <option value="Rejected">Rejected</option>
        </select>
    ),

    renderGlovesChange: (props: ObservationRenderProps) => (
        <select
            value={props.value}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Status</option>
            <option value="Changed">Changed</option>
            <option value="Not Changed">Not Changed</option>
            <option value="Damaged">Damaged</option>
        </select>
    ),

    renderCellDimensions: (props: ObservationRenderProps) => (
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
            <span className="text-xs text-gray-500 mt-1">
                {props.paramId.includes('Thickness') ? 'μm' : 'mm'}
            </span>
        </div>
    )
};

export const cellSortingStage: StageData = {
    id: 4,
    name: "Cell Sorting",
    parameters: [
        {
            id: "4-1",
            parameters: "Cell Status",
            criteria: "As per Order (Supplier, Lot NO and Expiry date)",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: CellSortingObservations.renderCellStatus
        },
        {
            id: "4-2",
            parameters: "Usage Validity",
            criteria: "Use within 8 hours after opening inner packaging",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: CellSortingObservations.renderUsageValidity
        },
        {
            id: "4-3",
            parameters: "Storage Conditions",
            criteria: "Solar cells not stacked more than 2 boxes",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: CellSortingObservations.renderStorageConditions
        },
        {
            id: "4-4",
            parameters: "Cell Appearance",
            criteria: "Color conformity, no notch, no crack, no broken, same power level",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: CellSortingObservations.renderCellAppearance
        },
        {
            id: "4-5",
            parameters: "Hand Gloves Change Frequency",
            criteria: "Change after 8 hrs or if tearing/damage",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: CellSortingObservations.renderGlovesChange
        },
        {
            id: "4-6",
            parameters: "Cell Dimensions",
            criteria: "Length & Width ±0.5mm, Thickness ±20μm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: CellSortingObservations.renderCellDimensions
        }
    ]
};