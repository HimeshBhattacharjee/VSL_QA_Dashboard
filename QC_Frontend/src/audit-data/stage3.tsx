import { StageData } from '../types/audit';

export const frontEncapsulantStage: StageData = {
    id: 3,
    name: "Front Encapsulant Storage & Cutting",
    parameters: [
        {
            id: "3-1",
            parameters: "Storage Humidity",
            criteria: "≤60%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hrs",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ]
        },
        {
            id: "3-2",
            parameters: "Storage Temperature",
            criteria: "25±5°C",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hrs",
            observations: [
                { timeSlot: "2 hrs", value: "" },
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "6 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ]
        },
        {
            id: "3-3",
            parameters: "Encapsulant Status",
            criteria: "Supplier, Lot NO and Expiry date",
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
            id: "3-4",
            parameters: "Usage Validity",
            criteria: "Use within 8 hours after opening inner packaging",
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
            id: "3-5",
            parameters: "Encapsulant Alignment",
            criteria: "±5mm",
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
            id: "3-6",
            parameters: "Aesthetic Condition",
            criteria: "No hair, dust, foreign particle, deep cut, damage outer layer",
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
            id: "3-7",
            parameters: "Length",
            criteria: "±2mm",
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
            id: "3-8",
            parameters: "Width",
            criteria: "±2mm",
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
            id: "3-9",
            parameters: "Thickness",
            criteria: "±0.05mm",
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