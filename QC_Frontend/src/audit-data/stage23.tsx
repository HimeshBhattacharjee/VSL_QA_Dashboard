import { StageData, ObservationRenderProps } from '../types/audit';
import { renderGroupedSampleInputs } from './sampleGroupedInputs';

const CleaningObservations = {
    renderSerialNumbers: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (!value) return 'bg-white';
            const upperValue = value.toUpperCase();
            if (upperValue === 'OFF') return 'bg-yellow-100';
            return 'bg-white';
        };

        return renderGroupedSampleInputs(props, getBackgroundColor);
    }
};

export const cleaningStage: StageData = {
    id: 23,
    name: "Cleaning",
    parameters: [
        {
            id: "23-1",
            parameters: "Module Cleanliness",
            criteria: "No dirt, glue melted, Encapsulant on glass & frame",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [],
            renderObservation: CleaningObservations.renderSerialNumbers
        }
    ]
};
