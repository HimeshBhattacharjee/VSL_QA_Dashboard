import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';
import { useLine } from '../context/LineContext';

const StringerSectionWithLine = (props: ObservationRenderProps) => {
    const { lineNumber } = useLine();
    return TabbingStringingObservations.renderCombinedStringerSectionWithLine({ ...props, lineNumber });
};

const TabbingStringingObservations = {
    renderInputText: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';
        const isNA = (value: string) => value.toUpperCase() === 'N/A';
        const isNG = (value: string) => value.toUpperCase() === 'NG';
        
        const getBackgroundColor = (value: string) => {
            if (isOff(value) || isNA(value)) return 'bg-yellow-100';
            if (isNG(value)) return 'bg-red-100';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col space-y-1">
                <input
                    type="text"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
            </div>
        );
    },

    renderINTCSupplier: (props: ObservationRenderProps) => {
        const isNA = (value: string) => value === 'NA';
        
        const getBackgroundColor = (value: string) => {
            if (isNA(value)) return 'bg-yellow-100';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col space-y-1">
                <select
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                >
                    <option value="">Select</option>
                    <option value="JUREN">Juren</option>
                    <option value="SUNBY">Sunby</option>
                    <option value="YB">YourBest</option>
                    <option value="NA">N/A</option>
                </select>
            </div>
        );
    },

    renderFluxSupplier: (props: ObservationRenderProps) => {
        const isNA = (value: string) => value === 'NA';
        
        const getBackgroundColor = (value: string) => {
            if (isNA(value)) return 'bg-yellow-100';
            return 'bg-white';
        };

        return (
            <div className="flex flex-col space-y-1">
                <select
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                >
                    <option value="">Select</option>
                    <option value="RC">Reality chemical</option>
                    <option value="AS">Arbital Solutions Pvt Ltd.</option>
                    <option value="KESTER">Kester</option>
                    <option value="NA">N/A</option>
                </select>
            </div>
        );
    },

    renderSelector: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (value === 'OFF') return 'bg-yellow-100';
            if (value === 'NG') return 'bg-red-100';
            return 'bg-white';
        };

        return (
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
            >
                <option value="">Select</option>
                <option value="OK">Checked OK</option>
                <option value="NG">Checked Not OK</option>
                <option value="OFF">OFF</option>
            </select>
        );
    },

    renderInputNumber: (props: ObservationRenderProps) => {
        const isOff = (value: string) => value.toUpperCase() === 'OFF';
        
        const getBackgroundColor = (value: string) => {
            if (isOff(value)) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            if (props.paramId === '5-8-tds') return (numValue < 0 || numValue > 5) ? 'bg-red-100' : 'bg-white';
            return 'bg-white';
        };

        return (
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
            />
        );
    },

    renderExpiryDate: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (value) {
                const inputDate = new Date(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                inputDate.setHours(0, 0, 0, 0);
                if (inputDate < today) return 'bg-red-100';
            }
            return 'bg-white';
        };

        return (
            <div className="flex flex-col space-y-1">
                <input
                    type="date"
                    value={props.value as string}
                    onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
                />
            </div>
        );
    },

    renderStringerSection: (props: ObservationRenderProps) => {
        const stringerData = props.value as Record<string, string>;
        const stringerNumber = parseInt(props.timeSlot.replace('Stringer-', ''));
        const isTopHalf = stringerNumber >= 7 && stringerNumber <= 9;

        const getBackgroundColorForValue = (value: string, key: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            if (props.paramId.includes('laser-power')) return (numValue < 30 || numValue > 70) ? 'bg-red-100' : 'bg-white';
            if (props.paramId.includes('groove-length')) return (numValue < 2 || numValue > 8) ? 'bg-red-100' : 'bg-white';
            if (props.paramId.includes('cell-width')) return 'bg-white';
            return 'bg-white';
        };

        return (
            <div className={`border rounded-lg p-2 ${isTopHalf ? 'bg-blue-50' : 'bg-green-50'}`}>
                <h4 className="font-semibold text-center mb-2 text-sm">{props.timeSlot}</h4>
                <div className="grid grid-cols-2 gap-1">
                    {Object.entries(stringerData).map(([key, value]) => (
                        <div key={key} className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">{key}</label>
                            {props.paramId.includes('laser-power') && (
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => {
                                        const updatedData = { ...stringerData, [key]: e.target.value };
                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                    }}
                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(value, key)}`}
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
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => {
                                        const updatedData = { ...stringerData, [key]: e.target.value };
                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                    }}
                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(value, key)}`}
                                />
                            )}
                            {props.paramId.includes('groove-length') && (
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => {
                                        const updatedData = { ...stringerData, [key]: e.target.value };
                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                    }}
                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(value, key)}`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    },

    renderCombinedStringerSectionWithLine: (props: ObservationRenderProps & { lineNumber: string }) => {
        const allStringerData = props.value as Record<string, Record<string, string>>;
        const { lineNumber } = props;

        // Get line configuration based on current line number
        const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] || 
                          LINE_DEPENDENT_CONFIG[5]?.lineMapping['I']; // Default to Line I

        const getBackgroundColorForValue = (value: string, paramId: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            if (paramId.includes('laser-power')) return (numValue < 30 || numValue > 70) ? 'bg-red-100' : 'bg-white';
            if (paramId.includes('groove-length')) return (numValue < 2 || numValue > 8) ? 'bg-red-100' : 'bg-white';
            return 'bg-white';
        };

        if (!lineConfig || !('topHalf' in lineConfig) || !('bottomHalf' in lineConfig)) {
            return <div>Error: Line configuration not found</div>;
        }

        return (
            <div className="flex flex-col space-y-4">
                {/* Top Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3 bg-blue-50">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.topHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <div className="grid grid-cols-2 gap-1">
                                    {Object.entries(allStringerData[`Stringer-${stringerNumber}`] || {}).map(([key, value]) => (
                                        <div key={key} className="flex flex-col">
                                            <label className="text-xs text-gray-600 mb-1">{key}</label>
                                            {props.paramId.includes('laser-power') && (
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {props.paramId.includes('laser-power') && (
                                                <span className="text-xs text-gray-500 mt-1">%</span>
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
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {props.paramId.includes('groove-length') && (
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {(props.paramId.includes('groove-length') || props.paramId.includes('cell-width')) && (
                                                <span className="text-xs text-gray-500 mt-1">mm</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Bottom Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3 bg-green-50">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.bottomHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <div className="grid grid-cols-2 gap-1">
                                    {Object.entries(allStringerData[`Stringer-${stringerNumber}`] || {}).map(([key, value]) => (
                                        <div key={key} className="flex flex-col">
                                            <label className="text-xs text-gray-600 mb-1">{key}</label>
                                            {props.paramId.includes('laser-power') && (
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {props.paramId.includes('laser-power') && (
                                                <span className="text-xs text-gray-500 mt-1">%</span>
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
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {props.paramId.includes('groove-length') && (
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...allStringerData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...allStringerData[`Stringer-${stringerNumber}`],
                                                                [key]: e.target.value
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(value, props.paramId)}`}
                                                />
                                            )}
                                            {(props.paramId.includes('groove-length') || props.paramId.includes('cell-width')) && (
                                                <span className="text-xs text-gray-500 mt-1">mm</span>
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
    },

    // Keep the original renderCombinedStringerSection for backward compatibility
    renderCombinedStringerSection: (props: ObservationRenderProps) => {
        return <StringerSectionWithLine {...props} />;
    },

    // New renderer for machine temperature setup
    renderMachineTemperature: (props: ObservationRenderProps) => {
        const tempData = props.value as Record<string, Record<string, string>>;
        
        const getBackgroundColorForValue = (value: string) => {
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            // Add validation logic for temperature ranges if needed
            return 'bg-white';
        };

        return (
            <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-center mb-3 text-sm">{props.timeSlot}</h4>
                <div className="space-y-3">
                    {Object.entries(tempData).map(([stringerKey, stringerData]) => (
                        <div key={stringerKey} className="border rounded p-3 bg-white">
                            <h5 className="font-medium text-center mb-2 text-sm">{stringerKey}</h5>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(stringerData).map(([unitKey, unitData]) => (
                                    <div key={unitKey} className="border rounded p-2">
                                        <h6 className="font-medium text-center mb-2 text-xs">{unitKey}</h6>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            {Object.entries(unitData as Record<string, string>).map(([paramKey, value]) => (
                                                <div key={paramKey} className="flex flex-col">
                                                    <label className="text-gray-600 mb-1">{paramKey}</label>
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        onChange={(e) => {
                                                            const updatedData = {
                                                                ...tempData,
                                                                [stringerKey]: {
                                                                    ...stringerData,
                                                                    [unitKey]: {
                                                                        ...(unitData as Record<string, string>),
                                                                        [paramKey]: e.target.value
                                                                    }
                                                                }
                                                            };
                                                            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                        }}
                                                        className={`px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:border-blue-500 ${getBackgroundColorForValue(value)}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    },

    // New renderer for peel strength measurements
    renderPeelStrength: (props: ObservationRenderProps) => {
        const peelData = props.value as Record<string, Record<string, string>>;
        
        const getBackgroundColorForValue = (value: string) => {
            if (value === 'N/A') return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            // Peel strength should be ≥ 1.0 N/mm
            return numValue >= 1.0 ? 'bg-white' : 'bg-red-100';
        };

        return (
            <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-center mb-3 text-sm">{props.timeSlot}</h4>
                <div className="space-y-4">
                    {Object.entries(peelData).map(([stringerKey, stringerData]) => (
                        <div key={stringerKey} className="border rounded p-3 bg-white">
                            <h5 className="font-medium text-center mb-3 text-sm">{stringerKey}</h5>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(stringerData).map(([sideKey, sideData]) => (
                                    <div key={sideKey} className="border rounded p-2">
                                        <h6 className="font-medium text-center mb-2 text-xs">{sideKey}</h6>
                                        <div className="grid grid-cols-5 gap-1 text-xs">
                                            {Object.entries(sideData as Record<string, string>).map(([position, value]) => (
                                                <div key={position} className="flex flex-col items-center">
                                                    <label className="text-gray-600 mb-1 text-xs">{position}</label>
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        onChange={(e) => {
                                                            const updatedData = {
                                                                ...peelData,
                                                                [stringerKey]: {
                                                                    ...stringerData,
                                                                    [sideKey]: {
                                                                        ...(sideData as Record<string, string>),
                                                                        [position]: e.target.value
                                                                    }
                                                                }
                                                            };
                                                            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                        }}
                                                        className={`w-full px-1 py-1 border border-gray-300 rounded text-center focus:outline-none focus:border-blue-500 ${getBackgroundColorForValue(value)}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    },

    // New renderer for light intensity and soldering time
    renderLightIntensityTime: (props: ObservationRenderProps) => {
        const intensityData = props.value as Record<string, Record<string, string>>;
        
        const getBackgroundColorForValue = (value: string) => {
            if (value === 'OFF') return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            // Add validation for light intensity ranges if needed
            return 'bg-white';
        };

        return (
            <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-center mb-3 text-sm">{props.timeSlot}</h4>
                <div className="space-y-3">
                    {Object.entries(intensityData).map(([stringerKey, stringerData]) => (
                        <div key={stringerKey} className="border rounded p-3 bg-white">
                            <h5 className="font-medium text-center mb-2 text-sm">{stringerKey}</h5>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(stringerData).map(([unitKey, unitData]) => (
                                    <div key={unitKey} className="border rounded p-2">
                                        <h6 className="font-medium text-center mb-2 text-xs">{unitKey}</h6>
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <label className="text-xs text-gray-600 w-20">Solder Time (ms):</label>
                                                <input
                                                    type="text"
                                                    value={(unitData as Record<string, string>).solderTime || ''}
                                                    onChange={(e) => {
                                                        const updatedData = {
                                                            ...intensityData,
                                                            [stringerKey]: {
                                                                ...stringerData,
                                                                [unitKey]: {
                                                                    ...(unitData as Record<string, string>),
                                                                    solderTime: e.target.value
                                                                }
                                                            }
                                                        };
                                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                    }}
                                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:border-blue-500"
                                                />
                                            </div>
                                            <div className="grid grid-cols-4 gap-1 text-xs">
                                                {Object.entries(unitData as Record<string, string>)
                                                    .filter(([key]) => key.startsWith('#'))
                                                    .map(([lightKey, value]) => (
                                                        <div key={lightKey} className="flex flex-col items-center">
                                                            <label className="text-gray-600 mb-1">{lightKey}</label>
                                                            <input
                                                                type="text"
                                                                value={value}
                                                                onChange={(e) => {
                                                                    const updatedData = {
                                                                        ...intensityData,
                                                                        [stringerKey]: {
                                                                            ...stringerData,
                                                                            [unitKey]: {
                                                                                ...(unitData as Record<string, string>),
                                                                                [lightKey]: e.target.value
                                                                            }
                                                                        }
                                                                    };
                                                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                                                }}
                                                                className={`w-full px-1 py-1 border border-gray-300 rounded text-center focus:outline-none focus:border-blue-500 ${getBackgroundColorForValue(value)}`}
                                                            />
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
};

// Update the parameter creation functions to use line context
const createCombinedStringerParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] || 
                      LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];
    
    const allStringersData: Record<string, Record<string, string>> = {};
    
    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            allStringersData[`Stringer-${stringerNumber}`] = { "Unit A": "", "Unit B": "" };
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            allStringersData[`Stringer-${i}`] = { "Unit A": "", "Unit B": "" };
        }
    }
    
    return allStringersData;
};

const createCombinedCellWidthParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] || 
                      LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];
    
    const allStringersData: Record<string, Record<string, string>> = {};
    
    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            allStringersData[`Stringer-${stringerNumber}`] = {
                "Upper-A-L": "", "Upper-A-R": "", "Lower-A-L": "", "Lower-A-R": "",
                "Upper-B-L": "", "Upper-B-R": "", "Lower-B-L": "", "Lower-B-R": ""
            };
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            allStringersData[`Stringer-${i}`] = {
                "Upper-A-L": "", "Upper-A-R": "", "Lower-A-L": "", "Lower-A-R": "",
                "Upper-B-L": "", "Upper-B-R": "", "Lower-B-L": "", "Lower-B-R": ""
            };
        }
    }
    
    return allStringersData;
};

// New function to create machine temperature parameters
const createMachineTemperatureParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] || 
                      LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];
    
    const tempData: Record<string, Record<string, Record<string, string>>> = {};
    
    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            tempData[`Stringer-${stringerNumber}`] = {
                "Unit A": {
                    "Flux Temp": "",
                    "#1 Pre heat base plate": "",
                    "#2 Pre heat base plate": "",
                    "Solder base plate": "",
                    "Holding base plate": "",
                    "#1 Cooling base plate": "",
                    "#2 Drying plate": "",
                    "#3 Drying plate": "",
                    "#4 Drying plate": "",
                    "#5 Drying plate": "",
                    "#6 Drying plate": ""
                },
                "Unit B": {
                    "Flux Temp": "",
                    "#1 Pre heat base plate": "",
                    "#2 Pre heat base plate": "",
                    "Solder base plate": "",
                    "Holding base plate": "",
                    "#1 Cooling base plate": "",
                    "#2 Drying plate": "",
                    "#3 Drying plate": "",
                    "#4 Drying plate": "",
                    "#5 Drying plate": "",
                    "#6 Drying plate": ""
                }
            };
        });
    }
    
    return tempData;
};

// New function to create peel strength parameters
const createPeelStrengthParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] || 
                      LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];
    
    const peelData: Record<string, Record<string, Record<string, string>>> = {};
    
    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            const positions: Record<string, string> = {};
            for (let i = 1; i <= 20; i++) {
                positions[i.toString()] = "";
            }
            
            peelData[`Stringer-${stringerNumber}`] = {
                "Front side": { ...positions },
                "Back side": { ...positions }
            };
        });
    }
    
    return peelData;
};

