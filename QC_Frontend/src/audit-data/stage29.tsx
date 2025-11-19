import { StageData, ObservationRenderProps } from '../types/audit';

const FQCObservations = {
    renderSelector: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (!value) return 'bg-white';
            const upperValue = value.toUpperCase();
            if (upperValue === 'OFF') return 'bg-yellow-100';
            if (upperValue === 'CHECKED NOT OK') return 'bg-red-100';
            return 'bg-white';
        };

        return (
            <div className="w-full flex justify-center">
                <select
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                >
                    <option value="">Select</option>
                    <option value="Checked OK">Checked OK</option>
                    <option value="Checked Not OK">Checked Not OK</option>
                    <option value="OFF">OFF</option>
                </select>
            </div>
        )
    },
    renderSerialNumbers: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (!value) return 'bg-white';
            const upperValue = value.toUpperCase();
            if (upperValue === 'OFF') return 'bg-yellow-100';
            return 'bg-white';
        };

        const sampleValue = typeof props.value === 'string'
            ? {
                "Sample-1": "", "Sample-2": "", "Sample-3": "", "Sample-4": "", "Sample-5": "",
                "Sample-6": "", "Sample-7": "", "Sample-8": "", "Sample-9": "", "Sample-10": ""
            }
            : props.value as Record<string, string>;

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

export const FQCStage: StageData = {
    id: 29,
    name: "FQC",
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
        },
        {
            id: "29-2",
            parameters: "JB connector dust cover cap",
            criteria: "Verify that the JB connector is equipped with a dust cover cap",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [
                { timeSlot: "2 hours", value: "" },
                { timeSlot: "4 hours", value: "" },
                { timeSlot: "6 hours", value: "" },
                { timeSlot: "8 hours", value: "" },
            ],
            renderObservation: FQCObservations.renderSelector
        },
    ]
};