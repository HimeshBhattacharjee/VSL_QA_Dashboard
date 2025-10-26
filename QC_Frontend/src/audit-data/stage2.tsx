import { StageData } from '../types/audit';

export const autoFrontGlassStage: StageData = {
    id: 2,
    name: "Auto Front Glass Loading",
    parameters: [
        {
            id: "2-1",
            parameters: "Front Glass Status",
            criteria: "Supplier, Lot No. and Expiry date",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ]
        },
        {
            id: "2-2",
            parameters: "Glass Surface Quality (Refer - Doc. No.: VSL/PDN/SP/49)",
            criteria: "No nail deep, scratch, smooth edge and corners, textured finish, no spot, rainbow & textured upwards",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ]
        },
        {
            id: "2-3",
            parameters: "Vacuum Cup Condition",
            criteria: "Vacuum cup should not be damaged",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ]
        },
        {
            id: "2-4",
            parameters: "Length",
            criteria: "As per Engg. drawing ±1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ]
        },
        {
            id: "2-5",
            parameters: "Width",
            criteria: "As per Engg. drawing ±1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ]
        },
        {
            id: "2-6",
            parameters: "Thickness",
            criteria: "As per Engg. drawing ±0.2mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ]
        }
    ]
};