import React, { useRef } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LineElement,
    BarElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    zoomPlugin
);

interface ZoomableChartProps {
    chartData: any;
    options?: any;
    type?: 'line' | 'bar';
}

const ZoomableChart: React.FC<ZoomableChartProps> = ({ chartData, options, type = 'line' }) => {
    const chartRef = useRef<any>(null);
    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: "index",
            intersect: false,
        },
        plugins: {
            zoom: {
                pan: { enabled: true, mode: 'xy' },
                zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' },
            },
        },
    };

    const mergedOptions = {
        ...defaultOptions,
        ...options,
        plugins: {
            ...defaultOptions.plugins,
            ...options?.plugins,
            zoom: {
                ...defaultOptions.plugins.zoom,
                ...options?.plugins?.zoom,
                pan: {
                    ...defaultOptions.plugins.zoom.pan,
                    ...options?.plugins?.zoom?.pan,
                },
                zoom: {
                    ...defaultOptions.plugins.zoom.zoom,
                    ...options?.plugins?.zoom?.zoom,
                },
            },
        },
    };

    const ChartComponent = type === 'bar' ? Bar : Line;

    const handleResetZoom = () => {
        if (chartRef.current) {
            chartRef.current.resetZoom();
        }
    };

    return (
        <div className="w-3/4 mx-auto">
            <div className="h-80">
                <ChartComponent
                    ref={chartRef}
                    data={chartData}
                    options={mergedOptions}
                    height={400}
                />
            </div>
            <div className="text-center mt-4">
                <button
                    className="px-4 py-2 bg-gradient-to-r from-[#5b78fa] to-[#ceaaf2] border-transparent text-black cursor-pointer rounded-lg hover:-translate-y-0.5 hover:shadow-lg transition-colors duration-200"
                    onClick={handleResetZoom}
                >
                    Reset Zoom
                </button>
            </div>
        </div>
    );
};

export default ZoomableChart;