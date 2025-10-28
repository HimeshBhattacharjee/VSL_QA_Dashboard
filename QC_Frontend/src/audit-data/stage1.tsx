// stage1.tsx
import { StageData, ObservationRenderProps } from '../types/audit';

const PreLamObservations = {
    renderHumidity: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <div className="flex flex-col items-center max-w-full">
                <input
                    type="number"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    placeholder="Enter %"
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm"
                    min="0"
                    max="100"
                    step="0.1"
                />
                <span className="text-xs text-gray-500 mt-1">%</span>
            </div>
        </div>
    ),

    renderTemperature: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <div className="flex flex-col items-center max-w-full">
                <input
                    type="number"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    placeholder="Enter °C"
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white shadow-sm"
                    min="0"
                    max="100"
                    step="0.1"
                />
                <span className="text-xs text-gray-500 mt-1">°C</span>
            </div>
        </div>
    ),

    renderAccessControl: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
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
        </div>
    )
};

export const preLamStage: StageData = {
    id: 1,
    name: "Pre Lam Shop Floor Condition",
    parameters: [
        {
            id: "1-1",
            parameters: "Humidity",
            criteria: "≤ 60%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: PreLamObservations.renderHumidity
        },
        {
            id: "1-2",
            parameters: "Temperature",
            criteria: "25 ± 5 °C",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: PreLamObservations.renderTemperature
        },
        {
            id: "1-3",
            parameters: "Open access to shop floor",
            criteria: "No open access for dust and insects",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: PreLamObservations.renderAccessControl
        }
    ]
};