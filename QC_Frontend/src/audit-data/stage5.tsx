import { StageData, ObservationRenderProps } from '../types/audit';
import { LINE_DEPENDENT_CONFIG } from './lineConfig';
import { useLine } from '../context/LineContext';

const StringerSectionWithLine = (props: ObservationRenderProps) => {
    const { lineNumber } = useLine();
    if (props.paramId === '5-11-peel-strength') return TabbingStringingObservations.renderPeelStrengthSection({ ...props, lineNumber });
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
            <div className={"border rounded-lg p-2"}>
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

    renderMachineTempSection: (props: ObservationRenderProps & { lineNumber: string }) => {
        const allStringerData = props.value as Record<string, any>;
        const { lineNumber } = props;
        const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
            LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

        const getBackgroundColorForValue = (value: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            return 'bg-white';
        };

        if (!lineConfig || !('topHalf' in lineConfig) || !('bottomHalf' in lineConfig)) {
            return <div>Error: Line configuration not found</div>;
        }

        const tempFields = [
            { key: 'fluxTemp', label: 'Flux Temp' },
            { key: 'preHeat1', label: '#1 Pre Heat' },
            { key: 'preHeat2', label: '#2 Pre Heat' },
            { key: 'solderPlate', label: 'Solder Plate' },
            { key: 'holdingPlate', label: 'Holding Plate' },
            { key: 'coolingPlate', label: '#1 Cooling Plate' },
            { key: 'drying2', label: '#2 Drying Plate' },
            { key: 'drying3', label: '#3 Drying Plate' },
            { key: 'drying4', label: '#4 Drying Plate' },
            { key: 'drying5', label: '#5 Drying Plate' },
            { key: 'drying6', label: '#6 Drying Plate' }
        ];

        const renderStringerUnit = (stringerNumber: number, unit: 'unitA' | 'unitB', unitLabel: string) => (
            <div className="border border-gray-200 rounded p-2 bg-gray-50">
                <h6 className="font-semibold text-center mb-2 text-sm bg-blue-100 py-1 rounded">{unitLabel}</h6>
                <div className="grid grid-cols-2 gap-1">
                    {tempFields.map((field) => (
                        <div key={field.key} className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">{field.label}</label>
                            <input
                                type="text"
                                value={allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.[field.key] || ''}
                                onChange={(e) => {
                                    const updatedData = {
                                        ...allStringerData,
                                        [`Stringer-${stringerNumber}`]: {
                                            ...allStringerData[`Stringer-${stringerNumber}`],
                                            [unit]: {
                                                ...allStringerData[`Stringer-${stringerNumber}`]?.[unit],
                                                [field.key]: e.target.value
                                            }
                                        }
                                    };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                }}
                                className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.[field.key] || '')}`}
                            />
                            <span className="text-xs text-gray-500 mt-1">°C</span>
                        </div>
                    ))}
                </div>
            </div>
        );

        return (
            <div className="flex flex-col space-y-4">
                {/* Top Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.topHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm py-1 rounded">Stringer {stringerNumber}</h5>
                                <div className="space-y-2">
                                    {renderStringerUnit(stringerNumber, 'unitA', 'Unit A')}
                                    {renderStringerUnit(stringerNumber, 'unitB', 'Unit B')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.bottomHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm py-1 rounded">Stringer {stringerNumber}</h5>
                                <div className="space-y-2">
                                    {renderStringerUnit(stringerNumber, 'unitA', 'Unit A')}
                                    {renderStringerUnit(stringerNumber, 'unitB', 'Unit B')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    },

    renderLightIntensityTimeSection: (props: ObservationRenderProps & { lineNumber: string }) => {
        const allStringerData = props.value as Record<string, any>;
        const { lineNumber } = props;
        const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
            LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

        const getBackgroundColorForValue = (value: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            return 'bg-white';
        };

        if (!lineConfig || !('topHalf' in lineConfig) || !('bottomHalf' in lineConfig)) {
            return <div>Error: Line configuration not found</div>;
        }

        const lightFields = Array.from({ length: 21 }, (_, i) => ({
            key: `light${i + 1}`,
            label: `#${i + 1}`
        }));

        const renderStringerUnit = (stringerNumber: number, unit: 'unitA' | 'unitB', unitLabel: string) => (
            <div className="border border-gray-200 rounded p-2 bg-gray-50">
                <h6 className="font-semibold text-center mb-2 text-sm bg-blue-100 py-1 rounded">{unitLabel}</h6>

                {/* Solder Time */}
                <div className="mb-3 p-2 border border-gray-300 rounded bg-white">
                    <label className="text-xs text-gray-600 mb-1 block text-center">Solder Time (ms)</label>
                    <input
                        type="text"
                        value={allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.solderTime || ''}
                        onChange={(e) => {
                            const updatedData = {
                                ...allStringerData,
                                [`Stringer-${stringerNumber}`]: {
                                    ...allStringerData[`Stringer-${stringerNumber}`],
                                    [unit]: {
                                        ...allStringerData[`Stringer-${stringerNumber}`]?.[unit],
                                        solderTime: e.target.value
                                    }
                                }
                            };
                            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                        }}
                        className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.solderTime || '')}`}
                    />
                </div>

                {/* Light Intensity Grid */}
                <div className="grid grid-cols-5 gap-1">
                    {lightFields.map((field) => (
                        <div key={field.key} className="flex flex-col">
                            <label className="text-xs text-gray-600 mb-1 text-center">{field.label}</label>
                            <input
                                type="text"
                                value={allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.[field.key] || ''}
                                onChange={(e) => {
                                    const updatedData = {
                                        ...allStringerData,
                                        [`Stringer-${stringerNumber}`]: {
                                            ...allStringerData[`Stringer-${stringerNumber}`],
                                            [unit]: {
                                                ...allStringerData[`Stringer-${stringerNumber}`]?.[unit],
                                                [field.key]: e.target.value
                                            }
                                        }
                                    };
                                    props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                }}
                                className={`px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.[unit]?.[field.key] || '')}`}
                            />
                            <span className="text-xs text-gray-500 mt-1 text-center">%</span>
                        </div>
                    ))}
                </div>
            </div>
        );

        return (
            <div className="flex flex-col space-y-4">
                {/* Top Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.topHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm py-1 rounded">Stringer {stringerNumber}</h5>
                                <div className="space-y-2">
                                    {renderStringerUnit(stringerNumber, 'unitA', 'Unit A')}
                                    {renderStringerUnit(stringerNumber, 'unitB', 'Unit B')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-3">
                        {lineConfig.bottomHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm py-1 rounded">Stringer {stringerNumber}</h5>
                                <div className="space-y-2">
                                    {renderStringerUnit(stringerNumber, 'unitA', 'Unit A')}
                                    {renderStringerUnit(stringerNumber, 'unitB', 'Unit B')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    },

    renderUnitSelector: (props: ObservationRenderProps) => {
        const getBackgroundColor = (value: string) => {
            if (value === 'OFF') return 'bg-yellow-100';
            return 'bg-white';
        };

        return (
            <select
                value={props.value as string}
                onChange={(e) => props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                className={`px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)}`}
            >
                <option value="">Select</option>
                <option value="Unit-A">Unit-A</option>
                <option value="Unit-B">Unit-B</option>
                <option value="OFF">OFF</option>
            </select>
        );
    },

    renderPeelStrengthInput: (props: ObservationRenderProps & { disabled?: boolean }) => {
        const getBackgroundColor = (value: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';
            return numValue < 1.0 ? 'bg-red-100' : 'bg-white';
        };

        return (
            <input
                type="text"
                value={props.value as string}
                onChange={(e) => !props.disabled && props.onUpdate(props.stageId, props.paramId, props.timeSlot, e.target.value)}
                disabled={props.disabled}
                className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(props.value as string)} ${props.disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
        );
    },

    renderPeelStrengthSection: (props: ObservationRenderProps & { lineNumber: string }) => {
        const peelStrengthData = props.value as Record<string, any>;
        const { lineNumber } = props;
        const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
            LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

        if (!lineConfig || !('stringers' in lineConfig)) {
            return <div>Error: Line configuration not found</div>;
        }

        const cellPositions = Array.from({ length: 20 }, (_, i) => i + 1);

        return (
            <div className="grid grid-cols-3 gap-2">
                {lineConfig.stringers.map((stringerNumber) => (
                    <div key={stringerNumber} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <h4 className="font-semibold text-center mb-4 text-sm">Stringer {stringerNumber}</h4>

                        <div className="space-y-4">
                            {/* Front Side */}
                            <div className="border border-gray-200 rounded-lg p-2 bg-white">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-sm font-semibold text-blue-600">Front Side</h5>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-600">Unit:</span>
                                        <TabbingStringingObservations.renderUnitSelector
                                            {...props}
                                            value={peelStrengthData[`Stringer-${stringerNumber}`]?.frontUnit || ''}
                                            onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                const updatedData = {
                                                    ...peelStrengthData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...peelStrengthData[`Stringer-${stringerNumber}`],
                                                        frontUnit: newValue as string
                                                    }
                                                };
                                                props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                            }}
                                        />
                                    </div>
                                </div>
                                {peelStrengthData[`Stringer-${stringerNumber}`]?.frontUnit !== 'OFF' && (
                                    <div className="grid grid-cols-5 gap-1">
                                        {cellPositions.map((position) => (
                                            <div key={`front-${position}`} className="flex flex-col items-center">
                                                <label className="text-xs text-gray-600 mb-1">{position}</label>
                                                <TabbingStringingObservations.renderPeelStrengthInput
                                                    {...props}
                                                    value={peelStrengthData[`Stringer-${stringerNumber}`]?.frontSide?.[position] || ''}
                                                    disabled={peelStrengthData[`Stringer-${stringerNumber}`]?.frontUnit === 'OFF'}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...peelStrengthData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...peelStrengthData[`Stringer-${stringerNumber}`],
                                                                frontSide: {
                                                                    ...peelStrengthData[`Stringer-${stringerNumber}`]?.frontSide,
                                                                    [position]: newValue as string
                                                                }
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Back Side */}
                            <div className="border border-gray-200 rounded-lg p-2 bg-white">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-sm font-semibold text-green-600">Back Side</h5>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-600">Unit:</span>
                                        <TabbingStringingObservations.renderUnitSelector
                                            {...props}
                                            value={peelStrengthData[`Stringer-${stringerNumber}`]?.backUnit || ''}
                                            onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                const updatedData = {
                                                    ...peelStrengthData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...peelStrengthData[`Stringer-${stringerNumber}`],
                                                        backUnit: newValue as string
                                                    }
                                                };
                                                props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                            }}
                                        />
                                    </div>
                                </div>
                                {peelStrengthData[`Stringer-${stringerNumber}`]?.backUnit !== 'OFF' && (
                                    <div className="grid grid-cols-5 gap-1">
                                        {cellPositions.map((position) => (
                                            <div key={`back-${position}`} className="flex flex-col items-center">
                                                <label className="text-xs text-gray-600 mb-1">{position}</label>
                                                <TabbingStringingObservations.renderPeelStrengthInput
                                                    {...props}
                                                    value={peelStrengthData[`Stringer-${stringerNumber}`]?.backSide?.[position] || ''}
                                                    disabled={peelStrengthData[`Stringer-${stringerNumber}`]?.backUnit === 'OFF'}
                                                    onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                        const updatedData = {
                                                            ...peelStrengthData,
                                                            [`Stringer-${stringerNumber}`]: {
                                                                ...peelStrengthData[`Stringer-${stringerNumber}`],
                                                                backSide: {
                                                                    ...peelStrengthData[`Stringer-${stringerNumber}`]?.backSide,
                                                                    [position]: newValue as string
                                                                }
                                                            }
                                                        };
                                                        props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    },

    renderSingleInputPerStringer: (props: ObservationRenderProps & { lineNumber: string }) => {
        const allStringerData = props.value as Record<string, string>;
        const { lineNumber } = props;
        const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
            LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

        const getBackgroundColorForValue = (value: string, paramId: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';

            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';

            if (paramId.includes('ribbon-flatten')) {
                // Ribbon flatten must be ≥ 56% of ribbon diameter
                // Assuming ribbon diameter is 0.139, so 56% would be 0.139 * 0.56 = 0.07784
                return numValue >= 0.07784 ? 'bg-white' : 'bg-red-100';
            }
            return 'bg-white';
        };

        if (!lineConfig || !('topHalf' in lineConfig) || !('bottomHalf' in lineConfig)) {
            return <div>Error: Line configuration not found</div>;
        }

        return (
            <div className="flex flex-col space-y-4">
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-6 gap-3">
                        {lineConfig.topHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <input
                                    type="text"
                                    value={allStringerData[`Stringer-${stringerNumber}`] || ''}
                                    onChange={(e) => {
                                        const updatedData = {
                                            ...allStringerData,
                                            [`Stringer-${stringerNumber}`]: e.target.value
                                        };
                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                    }}
                                    className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`] || '', props.paramId)}`}
                                />
                                {props.paramId.includes('ribbon-flatten') && (
                                    <span className="text-xs text-gray-500 mt-1 text-center">mm</span>
                                )}
                            </div>
                        ))}
                        {lineConfig.bottomHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <input
                                    type="text"
                                    value={allStringerData[`Stringer-${stringerNumber}`] || ''}
                                    onChange={(e) => {
                                        const updatedData = {
                                            ...allStringerData,
                                            [`Stringer-${stringerNumber}`]: e.target.value
                                        };
                                        props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                    }}
                                    className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`] || '', props.paramId)}`}
                                />
                                {props.paramId.includes('ribbon-flatten') && (
                                    <span className="text-xs text-gray-500 mt-1 text-center">mm</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    },

    renderDoubleTimeSlotPerStringer: (props: ObservationRenderProps & { lineNumber: string }) => {
        const allStringerData = props.value as Record<string, { '4 hours': string; '8 hours': string }>;
        const { lineNumber } = props;
        const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
            LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

        const getBackgroundColorForValue = (value: string, paramId: string) => {
            const isOff = value.toUpperCase() === 'OFF';
            if (isOff) return 'bg-yellow-100';
            if (!value) return 'bg-white';

            const numValue = parseFloat(value);
            if (isNaN(numValue)) return 'bg-white';

            if (paramId.includes('string-length')) {
                // String length ± 0.1mm validation would need reference value
                return 'bg-white';
            }
            if (paramId.includes('cell-to-cell-gap')) {
                // 0.8 mm to 1.8 mm for M10, 0.3 mm to 1.3 mm for M10R & G12
                // For now, using broader range that covers both
                return (numValue >= 0.3 && numValue <= 1.8) ? 'bg-white' : 'bg-red-100';
            }
            if (paramId.includes('el-inspection')) {
                if (value === 'NG') return 'bg-red-100';
                if (value === 'OFF') return 'bg-yellow-100';
                return 'bg-white';
            }
            return 'bg-white';
        };

        if (!lineConfig || !('topHalf' in lineConfig) || !('bottomHalf' in lineConfig)) {
            return <div>Error: Line configuration not found</div>;
        }

        return (
            <div className="flex flex-col space-y-4">
                {/* Top Half Stringers */}
                <div className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-6 gap-3">
                        {lineConfig.topHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <div className="mb-2">
                                    <label className="text-xs text-gray-600 mb-1 block text-center">4 hours</label>
                                    {props.paramId.includes('el-inspection') ? (
                                        <TabbingStringingObservations.renderSelector
                                            {...props}
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || ''}
                                            onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '4 hours': newValue as string
                                                    }
                                                };
                                                props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                            }}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || ''}
                                            onChange={(e) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '4 hours': e.target.value
                                                    }
                                                };
                                                props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                            }}
                                            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || '', props.paramId)}`}
                                        />
                                    )}
                                </div>
                                {(props.paramId.includes('string-length') || props.paramId.includes('cell-to-cell-gap')) && (
                                    <span className="text-xs text-gray-500 mb-2 text-center block">mm</span>
                                )}
                                <div>
                                    <label className="text-xs text-gray-600 mb-1 block text-center">8 hours</label>
                                    {props.paramId.includes('el-inspection') ? (
                                        <TabbingStringingObservations.renderSelector
                                            {...props}
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || ''}
                                            onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '8 hours': newValue as string
                                                    }
                                                };
                                                props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                            }}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || ''}
                                            onChange={(e) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '8 hours': e.target.value
                                                    }
                                                };
                                                props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                            }}
                                            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || '', props.paramId)}`}
                                        />
                                    )}
                                </div>
                                {(props.paramId.includes('string-length') || props.paramId.includes('cell-to-cell-gap')) && (
                                    <span className="text-xs text-gray-500 mt-1 text-center block">mm</span>
                                )}
                            </div>
                        ))}
                        {lineConfig.bottomHalf.map(stringerNumber => (
                            <div key={stringerNumber} className="border border-gray-200 rounded p-2 bg-white">
                                <h5 className="font-semibold text-center mb-2 text-sm">Stringer {stringerNumber}</h5>
                                <div className="mb-2">
                                    <label className="text-xs text-gray-600 mb-1 block text-center">4 hours</label>
                                    {props.paramId.includes('el-inspection') ? (
                                        <TabbingStringingObservations.renderSelector
                                            {...props}
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || ''}
                                            onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '4 hours': newValue as string
                                                    }
                                                };
                                                props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                            }}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || ''}
                                            onChange={(e) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '4 hours': e.target.value
                                                    }
                                                };
                                                props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                            }}
                                            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.['4 hours'] || '', props.paramId)}`}
                                        />
                                    )}
                                </div>
                                {(props.paramId.includes('string-length') || props.paramId.includes('cell-to-cell-gap')) && (
                                    <span className="text-xs text-gray-500 mb-2 text-center block">mm</span>
                                )}
                                <div>
                                    <label className="text-xs text-gray-600 mb-1 block text-center">8 hours</label>
                                    {props.paramId.includes('el-inspection') ? (
                                        <TabbingStringingObservations.renderSelector
                                            {...props}
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || ''}
                                            onUpdate={(stageId, paramId, timeSlot, newValue) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '8 hours': newValue as string
                                                    }
                                                };
                                                props.onUpdate(stageId, paramId, timeSlot, updatedData);
                                            }}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || ''}
                                            onChange={(e) => {
                                                const updatedData = {
                                                    ...allStringerData,
                                                    [`Stringer-${stringerNumber}`]: {
                                                        ...allStringerData[`Stringer-${stringerNumber}`],
                                                        '8 hours': e.target.value
                                                    }
                                                };
                                                props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedData);
                                            }}
                                            className={`w-full px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColorForValue(allStringerData[`Stringer-${stringerNumber}`]?.['8 hours'] || '', props.paramId)}`}
                                        />
                                    )}
                                </div>

                                {(props.paramId.includes('string-length') || props.paramId.includes('cell-to-cell-gap')) && (
                                    <span className="text-xs text-gray-500 mt-1 text-center block">mm</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
};

const createGrooveLengthParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
        LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const allStringersData: Record<string, Record<string, string>> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            allStringersData[`Stringer-${stringerNumber}`] = {
                "Unit A - Upper Half": "",
                "Unit A - Lower Half": "",
                "Unit B - Upper Half": "",
                "Unit B - Lower Half": ""
            };
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            allStringersData[`Stringer-${i}`] = {
                "Unit A - Upper Half": "",
                "Unit A - Lower Half": "",
                "Unit B - Upper Half": "",
                "Unit B - Lower Half": ""
            };
        }
    }

    return allStringersData;
};

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

const createMachineTempParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber] || LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const tempData: Record<string, any> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            tempData[`Stringer-${stringerNumber}`] = {
                unitA: {
                    fluxTemp: "",
                    preHeat1: "",
                    preHeat2: "",
                    solderPlate: "",
                    holdingPlate: "",
                    coolingPlate: "",
                    drying1: "",
                    drying2: "",
                    drying3: "",
                    drying4: "",
                    drying5: "",
                    drying6: ""
                },
                unitB: {
                    fluxTemp: "",
                    preHeat1: "",
                    preHeat2: "",
                    solderPlate: "",
                    holdingPlate: "",
                    coolingPlate: "",
                    drying1: "",
                    drying2: "",
                    drying3: "",
                    drying4: "",
                    drying5: "",
                    drying6: ""
                }
            };
        });
    }
    return tempData;
};

// For 5-10: Light Intensity & Soldering Time (22 inputs per unit)
const createLightIntensityTimeParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber] || LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const lightData: Record<string, any> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            lightData[`Stringer-${stringerNumber}`] = {
                unitA: {
                    solderTime: "",
                    light1: "", light2: "", light3: "", light4: "", light5: "", light6: "",
                    light7: "", light8: "", light9: "", light10: "", light11: "", light12: "",
                    light13: "", light14: "", light15: "", light16: "", light17: "", light18: "",
                    light19: "", light20: "", light21: ""
                },
                unitB: {
                    solderTime: "",
                    light1: "", light2: "", light3: "", light4: "", light5: "", light6: "",
                    light7: "", light8: "", light9: "", light10: "", light11: "", light12: "",
                    light13: "", light14: "", light15: "", light16: "", light17: "", light18: "",
                    light19: "", light20: "", light21: ""
                }
            };
        });
    }
    return lightData;
};

const createPeelStrengthParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
        LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const peelStrengthData: Record<string, any> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            peelStrengthData[`Stringer-${stringerNumber}`] = {
                frontUnit: '',
                backUnit: '',
                frontSide: {},
                backSide: {}
            };
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            peelStrengthData[`Stringer-${i}`] = {
                frontUnit: '',
                backUnit: '',
                frontSide: {},
                backSide: {}
            };
        }
    }

    return peelStrengthData;
};

// Parameter creation functions for the new structure
const createSingleInputPerStringerParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
        LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const stringerData: Record<string, string> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            stringerData[`Stringer-${stringerNumber}`] = "";
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            stringerData[`Stringer-${i}`] = "";
        }
    }

    return stringerData;
};

const createDoubleTimeSlotPerStringerParameters = (lineNumber: string = 'I') => {
    const lineConfig = LINE_DEPENDENT_CONFIG[5]?.lineMapping[lineNumber as keyof typeof LINE_DEPENDENT_CONFIG[5]['lineMapping']] ||
        LINE_DEPENDENT_CONFIG[5]?.lineMapping['I'];

    const stringerData: Record<string, { '4 hours': string; '8 hours': string }> = {};

    if (lineConfig && 'stringers' in lineConfig) {
        lineConfig.stringers.forEach(stringerNumber => {
            stringerData[`Stringer-${stringerNumber}`] = {
                '4 hours': "",
                '8 hours': ""
            };
        });
    } else {
        // Fallback to default (Line I)
        for (let i = 1; i <= 6; i++) {
            stringerData[`Stringer-${i}`] = {
                '4 hours': "",
                '8 hours': ""
            };
        }
    }

    return stringerData;
};

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
            renderObservation: (props: ObservationRenderProps) => {
                if (props.timeSlot === "Supplier") return TabbingStringingObservations.renderFluxSupplier(props);
                else if (props.timeSlot === "Expiry Date") return TabbingStringingObservations.renderExpiryDate(props);
                return TabbingStringingObservations.renderInputText(props);
            }
        },
        {
            id: "5-4-laser-power",
            parameters: "Machine Laser Power",
            criteria: "As per laser power range 50% ± 20%",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createCombinedStringerParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-5-cell-appearance",
            parameters: "Cell Appearance",
            criteria: "Free from chip, rough edge, cross cut, crack etc.",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createCombinedStringerParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-6-cell-width",
            parameters: "Cell Width Measurements",
            criteria: "Specific tolerance between Left & Right side width ± 0.1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createCombinedCellWidthParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-7-groove-length",
            parameters: "Groove Laser Cutting Length",
            criteria: "Specific tolerance 5 ± 3mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createGrooveLengthParameters(lineNumber) }
            ],
            renderObservation: TabbingStringingObservations.renderCombinedStringerSection
        },
        {
            id: "5-8-tds",
            parameters: "Deionized Water TDS Value",
            criteria: "Specific tolerance 0 to 5 ppm",
            typeOfInspection: "Functionality",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "TDS Value", value: "" }
            ],
            renderObservation: TabbingStringingObservations.renderInputNumber
        },
        {
            id: "5-9-machine-temp-setup",
            parameters: "Stringer Machine setup As per recipe Pre Heat Table & Soldering Temp",
            criteria: "Machine temperature setup As per Reference Document VSL/PDN/SC/34",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createMachineTempParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderMachineTempSection
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-10-light-intensity-time",
            parameters: "Stringer Machine setup As per recipe Light Intensity & Total soldering time",
            criteria: "Machine temperature setup As per Reference Document VSL/PDN/SC/34",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createLightIntensityTimeParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderLightIntensityTimeSection
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-11-peel-strength",
            parameters: "Cell to Interconnect Ribbon Peel Strength",
            criteria: "Peel strength average ≥ 1.0 N/mm. Effective soldering should be ≥ 90% of its total numbers of the bus pads. Hard soldering: Silver peel off not allowed",
            typeOfInspection: "Functionality",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createPeelStrengthParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderPeelStrengthSection
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-12-ribbon-flatten",
            parameters: "Ribbon flatten",
            criteria: "Ribbon flatten must be ≥ 56% of ribbon diameter",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every shift",
            observations: [
                { timeSlot: "", value: createSingleInputPerStringerParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderSingleInputPerStringer
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-13-string-length",
            parameters: "String length",
            criteria: "As per Engg. drawing ± 0.1mm",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hrs",
            observations: [
                { timeSlot: "", value: createDoubleTimeSlotPerStringerParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderDoubleTimeSlotPerStringer
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-14-cell-to-cell-gap",
            parameters: "Cell to Cell Gap",
            criteria: "0.8 mm to 1.8 mm for M10, 0.3 mm to 1.3 mm for M10R & G12",
            typeOfInspection: "Measurements",
            inspectionFrequency: "Every 4 hrs",
            observations: [
                { timeSlot: "", value: createDoubleTimeSlotPerStringerParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderDoubleTimeSlotPerStringer
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        },
        {
            id: "5-15-el-inspection",
            parameters: "EL inspection",
            criteria: "Refer doc no- VSL/QAD/SC/07",
            typeOfInspection: "Aesthetics",
            inspectionFrequency: "Every 4 hrs",
            observations: [
                { timeSlot: "", value: createDoubleTimeSlotPerStringerParameters(lineNumber) }
            ],
            renderObservation: (props: ObservationRenderProps) => (
                <TabbingStringingObservations.renderDoubleTimeSlotPerStringer
                    {...props}
                    lineNumber={lineNumber}
                />
            )
        }
    ]
});

export const tabbingStringingStage = createTabbingStringingStage('I');