// stage2.tsx
import { StageData, ObservationRenderProps } from '../types/audit';

const AutoFrontGlassObservations = {
    renderGlassStatus: (props: ObservationRenderProps) => (
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

    renderSurfaceQuality: (props: ObservationRenderProps) => (
        <select
            value={props.value}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Quality</option>
            <option value="OK">OK - No Defects</option>
            <option value="Minor Defects">Minor Defects</option>
            <option value="Major Defects">Major Defects</option>
            <option value="Rejected">Rejected</option>
        </select>
    ),

    renderVacuumCup: (props: ObservationRenderProps) => (
        <select
            value={props.value}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Condition</option>
            <option value="Good">Good</option>
            <option value="Damaged">Damaged</option>
            <option value="Needs Replacement">Needs Replacement</option>
        </select>
    ),

    renderDimensions: (props: ObservationRenderProps) => (
        <div className="flex flex-col items-center">
            <input
                type="number"
                value={props.value}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter mm"
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm"
                step="0.01"
                min="0"
            />
            <span className="text-xs text-gray-500 mt-1">mm</span>
        </div>
    )
};

export const autoFrontGlassStage: StageData = {
    id: 2,
    name: "Auto Front Glass Loading",
    parameters: [
        {
            id: "2-1",
            parameters: "Front Glass Status",
            criteria: "Supplier, Lot No. and Expiry date",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoFrontGlassObservations.renderGlassStatus
        },
        {
            id: "2-2",
            parameters: "Glass Surface Quality (Refer - Doc. No.: VSL/PDN/SP/49)",
            criteria: "No nail deep, scratch, smooth edge and corners, textured finish, no spot, rainbow & textured upwards",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoFrontGlassObservations.renderSurfaceQuality
        },
        {
            id: "2-3",
            parameters: "Vacuum Cup Condition",
            criteria: "Vacuum cup should not be damaged",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoFrontGlassObservations.renderVacuumCup
        },
        {
            id: "2-4",
            parameters: "Length",
            criteria: "As per Engg. drawing ±1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoFrontGlassObservations.renderDimensions
        },
        {
            id: "2-5",
            parameters: "Width",
            criteria: "As per Engg. drawing ±1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoFrontGlassObservations.renderDimensions
        },
        {
            id: "2-6",
            parameters: "Thickness",
            criteria: "As per Engg. drawing ±0.2mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoFrontGlassObservations.renderDimensions
        }
    ]
};