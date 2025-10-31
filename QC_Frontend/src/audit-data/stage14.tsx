// stage14.tsx
import { StageData, ObservationRenderProps } from '../types/audit';

const LaminationObservations = {
    renderLaminatorParameters: (props: ObservationRenderProps) => {
        const laminatorData = typeof props.value === 'string'
            ? {
                "upper": {
                    "Chamber_1_Pumping": "",
                    "Chamber_1_PressingCooling": "",
                    "Chamber_1_Venting": "",
                    "Chamber_1_LowerTemp": "",
                    "Chamber_1_UpperTemp": "",
                    "Chamber_2_Pumping": "",
                    "Chamber_2_PressingCooling": "",
                    "Chamber_2_Venting": "",
                    "Chamber_2_LowerTemp": "",
                    "Chamber_2_UpperTemp": "",
                    "Chamber_3_Pumping": "",
                    "Chamber_3_PressingCooling": "",
                    "Chamber_3_Venting": "",
                    "Chamber_3_LowerTemp": "",
                    "Chamber_3_UpperTemp": ""
                },
                "lower": {
                    "Chamber_1_Pumping": "",
                    "Chamber_1_PressingCooling": "",
                    "Chamber_1_Venting": "",
                    "Chamber_1_LowerTemp": "",
                    "Chamber_1_UpperTemp": "",
                    "Chamber_2_Pumping": "",
                    "Chamber_2_PressingCooling": "",
                    "Chamber_2_Venting": "",
                    "Chamber_2_LowerTemp": "",
                    "Chamber_2_UpperTemp": "",
                    "Chamber_3_Pumping": "",
                    "Chamber_3_PressingCooling": "",
                    "Chamber_3_Venting": "",
                    "Chamber_3_LowerTemp": "",
                    "Chamber_3_UpperTemp": ""
                }
            }
            : props.value as any;

        const updateUpperParameter = (field: string, value: string) => {
            const updatedValue = {
                ...laminatorData,
                upper: { ...laminatorData.upper, [field]: value }
            };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        const updateLowerParameter = (field: string, value: string) => {
            const updatedValue = {
                ...laminatorData,
                lower: { ...laminatorData.lower, [field]: value }
            };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        const updateRecipe = (recipe: string) => {
            const updatedValue = {
                ...laminatorData,
                selectedRecipe: recipe
            };
            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
        };

        // Reusable table component with horizontal scrolling
        const LaminatorTable = ({ title, data, onUpdate, type }: {
            title: string;
            data: any;
            onUpdate: (field: string, value: string) => void;
            type: 'upper' | 'lower';
        }) => (
            <div className="flex flex-col rounded-lg bg-white shadow-sm border border-gray-400 p-2">
                <div className="text-lg font-semibold text-gray-800 mb-2 text-center border-b pb-2">
                    {title}
                </div>

                {/* Scrollable container for high resolutions */}
                <div className="w-full overflow-x-auto 2xl:overflow-x-visible">
                    <div className="min-w-[600px] 2xl:min-w-0">
                        {/* Table Header */}
                        <div className="grid grid-cols-6 gap-2 mb-2 text-xs items-center font-medium text-gray-700 border-b pb-2">
                            <div className="col-span-1">Chamber</div>
                            <div className="col-span-1">Pumping</div>
                            <div className="col-span-1">Pressing/Cooling</div>
                            <div className="col-span-1">Venting</div>
                            <div className="col-span-1">Lower Temp (˚C)</div>
                            <div className="col-span-1">Upper Temp (˚C)</div>
                        </div>

                        {/* Chamber Rows */}
                        {[1, 2, 3].map((chamberNum) => (
                            <div key={chamberNum} className="grid grid-cols-6 gap-2 mb-2 items-center">
                                <div className="col-span-1 text-sm text-gray-600">Chamber {chamberNum}</div>
                                <div className="col-span-1">
                                    <input
                                        type="number"
                                        value={data[`Chamber_${chamberNum}_Pumping`] || ''}
                                        onChange={(e) => onUpdate(`${type}_Chamber_${chamberNum}_Pumping`, e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Pumping"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <input
                                        type="number"
                                        value={data[`Chamber_${chamberNum}_PressingCooling`] || ''}
                                        onChange={(e) => onUpdate(`${type}_Chamber_${chamberNum}_PressingCooling`, e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Pressing/Cooling"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <input
                                        type="number"
                                        value={data[`Chamber_${chamberNum}_Venting`] || ''}
                                        onChange={(e) => onUpdate(`${type}_Chamber_${chamberNum}_Venting`, e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Venting"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <input
                                        type="number"
                                        value={data[`Chamber_${chamberNum}_LowerTemp`] || ''}
                                        onChange={(e) => onUpdate(`${type}_Chamber_${chamberNum}_LowerTemp`, e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="˚C"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <input
                                        type="number"
                                        value={data[`Chamber_${chamberNum}_UpperTemp`] || ''}
                                        onChange={(e) => onUpdate(`${type}_Chamber_${chamberNum}_UpperTemp`, e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="˚C"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );

        return (
            <div className="flex flex-col gap-2">
                {/* Recipe Selection */}
                <div className="flex items-center justify-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Select Recipe:</span>
                    <select
                        value={laminatorData.selectedRecipe || ''}
                        onChange={(e) => updateRecipe(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                    >
                        <option value="">Select Recipe</option>
                        <option value="1">Recipe 1</option>
                        <option value="2">Recipe 2</option>
                        <option value="3">Recipe 3</option>
                        <option value="4">Recipe 4</option>
                        <option value="5">Recipe 5</option>
                        <option value="6">Recipe 6</option>
                    </select>
                </div>

                <div className="grid gap-2">
                    {/* Upper Laminator */}
                    <LaminatorTable
                        title="Upper"
                        data={laminatorData.upper}
                        onUpdate={updateUpperParameter}
                        type="upper"
                    />

                    {/* Lower Laminator */}
                    <LaminatorTable
                        title="Lower"
                        data={laminatorData.lower}
                        onUpdate={updateLowerParameter}
                        type="lower"
                    />
                </div>
            </div>
        );
    }
};

export const laminationStage: StageData = {
    id: 14,
    name: "Lamination Process",
    parameters: [
        {
            id: "14-1",
            parameters: "Laminator-5 Machine Setup as per Recipe",
            criteria: "Lamination process parameter spec. - VSL/PDN/SC/22",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                {
                    timeSlot: "",
                    value: {
                        "upper": {
                            "Chamber_1_Pumping": "",
                            "Chamber_1_PressingCooling": "",
                            "Chamber_1_Venting": "",
                            "Chamber_1_LowerTemp": "",
                            "Chamber_1_UpperTemp": "",
                            "Chamber_2_Pumping": "",
                            "Chamber_2_PressingCooling": "",
                            "Chamber_2_Venting": "",
                            "Chamber_2_LowerTemp": "",
                            "Chamber_2_UpperTemp": "",
                            "Chamber_3_Pumping": "",
                            "Chamber_3_PressingCooling": "",
                            "Chamber_3_Venting": "",
                            "Chamber_3_LowerTemp": "",
                            "Chamber_3_UpperTemp": ""
                        },
                        "lower": {
                            "Chamber_1_Pumping": "",
                            "Chamber_1_PressingCooling": "",
                            "Chamber_1_Venting": "",
                            "Chamber_1_LowerTemp": "",
                            "Chamber_1_UpperTemp": "",
                            "Chamber_2_Pumping": "",
                            "Chamber_2_PressingCooling": "",
                            "Chamber_2_Venting": "",
                            "Chamber_2_LowerTemp": "",
                            "Chamber_2_UpperTemp": "",
                            "Chamber_3_Pumping": "",
                            "Chamber_3_PressingCooling": "",
                            "Chamber_3_Venting": "",
                            "Chamber_3_LowerTemp": "",
                            "Chamber_3_UpperTemp": ""
                        }
                    }
                }
            ],
            renderObservation: LaminationObservations.renderLaminatorParameters
        },
        {
            id: "14-2",
            parameters: "Laminator-6 Machine Setup as per Recipe",
            criteria: "Lamination process parameter spec. - VSL/PDN/SC/22",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                {
                    timeSlot: "",
                    value: {
                        "upper": {
                            "Chamber_1_Pumping": "",
                            "Chamber_1_PressingCooling": "",
                            "Chamber_1_Venting": "",
                            "Chamber_1_LowerTemp": "",
                            "Chamber_1_UpperTemp": "",
                            "Chamber_2_Pumping": "",
                            "Chamber_2_PressingCooling": "",
                            "Chamber_2_Venting": "",
                            "Chamber_2_LowerTemp": "",
                            "Chamber_2_UpperTemp": "",
                            "Chamber_3_Pumping": "",
                            "Chamber_3_PressingCooling": "",
                            "Chamber_3_Venting": "",
                            "Chamber_3_LowerTemp": "",
                            "Chamber_3_UpperTemp": ""
                        },
                        "lower": {
                            "Chamber_1_Pumping": "",
                            "Chamber_1_PressingCooling": "",
                            "Chamber_1_Venting": "",
                            "Chamber_1_LowerTemp": "",
                            "Chamber_1_UpperTemp": "",
                            "Chamber_2_Pumping": "",
                            "Chamber_2_PressingCooling": "",
                            "Chamber_2_Venting": "",
                            "Chamber_2_LowerTemp": "",
                            "Chamber_2_UpperTemp": "",
                            "Chamber_3_Pumping": "",
                            "Chamber_3_PressingCooling": "",
                            "Chamber_3_Venting": "",
                            "Chamber_3_LowerTemp": "",
                            "Chamber_3_UpperTemp": ""
                        }
                    }
                }
            ],
            renderObservation: LaminationObservations.renderLaminatorParameters
        },
        {
            id: "14-3",
            parameters: "Laminator-7 Machine Setup as per Recipe",
            criteria: "Lamination process parameter spec. - VSL/PDN/SC/22",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                {
                    timeSlot: "",
                    value: {
                        "upper": {
                            "Chamber_1_Pumping": "",
                            "Chamber_1_PressingCooling": "",
                            "Chamber_1_Venting": "",
                            "Chamber_1_LowerTemp": "",
                            "Chamber_1_UpperTemp": "",
                            "Chamber_2_Pumping": "",
                            "Chamber_2_PressingCooling": "",
                            "Chamber_2_Venting": "",
                            "Chamber_2_LowerTemp": "",
                            "Chamber_2_UpperTemp": "",
                            "Chamber_3_Pumping": "",
                            "Chamber_3_PressingCooling": "",
                            "Chamber_3_Venting": "",
                            "Chamber_3_LowerTemp": "",
                            "Chamber_3_UpperTemp": ""
                        },
                        "lower": {
                            "Chamber_1_Pumping": "",
                            "Chamber_1_PressingCooling": "",
                            "Chamber_1_Venting": "",
                            "Chamber_1_LowerTemp": "",
                            "Chamber_1_UpperTemp": "",
                            "Chamber_2_Pumping": "",
                            "Chamber_2_PressingCooling": "",
                            "Chamber_2_Venting": "",
                            "Chamber_2_LowerTemp": "",
                            "Chamber_2_UpperTemp": "",
                            "Chamber_3_Pumping": "",
                            "Chamber_3_PressingCooling": "",
                            "Chamber_3_Venting": "",
                            "Chamber_3_LowerTemp": "",
                            "Chamber_3_UpperTemp": ""
                        }
                    }
                }
            ],
            renderObservation: LaminationObservations.renderLaminatorParameters
        },
        {
            id: "14-4",
            parameters: "Laminator-8 Machine Setup as per Recipe",
            criteria: "Lamination process parameter spec. - VSL/PDN/SC/22",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                {
                    timeSlot: "",
                    value: {
                        "upper": {
                            "Chamber_1_Pumping": "",
                            "Chamber_1_PressingCooling": "",
                            "Chamber_1_Venting": "",
                            "Chamber_1_LowerTemp": "",
                            "Chamber_1_UpperTemp": "",
                            "Chamber_2_Pumping": "",
                            "Chamber_2_PressingCooling": "",
                            "Chamber_2_Venting": "",
                            "Chamber_2_LowerTemp": "",
                            "Chamber_2_UpperTemp": "",
                            "Chamber_3_Pumping": "",
                            "Chamber_3_PressingCooling": "",
                            "Chamber_3_Venting": "",
                            "Chamber_3_LowerTemp": "",
                            "Chamber_3_UpperTemp": ""
                        },
                        "lower": {
                            "Chamber_1_Pumping": "",
                            "Chamber_1_PressingCooling": "",
                            "Chamber_1_Venting": "",
                            "Chamber_1_LowerTemp": "",
                            "Chamber_1_UpperTemp": "",
                            "Chamber_2_Pumping": "",
                            "Chamber_2_PressingCooling": "",
                            "Chamber_2_Venting": "",
                            "Chamber_2_LowerTemp": "",
                            "Chamber_2_UpperTemp": "",
                            "Chamber_3_Pumping": "",
                            "Chamber_3_PressingCooling": "",
                            "Chamber_3_Venting": "",
                            "Chamber_3_LowerTemp": "",
                            "Chamber_3_UpperTemp": ""
                        }
                    }
                }
            ],
            renderObservation: LaminationObservations.renderLaminatorParameters
        }
    ]
};