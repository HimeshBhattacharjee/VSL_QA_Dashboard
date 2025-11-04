import { StageData, ObservationRenderProps } from '../types/audit';

const PackingObservations = {
    renderSelector: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            >
                <option value="">Select</option>
                <option value="OK">Checked Ok</option>
                <option value="NG">Checked Not OK</option>
                <option value="OFF">OFF</option>
            </select>
        </div>
    ),

    renderTextInput: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
        </div>
    ),

    renderOrientation: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm w-full"
            >
                <option value="">Select</option>
                <option value="vertically">Vertically</option>
                <option value="horizontally">Horizontally</option>
                <option value="OFF">OFF</option>
            </select>
        </div>
    ),

    renderQuantity: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm w-full"
            >
                <option value="">Select</option>
                <option value="35">35</option>
                <option value="36">36</option>
                <option value="37">37</option>
                <option value="OFF">OFF</option>
            </select>
        </div>
    ),

    renderMeasurement: (props: ObservationRenderProps) => (
        <div className="w-full flex flex-col justify-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                step="0.1"
                min="0"
            />
            <span className="text-xs text-gray-500 mt-1">Newton (N)</span>
        </div>
    )
};

export const packingStage: StageData = {
    id: 31,
    name: "Packing",
    parameters: [
        {
            id: "31-1",
            parameters: "Serial Number Consistency",
            criteria: "Serial number on the outer part of the box is consistent with product serial number. Correct material",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderTextInput
        },
        {
            id: "31-2",
            parameters: "Barcode Labels Condition",
            criteria: "Barcode labels shall be free from smudge, damage",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderSelector
        },
        {
            id: "31-3",
            parameters: "Master Carton Condition",
            criteria: "Master carton free from moisture, damage, tore, breakage, printing missing, smudge etc.",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderSelector
        },
        {
            id: "31-4",
            parameters: "Pallet Condition",
            criteria: "Pallet free from termite, breakage, damage etc.",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderSelector
        },
        {
            id: "31-5",
            parameters: "Groove Cutting on Pallet",
            criteria: "Ensure groove cutting present on pallet",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderSelector
        },
        {
            id: "31-6",
            parameters: "Bottom Sheet Provision",
            criteria: "Bottom sheet provided on the pallet covering the nails",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderSelector
        },
        {
            id: "31-7",
            parameters: "Module Placement Orientation",
            criteria: "Modules placed vertically/horizontally in the box",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderOrientation
        },
        {
            id: "31-8",
            parameters: "Number of Modules in the Box",
            criteria: "As per criteria",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderQuantity
        },
        {
            id: "31-9",
            parameters: "Frame Corners Protection",
            criteria: "Frame corners covered by corner cap tightly",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderSelector
        },
        {
            id: "31-10",
            parameters: "3-ply Carton Provision",
            criteria: "3-ply carton provided between Glass to Glass Side",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderSelector
        },
        {
            id: "31-11",
            parameters: "Module Marking",
            criteria: "Marking of Module Wp and Frame Colour",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderSelector
        },
        {
            id: "31-12",
            parameters: "Stretch Wrap Film Coverage",
            criteria: "Stretch wrap film covers the box completely",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderSelector
        },
        {
            id: "31-13",
            parameters: "Strap Belt Tightness Strength",
            criteria: "Strap tightness - All measured tension values must be ≥ 60 N at a 2.5 cm pull",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Observation - 1", value: "" },
                { timeSlot: "Observation - 2", value: "" },
                { timeSlot: "Observation - 3", value: "" },
                { timeSlot: "Observation - 4", value: "" }
            ],
            renderObservation: PackingObservations.renderMeasurement
        }
    ]
};