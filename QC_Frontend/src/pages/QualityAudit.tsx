import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { initialStages } from '../audit-data';
import { AuditData, StageData, ParameterData, ObservationData } from '../types/audit';

export default function QualityAudit() {
    const navigate = useNavigate();
    const [activeStage, setActiveStage] = useState<number>(1);
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

    const handleBackToHome = () => navigate('/home');

    const updateObservation = (stageId: number, paramId: string, timeSlot: string, value: string) => {
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

    const generatePDFReport = () => {
        // This would integrate with a PDF generation library
        console.log('Generating PDF with data:', auditData);
        // Show preview modal or download PDF
    };

    return (
        <div className="pb-4">
            <Header />
            <div className="max-w-7xl mx-4">
                <div className="text-center mb-6">
                    <button
                        onClick={handleBackToHome}
                        className="bg-white/20 text-white border-2 border-white px-4 py-1 rounded-3xl cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-x-1"
                    >
                        <span className="font-bold text-md">⇐</span> Back to Home
                    </button>
                </div>

                {/* Basic Information Card */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-2">
                    <div className="flex flex-wrap gap-4">

                        {/* Report Name with Line Selector */}
                        <div className="w-full">
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <span className="text-md text-gray-800 font-medium">
                                    Inprocess Quality Audit Report - FAB - II LINE -
                                </span>
                                <select
                                    value={auditData.lineNumber}
                                    onChange={(e) =>
                                        setAuditData({ ...auditData, lineNumber: e.target.value })
                                    }
                                    className="text-sm p-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                >
                                    <option value="">Select</option>
                                    <option value="I">I</option>
                                    <option value="II">II</option>
                                    <option value="III">III</option>
                                    <option value="IV">IV</option>
                                </select>
                            </div>
                        </div>

                        {/* Date */}
                        <div className="w-full sm:w-[48%] lg:w-[23%]">
                            <label className="block text-xs font-medium text-gray-700">Date</label>
                            <input
                                type="date"
                                value={auditData.date}
                                onChange={(e) =>
                                    setAuditData({ ...auditData, date: e.target.value })
                                }
                                className="mt-1 p-1 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>

                        {/* Shift */}
                        <div className="w-full sm:w-[48%] lg:w-[23%]">
                            <label className="block text-xs font-medium text-gray-700">Shift</label>
                            <select
                                value={auditData.shift}
                                onChange={(e) =>
                                    setAuditData({ ...auditData, shift: e.target.value })
                                }
                                className="mt-1 p-1 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            >
                                <option value="">Select Shift</option>
                                <option value="A">Shift-A</option>
                                <option value="B">Shift-B</option>
                                <option value="C">Shift-C</option>
                            </select>
                        </div>

                        {/* Production Order No. */}
                        <div className="w-full sm:w-[48%] lg:w-[23%]">
                            <label className="block text-xs font-medium text-gray-700">
                                Production Order No.
                            </label>
                            <input
                                type="text"
                                value={auditData.productionOrderNo}
                                onChange={(e) =>
                                    setAuditData({ ...auditData, productionOrderNo: e.target.value })
                                }
                                className="mt-1 p-1 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>

                        {/* Module Type as Text Input */}
                        <div className="w-full sm:w-[48%] lg:w-[23%]">
                            <label className="block text-xs font-medium text-gray-700">Module Type</label>
                            <input
                                type="text"
                                value={auditData.moduleType}
                                onChange={(e) =>
                                    setAuditData({ ...auditData, moduleType: e.target.value })
                                }
                                className="mt-1 p-1 text-sm block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>

                        {/* Checkboxes */}
                        <div className="w-full flex flex-row justify-start gap-10">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={auditData.customerSpecAvailable}
                                    onChange={(e) =>
                                        setAuditData({ ...auditData, customerSpecAvailable: e.target.checked })
                                    }
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Customer Specification Available</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={auditData.specificationSignedOff}
                                    onChange={(e) =>
                                        setAuditData({ ...auditData, specificationSignedOff: e.target.checked })
                                    }
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Specification Signed Off With Customer</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Stage Navigation */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-2">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {auditData.stages.map((stage) => (
                            <button
                                key={stage.id}
                                onClick={() => setActiveStage(stage.id)}
                                className={`w-[1/5] p-2 rounded-lg transition-colors ${activeStage === stage.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                {stage.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Active Stage Content */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    {auditData.stages
                        .filter(stage => stage.id === activeStage)
                        .map(stage => (
                            <div key={stage.id}>
                                <div className="bg-blue-600 text-white px-6 py-4">
                                    <h2 className="text-xl font-semibold">{stage.name}</h2>
                                </div>

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
                                            {stage.parameters.map((param) => (
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
                                                        <div className="flex space-x-2">
                                                            {param.observations.map((obs) => (
                                                                <div key={obs.timeSlot} className="flex flex-col">
                                                                    <label className="text-xs text-gray-500 mb-1">{obs.timeSlot}</label>
                                                                    <input
                                                                        type="text"
                                                                        value={obs.value}
                                                                        onChange={(e) => updateObservation(stage.id, param.id, obs.timeSlot, e.target.value)}
                                                                        placeholder="Enter value"
                                                                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between mt-2">
                    <button
                        onClick={() => setActiveStage(prev => Math.max(1, prev - 1))}
                        disabled={activeStage === 1}
                        className="px-6 py-2 bg-gray-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                        Previous Stage
                    </button>

                    <button
                        onClick={generatePDFReport}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Generate Audit Report
                    </button>

                    <button
                        onClick={() => setActiveStage(prev => Math.min(auditData.stages.length, prev + 1))}
                        disabled={activeStage === auditData.stages.length}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                    >
                        Next Stage
                    </button>
                </div>
            </div>

            <div id="alert-container" className="fixed top-5 right-5 z-50 w-80"></div>
        </div>
    );
}