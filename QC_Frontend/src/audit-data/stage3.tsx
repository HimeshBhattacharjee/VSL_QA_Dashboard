import { StageData, ObservationRenderProps } from '../types/audit';

const FrontEncapsulantObservations = {
    renderStorageConditions: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            if (props.paramId === '3-1') return numValue > 60 ? 'bg-red-100' : 'bg-white';
            else if (props.paramId === '3-2') return (numValue < 20 || numValue > 30) ? 'bg-red-100' : 'bg-white';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col items-center">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
                <span className="text-xs text-gray-500 mt-1">
                    {props.paramId === '3-1' ? '%' : '°C'}
                </span>
            </div>
        );
    },

    renderEncapsulantStatus: (props: ObservationRenderProps) => {
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
        const getBackgroundColor = (value: string) => {
            if (value === 'OFF') return 'bg-yellow-100';
            if (value === 'Expired') return 'bg-red-100';
            return 'bg-white';
        };

        return (
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
            >
                <option value="">Select Validity</option>
                <option value="Used within 4 hrs">Used within 4 hrs</option>
                <option value="Used within 8 hrs">Used within 8 hrs</option>
                <option value="Expired">Expired</option>
                <option value="OFF">OFF</option>
            </select>
        );
    },

    renderAlignment: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            return (numValue < -5 || numValue > 5) ? 'bg-red-100' : 'bg-white';
        };

        return (
            <div className="flex flex-col items-center">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
                <span className="text-xs text-gray-500 mt-1">mm</span>
            </div>
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
                <div className="flex justify-between px-2 py-2 gap-2">
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
                <div className="flex justify-between px-2 py-2 gap-2">
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
                    className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
                <span className="text-xs text-gray-500 mt-1">mm</span>
            </div>
        );
    }
};

export const frontEncapsulantStage: StageData = {
    id: 3,
    name: "Front Encapsulant Storage & Cutting",
    parameters: [
        {
            id: "3-1",
            parameters: "Storage Humidity",
            criteria: "≤ 60%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hrs",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderStorageConditions
        },
        {
            id: "3-2",
            parameters: "Storage Temperature",
            criteria: "25 ± 5 °C",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hrs",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderStorageConditions
        },
        {
            id: "3-3",
            parameters: "Encapsulant Status",
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
                if (props.timeSlot === "Supplier") return FrontEncapsulantObservations.renderSupplier(props);
                if (props.timeSlot === "Expiry Date") return FrontEncapsulantObservations.renderExpiryDate(props);
                return FrontEncapsulantObservations.renderEncapsulantStatus(props);
            }
        },
        {
            id: "3-4",
            parameters: "Usage Validity",
            criteria: "Use within 8 hours after opening inner packaging",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderUsageValidity
        },
        {
            id: "3-5",
            parameters: "Encapsulant Alignment",
            criteria: "±5mm",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderAlignment
        },
        {
            id: "3-6",
            parameters: "Aesthetic Condition",
            criteria: "No hair, dust, foreign particle, deep cut, damage outer layer",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: FrontEncapsulantObservations.renderAestheticCondition
        },
        {
            id: "3-7",
            parameters: "Length",
            criteria: "±2mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [],
            renderObservation: FrontEncapsulantObservations.renderDimensions
        },
        {
            id: "3-8",
            parameters: "Width",
            criteria: "±2mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [],
            renderObservation: FrontEncapsulantObservations.renderDimensions
        },
        {
            id: "3-9",
            parameters: "Thickness",
            criteria: "±0.05mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [],
            renderObservation: FrontEncapsulantObservations.renderDimensions
        }
    ]
};