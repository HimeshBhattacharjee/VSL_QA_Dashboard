import { StageData, ObservationRenderProps } from '../types/audit';

const AutoSorterObservations = {
    renderSelector: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            >
                <option value="">Select Status</option>
                <option value="OK">Checked OK</option>
                <option value="NG">Checked Not OK</option>
                <option value="OFF">OFF</option>
            </select>
        </div>
    )
};

export const autoSorterStage: StageData = {
    id: 30,
    name: "Auto Sorter",
    parameters: [
        {
            id: "30-1",
            parameters: "Aesthetics as per defined binning grade",
            criteria: "Modules binning as per Wp, Current & Grade",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoSorterObservations.renderSelector
        },
        {
            id: "30-2",
            parameters: "Module stacking as per Bin",
            criteria: "As per defined binning grade",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: AutoSorterObservations.renderSelector
        }
    ]
};