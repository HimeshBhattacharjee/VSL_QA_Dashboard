import { StageData, ObservationRenderProps } from '../types/audit';

const AutoBussingObservations = {
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

    renderWidth: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter width"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-32"
            />
        </div>
    ),

    renderThickness: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter thickness"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-32"
            />
        </div>
    ),

    renderExpiry: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="DD.MM.YYYY"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-40"
            />
        </div>
    ),

    renderSolderingTime: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter seconds"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-24"
                min="0"
                step="0.1"
            />
        </div>
    ),

    renderTemperature: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter °C"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-24"
                min="0"
                step="1"
            />
        </div>
    ),

    renderPercentage: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <div className="flex flex-col items-center">
                <input
                    type="number"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    placeholder="Enter %"
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-20"
                    min="0"
                    max="100"
                    step="1"
                />
                <span className="text-xs text-gray-500 mt-1">%</span>
            </div>
        </div>
    ),

    renderLength: (props: ObservationRenderProps) => (
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
    ),

    renderAlignment: (props: ObservationRenderProps) => (
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

    renderPeelStrength: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <input
                type="number"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                placeholder="Enter N"
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm w-20"
                min="0"
                step="0.01"
            />
        </div>
    ),

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
    )
};

export const autoBussingStage: StageData = {
    id: 7,
    name: "Auto Bussing",
    parameters: [
        // Aesthetics Parameters
        {
            id: "7-1",
            parameters: "BUS Ribbon Status - Supplier",
            criteria: "As per Production Order /BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderSupplier
        },
        {
            id: "7-2",
            parameters: "BUS Ribbon Status - Width",
            criteria: "5.0 & 4.0 mm",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderWidth
        },
        {
            id: "7-3",
            parameters: "BUS Ribbon Status - Thickness",
            criteria: "0.400 & 0.350 mm",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderThickness
        },
        {
            id: "7-4",
            parameters: "BUS Ribbon Status - Expiry",
            criteria: "16.06.2026/14.06.2026",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderExpiry
        },
        {
            id: "7-5",
            parameters: "Soldering Time",
            criteria: "1.2 ± 0.4 Sec.",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Front TCA", value: "" },
                { timeSlot: "Middle TCA", value: "" },
                { timeSlot: "Back TCA", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderSolderingTime
        },
        {
            id: "7-6",
            parameters: "Cooling Temperature",
            criteria: "40°±15℃",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderTemperature
        },
        {
            id: "7-7",
            parameters: "Soldering Iron Temperature",
            criteria: "370° C to 410° C",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hrs",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderTemperature
        },
        {
            id: "7-8",
            parameters: "Soldering Trip Calibration",
            criteria: "Calibration once/day, SPC graph update",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every day",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderStatusCheck
        },
        // Measurement Parameters
        {
            id: "7-9",
            parameters: "Soldering Coverage - Top",
            criteria: "≥50% width of bus ribbon",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderPercentage
        },
        {
            id: "7-10",
            parameters: "Soldering Coverage - Middle",
            criteria: "≥50% width of bus ribbon",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderPercentage
        },
        {
            id: "7-11",
            parameters: "Soldering Coverage - Bottom",
            criteria: "≥50% width of bus ribbon",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderPercentage
        },
        {
            id: "7-12",
            parameters: "Bus Bar Cut Length - I Type",
            criteria: "345±5 mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderLength
        },
        {
            id: "7-13",
            parameters: "Bus Bar Cut Length - Small L",
            criteria: "170±5 mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderLength
        },
        {
            id: "7-14",
            parameters: "Bus Bar Cut Length - Big L",
            criteria: "365±5 mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderLength
        },
        {
            id: "7-15",
            parameters: "Bus Bar Cut Length - Terminal Height",
            criteria: "20±5 mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderLength
        },
        {
            id: "7-16",
            parameters: "String Alignment",
            criteria: "≤0.5mm",
            typeOfInspection: "Measurement",
            inspectionFrequency: "Every 4 hrs",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderAlignment
        },
        // Functionality Parameters
        {
            id: "7-17",
            parameters: "Peel Strength Bus Ribbon to INTC Ribbon",
            criteria: "≥ 1.5 N (Average)",
            typeOfInspection: "Functionality",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Position 1", value: "" },
                { timeSlot: "Position 2", value: "" },
                { timeSlot: "Position 3", value: "" },
                { timeSlot: "Position 4", value: "" },
                { timeSlot: "Position 5", value: "" },
                { timeSlot: "Position 6", value: "" },
                { timeSlot: "Position 7", value: "" },
                { timeSlot: "Position 8", value: "" },
                { timeSlot: "Position 9", value: "" },
                { timeSlot: "Position 10", value: "" },
                { timeSlot: "Position 11", value: "" },
                { timeSlot: "Position 12", value: "" }
            ],
            renderObservation: AutoBussingObservations.renderPeelStrength
        }
    ]
};