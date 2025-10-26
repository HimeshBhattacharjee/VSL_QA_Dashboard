import { StageData } from '../types/audit';

export const cellSortingStage: StageData = {
    id: 4,
    name: "Cell Sorting",
    parameters: [
        {
            id: "4-1",
            parameters: "Cell Status",
            criteria: "As per Order (Supplier, Lot NO and Expiry date)",
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
            id: "4-2",
            parameters: "Usage Validity",
            criteria: "Use within 8 hours after opening inner packaging",
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
            id: "4-3",
            parameters: "Storage Conditions",
            criteria: "Solar cells not stacked more than 2 boxes",
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
            id: "4-4",
            parameters: "Cell Appearance",
            criteria: "Color conformity, no notch, no crack, no broken, same power level",
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
            id: "4-5",
            parameters: "Hand Gloves Change Frequency",
            criteria: "Change after 8 hrs or if tearing/damage",
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
            id: "4-6",
            parameters: "Cell Dimensions",
            criteria: "Length & Width ±0.5mm, Thickness ±20μm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ]
        }
    ]
};