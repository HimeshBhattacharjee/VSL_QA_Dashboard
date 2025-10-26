import { StageData } from '../types/audit';

export const preLamStage: StageData = {
    id: 1,
    name: "Pre Lam Shop Floor Condition",
    parameters: [
        {
            id: "1-1",
            parameters: "Humidity",
            criteria: "≤60%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ]
        },
        {
            id: "1-2",
            parameters: "Temperature",
            criteria: "25±5°C",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ]
        },
        {
            id: "1-3",
            parameters: "Open access to shop floor",
            criteria: "No open access for dust and insects",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" } // Single observation for entire shift
            ]
        }
    ]
};