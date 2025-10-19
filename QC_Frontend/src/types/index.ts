export interface InspectionDataset {
    data: any[];
    summary: {
        defect_columns?: string[];
        [key: string]: any;
    };
}

export interface InspectionDatasets {
    'pre-el': InspectionDataset;
    'visual': InspectionDataset;
    'lam-qc': InspectionDataset;
    'fqc': InspectionDataset;
}

export interface ChartConfig {
    type: 'doughnut' | 'bar' | 'line';
    data: {
        labels: string[];
        datasets: Array<{
            data: number[];
            backgroundColor: string[];
            borderWidth: number;
            borderColor: string;
            [key: string]: any;
        }>;
    };
    options: any;
}

export interface DateRange {
    startDate: string;
    endDate: string;
}

export interface DefectAnalysis {
    defects: string[];
    total_defects: number;
}

export interface ProductionStats {
    [key: string]: any;
}