import { StageData, ObservationRenderProps } from '../types/audit';

const PreLamELVisualObservations = {
    renderSerialNumbers: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Sample-1": "", "Sample-2": "", "Sample-3": "",
                "Sample-4": "", "Sample-5": "", "Sample-6": ""
            }
            : props.value as Record<string, string>;

        return (
            <div className="flex flex-col rounded-lg bg-white shadow-sm border border-gray-400">
                {/* Top 3 samples */}
                <div className="flex justify-between p-2 gap-2">
                    {['Sample-1', 'Sample-2', 'Sample-3'].map((sample) => (
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
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                            />
                        </div>
                    ))}
                </div>

                {/* Bottom 3 samples */}
                <div className="flex justify-between p-2">
                    {['Sample-4', 'Sample-5', 'Sample-6'].map((sample) => (
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
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    }
};

export const preLamELVisualStage: StageData = {
    id: 12,
    name: "Pre-Lam EL & Visual",
    parameters: [
        {
            id: "12-1",
            parameters: "Pre Lam EL",
            criteria: "As per module acceptance criteria pre lamination EL test",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                {
                    timeSlot: "Line-3",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": "",
                        "Sample-5": "",
                        "Sample-6": ""
                    }
                },
                {
                    timeSlot: "Line-4",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": "",
                        "Sample-5": "",
                        "Sample-6": ""
                    }
                }
            ],
            renderObservation: PreLamELVisualObservations.renderSerialNumbers
        },
        {
            id: "12-2",
            parameters: "Pre Lam Visual",
            criteria: "AS per module acceptance criteria (visual)",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                {
                    timeSlot: "Line-3",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": "",
                        "Sample-5": "",
                        "Sample-6": ""
                    }
                },
                {
                    timeSlot: "Line-4",
                    value: {
                        "Sample-1": "",
                        "Sample-2": "",
                        "Sample-3": "",
                        "Sample-4": "",
                        "Sample-5": "",
                        "Sample-6": ""
                    }
                }
            ],
            renderObservation: PreLamELVisualObservations.renderSerialNumbers
        }
    ]
};