import { StageData, ObservationRenderProps } from '../types/audit';
import { renderGroupedSampleInputs } from './sampleGroupedInputs';

const LaminateInspectionObservations = {
    renderSerialNumbers: (props: ObservationRenderProps) => {
        return renderGroupedSampleInputs(props, (value) => value.toLowerCase() === 'off' ? 'bg-yellow-200' : 'bg-white');
    },

    renderInputNumber: (props: ObservationRenderProps) => {
        const value = typeof props.value === 'string' ? props.value : '';
        const numericValue = parseFloat(value);
        const isOff = value.toLowerCase() === 'off';
        let isOutOfRange = false;
        if (!isNaN(numericValue)) {
            switch (props.paramId) {
                case "16-2":
                case "16-3":
                case "16-4":
                case "16-5":
                    isOutOfRange = numericValue < 12;
                    break;
                case "16-6":
                    isOutOfRange = numericValue < 10 || numericValue > 20;
                    break;
                default:
                    isOutOfRange = false;
            }
        }
        let bgColor = 'bg-white';
        if (isOff) bgColor = 'bg-yellow-100';
        else if (isOutOfRange) bgColor = 'bg-red-100';

        return (
            <div className="flex w-full min-w-0 flex-col items-center">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`w-full min-w-0 px-3 py-2 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${bgColor}`}
                />
                <span className="text-xs text-gray-500 mt-1">mm</span>
            </div>
        );
    },
};

export const laminateInspectionStage: StageData = {
    id: 16,
    name: "Laminate Inspection",
    parameters: [
        {
            id: "16-1",
            parameters: "Air bubbles, delamination, foreign particles, cell breakage, edge chipping etc checked as per given spec",
            criteria: "Module acceptance criteria (visual) - VSL/QAD/SC/03",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [],
            renderObservation: LaminateInspectionObservations.renderSerialNumbers
        },
        {
            id: "16-2",
            parameters: "Creep edge distance - Left side gap",
            criteria: "≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [{ timeSlot: "4 hours", value: "" }, { timeSlot: "8 hours", value: "" }],
            renderObservation: LaminateInspectionObservations.renderInputNumber
        },
        {
            id: "16-3",
            parameters: "Creep edge distance - Right side gap",
            criteria: "≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [{ timeSlot: "4 hours", value: "" }, { timeSlot: "8 hours", value: "" }],
            renderObservation: LaminateInspectionObservations.renderInputNumber
        },
        {
            id: "16-4",
            parameters: "Creep edge distance - Top side gap",
            criteria: "≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [{ timeSlot: "4 hours", value: "" }, { timeSlot: "8 hours", value: "" }],
            renderObservation: LaminateInspectionObservations.renderInputNumber
        },
        {
            id: "16-5",
            parameters: "Creep edge distance - Bottom side gap",
            criteria: "≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [{ timeSlot: "4 hours", value: "" }, { timeSlot: "8 hours", value: "" }],
            renderObservation: LaminateInspectionObservations.renderInputNumber
        },
        {
            id: "16-6",
            parameters: "Space between 2 portion of half cut cell module",
            criteria: "Middle gap 15 ± 5 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [{ timeSlot: "4 hours", value: "" }, { timeSlot: "8 hours", value: "" }],
            renderObservation: LaminateInspectionObservations.renderInputNumber
        }
    ]
};
