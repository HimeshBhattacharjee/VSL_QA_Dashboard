import { StageData, ObservationRenderProps } from '../types/audit';

const RFIDObservations = {
    renderSelector: (props: ObservationRenderProps) => (
        <div className="w-full flex justify-center">
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            >
                <option value="">Select</option>
                <option value="OK">Checked Ok</option>
                <option value="NG">Checked Not OK</option>
                <option value="OFF">OFF</option>
            </select>
        </div>
    )
};

export const rfidStage: StageData = {
    id: 25,
    name: "RFID",
    parameters: [
        {
            id: "25-1",
            parameters: "Fixing position",
            criteria: "As per production Order",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: RFIDObservations.renderSelector
        },
        {
            id: "25-2",
            parameters: "RFID read & write process",
            criteria: "Tag should be read & write\nContent should comply MNRE guideline",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hours",
            observations: [
                { timeSlot: "4 hrs", value: "" },
                { timeSlot: "8 hrs", value: "" }
            ],
            renderObservation: RFIDObservations.renderSelector
        },
        {
            id: "25-3",
            parameters: "RFID ITEMS",
            criteria: "Module Serial Number, Name Of The Manufacturer Of PV Module, Month & Year Of The Manufacture Of Module, Country Of Origin For PV Module, Power: Pmpp Of The Module, Current: Imp of The Module, Isc of the Module, Module Model Number, Name of The Manufacturer Of Solar Cell, Month & Year of The Manufacture Of Solar Cell, Country of Origin For Solar Cell, Voltage: Vmpp of The Module, Fill Factor (FF) of The Module, Voc of The Module, Name of The Test Lab Issuing IEC Certificate, Date Of Obtaining IEC Certificate, IV Curve",
            typeOfInspection: "RFID Scanner",
            inspectionFrequency: "Every shift",
            observations: [{ timeSlot: "", value: "" }],
            renderObservation: RFIDObservations.renderSelector
        }
    ]
};