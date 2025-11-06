export interface LineMappingConfig {
    [key: string]: string[] | StringerConfig;
}

export interface StringerConfig {
    stringers: number[];
    topHalf: number[];
    bottomHalf: number[];
}

export const LINE_DEPENDENT_CONFIG: {
    [stageId: number]: {
        parameters: string[];
        lineMapping: LineMappingConfig;
    }
} = {
    2: {
        parameters: ['2-4', '2-5', '2-6'],
        lineMapping: {
            'I': ['Line-1', 'Line-2'],
            'II': ['Line-3', 'Line-4']
        }
    },
    3: {
        parameters: ['3-7', '3-8', '3-9'],
        lineMapping: {
            'I': ['Line-1', 'Line-2'],
            'II': ['Line-3', 'Line-4']
        }
    },
    5: {
        parameters: ['5-4-laser-power', '5-5-cell-appearance', '5-6-cell-width', '5-7-groove-length'],
        lineMapping: {
            'I': {
                stringers: [1, 2, 3, 4, 5, 6],
                topHalf: [1, 2, 3],
                bottomHalf: [4, 5, 6]
            },
            'II': {
                stringers: [7, 8, 9, 10, 11, 12],
                topHalf: [7, 8, 9],
                bottomHalf: [10, 11, 12]
            }
        }
    }
};