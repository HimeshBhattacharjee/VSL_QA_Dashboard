import { ObservationRenderProps } from '../types/audit';

const SAMPLE_GROUPS = [
    { key: '2h', label: '2 Hours', samples: ['Sample-1', 'Sample-2', 'Sample-3', 'Sample-4', 'Sample-5'] },
    { key: '4h', label: '4 Hours', samples: ['Sample-6', 'Sample-7', 'Sample-8', 'Sample-9', 'Sample-10'] },
    { key: '6h', label: '6 Hours', samples: ['Sample-11', 'Sample-12', 'Sample-13', 'Sample-14', 'Sample-15'] },
    { key: '8h', label: '8 Hours', samples: ['Sample-16', 'Sample-17', 'Sample-18', 'Sample-19', 'Sample-20'] },
];

export const createTwentySampleValue = () => SAMPLE_GROUPS
    .flatMap(group => group.samples)
    .reduce<Record<string, string>>((acc, sample) => {
        acc[sample] = '';
        return acc;
    }, {});

export const renderGroupedSampleInputs = (
    props: ObservationRenderProps,
    getBackgroundColor: (value: string) => string
) => {
    const sampleValue = typeof props.value === 'string'
        ? createTwentySampleValue()
        : { ...createTwentySampleValue(), ...(props.value as Record<string, string>) };
    const lineOptions = props.lineOptions || [];
    const fallbackLine = props.observationData.selectedLine || lineOptions[0] || '';
    const lineMapping = props.observationData.lineMapping || {};

    return (
        <div className="w-full rounded-lg bg-white shadow-sm border border-gray-300 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                {SAMPLE_GROUPS.map(group => (
                    <div key={group.label} className="border-r last:border-r-0 border-gray-200">
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-200 px-2 py-2">
                            <span>{group.label}</span>
                            <label className="flex items-center gap-1 font-normal text-gray-500">Line - 
                                <select
                                    value={lineMapping[group.key] || fallbackLine}
                                    onChange={(e) => props.onLineMappingUpdate?.(props.stageId, props.paramId, props.timeSlot, group.key, e.target.value)}
                                    className="px-1 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    {lineOptions.map(line => (
                                        <option key={line} value={line}>{line}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="grid grid-rows-5 gap-2 p-2">
                            {group.samples.map(sample => (
                                <div key={sample} className="flex flex-col items-center min-w-0">
                                    <span className="text-[11px] text-gray-500 mb-1 truncate w-full text-center">{sample}</span>
                                    <input
                                        type="text"
                                        value={sampleValue[sample] || ''}
                                        onChange={(e) => {
                                            const updatedValue = { ...sampleValue, [sample]: e.target.value };
                                            props.onUpdate(props.stageId, props.paramId, props.timeSlot, updatedValue);
                                        }}
                                        className={`w-full px-1 py-1 text-center border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500 shadow-sm ${getBackgroundColor(sampleValue[sample] || '')}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
