import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import ZoomableChart from '../components/ZoomableChart';
import { useAlert } from '../context/AlertContext';

interface GradeCounts {
    [key: string]: number;
}

interface DefectReasons {
    [key: string]: number;
}

interface GradeAnalysisResponse {
    success: boolean;
    grade_counts: GradeCounts;
    total_production: number;
    total_defects: number;
    defect_rate: string;
    detail?: string;
}

interface DefectAnalysisResponse {
    success: boolean;
    defect_reasons: DefectReasons;
    total_production: number;
    total_b_grade: number;
    detail?: string;
}

export default function BGradeTrend() {
    const navigate = useNavigate();
    const [currentAnalysisType, setCurrentAnalysisType] = useState<'b-grade' | 'defect'>('b-grade');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
    const [chartData, setChartData] = useState<any>(null);
    const { showAlert } = useAlert();
    const [metrics, setMetrics] = useState({
        totalProduction: 0,
        totalDefect: 0,
        defectRate: '0%'
    });
    const [isLoading, setIsLoading] = useState(false);
    const [hasData, setHasData] = useState(false);

    const B_GRADE_API_BASE_URL = 'http://localhost:8000/bgrade';

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);
        
        setEmptyChartState('Select dates to view data');

        const timer = setTimeout(() => {
            showAlert('warning', 'No data found for the selected date range');
            setIsInitialLoad(false);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isInitialLoad) {
            fetchAndDisplayData();
        }
    }, [startDate, endDate, currentAnalysisType]);

    const handleBackToTests = () => {
        navigate('/quality-tests');
    };

    const setActiveButton = (type: 'b-grade' | 'defect') => {
        setCurrentAnalysisType(type);
        // Immediately set loading state and reset data when switching buttons
        setIsLoading(true);
        setHasData(false);
        setEmptyChartState('Loading...');
    };

    const fetchAndDisplayData = async (suppressAlerts = false) => {
        if (!startDate || !endDate) {
            if (!suppressAlerts && !isInitialLoad) {
                showAlert('error', 'Please select both start and end dates.');
            }
            setEmptyChartState('Select dates to view data');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        try {
            if (currentAnalysisType === 'b-grade') {
                const response = await fetch(
                    `${B_GRADE_API_BASE_URL}/api/aggregated/grade-analysis?start_date=${startDate}&end_date=${endDate}`
                );
                const result: GradeAnalysisResponse = await response.json();
                if (!result.success) {
                    throw new Error(result.detail || 'Failed to fetch grade analysis data');
                }
                processAggregatedGradeData(result);
            } else {
                const response = await fetch(
                    `${B_GRADE_API_BASE_URL}/api/aggregated/defect-analysis?start_date=${startDate}&end_date=${endDate}&top_n=15`
                );
                const result: DefectAnalysisResponse = await response.json();
                if (!result.success) {
                    throw new Error(result.detail || 'Failed to fetch defect analysis data');
                }
                processAggregatedDefectData(result);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            if (!suppressAlerts && !isInitialLoad) {
                showAlert('error', `Failed to fetch data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            setEmptyChartState('No data available for the selected criteria');
            setHasData(false);
        } finally {
            setIsLoading(false);
        }
    };

    const setEmptyChartState = (message: string) => {
        setChartData({
            data: {
                labels: [],
                datasets: [{
                    label: 'Count',
                    data: [],
                    backgroundColor: [],
                    borderColor: [],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: message,
                        font: { size: 16 }
                    },
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Count' }
                    },
                    x: {
                        title: { 
                            display: true, 
                            text: currentAnalysisType === 'b-grade' ? 'Grade' : 'Defect Reason' 
                        }
                    }
                }
            }
        });
        setMetrics({
            totalProduction: 0,
            totalDefect: 0,
            defectRate: '0%'
        });
    };

    // Helper function to check if all values in an object are zero
    const allValuesAreZero = (obj: { [key: string]: number }): boolean => {
        const values = Object.values(obj);
        return values.length > 0 && values.every(value => value === 0);
    };

    const processAggregatedGradeData = (result: GradeAnalysisResponse) => {
        const gradeCounts = result.grade_counts;
        
        // Check if we have data AND if all values are not zero
        if (Object.keys(gradeCounts).length === 0 || allValuesAreZero(gradeCounts)) {
            showAlert('warning', 'No data found for the selected date range');
            setEmptyChartState('No data available for the selected criteria');
            setHasData(false);
            return;
        }

        setHasData(true);
        setMetrics({
            totalProduction: result.total_production,
            totalDefect: result.total_defects,
            defectRate: `${result.defect_rate}%`
        });
        
        createGradeChart(gradeCounts);
    };

    const processAggregatedDefectData = (result: DefectAnalysisResponse) => {
        const reasonCounts = result.defect_reasons;
        
        // Check if we have data AND if all values are not zero
        if (Object.keys(reasonCounts).length === 0 || allValuesAreZero(reasonCounts)) {
            showAlert('warning', 'No data found for the selected date range');
            setEmptyChartState('No data available for the selected criteria');
            setHasData(false);
            return;
        }

        setHasData(true);
        const defectRate = result.total_production > 0 ?
            ((result.total_b_grade / result.total_production) * 100).toFixed(2) : '0';

        setMetrics({
            totalProduction: result.total_production,
            totalDefect: result.total_b_grade,
            defectRate: `${defectRate}%`
        });
        
        createDefectChart(reasonCounts);
    };

    const createGradeChart = (gradeCounts: GradeCounts) => {
        const labels = Object.keys(gradeCounts);
        const data = Object.values(gradeCounts);

        setChartData({
            data: {
                labels: labels,
                datasets: [{
                    label: 'Count',
                    data: data,
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(255, 99, 132, 0.7)'
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'B-Grade Analysis by Grade Type',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Grade'
                        }
                    }
                }
            }
        });
    };

    const createDefectChart = (reasonCounts: DefectReasons) => {
        const labels = Object.keys(reasonCounts).map(label =>
            label === 'null' || label === null || label === '' ? 'UNKNOWN' : label
        );
        const counts = Object.values(reasonCounts);
        const totalDefects = counts.reduce((sum, count) => sum + count, 0);
        const percentages = counts.map(count =>
            totalDefects > 0 ? ((count / totalDefects) * 100).toFixed(2) : 0
        );

        const colorPalette = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)',
            'rgba(199, 199, 199, 0.7)',
            'rgba(83, 102, 255, 0.7)',
            'rgba(40, 159, 64, 0.7)',
            'rgba(210, 105, 30, 0.7)'
        ];

        const backgroundColors = labels.map((_, index) =>
            colorPalette[index % colorPalette.length]
        );

        setChartData({
            data: {
                labels: labels,
                datasets: [{
                    label: 'Percentage',
                    data: percentages,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Defect Reason Analysis for B-Grade Items',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context: any) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                const index = context.dataIndex;
                                const count = counts[index];
                                return `${label}: ${value}% (Count: ${count})`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Percentage (%)'
                        },
                        ticks: {
                            callback: function (value: any) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Defect Reason'
                        }
                    }
                }
            }
        });
    };

    return (
        <div className="pb-4">
            <Header />
            <div className="max-w-7xl mx-auto">
                <div className="text-center text-white mb-6">
                    <button
                        onClick={handleBackToTests}
                        className="bg-white/20 text-white border-2 border-white px-4 py-1 rounded-3xl cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-x-1"
                    >
                        <span className="font-bold text-md">⇐</span> Back to Quality Tests
                    </button>
                </div>

                <div className="bg-white rounded-2xl p-5 mx-5 shadow-2xl">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-center flex-wrap">
                        <div className="flex flex-col">
                            <label htmlFor="startDate" className="text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                            <input
                                type="date"
                                id="startDate"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="cursor-pointer px-3 py-2 rounded-lg text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] focus:outline-none focus:ring-2 focus:ring-[#667eea] hover:-translate-y-0.5"
                            />
                        </div>

                        <div className="flex flex-col">
                            <label htmlFor="endDate" className="text-xs font-semibold text-gray-600 mb-1">End Date</label>
                            <input
                                type="date"
                                id="endDate"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="cursor-pointer px-3 py-2 rounded-lg text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] focus:outline-none focus:ring-2 focus:ring-[#667eea] hover:-translate-y-0.5"
                            />
                        </div>

                        <button
                            onClick={() => setActiveButton('defect')}
                            className={`bg-white text-black rounded-lg px-5 py-2 mt-5 text-sm font-medium cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${currentAnalysisType === 'defect'
                                    ? 'bg-gradient-to-r from-[#8298f9] to-[#ceaaf2] border-transparent'
                                    : 'border-b-2 border-b-[#667eea] hover:-translate-y-0.5'
                                }`}
                        >
                            Defect Reason Analysis
                        </button>

                        <button
                            onClick={() => setActiveButton('b-grade')}
                            className={`bg-white text-black rounded-lg px-5 py-2 mt-5 text-sm font-medium cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${currentAnalysisType === 'b-grade'
                                    ? 'bg-gradient-to-r from-[#8298f9] to-[#ceaaf2] border-transparent'
                                    : 'border-b-2 border-b-[#667eea]'
                                }`}
                        >
                            B-Grade Analysis
                        </button>
                    </div>

                    <div className="chart-container mb-6 h-96">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-gray-500 text-lg">Loading chart data...</div>
                            </div>
                        ) : hasData ? (
                            <ZoomableChart
                                chartData={chartData.data}
                                options={chartData.options}
                                type="bar"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-gray-500 text-lg">No data available for the selected criteria</div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-50 rounded-xl p-5 text-center border-l-4 border-blue-500">
                            <div className="text-3xl font-bold text-gray-800 mb-2">{metrics.totalProduction}</div>
                            <div className="text-sm text-gray-600 font-medium">Total Production</div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-5 text-center border-l-4 border-blue-500">
                            <div className="text-3xl font-bold text-gray-800 mb-2">{metrics.totalDefect}</div>
                            <div className="text-sm text-gray-600 font-medium">Total Defects</div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-5 text-center border-l-4 border-blue-500">
                            <div className="text-3xl font-bold text-gray-800 mb-2">{metrics.defectRate}</div>
                            <div className="text-sm text-gray-600 font-medium">Defect Rate (in %)</div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="alert-container" className="fixed top-5 right-5 z-50 w-80"></div>
        </div>
    );
}