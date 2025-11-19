import { StageData, ObservationRenderProps } from '../types/audit';

const RearGlassLoadingObservations = {
    renderRearGlassLoadingStatus: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col space-y-1">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
            </div>
        );
    },

    renderSupplier: (props: ObservationRenderProps) => {
        const isNA = (value: string) => value === 'N/A';

        const getBackgroundColor = (value: string) => {
            if (isNA(value)) return 'bg-yellow-100';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col space-y-1">
                <select
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                >
                    <option value="">Select</option>
                    <option value="Xinyi Solar">Xinyi Solar</option>
                    <option value="CSG Holding Co., Ltd.">CSG Holding Co., Ltd.</option>
                    <option value="Gurjat Borosil">Gurjat Borosil</option>
                    <option value="Kibing Group">Kibing Group</option>
                    <option value="Flat Glass Group Co., Ltd">Flat Glass Group Co., Ltd</option>
                    <option value="Henan Ancai Hi-Tech Co., Ltd">Henan Ancai Hi-Tech Co., Ltd</option>
                    <option value="N/A">N/A</option>
                </select>
            </div>
        );
    },

    renderExpiryDate: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (value) {
                const inputDate = new Date(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                inputDate.setHours(0, 0, 0, 0);
                if (inputDate < today) return 'bg-red-100';
            }
            return 'bg-white';
        };

        return (
            <div className="flex flex-col space-y-1">
                <input
                    type="date"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
            </div>
        );
    },

    renderUsageValidity: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';
        const isExpired = (value: string) => value === 'Expired';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (isExpired(value)) return 'bg-red-100';
            return 'bg-white';
        };

        return (
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
            >
                <option value="">Select Status</option>
                <option value="Within 4 hours">Within 4 hours</option>
                <option value="Within 8 hours">Within 8 hours</option>
                <option value="Expired">Expired</option>
                <option value="OFF">OFF</option>
            </select>
        );
    },

    renderAestheticCondition: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? { "Sample-1": "", "Sample-2": "", "Sample-3": "", "Sample-4": "", "Sample-5": "", "Sample-6": "" }
            : props.value as Record<string, string>;

        const getBackgroundColor = (value: string) => {
            if (value === 'OFF') return 'bg-yellow-100';
            if (value === 'Checked Not OK') return 'bg-red-100';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col rounded-lg bg-white shadow-sm border border-gray-200">
                <div className="flex justify-between p-2 gap-2">
                    {['Sample-1', 'Sample-2', 'Sample-3'].map((sample) => (
                        <div key={sample} className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">{sample}</span>
                            <select
                                value={sampleValue[sample] || ''}
                                onChange={(e) => {
                                    const updatedValue = { ...sampleValue, [sample]: e.target.value };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                }}
                                className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(sampleValue[sample] || '')}`}
                            >
                                <option value="">Select</option>
                                <option value="Checked OK">Checked OK</option>
                                <option value="Checked Not OK">Checked Not OK</option>
                                <option value="OFF">OFF</option>
                            </select>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between p-2 gap-2">
                    {['Sample-4', 'Sample-5', 'Sample-6'].map((sample) => (
                        <div key={sample} className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">{sample}</span>
                            <select
                                value={sampleValue[sample] || ''}
                                onChange={(e) => {
                                    const updatedValue = { ...sampleValue, [sample]: e.target.value };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                }}
                                className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(sampleValue[sample] || '')}`}
                            >
                                <option value="">Select</option>
                                <option value="Checked OK">Checked OK</option>
                                <option value="Checked Not OK">Checked Not OK</option>
                                <option value="OFF">OFF</option>
                            </select>
                        </div>
                    ))}
                </div>
            </div>
        );
    },

    renderDimensions: (props: ObservationRenderProps) => {
        const sampleValue = typeof props.value === 'string'
            ? { "Sample-1": "", "Sample-2": "", "Sample-3": "", "Sample-4": "" }
            : props.value as Record<string, string>;

        const isOff = (value: string) => {
            return typeof value === 'string' && value.toUpperCase() === 'OFF';
        };

        const getBackgroundColor = (value: string, criteria?: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';

            if (criteria) {
                const numValue = parseFloat(value);
                if (isNaN(numValue)) return 'bg-white';

                // Length & Width: ± 1mm
                if (criteria.includes('± 1mm')) {
                    // This would need a target value to calculate deviation
                    // For now, just return white as we don't have the target
                    return 'bg-white';
                }

                // Thickness: ± 0.2 mm
                if (criteria.includes('± 0.2mm')) {
                    // This would need a target value to calculate deviation
                    // For now, just return white as we don't have the target
                    return 'bg-white';
                }
            }

            return 'bg-white';
        };

        const getCriteria = () => {
            if (props.paramId === '11-3') return '± 1mm';
            if (props.paramId === '11-4') return '± 1mm';
            if (props.paramId === '11-5') return '± 0.2mm';
            return '';
        };

        const criteria = getCriteria();

        return (
            <div className="flex flex-col p-2 rounded-lg bg-white shadow-sm border border-gray-200">
                <div className="flex justify-between p-2 gap-2">
                    {['Sample-1', 'Sample-2', 'Sample-3', 'Sample-4'].map((sample) => (
                        <div key={sample} className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 mb-1">{sample}</span>
                            <input
                                type="text"
                                value={sampleValue[sample] || ''}
                                onChange={(e) => {
                                    const updatedValue = { ...sampleValue, [sample]: e.target.value };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                }}
                                className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(sampleValue[sample] || '', criteria)}`}
                            />
                            <span className="text-xs text-gray-500 mt-1">mm</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    },

    renderInputNumber: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col items-center">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
                <span className="text-xs text-gray-500 mt-1">mm</span>
            </div>
        );
    },
};

export const rearGlassLoadingStage: StageData = {
    id: 11,
    name: "Rear Glass Loading",
    parameters: [
        {
            id: "11-1",
            parameters: "Rear Glass Status",
            criteria: "Supplier, Type, Lot No. and Expiry Date",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "Type", value: "" },
                { timeSlot: "Lot No.", value: "" },
                { timeSlot: "Expiry Date", value: "" }
            ],
            renderObservation: (props: ObservationRenderProps) => {
                if (props.timeSlot === "Supplier") return RearGlassLoadingObservations.renderSupplier(props);
                else if (props.timeSlot === "Expiry Date") return RearGlassLoadingObservations.renderExpiryDate(props);
                return RearGlassLoadingObservations.renderRearGlassLoadingStatus(props);
            }
        },
        {
            id: "11-2",
            parameters: "Rear Glass Aesthetic Condition",
            criteria: "Ensure terminal shouldn't get bend and check the string to string gap and also paste the back side barcode on 5 no. string position on middle of the module",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [{ timeSlot: "4 hours", value: "" }, { timeSlot: "8 hours", value: "" }],
            renderObservation: RearGlassLoadingObservations.renderAestheticCondition
        },
        {
            id: "11-3",
            parameters: "Length",
            criteria: "As per Engg. drawing  ± 1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [],
            renderObservation: RearGlassLoadingObservations.renderDimensions
        },
        {
            id: "11-4",
            parameters: "Width",
            criteria: "As per Engg. drawing  ± 1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [],
            renderObservation: RearGlassLoadingObservations.renderDimensions
        },
        {
            id: "11-5",
            parameters: "Thickness",
            criteria: "As per Engg. drawing  ± 0.2mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [],
            renderObservation: RearGlassLoadingObservations.renderDimensions
        },
        {
            id: "11-6",
            parameters: "Glass Alignment",
            criteria: "For Frame less module : error ≤3mm; For Framed module : error ≤1.5mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [{ timeSlot: "4 hours", value: "" }, { timeSlot: "8 hours", value: "" }],
            renderObservation: RearGlassLoadingObservations.renderInputNumber
        }
    ]
};