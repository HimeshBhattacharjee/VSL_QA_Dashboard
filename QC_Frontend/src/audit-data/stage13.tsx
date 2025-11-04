import { StageData, ObservationRenderProps } from '../types/audit';

const PreLamRepairNAutoEdgeSealObservations = {
    renderNumberInput: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <div className="flex flex-col items-center max-w-full">
                <input
                    type="number"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm"
                    min="0"
                    max="100"
                    step="0.1"
                />
                <span className="text-xs text-gray-500 mt-1">
                    {props.paramId.includes('peel-strength') ? 'N/mm' : '°C'}
                </span>
            </div>
        </div>
    ),

    renderSelector: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
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
        </div>
    )
};

export const preLamRepairNAutoEdgeSealStage: StageData = {
    id: 13,
    name: "Pre-Lam Repair & Auto Edge Sealing",
    parameters: [
        {
            id: "13-1",
            parameters: "Soldering Iron Temperature shown in Digital Meter",
            criteria: "370° C to 410° C (Manual Bussing)",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: PreLamRepairNAutoEdgeSealObservations.renderNumberInput
        },
        {
            id: "13-2",
            parameters: "Soldering Trip Calibration",
            criteria: "Calibration should be done once/day, SPC graph update",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every day",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: PreLamRepairNAutoEdgeSealObservations.renderSelector
        },
        {
            id: "13-3-peel-strength",
            parameters: "Cell to Interconnect Ribbon Peel Strength test",
            criteria: "Peel strength average ≥ 1.0 N/mm; Hard soldering: Silver peel off not allowed",
            typeOfInspection: "Functionality",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Front", value: "" },
                { timeSlot: "Back", value: "" }
            ],
            renderObservation: PreLamRepairNAutoEdgeSealObservations.renderNumberInput
        },
        {
            id: "13-4",
            parameters: "Edge Sealing Tape Condition",
            criteria: "Tape should be covered around the module",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hours", value: "" },
                { timeSlot: "8 hours", value: "" }
            ],
            renderObservation: PreLamRepairNAutoEdgeSealObservations.renderSelector
        },
    ]
};