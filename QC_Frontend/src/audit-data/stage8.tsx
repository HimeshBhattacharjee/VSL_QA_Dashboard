import { StageData, ObservationRenderProps } from '../types/audit';

const AutoTapingNLayupObservations = {
    renderStatusCheck: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm w-32"
            >
                <option value="">Select Status</option>
                <option value="OK">Checked OK</option>
                <option value="NG">Checked NG</option>
                <option value="NA">N/A</option>
            </select>
        </div>
    ),

    renderRFID: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm w-40"
            >
                <option value="">Select Position</option>
                <option value="Inside">Laminate Inside</option>
                <option value="Outside">Outside RFID</option>
                <option value="NotRequired">Not required</option>
            </select>
        </div>
    ),

    renderSupplier: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter supplier"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-32"
            />
        </div>
    ),

    renderTapeType: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter type"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-32"
            />
        </div>
    ),

    renderTapeQty: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter qty"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-20"
                min="0"
                step="1"
            />
        </div>
    ),

    renderGap: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter mm"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-20"
                min="0"
                step="0.01"
            />
        </div>
    ),

    renderDistance: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter mm"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-24"
                min="0"
                step="0.01"
            />
        </div>
    ),

    renderTapeLength: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter mm"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-20"
                min="0"
                step="1"
            />
        </div>
    )
};

export const autoTapingNLayupStage: StageData = {
    id: 8,
    name: "Auto Taping and Layup",
    parameters: [
        // Aesthetics Parameters
        {
            id: "8-1",
            parameters: "Gap between cell edge to Label",
            criteria: "Uniform gap",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderStatusCheck
        },
        {
            id: "8-2",
            parameters: "RFID Tag Position",
            criteria: "Laminate Inside/Not required",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderRFID
        },
        {
            id: "8-3",
            parameters: "Logo Watt peak & Vikram Logo",
            criteria: "Module Watt Peak tolerance as per PO No",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderStatusCheck
        },
        {
            id: "8-4",
            parameters: "Barcode Serial No",
            criteria: "Module SL no as per PO No",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderStatusCheck
        },
        {
            id: "8-5",
            parameters: "Foreign particles",
            criteria: "Not allowed",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderStatusCheck
        },
        {
            id: "8-6",
            parameters: "Cell fixing tape - Supplier",
            criteria: "As per BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderSupplier
        },
        {
            id: "8-7",
            parameters: "Cell fixing tape - Type",
            criteria: "As per BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderTapeType
        },
        {
            id: "8-8",
            parameters: "Cell fixing tape - Quantity",
            criteria: "45±15",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderTapeQty
        },
        // Measurement Parameters
        {
            id: "8-9",
            parameters: "Cell to Cell Gap",
            criteria: "0.8 mm to 1.8 mm for M10, 0.3 mm to 1.3 mm for M10R & G12",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderGap
        },
        {
            id: "8-10",
            parameters: "String to String Gap",
            criteria: "1.5±0.5 mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderGap
        },
        {
            id: "8-11",
            parameters: "Creep edge distance - Left side",
            criteria: "≥12 mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderDistance
        },
        {
            id: "8-12",
            parameters: "Creep edge distance - Right side",
            criteria: "≥12 mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderDistance
        },
        {
            id: "8-13",
            parameters: "Creep edge distance - Top side",
            criteria: "≥12 mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderDistance
        },
        {
            id: "8-14",
            parameters: "Creep edge distance - Bottom side",
            criteria: "≥12 mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderDistance
        },
        {
            id: "8-15",
            parameters: "Space between 2 portions of half cut cell module",
            criteria: "15±5 mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderDistance
        },
        {
            id: "8-16",
            parameters: "Cell fixing tape dimension",
            criteria: "Tape length 21±5 mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoTapingNLayupObservations.renderTapeLength
        }
    ]
};