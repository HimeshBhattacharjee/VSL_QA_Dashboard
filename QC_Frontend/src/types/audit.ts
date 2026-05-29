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
    signatures?: {
        auditBy: string;
        reviewedBy: string;
        auditByImage?: string;
        reviewedByImage?: string;
    };
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

export interface SampleGroupedSampleValue {
    parameterId: string;
    sampleGroup: string;
    sampleNumber: number;
    sampleLabel: string;
    value: string;
}

export interface SampleGroupedGroupValue {
    groupKey: string;
    groupLabel: string;
    order: number;
    selectedLine?: string;
    samples: SampleGroupedSampleValue[];
}

export interface SampleGroupedValue {
    schemaVersion: 1;
    sampleGroups: SampleGroupedGroupValue[];
}

export type ObservationValue = string | Record<string, string> | Record<string, Record<string, string>> | SampleGroupedValue;

export interface ObservationData {
    timeSlot: string;
    value: ObservationValue;
    sampleReadings?: string[];
    selectedLine?: string;
    lineMapping?: Record<string, string>;
}

export interface ObservationRenderProps {
    stageId: number;
    paramId: string;
    timeSlot: string;
    value: ObservationValue;
    observationData: ObservationData;
    onUpdate: (stageId: number, paramId: string, timeSlot: string, value: ObservationValue) => void;
    lineOptions?: string[];
    onLineMappingUpdate?: (stageId: number, paramId: string, timeSlot: string, groupKey: string, selectedLine: string) => void;
}
