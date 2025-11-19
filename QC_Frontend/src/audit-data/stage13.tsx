import { StageData, ObservationRenderProps } from '../types/audit';

const PreLamRepairNAutoEdgeSealObservations = {
    renderNumberInput: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            if (props.paramId === "13-1") {
                if (numValue >= 370 && numValue <= 410) return 'bg-white';
                return 'bg-red-100';
            } else if (props.paramId === "13-3-peel-strength") {
                if (numValue >= 1.0) return 'bg-white';
                return 'bg-red-100';
            }
            return 'bg-white';
        };

        return (
            <div className="flex justify-center">
                <div className="flex flex-col items-center max-w-full">
                    <input
                        type="text"
                        value={props.value as string}
                        onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                        className={`px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 text-center shadow-sm ${getBackgroundColor(props.value as string || '')}`}
                    />
                    <span className="text-xs text-gray-500 mt-1">
                        {props.paramId.includes('peel-strength') ? 'N/mm' : '°C'}
                    </span>
                </div>
            </div>
        );
    },

    renderSelector: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';
        
        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (props.paramId === "13-2" || props.paramId === "13-4") {
                if (value === "Checked Not OK") return 'bg-red-100';
            }
            return 'bg-white';
        };

        return (
            <div className="flex justify-center">
                <div className="flex flex-col items-center">
                    <select
                        value={props.value as string}
                        onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                        className={`px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string || '')}`}
                    >
                        <option value="">Select</option>
                        <option value="Checked OK">Checked OK</option>
                        <option value="Checked Not OK">Checked Not OK</option>
                        <option value="OFF">OFF</option>
                    </select>
                </div>
            </div>
        );
    }
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
            observations: [{ timeSlot: "4 hrs", value: "" }, { timeSlot: "8 hrs", value: "" }],
            renderObservation: PreLamRepairNAutoEdgeSealObservations.renderNumberInput
        },
        {
            id: "13-2",
            parameters: "Soldering Trip Calibration",
            criteria: "Calibration should be done once/day, SPC graph update",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every day",
            observations: [{ timeSlot: "", value: "" }],
            renderObservation: PreLamRepairNAutoEdgeSealObservations.renderSelector
        },
        {
            id: "13-3-peel-strength",
            parameters: "Cell to Interconnect Ribbon Peel Strength test",
            criteria: "Peel strength average ≥ 1.0 N/mm; Hard soldering: Silver peel off not allowed",
            typeOfInspection: "Functionality",
            inspectionFrequency: "Every shift",
            observations: [{ timeSlot: "Front", value: "" }, { timeSlot: "Back", value: "" }],
            renderObservation: PreLamRepairNAutoEdgeSealObservations.renderNumberInput
        },
        {
            id: "13-4",
            parameters: "Edge Sealing Tape Condition",
            criteria: "Tape should be covered around the module",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [{ timeSlot: "4 hrs", value: "" }, { timeSlot: "8 hrs", value: "" }],
            renderObservation: PreLamRepairNAutoEdgeSealObservations.renderSelector
        },
    ]
};