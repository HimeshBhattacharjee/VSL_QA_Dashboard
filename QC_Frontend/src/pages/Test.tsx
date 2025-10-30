import { useState } from "react";
import { initialStages } from '../audit-data';
import { AuditData } from "../types/audit";

export default function Test() {
    const stageID = 13;

    const [auditData, setAuditData] = useState<AuditData>({
        lineNumber: '',
        date: new Date().toISOString().split('T')[0],
        shift: '',
        productionOrderNo: '',
        moduleType: '',
        customerSpecAvailable: false,
        specificationSignedOff: false,
        stages: initialStages
    });

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
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Parameters
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Criteria
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type of Inspection
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Inspection Frequency
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Observations
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {auditData.stages
                            .find(stage => stage.id === stageID)
                            ?.parameters.map((param) => (
                                <tr key={param.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-900">
                                        {param.parameters}
                                    </td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-900">
                                        {param.criteria}
                                    </td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-900">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${param.typeOfInspection === 'Aesthetics' ? 'bg-green-100 text-green-800' :
                                            param.typeOfInspection === 'Measurements' ? 'bg-blue-100 text-blue-800' :
                                                param.typeOfInspection === 'Functionality' ? 'bg-purple-100 text-purple-800' :
                                                    'bg-gray-100 text-gray-800'
                                            }`}>
                                            {param.typeOfInspection}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-900">
                                        {param.inspectionFrequency}
                                    </td>
                                    <td className="px-6 py-4">
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
                                                            paramId: param.id, // Fixed: should be param.id, not param.parameters
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
                            ))}
                    </tbody>
                </table>
            </div>
        </>
    )
}