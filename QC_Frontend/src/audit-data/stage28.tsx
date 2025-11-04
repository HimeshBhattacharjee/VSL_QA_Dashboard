import { StageData, ObservationRenderProps } from '../types/audit';

const BackLabelFixingObservations = {
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

export const backLabelFixingStage: StageData = {
    id: 28,
    name: "Back Label Fixing",
    parameters: [
        {
            id: "28-1",
            parameters: "Back-label Aesthetic Condition",
            criteria: "Ensure that the label should be free from damage & bubble free, it should align straight and the printing on the back-label should be clear",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: BackLabelFixingObservations.renderSelector
        }
    ]
};