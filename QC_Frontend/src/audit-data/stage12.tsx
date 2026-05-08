import { StageData, ObservationRenderProps } from '../types/audit';
import { renderGroupedSampleInputs } from './sampleGroupedInputs';

const PreLamELVisualObservations = {
    renderSerialNumbers: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';

        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            return 'bg-white';
        };

        return renderGroupedSampleInputs(props, getBackgroundColor);
    }
};

export const preLamELVisualStage: StageData = {
    id: 12,
    name: "Pre-Lam EL & Visual",
    parameters: [
        {
            id: "12-1",
            parameters: "Pre Lam EL (Module acceptance criteria Pre-Lamination EL)",
            criteria: "VSL/QAD/SC/07",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [],
            renderObservation: PreLamELVisualObservations.renderSerialNumbers
        },
        {
            id: "12-2",
            parameters: "Pre Lam Visual (Module acceptance criteria Pre-Lamination Visual)",
            criteria: "VSL/QAD/SC/03",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 2 hours",
            observations: [],
            renderObservation: PreLamELVisualObservations.renderSerialNumbers
        }
    ]
};
