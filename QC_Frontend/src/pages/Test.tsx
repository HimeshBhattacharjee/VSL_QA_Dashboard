import { useEffect, useMemo, useState } from "react";
import { initialStages } from '../audit-data';
import { AuditData, StageData } from "../types/audit";
import { useLine } from '../context/LineContext';
import { LINE_DEPENDENT_CONFIG } from '../audit-data/lineConfig';
import { createTabbingStringingStage } from "../audit-data/stage5";
import { createAutoBussingStage } from "../audit-data/stage7";
import { createAutoTapingNLayupStage } from "../audit-data/stage8";
import { createLaminationStage } from "../audit-data/stage14";
import { createAutoTrimmingStage } from "../audit-data/stage15";
import { createAutoFramingStage } from "../audit-data/stage17";
import { createJunctionBoxFixingStage } from "../audit-data/stage18";
import { createAutoJBSolderingStage } from "../audit-data/stage19";
import { createAutoPottingStage } from "../audit-data/stage20";
import { createCuringStage } from "../audit-data/stage21";
import { createAutoFilingStage } from "../audit-data/stage22";
import { createSunSimulatorStage } from "../audit-data/stage24";
import { createSafetyTestStage } from "../audit-data/stage26";

const useLineDependentStages = (baseStages: StageData[], lineNumber: string) => {
    return useMemo(() => {
        if (!lineNumber) return baseStages;

        return baseStages.map(stage => {
            if (stage.id === 5) return createTabbingStringingStage(lineNumber);
            if (stage.id === 7) return createAutoBussingStage(lineNumber);
            if (stage.id === 8) return createAutoTapingNLayupStage(lineNumber);
            if (stage.id === 14) return createLaminationStage(lineNumber);
            if (stage.id === 15) return createAutoTrimmingStage(lineNumber);
            if (stage.id === 17) return createAutoFramingStage(lineNumber);
            if (stage.id === 18) return createJunctionBoxFixingStage(lineNumber);
            if (stage.id === 19) return createAutoJBSolderingStage(lineNumber);
            if (stage.id === 20) return createAutoPottingStage(lineNumber);
            if (stage.id === 21) return createCuringStage(lineNumber);
            if (stage.id === 22) return createAutoFilingStage(lineNumber);
            if (stage.id === 24) return createSunSimulatorStage(lineNumber);
            if (stage.id === 26) return createSafetyTestStage(lineNumber);
            const stageConfig = LINE_DEPENDENT_CONFIG[stage.id as keyof typeof LINE_DEPENDENT_CONFIG];
            if (!stageConfig) return stage;
            const lineOptions = stageConfig.lineMapping[lineNumber];
            if (!lineOptions || !Array.isArray(lineOptions)) return stage;
            return {
                ...stage,
                parameters: stage.parameters.map(param => {
                    if (stageConfig.parameters.includes(param.id)) {
                        return {
                            ...param,
                            observations: lineOptions.map((option: string) => ({
                                timeSlot: option,
                                value: ""
                            }))
                        };
                    }
                    return param;
                })
            };
        });
    }, [baseStages, lineNumber]);
};

export default function Test() {
    const stageID = 31;
    const { lineNumber, setLineNumber } = useLine();
    const lineDependentStages = useLineDependentStages(initialStages, lineNumber);
    setLineNumber('I')
    const [auditData, setAuditData] = useState<AuditData>({
        lineNumber: '',
        date: new Date().toISOString().split('T')[0],
        shift: '',
        productionOrderNo: '',
        moduleType: '',
        customerSpecAvailable: false,
        specificationSignedOff: false,
        stages: lineDependentStages
    });

    useEffect(() => {
        setAuditData(prev => ({
            ...prev,
            stages: lineDependentStages
        }));
    }, [lineDependentStages]);

    const updateObservation = (stageId: number, paramId: string, timeSlot: string, value: string | Record<string, string> | Record<string, Record<string, string>>) => {
        setAuditData(prev => ({
            ...prev,
            stages: prev.stages.map(stage =>
                stage.id === stageId ? {
                    ...stage,
                    parameters: stage.parameters.map(param =>
                        param.id === paramId ? {
                            ...param,
                            observations: param.observations.map(obs =>
                                obs.timeSlot === timeSlot ? { ...obs, value } : obs
                            )
                        } : param
                    )
                } : stage
            )
        }));
    };

    return (
        <>
            <div className="overflow-x-auto">
                {auditData.stages
                    .find(stage => stage.id === stageID)
                    ?.parameters.map((param) => (
                        <table key={param.id} className="min-w-full border border-gray-200 rounded-lg overflow-hidden mb-2">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                                        Parameters
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                                        Criteria
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                                        Type of Inspection
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                                        Inspection Frequency
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                <tr className="bg-blue-50 font-bold">
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-900 border border-gray-200">
                                        {param.parameters}
                                    </td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-900 border border-gray-200">
                                        {param.criteria}
                                    </td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-900 border border-gray-200">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${param.typeOfInspection === 'Aesthetics' ? 'bg-green-100 text-green-800' :
                                            param.typeOfInspection === 'Measurements' ? 'bg-blue-100 text-blue-800' :
                                                param.typeOfInspection === 'Functionality' ? 'bg-purple-100 text-purple-800' :
                                                    param.typeOfInspection === 'RFID Scanner' ? 'bg-cyan-100 text-cyan-800' :
                                                        'bg-gray-100 text-gray-800'
                                            }`}>
                                            {param.typeOfInspection}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-900 border border-gray-200">
                                        {param.inspectionFrequency}
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border border-gray-200">
                                        Observations
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 border border-gray-200">
                                        <div className="flex justify-center space-x-2 w-full">
                                            {param.observations.map((obs) => (
                                                <div
                                                    key={obs.timeSlot}
                                                    className={`flex flex-col items-center ${param.observations.length === 1 ? 'w-full' :
                                                        param.observations.length === 2 ? 'w-1/2' :
                                                            param.observations.length === 3 ? 'w-1/3' :
                                                                'w-1/4'}`}
                                                >
                                                    <label className="text-xs text-gray-500 mb-1">{obs.timeSlot}</label>
                                                    {param.renderObservation ? (
                                                        param.renderObservation({
                                                            stageId: stageID,
                                                            paramId: param.id,
                                                            timeSlot: obs.timeSlot,
                                                            value: obs.value,
                                                            observationData: obs,
                                                            onUpdate: updateObservation
                                                        })
                                                    ) : (
                                                        <div className="w-full flex justify-center">
                                                            {/* Handle both string and object values */}
                                                            {typeof obs.value === 'string' ? (
                                                                <input
                                                                    type="text"
                                                                    value={obs.value}
                                                                    onChange={(e) => updateObservation(stageID, param.id, obs.timeSlot, e.target.value)}
                                                                    placeholder="Enter value"
                                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                />
                                                            ) : (
                                                                <div className="text-xs text-gray-500 p-2 border border-gray-300 rounded bg-gray-50">
                                                                    Complex data structure - use custom renderer
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    ))}
            </div>
        </>
    )
}