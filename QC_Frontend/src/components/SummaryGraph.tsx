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
    [key: string]: string;
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

    const getActualInspectionType = (): 'pre-el' | 'visual' | 'lam-qc' | 'fqc' => {
        if (type === 'pre-lam') return currentPreLamDataType;
        return type;
    };

    const getDisplayTitle = (): string => {
        if (type === 'pre-lam') {
            const prefix = currentPreLamDataType === 'pre-el' ? 'Pre-EL ' : 'Visual ';
            return `${prefix}${period.charAt(0).toUpperCase() + period.slice(1)} Metrics`;
        }
        return periodTitles[period];
    };

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

    const getDataForDateRange = (data: InspectionData[], startDate: Date, endDate: Date): InspectionData[] => {
        if (data.length === 0) return [];
        return data.filter(row => {
            const rowDate = new Date(row.Date);
            return rowDate >= startDate && rowDate <= endDate;
        });
    };

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

    const updateChartWithData = async () => {
        if (!chartRef.current) return;
        setIsLoading(true);
        try {
            const actualInspectionType = getActualInspectionType();
            const inspectionData = await loadInspectionData(actualInspectionType);
            const { startDate, endDate } = getDateRange(period);
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
            const defectColumns = inspectionData.summary.defect_columns || [];
            const chartData = calculateChartData(filteredData, defectColumns);
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                chartInstance.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Accepted', 'Rejected'],
                        datasets: [{
                            data: [chartData.accepted, chartData.rejected],
                            backgroundColor: [
                                '#27ae60', // Light mode green
                                '#e74c3c'  // Light mode red
                            ],
                            borderWidth: 2,
                            borderColor: '#ffffff dark:border-gray-700'
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

    const showNoDataChart = () => {
        if (!chartRef.current || !chartInstance.current) return;
        if (chartInstance.current) chartInstance.current.destroy();
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
                        borderColor: '#ffffff dark:border-gray-700'
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

    const handlePeriodChange = (newPeriod: 'yearly' | 'monthly' | 'weekly' | 'daily') => {
        setPeriod(newPeriod);
    };

    const togglePreLamDataType = () => {
        if (type === 'pre-lam') setCurrentPreLamDataType(prev => prev === 'pre-el' ? 'visual' : 'pre-el');
    };

    useEffect(() => {
        updateChartWithData();
        return () => {
            if (chartInstance.current) chartInstance.current.destroy();
        };
    }, [period, type, currentPreLamDataType]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (type === 'pre-lam') togglePreLamDataType();
            else updateChartWithData();
        }, 30000);
        return () => clearInterval(interval);
    }, [period, type]);

    return (
        <div className={`
            report-section 
            bg-white dark:bg-gray-900 
            rounded-xl md:rounded-2xl 
            p-3 md:p-4 
            shadow-lg dark:shadow-gray-900/30 
            transition-all duration-300 
            hover:shadow-xl dark:hover:shadow-gray-900/50 
            cursor-pointer 
            min-h-[380px] md:min-h-[480px] 
            flex flex-col
            w-full
        `}>
            {/* Header */}
            <div className={`
                section-header 
                text-center mb-2 md:mb-3 pb-2 md:pb-3 
                border-b-2 
                ${type === 'pre-el' ? '[border-image:linear-gradient(90deg,transparent,red,transparent)_1]' :
                  '[border-image:linear-gradient(90deg,transparent,orange,transparent)_1]'}
            `}>
                <h2 className="text-lg md:text-xl font-semibold text-gray-800 dark:text-gray-100">
                    {title}
                </h2>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {subtitle}
                </p>
            </div>

            {/* Controls */}
            <div className="period-selector flex flex-col sm:flex-row gap-2 md:gap-3 justify-center mb-3 md:mb-4">
                <select
                    className="
                        period-dropdown 
                        px-3 py-2 
                        rounded-lg 
                        border border-gray-300 dark:border-gray-600 
                        bg-white dark:bg-gray-800 
                        text-sm font-medium 
                        cursor-pointer 
                        shadow-sm dark:shadow-gray-900/20 
                        transition-all duration-200 
                        focus:outline-none 
                        hover:shadow-md dark:hover:shadow-gray-900/30
                        text-gray-800 dark:text-gray-200
                    "
                    value={period}
                    onChange={(e) => handlePeriodChange(e.target.value as any)}
                >
                    <option value="yearly" className="dark:bg-gray-700">Yearly Metrics</option>
                    <option value="monthly" className="dark:bg-gray-700">Monthly Metrics</option>
                    <option value="weekly" className="dark:bg-gray-700">Weekly Metrics</option>
                    <option value="daily" className="dark:bg-gray-700">Daily Metrics</option>
                </select>
                <button
                    className="
                        detailed_analysis_btn 
                        bg-white dark:bg-gray-800 
                        text-gray-800 dark:text-gray-200 
                        border border-gray-300 dark:border-gray-600 
                        px-4 py-2 
                        rounded-lg 
                        cursor-pointer 
                        text-sm font-medium 
                        shadow-sm dark:shadow-gray-900/20 
                        transition-all duration-200 
                        hover:bg-gray-50 dark:hover:bg-gray-700 
                        hover:shadow-md dark:hover:shadow-gray-900/30
                        hover:text-blue-600 dark:hover:text-blue-400
                        whitespace-nowrap
                    "
                    onClick={() => window.location.href = dashboardLink}
                >
                    Go to {getButtonText()} Analysis
                </button>
            </div>

            {/* Chart Container */}
            <div className="chart-display-container flex flex-col items-center gap-3 md:gap-4 flex-grow">
                <div className={`
                    selected-period-card 
                    bg-gray-50 dark:bg-gray-900 
                    rounded-xl 
                    p-3 md:p-4 
                    border-l-4 
                    ${type === 'pre-el' ? 'border-red-500' : 'border-orange-300'}
                    w-full shadow-sm dark:shadow-gray-900/20
                `}>
                    <div className="
                        selected-period-title 
                        text-base md:text-lg 
                        font-semibold 
                        text-gray-800 dark:text-gray-100 
                        mb-2 md:mb-3 
                        text-center
                    ">
                        {getDisplayTitle()}
                        {isLoading && (
                            <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 ml-2">
                                Loading...
                            </span>
                        )}
                    </div>
                    
                    {/* Chart Canvas */}
                    <div className="selected-chart-container h-40 md:h-48 mb-3 md:mb-4">
                        <canvas 
                            ref={chartRef} 
                            className="w-full h-full"
                        ></canvas>
                    </div>
                    
                    {/* Stats */}
                    <div className="chart-stats grid grid-cols-3 gap-1 md:gap-2 text-center">
                        <div className="
                            stat-item 
                            flex flex-col 
                            p-2 
                            bg-white dark:bg-gray-800 
                            rounded-lg 
                            border border-gray-200 dark:border-gray-600
                        ">
                            <span className="
                                stat-label 
                                text-xs 
                                text-gray-600 dark:text-gray-400 
                                font-medium 
                                mb-1
                            ">
                                Production:
                            </span>
                            <span className="
                                stat-value 
                                production-value 
                                text-sm 
                                font-semibold 
                                text-green-600 dark:text-green-400
                            ">
                                {chartStats.production.toLocaleString()}
                            </span>
                        </div>
                        <div className="
                            stat-item 
                            flex flex-col 
                            p-2 
                            bg-white dark:bg-gray-800 
                            rounded-lg 
                            border border-gray-200 dark:border-gray-600
                        ">
                            <span className="
                                stat-label 
                                text-xs 
                                text-gray-600 dark:text-gray-400 
                                font-medium 
                                mb-1
                            ">
                                Rejection:
                            </span>
                            <span className="
                                stat-value 
                                rejection-value 
                                text-sm 
                                font-semibold 
                                text-red-600 dark:text-red-400
                            ">
                                {chartStats.rejection.toLocaleString()}
                            </span>
                        </div>
                        <div className="
                            stat-item 
                            flex flex-col 
                            p-2 
                            bg-white dark:bg-gray-800 
                            rounded-lg 
                            border border-gray-200 dark:border-gray-600
                        ">
                            <span className="
                                stat-label 
                                text-xs 
                                text-gray-600 dark:text-gray-400 
                                font-medium 
                                mb-1
                            ">
                                Rej. Rate:
                            </span>
                            <span className="
                                stat-value 
                                rejection-percent 
                                text-sm 
                                font-semibold 
                                text-gray-600 dark:text-gray-300
                            ">
                                {chartStats.rejectionRate}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}