import { StageData, ObservationRenderProps } from '../types/audit';

const BackSheetObservations = {
    renderBackSheetStatus: (props: ObservationRenderProps) => {
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
                    <option value="Hangzhou First PV Material Co., Ltd">Hangzhou First PV Material Co., Ltd</option>
                    <option value="Vietnam Advance Film Material Company Ltd">Vietnam Advance Film Material Company Ltd</option>
                    <option value="First Material Science (Thailand) Co., Ltd">First Material Science (Thailand) Co., Ltd</option>
                    <option value="Cybrid Technologies Pvt. Ltd">Cybrid Technologies Pvt. Ltd</option>
                    <option value="Cymax PTE. Ltd">Cymax PTE. Ltd</option>
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
                <option value="">Select</option>
                <option value="Within 4 hours">Within 4 hours</option>
                <option value="Within 8 hours">Within 8 hours</option>
                <option value="Expired">Expired</option>
                <option value="OFF">OFF</option>
            </select>
        );
    },

    renderAestheticCondition: (props: ObservationRenderProps) => {
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

                // Length & Width: ± 2mm
                if (criteria.includes('± 2mm')) {
                    // This would need a target value to calculate deviation
                    // For now, just return white as we don't have the target
                    return 'bg-white';
                }

                // Thickness: ± 0.05 mm
                if (criteria.includes('± 0.05 mm')) {
                    // This would need a target value to calculate deviation
                    // For now, just return white as we don't have the target
                    return 'bg-white';
                }
            }

            return 'bg-white';
        };

        const getCriteria = () => {
            if (props.paramId === '10-4') return '± 2mm';
            if (props.paramId === '10-5') return '± 2mm';
            if (props.paramId === '10-6') return '± 0.05 mm';
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
    }
};

export const backSheetStage: StageData = {
    id: 10,
    name: "Backsheet Cutting",
    parameters: [
        {
            id: "10-1",
            parameters: "Backsheet Status",
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
                if (props.timeSlot === "Supplier") return BackSheetObservations.renderSupplier(props);
                if (props.timeSlot === "Expiry Date") return BackSheetObservations.renderExpiryDate(props);
                return BackSheetObservations.renderBackSheetStatus(props);
            }
        },
        {
            id: "10-2",
            parameters: "Usage validity",
            criteria: "Use within 8 hours after opening of the inner packaging",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: BackSheetObservations.renderUsageValidity
        },
        {
            id: "10-3",
            parameters: "Backsheet aesthetic condition",
            criteria: "No hair, dust and foreign particle, deep cut, damage outer layer",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hours", value: "" },
                { timeSlot: "8 hours", value: "" }
            ],
            renderObservation: BackSheetObservations.renderAestheticCondition
        },
        {
            id: "10-4",
            parameters: "Length",
            criteria: "± 2mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [],
            renderObservation: BackSheetObservations.renderDimensions
        },
        {
            id: "10-5",
            parameters: "Width",
            criteria: "± 2mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [],
            renderObservation: BackSheetObservations.renderDimensions
        },
        {
            id: "10-6",
            parameters: "Thickness",
            criteria: "± 0.05 mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [],
            renderObservation: BackSheetObservations.renderDimensions
        }
    ]
};