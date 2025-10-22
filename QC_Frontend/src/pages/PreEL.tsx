import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import ZoomableChart from '../components/ZoomableChart';
import { useAlert } from '../context/AlertContext';
import { loadInspectionData } from '../utilities/InspectionAPIUtils';

interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor: string[];
        borderColor: string[];
        borderWidth: number;
    }[];
}

interface InspectionData {
    [key: string]: any;
}

interface InspectionDataset {
    data: InspectionData[];
    summary: {
        defect_columns: string[];
        [key: string]: any;
    };
}

export default function PreEL() {
    const navigate = useNavigate();
    const { showAlert } = useAlert();
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedLine, setSelectedLine] = useState<'1' | '2' | '3' | '4' | 'combined'>('combined');
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [metrics, setMetrics] = useState({
        totalProduction: 0,
        totalRejection: 0,
        rejectionRate: '0%'
    });
    const [isLoading, setIsLoading] = useState(false);

    // Initialize inspection datasets state
    const [preELDataset, setPreELDataset] = useState<InspectionDataset>({
        data: [],
        summary: { defect_columns: [] }
    });


    const handleBackToPreLamDashboard = () => {
        navigate('/prelam');
    };

    // Initialize dates on component mount
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);

        // Load initial data
        loadInitialData();
    }, []);

    // Fetch data when dates or line selection changes
    useEffect(() => {
        if (startDate && endDate) {
            fetchData();
        }
    }, [startDate, endDate, selectedLine]);

    const loadInitialData = async () => {
        try {
            const inspectionData = await loadInspectionData('pre-el', 'combined');
            setPreELDataset(inspectionData);
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    };

    // Translated function from script.js - Generate colors for chart
    const generateColors = (count: number): string[] => {
        const baseColors = [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)',
            'rgba(199, 199, 199, 0.6)',
            'rgba(83, 102, 255, 0.6)',
            'rgba(40, 167, 69, 0.6)',
            'rgba(220, 53, 69, 0.6)',
            'rgba(253, 126, 20, 0.6)',
            'rgba(111, 66, 193, 0.6)'
        ];

        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    };

    // Replace the existing fetchData with this version
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Load fresh data for selected line
            const inspectionData = await loadInspectionData('pre-el', selectedLine);

            // Immediately update state so UI remains consistent
            setPreELDataset(prev => ({
                ...prev,
                'pre-el': inspectionData
            }));

            // Use the freshly fetched data (inspectionData.data) instead of reading from state
            const rawData = inspectionData.data || [];

            // Filter by date range using the local data
            const start = new Date(startDate);
            const end = new Date(endDate);
            const filteredData = rawData.filter((row: InspectionData) => {
                // Defensive: ensure row.Date exists
                if (!row || !row.Date) return false;
                const rowDate = new Date(row.Date);
                return rowDate >= start && rowDate <= end;
            });

            if (filteredData.length === 0) {
                showAlert('warning', 'No data found for the selected date range');
                setChartData({
                    labels: [],
                    datasets: [{
                        label: 'Rejection Count',
                        data: [],
                        backgroundColor: [],
                        borderColor: [],
                        borderWidth: 1
                    }]
                });
                setMetrics({
                    totalProduction: 0,
                    totalRejection: 0,
                    rejectionRate: '0%'
                });
                return;
            }

            // Calculate total production (use Number(...) to be safer)
            const totalProduction = filteredData.reduce((sum: number, row: InspectionData) =>
                sum + (Number(row['Total Production']) || 0), 0
            );

            // Get defect columns from the freshly fetched summary (not from state)
            const defectColumnsRaw: string[] = (inspectionData.summary && inspectionData.summary.defect_columns) || [];
            // Clean defect column names (trim)
            const defectColumns = defectColumnsRaw.map(dc => String(dc).trim());

            const defectData: { [key: string]: number } = {};
            let totalRejection = 0;

            defectColumns.forEach((defect: string) => {
                const defectSum = filteredData.reduce((sum: number, row: InspectionData) =>
                    sum + (Number(row[defect]) || 0), 0
                );
                defectData[defect] = defectSum;
                totalRejection += defectSum;
            });

            const rejectionRate = totalProduction > 0 ?
                ((totalRejection / totalProduction) * 100).toFixed(2) + '%' : '0%';

            const dataValues = defectColumns.map(defect => defectData[defect] || 0);
            const colors = generateColors(defectColumns.length);

            setChartData({
                labels: defectColumns,
                datasets: [{
                    label: 'Rejection Count',
                    data: dataValues,
                    backgroundColor: colors,
                    borderColor: colors.map(color => color.replace('0.6', '1')),
                    borderWidth: 1
                }]
            });

            setMetrics({
                totalProduction,
                totalRejection,
                rejectionRate
            });

        } catch (error) {
            console.error('Error fetching Pre-EL data:', error);
            showAlert('error', `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`);

            setChartData({
                labels: [],
                datasets: [{
                    label: 'Rejection Count',
                    data: [],
                    backgroundColor: [],
                    borderColor: [],
                    borderWidth: 1
                }]
            });

            setMetrics({
                totalProduction: 0,
                totalRejection: 0,
                rejectionRate: '0%'
            });
        } finally {
            setIsLoading(false);
        }
    };


    const handleLineSelect = (line: '1' | '2' | '3' | '4' | 'combined') => {
        setSelectedLine(line);
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function (context: any) {
                        return `${context.label}: ${context.parsed.y} units`;
                    }
                }
            },
            title: {
                display: true,
                text: `Defect Analysis - Pre-EL ${selectedLine === 'combined' ? '(All Lines)' : `(Line ${selectedLine})`}`,
                font: {
                    size: 16
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Number of Rejections'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Defect Types'
                }
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-4">
            <Header />
            <div className="max-w-7xl mx-auto">
                <div className="text-center text-white mb-6">
                    <button
                        onClick={handleBackToPreLamDashboard}
                        className="bg-white/20 text-white border-2 border-white px-4 py-1 rounded-3xl cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-x-1"
                    >
                        <span className="font-bold text-md">⇐</span> Back to Pre-Lam Dashboard
                    </button>
                </div>
                <div className="display bg-white rounded-2xl p-5 shadow-2xl min-h-[500px]">
                    <div className="date-selector flex flex-col md:flex-row gap-4 items-center justify-center mb-6 flex-wrap">
                        <div className="date-input flex flex-col">
                            <label htmlFor="startDate" className="text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                            <input
                                type="date"
                                id="startDate"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="cursor-pointer px-3 py-2 rounded-lg text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 border-b-2 border-b-[#667eea] focus:outline-none focus:ring-2 focus:ring-[#667eea] hover:-translate-y-0.5"
                            />
                        </div>

                        <div className="date-input flex flex-col">
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
                            className={`line-1 bg-white text-black rounded-lg px-4 py-2 mt-5 text-sm font-medium cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${selectedLine === '1' ? 'bg-gradient-to-r from-[#8298f9] to-[#ceaaf2] border-transparent' : 'border-b-2 border-b-[#667eea]'
                                }`}
                            onClick={() => handleLineSelect('1')}
                        >
                            Line - 1
                        </button>
                        <button
                            className={`line-2 bg-white text-black rounded-lg px-4 py-2 mt-5 text-sm font-medium cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${selectedLine === '2' ? 'bg-gradient-to-r from-[#8298f9] to-[#ceaaf2] border-transparent' : 'border-b-2 border-b-[#667eea]'
                                }`}
                            onClick={() => handleLineSelect('2')}
                        >
                            Line - 2
                        </button>
                        <button
                            className={`line-3 bg-white text-black rounded-lg px-4 py-2 mt-5 text-sm font-medium cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${selectedLine === '3' ? 'bg-gradient-to-r from-[#8298f9] to-[#ceaaf2] border-transparent' : 'border-b-2 border-b-[#667eea]'
                                }`}
                            onClick={() => handleLineSelect('3')}
                        >
                            Line - 3
                        </button>
                        <button
                            className={`line-4 bg-white text-black rounded-lg px-4 py-2 mt-5 text-sm font-medium cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${selectedLine === '4' ? 'bg-gradient-to-r from-[#8298f9] to-[#ceaaf2] border-transparent' : 'border-b-2 border-b-[#667eea]'
                                }`}
                            onClick={() => handleLineSelect('4')}
                        >
                            Line - 4
                        </button>
                        <button
                            className={`all_lines bg-white text-black rounded-lg px-4 py-2 mt-5 text-sm font-medium cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${selectedLine === 'combined' ? 'bg-gradient-to-r from-[#8298f9] to-[#ceaaf2] border-transparent' : 'border-b-2 border-b-[#667eea]'
                                }`}
                            onClick={() => handleLineSelect('combined')}
                        >
                            Combined Lines
                        </button>
                    </div>

                    <div className="chart-container mb-8 h-96">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-gray-500 text-lg">Loading chart data...</div>
                            </div>
                        ) : chartData && chartData.labels.length > 0 ? (
                            <ZoomableChart
                                chartData={chartData}
                                options={chartOptions}
                                type="bar"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-gray-500 text-lg">No data available for the selected criteria</div>
                            </div>
                        )}
                    </div>

                    <div className="metrics-container grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="metric-card bg-gray-50 rounded-xl p-5 text-center border-l-4 border-blue-500">
                            <div className="metric-value text-3xl font-bold text-gray-800 mb-2" id="totalProduction">
                                {metrics.totalProduction.toLocaleString()}
                            </div>
                            <div className="metric-label text-sm text-gray-600 font-medium">Total Production</div>
                        </div>
                        <div className="metric-card bg-gray-50 rounded-xl p-5 text-center border-l-4 border-blue-500">
                            <div className="metric-value text-3xl font-bold text-gray-800 mb-2" id="totalRejection">
                                {metrics.totalRejection.toLocaleString()}
                            </div>
                            <div className="metric-label text-sm text-gray-600 font-medium">Total Rejections</div>
                        </div>
                        <div className="metric-card bg-gray-50 rounded-xl p-5 text-center border-l-4 border-blue-500">
                            <div className="metric-value text-3xl font-bold text-gray-800 mb-2" id="rejectionRate">
                                {metrics.rejectionRate}
                            </div>
                            <div className="metric-label text-sm text-gray-600 font-medium">Rejection Rate (in %)</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}