// stage4.tsx
import { StageData, ObservationRenderProps } from '../types/audit';

const TabbingStringingObservations = {
    renderINTCRibbonStatus: (props: ObservationRenderProps) => (
        <div className="flex flex-col space-y-1">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            />
        </div>
    ),

    renderRibbonSpool: (props: ObservationRenderProps) => (
        <select
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Status</option>
            <option value="OK">Checked OK</option>
            <option value="NG">Checked NG</option>
            <option value="NA">N/A</option>
        </select>
    ),

    renderStorageConditions: (props: ObservationRenderProps) => (
        <select
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Status</option>
            <option value="Compliant">Compliant</option>
            <option value="Non-Compliant">Non-Compliant</option>
            <option value="NA">N/A</option>
        </select>
    ),

    renderCellAppearance: (props: ObservationRenderProps) => (
        <select
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Status</option>
            <option value="OK">Checked OK</option>
            <option value="NG">Checked NG</option>
            <option value="NA">N/A</option>
        </select>
    ),

    renderGlovesChange: (props: ObservationRenderProps) => (
        <select
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Status</option>
            <option value="Changed">Hand Gloves Changed</option>
            <option value="Not Changed">Hand Gloves Not Changed</option>
            <option value="NA">N/A</option>
        </select>
    ),

    renderCellDimensions: (props: ObservationRenderProps) => (
        <div className="flex flex-col items-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter value"
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

export const tabbingStringingStage: StageData = {
    id: 5,
    name: "Tabbing and Stringing",
    parameters: [
        {
            id: "5-1",
            parameters: "INTC Ribbon Status",
            criteria: "As per Production Order / BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "Dimension", value: "" },
                { timeSlot: "Expiry Date", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderINTCRibbonStatus
        },
        {
            id: "5-2",
            parameters: "Ribbon Spool Aesthetics",
            criteria: "Spool Gap, Damage or Coating Defect",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderRibbonSpool
        },
        {
            id: "5-3",
            parameters: "Flux Status",
            criteria: "As per Production Order / BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "Expiry Date", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderStorageConditions
        },
        {
            id: "5-4",
            parameters: "Machine Laser Power",
            criteria: "As per laser power range 50 % ± 20 %",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderCellAppearance
        },
        {
            id: "5-5",
            parameters: "Cell Appearance",
            criteria: "Free from chip, rough edge, cross cut ,crack etc.",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderGlovesChange
        },
        {
            id: "5-6",
            parameters: "Cell Dimensions",
            criteria: "Length & Width ±0.5mm, Thickness ±20μm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Length", value: "" },
                { timeSlot: "Width", value: "" },
                { timeSlot: "Thickness", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderCellDimensions
        }
    ]
};