import { useState, useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { loadInspectionData } from '../utilities/InspectionAPIUtils';

interface SummaryGraphProps {
    type: 'pre-lam' | 'lam-qc' | 'fqc' | 'pre-el' | 'visual';
    title: string;
    subtitle: string;
    dashboardLink: string;
}

interface InspectionData {
    Date: string;
    'Total Production': string;
    [key: string]: string; // For defect columns
}

interface ChartStats {
    production: number;
    rejection: number;
    rejectionRate: string;
}

export default function SummaryGraph({ type, title, subtitle, dashboardLink }: SummaryGraphProps) {
    const [period, setPeriod] = useState<'yearly' | 'monthly' | 'weekly' | 'daily'>('yearly');
    const [chartStats, setChartStats] = useState<ChartStats>({
        production: 0,
        rejection: 0,
        rejectionRate: '0%'
    });
    const [isLoading, setIsLoading] = useState(true);
    const [currentPreLamDataType, setCurrentPreLamDataType] = useState<'pre-el' | 'visual'>('pre-el');
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    const sectionColors = {
        'pre-lam': '[border-image:linear-gradient(90deg,transparent,red,transparent)_1]',
        'lam-qc': '[border-image:linear-gradient(90deg,transparent,blue,transparent)_1]',
        'fqc': '[border-image:linear-gradient(90deg,transparent,green,transparent)_1]',
        'pre-el': '[border-image:linear-gradient(90deg,transparent,purple,transparent)_1]',
        'visual': '[border-image:linear-gradient(90deg,transparent,orange,transparent)_1]',
    };

    const getButtonText = () => {
        switch (type) {
            case 'pre-lam': return 'Pre-Lam';
            case 'lam-qc': return 'Lam-QC';
            case 'fqc': return 'FQC';
            case 'pre-el': return 'Pre-EL';
            case 'visual': return 'Visual';
            default: return 'Dashboard';
        }
    };

    const periodTitles = {
        yearly: 'Yearly Metrics',
        monthly: 'Monthly Metrics',
        weekly: 'Weekly Metrics',
        daily: 'Daily Metrics'
    };

    // Function to get the actual inspection type (handles pre-lam toggle)
    const getActualInspectionType = (): 'pre-el' | 'visual' | 'lam-qc' | 'fqc' => {
        if (type === 'pre-lam') {
            return currentPreLamDataType;
        }
        return type;
    };

    // Function to get display title (handles pre-lam prefix)
    const getDisplayTitle = (): string => {
        if (type === 'pre-lam') {
            const prefix = currentPreLamDataType === 'pre-el' ? 'Pre-EL ' : 'Visual ';
            return `${prefix}${period.charAt(0).toUpperCase() + period.slice(1)} Metrics`;
        }
        return periodTitles[period];
    };

    // Function to get date range based on period
    const getDateRange = (period: string): { startDate: Date; endDate: Date } => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        let startDate: Date, endDate: Date;

        switch (period) {
            case 'daily':
                startDate = new Date(today);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(today);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'weekly':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 6);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(today);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'monthly':
                startDate = new Date(currentYear, currentMonth, 1);
                endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
                break;
            case 'yearly':
                startDate = new Date(currentYear, 0, 1);
                endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
                break;
            default:
                startDate = new Date(currentYear, 0, 1);
                endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        }

        return { startDate, endDate };
    };

    // Function to filter data for date range
    const getDataForDateRange = (data: InspectionData[], startDate: Date, endDate: Date): InspectionData[] => {
        if (data.length === 0) {
            return [];
        }
        return data.filter(row => {
            const rowDate = new Date(row.Date);
            return rowDate >= startDate && rowDate <= endDate;
        });
    };

    // Function to calculate chart data
    const calculateChartData = (data: InspectionData[], defectColumns: string[] = []) => {
        const totalProduction = data.reduce((sum, row) => sum + (parseInt(row['Total Production']) || 0), 0);

        let totalRejection = 0;
        defectColumns.forEach(defect => {
            const defectSum = data.reduce((sum, row) => sum + (parseInt(row[defect]) || 0), 0);
            totalRejection += defectSum;
        });

        const accepted = Math.max(0, totalProduction - totalRejection);
        const rejected = totalRejection;
        const rejectionRate = totalProduction > 0 ? ((totalRejection / totalProduction) * 100).toFixed(2) + '%' : '0%';

        return {
            accepted,
            rejected,
            totalProduction,
            totalRejection,
            rejectionRate
        };
    };

    // Function to update chart with actual data
    const updateChartWithData = async () => {
        if (!chartRef.current) return;

        setIsLoading(true);

        try {
            // Get the actual inspection type (handles pre-lam toggle)
            const actualInspectionType = getActualInspectionType();

            // Load data for the current inspection type
            const inspectionData = await loadInspectionData(actualInspectionType);
            const { startDate, endDate } = getDateRange(period);

            // Filter data for the selected period
            const filteredData = getDataForDateRange(inspectionData.data, startDate, endDate);

            if (filteredData.length === 0) {
                showNoDataChart();
                setChartStats({
                    production: 0,
                    rejection: 0,
                    rejectionRate: '0%'
                });
                return;
            }

            // Calculate chart data
            const defectColumns = inspectionData.summary.defect_columns || [];
            const chartData = calculateChartData(filteredData, defectColumns);

            // Update chart
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }

            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                chartInstance.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Accepted', 'Rejected'],
                        datasets: [{
                            data: [chartData.accepted, chartData.rejected],
                            backgroundColor: ['#27ae60', '#e74c3c'],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        const label = context.label || '';
                                        const value = context.parsed;
                                        return `${label}: ${value.toLocaleString()} units`;
                                    }
                                }
                            }
                        },
                        animation: {
                            animateScale: true,
                            animateRotate: true,
                        }
                    }
                });
            }

            // Update stats
            setChartStats({
                production: chartData.totalProduction,
                rejection: chartData.totalRejection,
                rejectionRate: chartData.rejectionRate
            });

        } catch (error) {
            console.error('Error updating chart with data:', error);
            showNoDataChart();
            setChartStats({
                production: 0,
                rejection: 0,
                rejectionRate: '0%'
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Function to show no data chart
    const showNoDataChart = () => {
        if (!chartRef.current || !chartInstance.current) return;

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
            chartInstance.current = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['No Data'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#95a5a6'],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            enabled: false
                        }
                    },
                    animation: {
                        animateScale: true,
                        animateRotate: true
                    }
                }
            });
        }
    };

    // Handle period change
    const handlePeriodChange = (newPeriod: 'yearly' | 'monthly' | 'weekly' | 'daily') => {
        setPeriod(newPeriod);
    };

    // Function to toggle pre-lam data type (pre-el ↔ visual)
    const togglePreLamDataType = () => {
        if (type === 'pre-lam') {
            setCurrentPreLamDataType(prev => prev === 'pre-el' ? 'visual' : 'pre-el');
        }
    };

    // Initialize chart and load data
    useEffect(() => {
        updateChartWithData();

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [period, type, currentPreLamDataType]); // Added currentPreLamDataType to dependencies

    // Auto-refresh data every 30 seconds AND toggle pre-lam data type
    useEffect(() => {
        const interval = setInterval(() => {
            if (type === 'pre-lam') {
                // For pre-lam section, toggle between pre-el and visual data
                togglePreLamDataType();
            } else {
                // For other sections, just refresh the data
                updateChartWithData();
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [period, type]); // Only depend on period and type, not currentPreLamDataType

    return (
        <div className={`report-section bg-white rounded-2xl p-3 shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl cursor-pointer min-h-[480px] flex flex-col`}>
            <div className={`section-header text-center mb-2 pb-2 border-b-2 ${sectionColors[type]}`}>
                <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
                <p className="text-sm text-gray-600">{subtitle}</p>
            </div>

            <div className="period-selector flex gap-2 justify-center mb-2">
                <select
                    className="period-dropdown px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold cursor-pointer shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#667eea] hover:shadow-xl"
                    value={period}
                    onChange={(e) => handlePeriodChange(e.target.value as any)}
                >
                    <option value="yearly">Yearly Metrics</option>
                    <option value="monthly">Monthly Metrics</option>
                    <option value="weekly">Weekly Metrics</option>
                    <option value="daily">Daily Metrics</option>
                </select>

                <button
                    className="detailed_analysis_btn bg-white text-black border border-gray-300 px-4 py-2 rounded-lg cursor-pointer text-sm font-semibold shadow-lg transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-y-1"
                    onClick={() => window.location.href = dashboardLink}
                >
                    Go to {getButtonText()} Analysis
                </button>
            </div>

            <div className="chart-display-container flex flex-col items-center gap-5 flex-grow">
                <div className="selected-period-card bg-gray-50 rounded-xl p-4 border-l-4 border-green-400 w-full max-w-md shadow-lg">
                    <div className="selected-period-title text-lg font-semibold text-gray-800 mb-3 text-center">
                        {getDisplayTitle()}
                        {isLoading && <span className="text-sm text-gray-500 ml-2">Loading...</span>}
                    </div>

                    <div className="selected-chart-container h-48 mb-3">
                        <canvas ref={chartRef} className="w-full h-full"></canvas>
                    </div>

                    <div className="chart-stats grid grid-cols-3 gap-2 text-center">
                        <div className="stat-item flex flex-col p-2 bg-white rounded-lg border border-gray-200">
                            <span className="stat-label text-xs text-gray-600 font-medium mb-1">Production:</span>
                            <span className="stat-value production-value text-sm font-semibold text-green-600">
                                {chartStats.production.toLocaleString()}
                            </span>
                        </div>
                        <div className="stat-item flex flex-col p-2 bg-white rounded-lg border border-gray-200">
                            <span className="stat-label text-xs text-gray-600 font-medium mb-1">Rejection:</span>
                            <span className="stat-value rejection-value text-sm font-semibold text-red-600">
                                {chartStats.rejection.toLocaleString()}
                            </span>
                        </div>
                        <div className="stat-item flex flex-col p-2 bg-white rounded-lg border border-gray-200">
                            <span className="stat-label text-xs text-gray-600 font-medium mb-1">Rej. Rate:</span>
                            <span className="stat-value rejection-percent text-sm font-semibold text-gray-600">
                                {chartStats.rejectionRate}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}