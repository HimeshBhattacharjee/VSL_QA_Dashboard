import { StageData, ObservationRenderProps } from '../types/audit';

const LaminateInspectionObservations = {
    renderSerialNumbers: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Sample-1": "", "Sample-2": "", "Sample-3": "", "Sample-4": "", "Sample-5": "",
                "Sample-6": "", "Sample-7": "", "Sample-8": "", "Sample-9": "", "Sample-10": ""
            }
            : props.value as Record<string, string>;

        return (
            <div className="flex flex-row rounded-lg bg-white shadow-sm border border-gray-400">
                <div className="flex flex-col justify-between p-2 gap-2">
                    {['Sample-1', 'Sample-2', 'Sample-3', 'Sample-4', 'Sample-5'].map((sample) => (
                        <div key={sample} className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">{sample}</span>
                            <input
                                type="text"
                                value={sampleValue[sample] || ''}
                                onChange={(e) => {
                                    const updatedValue = { ...sampleValue, [sample]: e.target.value };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                }}
                                className="w-full px-2 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                            />
                        </div>
                    ))}
                </div>
                <div className="flex flex-col justify-between p-2">
                    {['Sample-6', 'Sample-7', 'Sample-8', 'Sample-9', 'Sample-10'].map((sample) => (
                        <div key={sample} className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">{sample}</span>
                            <input
                                type="text"
                                value={sampleValue[sample] || ''}
                                onChange={(e) => {
                                    const updatedValue = { ...sampleValue, [sample]: e.target.value };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                }}
                                className="w-full px-2 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    },

    renderInputNumber: (props: ObservationRenderProps) => (
        <div className="flex flex-col items-center">
            <input
                type="number"
                min={0}
                step={0.001}
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            />
            <span className="text-xs text-gray-500 mt-1">mm</span>
        </div>
    ),
};

export const laminateInspectionStage: StageData = {
    id: 16,
    name: "Laminate inspection",
    parameters: [
        {
            id: "16-1",
            parameters: "Air bubbles, delamination, foreign particles, cell breakage, edge chipping etc checked as per given spec",
            criteria: "Module acceptance criteria (visual) - VSL/QAD/SC/03",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                {
                    timeSlot: "Line-3",
                    value: ""
                },
                {
                    timeSlot: "Line-4",
                    value: ""
                }
            ],
            renderObservation: LaminateInspectionObservations.renderSerialNumbers
        },
        {
            id: "16-2",
            parameters: "Creep edge distance - Left side gap",
            criteria: "≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hours", value: "" },
                { timeSlot: "8 hours", value: "" }
            ],
            renderObservation: LaminateInspectionObservations.renderInputNumber
        },
        {
            id: "16-3",
            parameters: "Creep edge distance - Right side gap",
            criteria: "≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hours", value: "" },
                { timeSlot: "8 hours", value: "" }
            ],
            renderObservation: LaminateInspectionObservations.renderInputNumber
        },
        {
            id: "16-4",
            parameters: "Creep edge distance - Top side gap",
            criteria: "≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hours", value: "" },
                { timeSlot: "8 hours", value: "" }
            ],
            renderObservation: LaminateInspectionObservations.renderInputNumber
        },
        {
            id: "16-5",
            parameters: "Creep edge distance - Bottom side gap",
            criteria: "≥ 12 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hours", value: "" },
                { timeSlot: "8 hours", value: "" }
            ],
            renderObservation: LaminateInspectionObservations.renderInputNumber
        },
        {
            id: "16-6",
            parameters: "Space between 2 portion of half cut cell module",
            criteria: "Middle gap 15 ± 5 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hours", value: "" },
                { timeSlot: "8 hours", value: "" }
            ],
            renderObservation: LaminateInspectionObservations.renderInputNumber
        }
    ]
};