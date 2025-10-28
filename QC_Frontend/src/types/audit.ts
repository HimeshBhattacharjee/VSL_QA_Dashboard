// audit.ts
import { JSX } from "react";

export interface AuditData {
    lineNumber: string;
    date: string;
    shift: string;
    productionOrderNo: string;
    moduleType: string;
    customerSpecAvailable: boolean;
    specificationSignedOff: boolean;
    stages: StageData[];
}

export interface StageData {
    id: number;
    name: string;
    parameters: ParameterData[];
}

export interface ParameterData {
    id: string;
    parameters: string;
    criteria: string;
    typeOfInspection: string;
    inspectionFrequency: string;
    observations: ObservationData[];
    renderObservation?: (props: ObservationRenderProps) => JSX.Element;
}

export interface ObservationData {
    timeSlot: string;
    value: string | Record<string, string>; // Updated to support both string and object values
    sampleReadings?: string[];
}

export interface ObservationRenderProps {
    stageId: number;
    paramId: string;
    timeSlot: string;
    value: string | Record<string, string>; // Updated to support both string and object values
    observationData: ObservationData;
    onUpdate: (stageId: number, paramId: string, timeSlot: string, value: string | Record<string, string>) => void;
}