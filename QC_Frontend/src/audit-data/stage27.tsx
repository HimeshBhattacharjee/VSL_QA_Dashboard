import { StageData, ObservationRenderProps } from '../types/audit';
import { renderGroupedSampleInputs } from './sampleGroupedInputs';

const FinalELObservations = {
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

export const finalELStage: StageData = {
    id: 27,
    name: "Final EL Test",
    parameters: [
        {
            id: "27-1",
            parameters: "Interruption, Cross Cracks, Dark Areas",
            criteria: "Refer VSL/QAD/SC/04",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [],
            renderObservation: FinalELObservations.renderSerialNumbers
        }
    ]
};
