import { StageData, ObservationRenderProps } from '../types/audit';

const CellSortingObservations = {
    renderCellStatus: (props: ObservationRenderProps) => (
        <div className="flex flex-col space-y-1">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="w-36 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
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
            <option value="4_hrs">Used within 8 hrs</option>
            <option value="8_hrs">Used within 8 hrs</option>
            <option value="Expired">Expired</option>
            <option value="OFF">OFF</option>
        </select>
    ),

    renderStorageConditions: (props: ObservationRenderProps) => (
        <select
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select</option>
            <option value="Compliant">Compliant</option>
            <option value="Non-Compliant">Non-Compliant</option>
            <option value="OFF">OFF</option>
        </select>
    ),

    renderCellAppearance: (props: ObservationRenderProps) => (
        <select
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select</option>
            <option value="OK">Checked OK</option>
            <option value="NG">Checked Not OK</option>
            <option value="OFF">OFF</option>
        </select>
    ),

    renderGlovesChange: (props: ObservationRenderProps) => (
        <select
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select</option>
            <option value="Changed">New Hand Gloves Used</option>
            <option value="Not Changed">Hand Gloves Not Changed</option>
            <option value="OFF">OFF</option>
        </select>
    ),

    renderCellDimensions: (props: ObservationRenderProps) => (
        <div className="flex flex-col items-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm"
                step="0.01"
                min="0"
            />
            <span className="text-xs text-gray-500 mt-1">
                {props.observationData.timeSlot.includes('Thickness') ? 'μm' : 'mm'}
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
            criteria: "As per Order (Supplier, Watt Peak, Lot No. and Expiry Date)",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "WP", value: "" },
                { timeSlot: "Lot No.", value: "" },
                { timeSlot: "Expiry Date", value: "" }
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
                { timeSlot: "4 hrs", value: "" },
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
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: CellSortingObservations.renderStorageConditions
        },
        {
            id: "4-4",
            parameters: "Cell Appearance",
            criteria: "Color conformity, no notch, no crack, no broken, same power level, efficiency as per specs",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: CellSortingObservations.renderCellAppearance
        },
        {
            id: "4-5",
            parameters: "Hand Gloves Change Frequency",
            criteria: "Change after 8 hrs or in case of tearing/damage",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
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
                { timeSlot: "Length", value: "" },
                { timeSlot: "Width", value: "" },
                { timeSlot: "Thickness", value: "" }
            ],
            renderObservation: CellSortingObservations.renderCellDimensions
        }
    ]
};