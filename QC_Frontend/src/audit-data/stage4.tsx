import { StageData, ObservationRenderProps } from '../types/audit';

const CellSortingObservations = {
    renderCellStatus: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';
        const isNA = (value: string) => value.toUpperCase() === 'N/A';
        const isNG = (value: string) => value.toUpperCase() === 'NG';

        const getBackgroundColor = (value: string) => {
            if (isOff(value) || isNA(value)) return 'bg-yellow-100';
            if (isNG(value)) return 'bg-red-100';
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
        const isNA = (value: string) => value === 'NA';

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
                    <option value="AIKO">Aiko</option>
                    <option value="JTPV">JTPV</option>
                    <option value="SNP">Solar N-Plus</option>
                    <option value="YINGFA">Yingfa</option>
                    <option value="SS">Solar space</option>
                    <option value="NA">N/A</option>
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
                <option value="">Select</option>
                <option value="4_hrs">Used within 4 hrs</option>
                <option value="8_hrs">Used within 8 hrs</option>
                <option value="Expired">Expired</option>
                <option value="OFF">OFF</option>
            </select>
        );
    },

    renderStorageConditions: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (value === 'OFF') return 'bg-yellow-100';
            if (value === 'Non-Compliant') return 'bg-red-100';
            return 'bg-white';
        };

        return (
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
            >
                <option value="">Select</option>
                <option value="Compliant">Compliant</option>
                <option value="Non-Compliant">Non-Compliant</option>
                <option value="OFF">OFF</option>
            </select>
        );
    },

    renderCellAppearance: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (value === 'OFF') return 'bg-yellow-100';
            if (value === 'NG') return 'bg-red-100';
            return 'bg-white';
        };

        return (
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
            >
                <option value="">Select</option>
                <option value="OK">Checked OK</option>
                <option value="NG">Checked Not OK</option>
                <option value="OFF">OFF</option>
            </select>
        );
    },

    renderGlovesChange: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (value === 'OFF') return 'bg-yellow-100';
            if (value === 'Not Changed') return 'bg-red-100';
            return 'bg-white';
        };

        return (
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
            >
                <option value="">Select</option>
                <option value="Changed">New Hand Gloves Used</option>
                <option value="Not Changed">Hand Gloves Not Changed</option>
                <option value="OFF">OFF</option>
            </select>
        );
    },

    renderCellDimensions: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
        };

        return (
            <div className="flex flex-col items-center">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
                <span className="text-xs text-gray-500 mt-1">
                    {props.timeSlot.includes('Thickness') ? 'μm' : 'mm'}
                </span>
            </div>
        );
    }
};

export const cellSortingStage: StageData = {
    id: 4,
    name: "Cell Sorting",
    parameters: [
        {
            id: "4-1",
            parameters: "Cell Status",
            criteria: "As per Order (Supplier, Watt Peak, Lot No. and Expiry Date)",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "WP", value: "" },
                { timeSlot: "Lot No.", value: "" },
                { timeSlot: "Expiry Date", value: "" }
            ],
            renderObservation: (props: ObservationRenderProps) => {
                if (props.timeSlot === "Supplier") return CellSortingObservations.renderSupplier(props);
                else if (props.timeSlot === "Expiry Date") return CellSortingObservations.renderExpiryDate(props);
                return CellSortingObservations.renderCellStatus(props);
            }
        },
        {
            id: "4-2",
            parameters: "Usage Validity",
            criteria: "Use within 8 hours after opening inner packaging",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: CellSortingObservations.renderUsageValidity
        },
        {
            id: "4-3",
            parameters: "Storage Conditions",
            criteria: "Solar cells not stacked more than 2 boxes",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: CellSortingObservations.renderStorageConditions
        },
        {
            id: "4-4",
            parameters: "Cell Appearance",
            criteria: "Color conformity, no notch, no crack, no broken, same power level, efficiency as per specs",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: CellSortingObservations.renderCellAppearance
        },
        {
            id: "4-5",
            parameters: "Hand Gloves Change Frequency",
            criteria: "Change after 8 hrs or in case of tearing/damage",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: CellSortingObservations.renderGlovesChange
        },
        {
            id: "4-6",
            parameters: "Cell Dimensions",
            criteria: "Length & Width ±0.5mm, Thickness ±20μm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Length", value: "" },
                { timeSlot: "Width", value: "" },
                { timeSlot: "Thickness", value: "" }
            ],
            renderObservation: CellSortingObservations.renderCellDimensions
        }
    ]
};