// New function to create light intensity and time parameters
const createLightIntensityTimeParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] || 
                      LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];
    
    const intensityData: Record<string, Record<string, Record<string, string>>> = {};
    
    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            const lightPositions: Record<string, string> = {};
            for (let i = 1; i <= 21; i++) {
                lightPositions[`#${i}`] = "";
            }
            
            intensityData[`Stringer-${stringerNumber}`] = {
                "Unit A": {
                    solderTime: "",
                    ...lightPositions
                },
                "Unit B": {
                    solderTime: "",
                    ...lightPositions
                }
            };
        });
    }
    
    return intensityData;
};

// Create stage data with line-aware parameter initialization
export const createTabbingStringingStage = (lineNumber: string = 'I'): StageData => ({
    id: 5,
    name: "Tabbing and Stringing",
    parameters: [
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
            renderObservation: (props: ObservationRenderProps) => {
                if (props.timeSlot === "Supplier") return TabbingStringingObservations.renderINTCSupplier(props);
                else if (props.timeSlot === "Expiry Date") return TabbingStringingObservations.renderExpiryDate(props);
                return TabbingStringingObservations.renderInputText(props);
            }
        },
        {
            id: "5-2",
            parameters: "Ribbon Spool Aesthetics",
            criteria: "Spool Gap, Damage or Coating Defects",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Spool 1", value: "" },
                { timeSlot: "Spool 2", value: "" },
                { timeSlot: "Spool 3", value: "" },
                { timeSlot: "Spool 4", value: "" },
                { timeSlot: "Spool 5", value: "" },
                { timeSlot: "Spool 6", value: "" }
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
            renderObservation: (props: ObservationRenderProps) => {
                if (props.timeSlot === "Supplier") return TabbingStringingObservations.renderFluxSupplier(props);
                else if (props.timeSlot === "Expiry Date") return TabbingStringingObservations.renderExpiryDate(props);
                return TabbingStringingObservations.renderInputText(props);
            }
        },
        {
            id: "5-4",
            parameters: "Flux Pot Level",
            criteria: "Above Minimum Level",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Flux Pot 1", value: "" },
                { timeSlot: "Flux Pot 2", value: "" },
                { timeSlot: "Flux Pot 3", value: "" },
                { timeSlot: "Flux Pot 4", value: "" },
                { timeSlot: "Flux Pot 5", value: "" },
                { timeSlot: "Flux Pot 6", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderSelector
        },
        {
            id: "5-5",
            parameters: "Flux Pot Temperature",
            criteria: "40-45°C",
            typeOfInspection: "Process",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Flux Pot 1", value: "" },
                { timeSlot: "Flux Pot 2", value: "" },
                { timeSlot: "Flux Pot 3", value: "" },
                { timeSlot: "Flux Pot 4", value: "" },
                { timeSlot: "Flux Pot 5", value: "" },
                { timeSlot: "Flux Pot 6", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderInputNumber
        },
        {
            id: "5-6",
            parameters: "Laser Power",
            criteria: "30-70%",
            typeOfInspection: "Process",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Combined", value: createCombinedStringerParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-7",
            parameters: "Cell Appearance after Tabbing",
            criteria: "No Burn Mark, No Crack, No Chipping",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Combined", value: createCombinedStringerParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-8",
            parameters: "TDS of DI Water",
            criteria: "0-5 ppm",
            typeOfInspection: "Process",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "TDS", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderInputNumber
        },
        {
            id: "5-9",
            parameters: "Cell Width after Tabbing",
            criteria: "As per Drawing",
            typeOfInspection: "Dimension",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Combined", value: createCombinedCellWidthParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-10",
            parameters: "Groove Length",
            criteria: "2-8 mm",
            typeOfInspection: "Dimension",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Combined", value: createCombinedStringerParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-11",
            parameters: "Machine Temperature Setup",
            criteria: "As per Process Parameter",
            typeOfInspection: "Process",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Temperature Setup", value: createMachineTemperatureParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderMachineTemperature
        },
        {
            id: "5-12",
            parameters: "Light Intensity & Soldering Time",
            criteria: "As per Process Parameter",
            typeOfInspection: "Process",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Light Intensity", value: createLightIntensityTimeParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderLightIntensityTime
        },
        {
            id: "5-13",
            parameters: "Peel Strength",
            criteria: "≥ 1.0 N/mm",
            typeOfInspection: "Dimension",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Peel Strength", value: createPeelStrengthParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderPeelStrength
        },
        {
            id: "5-14",
            parameters: "Cell Appearance after Stringing",
            criteria: "No Burn Mark, No Crack, No Chipping",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Combined", value: createCombinedStringerParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-15",
            parameters: "Cell Width after Stringing",
            criteria: "As per Drawing",
            typeOfInspection: "Dimension",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "Combined", value: createCombinedCellWidthParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        }
    ]
});

export default TabbingStringingObservations;