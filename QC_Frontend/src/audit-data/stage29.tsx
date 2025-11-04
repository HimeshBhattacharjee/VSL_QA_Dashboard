import { StageData, ObservationRenderProps } from '../types/audit';

const FQCObservations = {
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
                                placeholder="Enter sl no."
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
                                placeholder="Enter sl no."
                                className="w-full px-2 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    }
};

export const FQCStage: StageData = {
    id: 29,
    name: "Final EL Test",
    parameters: [
        {
            id: "29-1",
            parameters: "FQC as per module acceptance criteria",
            criteria: "Refer VSL/QAD/SC/03",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "Line-3", value: "" },
                { timeSlot: "Line-4", value: "" }
            ],
            renderObservation: FQCObservations.renderSerialNumbers
        }
    ]
};