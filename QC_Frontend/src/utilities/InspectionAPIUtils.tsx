const API_BASE_URL = 'http://localhost:8000';

export interface GradeCounts {
    [key: string]: number;
}

export interface DefectReasons {
    [key: string]: number;
}

export interface GradeAnalysisResponse {
    success: boolean;
    grade_counts: GradeCounts;
    total_production: number;
    total_defects: number;
    defect_rate: string;
    detail?: string;
}

export interface DefectAnalysisResponse {
    success: boolean;
    defect_reasons: DefectReasons;
    total_production: number;
    total_b_grade: number;
    detail?: string;
}

export interface InspectionDataResponse {
    data: any[];
    summary: {
        defect_columns: string[];
        [key: string]: any;
    };
}

export interface DefectAnalysisData {
    defects: string[];
    total_defects: number;
    [key: string]: any;
}

export interface ProductionStats {
    [key: string]: any;
}

export interface DateRangeData {
    [key: string]: any;
}

// Enhanced error handling function
const handleApiError = (error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    if (error instanceof Error) {
        throw new Error(`${context}: ${error.message}`);
    }
    throw new Error(`${context}: Unknown error occurred`);
};

// UPDATED: Load data from API instead of JSON files
export async function loadInspectionData(inspectionType: string, line: string = 'combined'): Promise<InspectionDataResponse> {
    try {
        let dataUrl, summaryUrl;

        if (line === 'combined') {
            dataUrl = `${API_BASE_URL}/qa/api/combined/${inspectionType}`;
            summaryUrl = `${API_BASE_URL}/qa/api/combined/${inspectionType}/summary`;
        } else {
            dataUrl = `${API_BASE_URL}/qa/api/lines/${line}/${inspectionType}`;
            summaryUrl = `${API_BASE_URL}/qa/api/lines/${line}/${inspectionType}/summary`;
        }

        console.log(`Fetching data from: ${dataUrl}`);

        const [dataResponse, summaryResponse] = await Promise.all([
            fetch(dataUrl),
            fetch(summaryUrl)
        ]);

        if (!dataResponse.ok) {
            throw new Error(`HTTP error! status: ${dataResponse.status}`);
        }
        if (!summaryResponse.ok) {
            throw new Error(`HTTP error! status: ${summaryResponse.status}`);
        }

        const dataResult = await dataResponse.json();
        const summaryResult = await summaryResponse.json();

        return {
            data: dataResult.data || [],
            summary: summaryResult
        };
    } catch (error) {
        return handleApiError(error, `loadInspectionData(${inspectionType}, ${line})`);
    }
}

// UPDATED: Fetch defect analysis from API
export async function fetchDefectAnalysis(inspectionType: string, line: string | null = null): Promise<DefectAnalysisData> {
    try {
        let url = `${API_BASE_URL}/qa/api/analysis/defects/${inspectionType}`;
        if (line) {
            url += `?line_number=${line}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        return handleApiError(error, `fetchDefectAnalysis(${inspectionType}, ${line})`);
    }
}

// UPDATED: Fetch production statistics from API
export async function fetchProductionStats(inspectionType: string | null = null, line: string | null = null): Promise<ProductionStats> {
    try {
        let url = `${API_BASE_URL}/qa/api/analysis/production`;
        const params = new URLSearchParams();

        if (inspectionType) params.append('inspection_type', inspectionType);
        if (line) params.append('line_number', line);

        if (params.toString()) {
            url += '?' + params.toString();
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        return handleApiError(error, `fetchProductionStats(${inspectionType}, ${line})`);
    }
}

// UPDATED: Fetch data by date range from API
export async function fetchDateRangeData(startDate: string, endDate: string, inspectionType: string, metric: string = 'Total rejection'): Promise<DateRangeData> {
    try {
        const url = `${API_BASE_URL}/qa/api/data/date-range?date_from=${startDate}&date_to=${endDate}&inspection_type=${inspectionType}&metric=${encodeURIComponent(metric)}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        return handleApiError(error, `fetchDateRangeData(${startDate}, ${endDate}, ${inspectionType})`);
    }
}

// B-Grade Analysis specific functions
export async function fetchGradeAnalysis(startDate: string, endDate: string): Promise<GradeAnalysisResponse> {
    try {
        const B_GRADE_API_BASE_URL = 'http://localhost:8000/bgrade';
        const response = await fetch(
            `${B_GRADE_API_BASE_URL}/api/aggregated/grade-analysis?start_date=${startDate}&end_date=${endDate}`
        );
        const result: GradeAnalysisResponse = await response.json();
        if (!result.success) {
            throw new Error(result.detail || 'Failed to fetch grade analysis data');
        }
        return result;
    } catch (error) {
        return handleApiError(error, `fetchGradeAnalysis(${startDate}, ${endDate})`);
    }
}

export async function fetchDefectReasonAnalysis(startDate: string, endDate: string): Promise<DefectAnalysisResponse> {
    try {
        const B_GRADE_API_BASE_URL = 'http://localhost:8000/bgrade';
        const response = await fetch(
            `${B_GRADE_API_BASE_URL}/api/aggregated/defect-analysis?start_date=${startDate}&end_date=${endDate}&top_n=15`
        );
        const result: DefectAnalysisResponse = await response.json();
        if (!result.success) {
            throw new Error(result.detail || 'Failed to fetch defect analysis data');
        }
        return result;
    } catch (error) {
        return handleApiError(error, `fetchDefectReasonAnalysis(${startDate}, ${endDate})`);
    }
}