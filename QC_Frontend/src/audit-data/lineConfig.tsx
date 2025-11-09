export interface LineMappingConfig { [key: string]: string[] | StringerConfig; }

export interface StringerConfig { stringers: number[]; topHalf: number[]; bottomHalf: number[]; }

export const LINE_DEPENDENT_CONFIG: { [stageId: number]: { parameters: string[]; lineMapping: LineMappingConfig; } } = {
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
        parameters: [
            '5-4-laser-power', '5-5-cell-appearance', '5-6-cell-width', '5-7-groove-length',
            '5-9-machine-temp-setup', '5-10-light-intensity-time', '5-11-peel-strength'
        ],
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
    },
    7: {
        parameters: [
            '7-1', '7-2', '7-3', '7-4', '7-5', '7-6', '7-7', '7-8', '7-9'
        ],
        lineMapping: {
            'I': ['Line-1', 'Line-2', 'Line-3'],
            'II': ['Line-4', 'Line-5']
        }
    },
    8: {
        parameters: [
            '8-1', '8-2', '8-3', '8-4', '8-5', '8-6', '8-9', '8-10',
            '8-11', '8-12', '8-13', '8-14', '8-15', '8-16'
        ],
        lineMapping: {
            'I': ['Line-1', 'Line-2'],
            'II': ['Line-3', 'Line-4']
        }
    },
    9: {
        parameters: ['9-6', '9-7', '9-8'],
        lineMapping: {
            'I': ['Line-1', 'Line-2'],
            'II': ['Line-3', 'Line-4']
        }
    },
    10: {
        parameters: ['10-4', '10-5', '10-6'],
        lineMapping: {
            'I': ['Line-1', 'Line-2'],
            'II': ['Line-3', 'Line-4']
        }
    },
    11: {
        parameters: ['11-3', '11-4', '11-5'],
        lineMapping: {
            'I': ['Line-1', 'Line-2'],
            'II': ['Line-3', 'Line-4']
        }
    },
    12: {
        parameters: ['12-1', '12-2'],
        lineMapping: {
            'I': ['Line-1', 'Line-2'],
            'II': ['Line-3', 'Line-4']
        }
    },
    14: {
        parameters: [
            '14-1-laminator1', '14-2-laminator2', '14-3-laminator3', '14-4-laminator4',
            '14-5-laminator5', '14-6-laminator6', '14-7-laminator7', '14-8-laminator8'
        ],
        lineMapping: {
            'I': ['Laminator-1', 'Laminator-2', 'Laminator-3', 'Laminator-4'],
            'II': ['Laminator-5', 'Laminator-6', 'Laminator-7', 'Laminator-8']
        }
    },
    15: {
        parameters: ['15-1', '15-2'],
        lineMapping: {
            'I': ['Auto trimming - 1', 'Auto trimming - 2'],
            'II': ['Auto trimming - 3', 'Auto trimming - 4']
        }
    },
    16: {
        parameters: ['16-1'],
        lineMapping: {
            'I': ['Line-1', 'Line-2'],
            'II': ['Line-3', 'Line-4']
        }
    },
    17: {
        parameters: ['17-1', '17-2', '17-3', '17-4', '17-5', '17-6', '17-7', '17-8', '17-9', '17-10', '17-11', '17-12-coating-thickness'],
        lineMapping: {
            'I': ['Line-1', 'Line-2'],
            'II': ['Line-3', 'Line-4']
        }
    },
    18: {
        parameters: ['18-1', '18-2', '18-3', '18-4', '18-5', '18-6'],
        lineMapping: {
            'I': ['Line-1', 'Line-2'],
            'II': ['Line-3', 'Line-4']
        }
    },
};