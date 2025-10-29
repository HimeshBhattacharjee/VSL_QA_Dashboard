import { StageData, ObservationRenderProps } from '../types/audit';

const RoboticLayupObservations = {
    renderSelector: (props: ObservationRenderProps) => (
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

export const roboticLayupStage: StageData = {
    id: 6,
    name: "Robotic Layup",
    parameters: [
        {
            id: "6-1",
            parameters: "Module Polarity",
            criteria: "String shouldn't be of same polarity",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: RoboticLayupObservations.renderSelector
        }
    ]
};