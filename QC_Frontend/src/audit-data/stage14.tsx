import { StageData, ObservationRenderProps } from '../types/audit';
import { useState, useEffect, useCallback } from 'react';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';

const getLaminatorConfiguration = (lineNumber: string): string[] => {
    const stageConfig = LINE_DEPENDENT_CONFIG[14];
    if (!stageConfig) {
        return lineNumber === 'I' ? ['Laminator-1', 'Laminator-2', 'Laminator-3', 'Laminator-4']
            : ['Laminator-5', 'Laminator-6', 'Laminator-7', 'Laminator-8'];
    }
    const lineOptions = stageConfig.lineMapping[lineNumber];
    return Array.isArray(lineOptions) ? lineOptions :
        lineNumber === 'I' ? ['Laminator-1', 'Laminator-2', 'Laminator-3', 'Laminator-4']
            : ['Laminator-5', 'Laminator-6', 'Laminator-7', 'Laminator-8'];
};

const LaminatorParametersComponent = (props: ObservationRenderProps & { lineNumber?: string }) => {
    const defaultLaminatorData = {
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
            "Chamber_3_UpperTemp": "",
            "selectedRecipeUpper": ""
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
            "Chamber_3_UpperTemp": "",
            "selectedRecipeLower": ""
        }
    };

    const [localData, setLocalData] = useState(() => {
        if (typeof props.value === 'string' || !props.value) return defaultLaminatorData;
        return { ...defaultLaminatorData, ...props.value };
    });

    const [isUpperOffMode, setIsUpperOffMode] = useState(false);
    const [isLowerOffMode, setIsLowerOffMode] = useState(false);

    useEffect(() => {
        if (props.value && typeof props.value === 'object' && !Array.isArray(props.value)) {
            const valueObj = props.value as Record<string, any>;
            setLocalData(prev => ({ ...prev, ...valueObj }));
        }
    }, [props.value]);

    // Check if OFF mode should be active for upper and lower sections
    useEffect(() => {
        const upperIsOff = localData.upper?.selectedRecipeUpper?.toUpperCase() === 'OFF';
        const lowerIsOff = localData.lower?.selectedRecipeLower?.toUpperCase() === 'OFF';
        setIsUpperOffMode(upperIsOff);
        setIsLowerOffMode(lowerIsOff);
    }, [localData.upper?.selectedRecipeUpper, localData.lower?.selectedRecipeLower]);

    const updateParent = useCallback((newData: any) => {
        props.onUpdate(props.stageId, props.paramId, props.timeSlot, newData);
    }, [props.stageId, props.paramId, props.timeSlot, props.onUpdate]);

    const updateUpperParameter = useCallback((field: string, value: string) => {
        const updatedData = {
            ...localData,
            upper: { ...localData.upper, [field]: value }
        };
        setLocalData(updatedData);
        updateParent(updatedData);
    }, [localData, updateParent]);

    const updateLowerParameter = useCallback((field: string, value: string) => {
        const updatedData = {
            ...localData,
            lower: { ...localData.lower, [field]: value }
        };
        setLocalData(updatedData);
        updateParent(updatedData);
    }, [localData, updateParent]);

    const updateUpperRecipe = useCallback((recipe: string) => {
        const updatedData = {
            ...localData,
            upper: { ...localData.upper, selectedRecipeUpper: recipe }
        };
        setLocalData(updatedData);
        updateParent(updatedData);
    }, [localData, updateParent]);

    const updateLowerRecipe = useCallback((recipe: string) => {
        const updatedData = {
            ...localData,
            lower: { ...localData.lower, selectedRecipeLower: recipe }
        };
        setLocalData(updatedData);
        updateParent(updatedData);
    }, [localData, updateParent]);

    const getSelectClassName = (isOff: boolean): string => {
        const baseClass = "px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 bg-white shadow-sm";
        return isOff ? `${baseClass} bg-yellow-100` : baseClass;
    };

    const getBackgroundColor = (value: string) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';
        if (isOff(value)) return 'bg-yellow-100';
        return 'bg-white';
    };

    const LaminatorTable = useCallback(({ title, lamNo, data, onUpdate, selectedRecipe, onRecipeUpdate, isOffMode }: {
        title: string; lamNo: string; data: any; isOffMode: boolean;
        onUpdate: (field: string, value: string) => void;
        onRecipeUpdate: (recipe: string) => void;
        selectedRecipe: string;
    }) => (
        <div className="flex flex-col rounded-lg bg-white shadow-sm border border-gray-400 p-2">
            <div className="flex items-center justify-between mb-2 border-b pb-2">
                <div className="text-lg font-semibold text-gray-800">
                    Laminator - {lamNo} {title}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Recipe:</span>
                    <select
                        value={selectedRecipe || ''}
                        onChange={(e) => onRecipeUpdate(e.target.value)}
                        className={getSelectClassName(isOffMode)}
                    >
                        <option value="">Select Recipe</option>
                        <option value="1">Recipe 1</option>
                        <option value="2">Recipe 2</option>
                        <option value="3">Recipe 3</option>
                        <option value="4">Recipe 4</option>
                        <option value="5">Recipe 5</option>
                        <option value="OFF">OFF</option>
                    </select>
                </div>
            </div>
            
            {!isOffMode ? (
                <div className="w-full overflow-x-auto 2xl:overflow-x-visible">
                    <div className="min-w-[600px] 2xl:min-w-0">
                        <div className="grid grid-cols-6 gap-2 mb-2 text-xs items-center font-medium text-gray-700 border-b pb-2">
                            <div className="col-span-1">Chamber</div>
                            <div className="col-span-1">Pumping</div>
                            <div className="col-span-1">Pressing/Cooling</div>
                            <div className="col-span-1">Venting</div>
                            <div className="col-span-1">Lower Temp (˚C)</div>
                            <div className="col-span-1">Upper Temp (˚C)</div>
                        </div>
                        {[1, 2, 3].map((chamberNum) => (
                            <div key={chamberNum} className="grid grid-cols-6 gap-2 mb-2 items-center">
                                <div className="col-span-1 text-sm text-gray-600">Chamber {chamberNum}</div>
                                <div className="col-span-1">
                                    <input
                                        type="text"
                                        value={data[`Chamber_${chamberNum}_Pumping`] || ''}
                                        onChange={(e) => onUpdate(`Chamber_${chamberNum}_Pumping`, e.target.value)}
                                        className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 ${getBackgroundColor(data[`Chamber_${chamberNum}_Pumping`] || '')}`}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <input
                                        type="text"
                                        value={data[`Chamber_${chamberNum}_PressingCooling`] || ''}
                                        onChange={(e) => onUpdate(`Chamber_${chamberNum}_PressingCooling`, e.target.value)}
                                        className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 ${getBackgroundColor(data[`Chamber_${chamberNum}_PressingCooling`] || '')}`}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <input
                                        type="text"
                                        value={data[`Chamber_${chamberNum}_Venting`] || ''}
                                        onChange={(e) => onUpdate(`Chamber_${chamberNum}_Venting`, e.target.value)}
                                        className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 ${getBackgroundColor(data[`Chamber_${chamberNum}_Venting`] || '')}`}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <input
                                        type="text"
                                        value={data[`Chamber_${chamberNum}_LowerTemp`] || ''}
                                        onChange={(e) => onUpdate(`Chamber_${chamberNum}_LowerTemp`, e.target.value)}
                                        className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 ${getBackgroundColor(data[`Chamber_${chamberNum}_LowerTemp`] || '')}`}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <input
                                        type="text"
                                        value={data[`Chamber_${chamberNum}_UpperTemp`] || ''}
                                        onChange={(e) => onUpdate(`Chamber_${chamberNum}_UpperTemp`, e.target.value)}
                                        className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 ${getBackgroundColor(data[`Chamber_${chamberNum}_UpperTemp`] || '')}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center bg-yellow-100 rounded-lg border border-yellow-300 py-4">
                    <p className="text-yellow-800 font-medium">{title} Laminator is OFF - Parameters are hidden</p>
                </div>
            )}
        </div>
    ), []);

    return (
        <div className="flex flex-col gap-4">
            <LaminatorTable
                title="Upper"
                lamNo={props.paramId[props.paramId.length - 1]}
                data={localData.upper}
                onUpdate={updateUpperParameter}
                onRecipeUpdate={updateUpperRecipe}
                selectedRecipe={localData.upper?.selectedRecipeUpper || ''}
                isOffMode={isUpperOffMode}
            />
            <LaminatorTable
                title="Lower"
                lamNo={props.paramId[props.paramId.length - 1]}
                data={localData.lower}
                onUpdate={updateLowerParameter}
                onRecipeUpdate={updateLowerRecipe}
                selectedRecipe={localData.lower?.selectedRecipeLower || ''}
                isOffMode={isLowerOffMode}
            />
        </div>
    );
};

const LaminationObservations = {
    renderLaminatorParameters: (props: ObservationRenderProps & { lineNumber?: string }) => {
        return <LaminatorParametersComponent {...props} />;
    }
};

export const createLaminationStage = (lineNumber: string): StageData => {
    const laminators = getLaminatorConfiguration(lineNumber);

    return {
        id: 14,
        name: "Lamination Process",
        parameters: laminators.map((laminator, index) => ({
            id: `14-${index + 1}-${laminator.toLowerCase().replace('-', '')}`,
            parameters: `${laminator} Machine Setup as per Recipe`,
            criteria: "Lamination process parameter spec. - VSL/PDN/SC/22",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [{ timeSlot: "", value: "" }],
            renderObservation: (props: ObservationRenderProps) =>
                LaminationObservations.renderLaminatorParameters({ ...props, lineNumber })
        }))
    };
};

export const laminationStage: StageData = createLaminationStage('II');