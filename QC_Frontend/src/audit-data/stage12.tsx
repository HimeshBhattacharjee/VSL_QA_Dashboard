import { StageData, ObservationRenderProps } from '../types/audit';

const PreLamELVisualObservations = {
    renderSerialNumbers: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? {
                "Sample-1": "", "Sample-2": "", "Sample-3": "", "Sample-4": "", "Sample-5": "",
                "Sample-6": "", "Sample-7": "", "Sample-8": "", "Sample-9": "", "Sample-10": ""
            }
            : props.value as Record<string, string>;

        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col rounded-lg bg-white shadow-sm border border-gray-400">
                <div className="flex flex-row justify-between p-2 gap-2">
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
                                className={`w-full px-2 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(sampleValue[sample] || '')}`}
                            />
                        </div>
                    ))}
                </div>
                <div className="flex flex-row justify-between gap-2 p-2">
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
                                className={`w-full px-2 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(sampleValue[sample] || '')}`}
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
            parameters: "Pre Lam EL (Module acceptance criteria Pre-Lamination EL)",
            criteria: "VSL/QAD/SC/07",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [],
            renderObservation: PreLamELVisualObservations.renderSerialNumbers
        },
        {
            id: "12-2",
            parameters: "Pre Lam Visual (Module acceptance criteria Pre-Lamination Visual)",
            criteria: "VSL/QAD/SC/03",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [],
            renderObservation: PreLamELVisualObservations.renderSerialNumbers
        }
    ]
};