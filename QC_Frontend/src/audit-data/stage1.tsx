import { StageData, ObservationRenderProps } from '../types/audit';

const PreLamObservations = {
    renderHumidity: (props: ObservationRenderProps) => {
        const isOff = typeof props.value === 'string' && props.value.toUpperCase() === 'OFF';

        const isWithinCriteria = () => {
            if (isOff) return true;
            const value = parseFloat(props.value as string);
            return !isNaN(value) && value <= 60;
        };

        const getBackgroundColor = () => {
            if (isOff) return 'bg-yellow-100';
            if (!props.value) return 'bg-white';
            return isWithinCriteria() ? 'bg-white' : 'bg-red-100';
        };

        return (
            <div className="flex flex-col items-center space-y-2">
                <div className="flex flex-col items-center">
                    <input
                        type="text"
                        value={props.value as string}
                        onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                        className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outine-none focus:border-blue-500 text-center shadow-sm ${getBackgroundColor()}`}
                    />
                    <span className="text-xs text-gray-500 mt-1">%</span>
                </div>
            </div>
        );
    },

    renderTemperature: (props: ObservationRenderProps) => {
        const isOff = typeof props.value === 'string' && props.value.toUpperCase() === 'OFF';

        const isWithinCriteria = () => {
            if (isOff) return true;
            const value = parseFloat(props.value as string);
            return !isNaN(value) && value >= 20 && value <= 30;
        };

        const getBackgroundColor = () => {
            if (isOff) return 'bg-yellow-100';
            if (!props.value) return 'bg-white';
            return isWithinCriteria() ? 'bg-white' : 'bg-red-100';
        };

        return (
            <div className="flex flex-col items-center space-y-2">
                <div className="flex flex-col items-center">
                    <input
                        type="text"
                        value={props.value as string}
                        onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                        className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 text-center shadow-sm ${getBackgroundColor()}`}
                    />
                    <span className="text-xs text-gray-500 mt-1">°C</span>
                </div>
            </div>
        );
    },

    renderAccessControl: (props: ObservationRenderProps) => {
        return (
            <div className="flex justify-center">
                <select
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${
                        props.value === 'Checked Not OK' ? 'bg-red-100' : 
                        props.value === 'OFF' ? 'bg-yellow-100' : 
                        'bg-white'
                    }`}
                >
                    <option value="">Select</option>
                    <option value="Checked OK">Checked OK</option>
                    <option value="Checked Not OK">Checked Not OK</option>
                    <option value="OFF">OFF</option>
                </select>
            </div>
        );
    }
};

export const preLamStage: StageData = {
    id: 1,
    name: "Pre Lam Shop Floor Condition",
    parameters: [
        {
            id: "1-1",
            parameters: "Humidity",
            criteria: "≤ 60%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: PreLamObservations.renderHumidity
        },
        {
            id: "1-2",
            parameters: "Temperature",
            criteria: "25 ± 5 °C",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: PreLamObservations.renderTemperature
        },
        {
            id: "1-3",
            parameters: "Open access to shop floor",
            criteria: "No open access for dust and insects",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: PreLamObservations.renderAccessControl
        }
    ]
};