import { StageData, ObservationRenderProps } from '../types/audit';

const PreLamObservations = {
    renderHumidity: (props: ObservationRenderProps) => {
        const isOff = props.value === 'OFF';

        const handleToggle = (off: boolean) => {
            if (off) props.onUpdate(props.stageId, props.paramId, props.timeSlot, 'OFF');
            else props.onUpdate(props.stageId, props.paramId, props.timeSlot, '');
        };

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
            <div className="w-full flex flex-col items-center space-y-2">
                <div className="flex items-center space-x-2">
                    <div className="relative inline-block">
                        <input
                            type="checkbox"
                            checked={!isOff}
                            onChange={(e) => handleToggle(!e.target.checked)}
                            className="sr-only"
                            id={`humidity-toggle-${props.timeSlot}`}
                        />
                        <label
                            htmlFor={`humidity-toggle-${props.timeSlot}`}
                            className={`block w-12 h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                                !isOff ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                        >
                            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${
                                !isOff ? 'transform translate-x-6' : ''
                            }`} />
                        </label>
                    </div>
                </div>
                <div className="flex flex-col items-center">
                    {isOff ? (
                        <div className="px-2 py-1 border border-gray-300 rounded text-sm text-center bg-yellow-100 shadow-sm items-center justify-center w-full">
                            OFF
                        </div>
                    ) : (
                        <input
                            type="number"
                            value={props.value as string}
                            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center shadow-sm ${getBackgroundColor()}`}
                            min="0"
                            max="100"
                            step="0.1"
                        />
                    )}
                    <span className="text-xs text-gray-500 mt-1">%</span>
                </div>
            </div>
        );
    },

    renderTemperature: (props: ObservationRenderProps) => {
        const isOff = props.value === 'OFF';

        const handleToggle = (off: boolean) => {
            if (off) props.onUpdate(props.stageId, props.paramId, props.timeSlot, 'OFF');
            else props.onUpdate(props.stageId, props.paramId, props.timeSlot, '');
        };

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
            <div className="w-full flex flex-col items-center space-y-2">
                <div className="flex items-center space-x-2">
                    <div className="relative inline-block">
                        <input
                            type="checkbox"
                            checked={!isOff}
                            onChange={(e) => handleToggle(!e.target.checked)}
                            className="sr-only"
                            id={`temperature-toggle-${props.timeSlot}`}
                        />
                        <label
                            htmlFor={`temperature-toggle-${props.timeSlot}`}
                            className={`block w-12 h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                                !isOff ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                        >
                            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${
                                !isOff ? 'transform translate-x-6' : ''
                            }`} />
                        </label>
                    </div>
                </div>
                <div className="flex flex-col items-center">
                    {isOff ? (
                        <div className="px-2 py-1 border border-gray-300 rounded text-sm text-center bg-yellow-100 shadow-sm items-center justify-center w-full">
                            OFF
                        </div>
                    ) : (
                        <input
                            type="number"
                            value={props.value as string}
                            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                            className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center shadow-sm ${getBackgroundColor()}`}
                            min="0"
                            max="100"
                            step="0.1"
                        />
                    )}
                    <span className="text-xs text-gray-500 mt-1">°C</span>
                </div>
            </div>
        );
    },

    renderAccessControl: (props: ObservationRenderProps) => {
        return (
            <div className="w-full flex justify-center">
                <select
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${
                        props.value === 'NG' ? 'bg-red-100' : 
                        props.value === 'OFF' ? 'bg-yellow-100' : 
                        'bg-white'
                    }`}
                >
                    <option value="">Select</option>
                    <option value="OK">Checked OK</option>
                    <option value="NG">Checked Not OK</option>
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