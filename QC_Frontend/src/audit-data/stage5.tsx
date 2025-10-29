import { StageData, ObservationRenderProps } from '../types/audit';

const TabbingStringingObservations = {
    renderInputText: (props: ObservationRenderProps) => (
        <div className="flex flex-col space-y-1">
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            />
        </div>
    ),

    renderSelector: (props: ObservationRenderProps) => (
        <select
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
            <option value="">Select Status</option>
            <option value="OK">Checked OK</option>
            <option value="NG">Checked NG</option>
            <option value="NA">N/A</option>
        </select>
    ),

    renderInputNumber: (props: ObservationRenderProps) => (
        <input
            type="number"
            min={0}
            step={0.001}
            value={props.value as string}
            onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            placeholder="Value"
        />
    ),

    renderStringerSection: (props: ObservationRenderProps) => {
        const stringerData = props.value as Record<string, string>;
        const stringerNumber = parseInt(props.timeSlot.replace('Stringer-', ''));

        // Determine if this stringer goes in top or bottom half
        const isTopHalf = stringerNumber >= 7 && stringerNumber <= 9;

        return (
            <div className={`border rounded-lg p-2 ${isTopHalf ? 'bg-blue-50' : 'bg-green-50'}`}>
                <h4 className="font-semibold text-center mb-2 text-sm">{props.timeSlot}</h4>
                <div className="grid grid-cols-2 gap-1">
                    {Object.entries(stringerData).map(([key, value]) => (
                        <div key={key} className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">{key}</label>
                            {props.paramId.includes('laser-power') && (
                                <TabbingStringingObservations.renderInputNumber
                                    {...props}
                                    value={value}
                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                        const updatedData = { ...stringerData, [key]: newValue as string };
                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                    }}
                                />
                            )}
                            {props.paramId.includes('cell-appearance') && (
                                <TabbingStringingObservations.renderSelector
                                    {...props}
                                    value={value}
                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                        const updatedData = { ...stringerData, [key]: newValue as string };
                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                    }}
                                />
                            )}
                            {props.paramId.includes('cell-width') && (
                                <TabbingStringingObservations.renderInputNumber
                                    {...props}
                                    value={value}
                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                        const updatedData = { ...stringerData, [key]: newValue as string };
                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                    }}
                                />
                            )}
                            {props.paramId.includes('groove-length') && (
                                <TabbingStringingObservations.renderInputNumber
                                    {...props}
                                    value={value}
                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                        const updatedData = { ...stringerData, [key]: newValue as string };
                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    },

    renderCombinedStringerSection: (props: ObservationRenderProps) => {
        const allStringerData = props.value as Record<string, Record<string, string>>;

        return (
            <div className="flex flex-col space-y-4">
                {/* Top Row - Stringers 7-9 */}
                <div className="border rounded-lg p-3 bg-blue-50">
                    <div className="grid grid-cols-3 gap-3">
                        {[7, 8, 9].map(stringerNumber => (
                            <div key={stringerNumber} className="border rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <div className="grid grid-cols-2 gap-1">
                                    {Object.entries(allStringerData[`Stringer-${stringerNumber}`] || {}).map(([key, value]) => (
                                        <div key={key} className="flex flex-col">
                                            <label className="text-xs text-gray-600 mb-1">{key}</label>
                                            {props.paramId.includes('laser-power') && (
                                                <TabbingStringingObservations.renderInputNumber
                                                    {...props}
                                                    value={value}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: newValue as string
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            )}
                                            {props.paramId.includes('cell-appearance') && (
                                                <TabbingStringingObservations.renderSelector
                                                    {...props}
                                                    value={value}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: newValue as string
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            )}
                                            {props.paramId.includes('cell-width') && (
                                                <TabbingStringingObservations.renderInputNumber
                                                    {...props}
                                                    value={value}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: newValue as string
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            )}
                                            {props.paramId.includes('groove-length') && (
                                                <TabbingStringingObservations.renderInputNumber
                                                    {...props}
                                                    value={value}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: newValue as string
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Row - Stringers 10-12 */}
                <div className="border rounded-lg p-3 bg-green-50">
                    <div className="grid grid-cols-3 gap-3">
                        {[10, 11, 12].map(stringerNumber => (
                            <div key={stringerNumber} className="border rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <div className="grid grid-cols-2 gap-1">
                                    {Object.entries(allStringerData[`Stringer-${stringerNumber}`] || {}).map(([key, value]) => (
                                        <div key={key} className="flex flex-col">
                                            <label className="text-xs text-gray-600 mb-1">{key}</label>
                                            {props.paramId.includes('laser-power') && (
                                                <TabbingStringingObservations.renderInputNumber
                                                    {...props}
                                                    value={value}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: newValue as string
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            )}
                                            {props.paramId.includes('cell-appearance') && (
                                                <TabbingStringingObservations.renderSelector
                                                    {...props}
                                                    value={value}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: newValue as string
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            )}
                                            {props.paramId.includes('cell-width') && (
                                                <TabbingStringingObservations.renderInputNumber
                                                    {...props}
                                                    value={value}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: newValue as string
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            )}
                                            {props.paramId.includes('groove-length') && (
                                                <TabbingStringingObservations.renderInputNumber
                                                    {...props}
                                                    value={value}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: newValue as string
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
};

// Create combined parameters for all stringers
const createCombinedStringerParameters = () => {
    const allStringersData: Record<string, Record<string, string>> = {};

    // Create data structure for all stringers (7-12)
    for (let i = 7; i <= 12; i++) {
        if (i >= 7 && i <= 9) {
            // Top stringers (7-9)
            allStringersData[`Stringer-${i}`] = { "Unit A": "", "Unit B": "" };
        } else {
            // Bottom stringers (10-12)
            allStringersData[`Stringer-${i}`] = { "Unit A": "", "Unit B": "" };
        }
    }

    return allStringersData;
};

const createCombinedCellWidthParameters = () => {
    const allStringersData: Record<string, Record<string, string>> = {};

    // Create data structure for all stringers (7-12) with cell width measurements
    for (let i = 7; i <= 12; i++) {
        allStringersData[`Stringer-${i}`] = {
            "Upper-A-L": "", "Upper-A-R": "",
            "Lower-A-L": "", "Lower-A-R": "",
            "Upper-B-L": "", "Upper-B-R": "",
            "Lower-B-L": "", "Lower-B-R": ""
        };
    }

    return allStringersData;
};

export const tabbingStringingStage: StageData = {
    id: 5,
    name: "Tabbing and Stringing",
    parameters: [
        // ... (other parameters remain the same)
        {
            id: "5-1",
            parameters: "INTC Ribbon Status",
            criteria: "As per Production Order / BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "Dimension", value: "" },
                { timeSlot: "Expiry Date", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderInputText
        },
        {
            id: "5-2",
            parameters: "Ribbon Spool Aesthetics",
            criteria: "Spool Gap, Damage or Coating Defect",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderSelector
        },
        {
            id: "5-3",
            parameters: "Flux Status",
            criteria: "As per Production Order / BOM Engineering Specification",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Supplier", value: "" },
                { timeSlot: "Expiry Date", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderInputText
        },

        // Combined Laser Power - All Stringers (7-12)
        {
            id: "5-4-laser-power",
            parameters: "Machine Laser Power",
            criteria: "As per laser power range 50% ± 20%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createCombinedStringerParameters() }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },

        // Combined Cell Appearance - All Stringers (7-12)
        {
            id: "5-5-cell-appearance",
            parameters: "Cell Appearance",
            criteria: "Free from chip, rough edge, cross cut, crack etc.",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createCombinedStringerParameters() }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },

        // Combined Cell Width - All Stringers (7-12)
        {
            id: "5-6-cell-width",
            parameters: "Cell Width Measurements",
            criteria: "Specific tolerance between Left & Right side width ± 0.1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createCombinedCellWidthParameters() }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },

        // Combined Groove Length - All Stringers (7-12)
        {
            id: "5-7-groove-length",
            parameters: "Groove Laser Cutting Length",
            criteria: "Specific tolerance 5 ± 3mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createCombinedStringerParameters() }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-8",
            parameters: "Deionized Water TDS Value",
            criteria: "Specific tolerance 0 to 5 ppm",
            typeOfInspection: "Functionality",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "TDS Value", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderInputNumber
        }
    ]
};