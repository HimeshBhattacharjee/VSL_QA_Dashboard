import { StageData, ObservationRenderProps } from '../types/audit';

const OfflineLaserObservations = {
    renderSelector: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (value === 'OFF') return 'bg-yellow-100';
            if (value === 'Checked Not OK') return 'bg-red-100';
            return 'bg-white';
        };

        return (
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
        );
    },

    renderInputNumber: (props: ObservationRenderProps & { min?: number, max?: number, unit?: string }) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';
        
        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            
            if (props.min !== undefined && props.max !== undefined) {
                if (numValue < props.min || numValue > props.max) return 'bg-red-100';
            }
            
            return 'bg-white';
        };

        return (
            <div className="flex flex-col items-center">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
                {props.unit && (
                    <span className="text-xs text-gray-500 mt-1">{props.unit}</span>
                )}
            </div>
        );
    },

    renderFrequencyInput: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            
            // Slot laser frequency: 110 ± 50 KHz → 60 to 160 KHz
            if (props.timeSlot === "Slot laser frequency (KHz )") {
                return (numValue >= 60 && numValue <= 160) ? 'bg-white' : 'bg-red-100';
            }
            
            return 'bg-white';
        };

        return (
            <div className="flex flex-col items-center">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
                <span className="text-xs text-gray-500 mt-1">
                    {props.timeSlot.includes("KHz") ? "KHz" : 
                     props.timeSlot.includes("%") ? "%" : 
                     props.timeSlot.includes("℃") ? "℃" : ""}
                </span>
            </div>
        );
    },

    renderLaserPowerInput: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            
            if (props.timeSlot === "Slot Laser power (%)") {
                // Slot Laser power range 90% ± 10% → 80% to 100%
                return (numValue >= 80 && numValue <= 100) ? 'bg-white' : 'bg-red-100';
            } else if (props.timeSlot === "Hot Cracking Laser Power (%)") {
                // Hot Cracking Laser Power range=50%±20% → 30% to 70%
                return (numValue >= 30 && numValue <= 70) ? 'bg-white' : 'bg-red-100';
            }
            
            return 'bg-white';
        };

        return (
            <div className="flex flex-col items-center">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
                <span className="text-xs text-gray-500 mt-1">%</span>
            </div>
        );
    },

    renderTemperatureInput: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            
            // Unloading blower heater temp.=120℃±30℃ → 90℃ to 150℃
            if (props.timeSlot === "Unloading blower heater temp. (℃)") {
                return (numValue >= 90 && numValue <= 150) ? 'bg-white' : 'bg-red-100';
            }
            
            return 'bg-white';
        };

        return (
            <div className="flex flex-col items-center">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
                <span className="text-xs text-gray-500 mt-1">℃</span>
            </div>
        );
    },

    renderWidthMeasurement: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            
            // Specific tolerance between Left & Right side width ± 0.1mm
            // This would need to compare left and right measurements
            // For now, just accept the value
            return 'bg-white';
        };

        return (
            <div className="flex flex-col items-center">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
                <span className="text-xs text-gray-500 mt-1">mm</span>
            </div>
        );
    },

    renderLaserCuttingLength: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            
            // Specific tolerance 5 ± 3mm → 2mm to 8mm
            return (numValue >= 2 && numValue <= 8) ? 'bg-white' : 'bg-red-100';
        };

        return (
            <div className="flex flex-col items-center">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
                <span className="text-xs text-gray-500 mt-1">mm</span>
            </div>
        );
    }
};

export const offlineLaserCellCuttingStage: StageData = {
    id: 1, // Using ID 1 as this will be inserted at the beginning for Line-I
    name: "Offline Laser Cell Cutting",
    parameters: [
        {
            id: "1-1",
            parameters: "Machine Current Power",
            criteria: "Slot laser frequency 110 ± 50 KHz, Slot Laser power range 90% ± 10%, Hot Cracking Laser Power range=50%±20%, Unloading blower heater temp.=120℃±30℃",
            typeOfInspection: "Machine current power",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Slot laser frequency (KHz )", value: "" },
                { timeSlot: "Slot Laser power (%)", value: "" },
                { timeSlot: "Hot Cracking Laser Power (%)", value: "" },
                { timeSlot: "Unloading blower heater temp. (℃)", value: "" }
            ],
            renderObservation: (props: ObservationRenderProps) => {
                if (props.timeSlot === "Slot laser frequency (KHz )") {
                    return <OfflineLaserObservations.renderFrequencyInput {...props} />;
                } else if (props.timeSlot === "Slot Laser power (%)" || props.timeSlot === "Hot Cracking Laser Power (%)") {
                    return <OfflineLaserObservations.renderLaserPowerInput {...props} />;
                } else if (props.timeSlot === "Unloading blower heater temp. (℃)") {
                    return <OfflineLaserObservations.renderTemperatureInput {...props} />;
                }
                return <OfflineLaserObservations.renderInputNumber {...props} />;
            }
        },
        {
            id: "1-2",
            parameters: "Cell Appearance",
            criteria: "Free from chip, rough edge, cross cut, crack etc.",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: OfflineLaserObservations.renderSelector
        },
        {
            id: "1-3",
            parameters: "Cell Width Measurements",
            criteria: "Specific tolerance between Left & Right side width ± 0.1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "Upper Half Left", value: "" },
                { timeSlot: "Upper Half Right", value: "" },
                { timeSlot: "Lower Half Left", value: "" },
                { timeSlot: "Lower Half Right", value: "" }
            ],
            renderObservation: OfflineLaserObservations.renderWidthMeasurement
        },
        {
            id: "1-4",
            parameters: "Slot Laser Laser Cutting Length",
            criteria: "Specific tolerance 5 ± 3mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "", // Not specified in Excel, will be determined
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: OfflineLaserObservations.renderLaserCuttingLength
        }
    ]
};