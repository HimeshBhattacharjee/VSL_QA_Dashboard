import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight, BarChart3, CheckCircle2, ClipboardList,
    FlaskConical, Loader2, Play, ShieldCheck
} from 'lucide-react';
import {
    CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement,
    PointElement, Title, Tooltip, type ChartData, type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { fetchTasks } from '../utilities/taskApi';
import { useTheme } from '../context/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend);

const ACCENT = '#CF181F';
const productionProcessVideo = '/VIDEOS/Vikram%20Solar-%20Production%20Process.mp4';
const PEEL_API_BASE_URL = `${import.meta.env.VITE_API_URL}/peel`;

type KpiState = {
    ongoingTasks: number;
    completedTasks: number;
};

type PeelGraphPoint = {
    date: string;
    average_value: number | null;
    max_value?: number | null;
    min_value?: number | null;
};

type PeelGraphResponse = {
    data?: PeelGraphPoint[];
    stringer?: number;
};

type PeelTrendState = {
    labels: string[];
    values: number[];
    stringer: number | null;
    latestAverage: number | null;
};

const defaultKpis: KpiState = {
    ongoingTasks: 0,
    completedTasks: 0,
};

const defaultPeelTrend: PeelTrendState = {
    labels: [],
    values: [],
    stringer: null,
    latestAverage: null,
};

const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const heroActions = [
    { label: 'Open Task Management', path: '/task-management', primary: true },
    { label: 'Open IPQC', path: '/ipqc', primary: false },
    { label: 'View Quality Analysis', path: '/quality-analysis', primary: false },
    { label: 'Open IPQC Audits', path: '/ipqc-audits', primary: false },
];

const quickLinks = [
    {
        title: 'Task Management',
        description: 'Manage meetings, action items, and department goals.',
        path: '/task-management',
        icon: ClipboardList,
    },
    {
        title: 'IPQC',
        description: 'Open test records, inspection forms, and report entries.',
        path: '/ipqc',
        icon: FlaskConical,
    },
    {
        title: 'Quality Analysis',
        description: 'Review quality trends, dashboards, and process insights.',
        path: '/quality-analysis',
        icon: BarChart3,
    },
    {
        title: 'IPQC Audits',
        description: 'Access audit records, checkpoints, and compliance reviews.',
        path: '/ipqc-audits',
        icon: ShieldCheck,
    },
];

function useElementWidth<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const element = ref.current;

        if (!element) {
            return undefined;
        }

        let animationFrame = 0;
        const updateWidth = () => {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = window.requestAnimationFrame(() => {
                setWidth(Math.round(element.getBoundingClientRect().width));
            });
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);

        if (typeof ResizeObserver === 'undefined') {
            return () => {
                window.cancelAnimationFrame(animationFrame);
                window.removeEventListener('resize', updateWidth);
            };
        }

        const observer = new ResizeObserver(updateWidth);
        observer.observe(element);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            observer.disconnect();
            window.removeEventListener('resize', updateWidth);
        };
    }, []);

    return { ref, width };
}

function getCurrentPeelMonth() {
    const today = new Date();
    return {
        month: monthNames[today.getMonth()],
        year: today.getFullYear(),
    };
}

function formatTrendDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

async function fetchPeelTrend(): Promise<PeelTrendState> {
    const { month, year } = getCurrentPeelMonth();

    for (let stringer = 1; stringer <= 12; stringer += 1) {
        const response = await fetch(
            `${PEEL_API_BASE_URL}/graph-data?month=${month}&year=${year}&stringer=${stringer}&cell_face=both`,
        );

        if (!response.ok) {
            continue;
        }

        const result = await response.json() as PeelGraphResponse;
        const points = (result.data || [])
            .filter((point): point is PeelGraphPoint & { average_value: number } =>
                typeof point.average_value === 'number' && Number.isFinite(point.average_value),
            )
            .slice(-7);

        if (points.length > 0) {
            return {
                labels: points.map((point) => formatTrendDate(point.date)),
                values: points.map((point) => point.average_value),
                stringer,
                latestAverage: points[points.length - 1]?.average_value ?? null,
            };
        }
    }

    return defaultPeelTrend;
}

function PortalVideo() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [needsUserStart, setNeedsUserStart] = useState(false);

    const playVideo = async () => {
        const video = videoRef.current;

        if (!video) {
            return;
        }

        try {
            await video.play();
            setNeedsUserStart(false);
        } catch {
            setNeedsUserStart(true);
        }
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void playVideo();
        }, 300);

        return () => window.clearTimeout(timer);
    }, []);

    return (
        <div className="relative min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_0%,#fee2e2_52%,#e2e8f0_100%)] dark:bg-[linear-gradient(135deg,#020617_0%,#1f2937_58%,#2b0909_100%)]" />
            {!isReady && (
                <div className="absolute inset-0 z-10 flex items-center justify-center text-sm font-medium text-slate-500 dark:text-slate-300">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading preview
                </div>
            )}
            <video
                ref={videoRef}
                className={`relative z-0 block aspect-video max-h-[360px] w-full object-cover transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}
                muted
                loop
                playsInline
                preload="metadata"
                onLoadedMetadata={() => setIsReady(true)}
                onCanPlay={() => {
                    setIsReady(true);
                    void playVideo();
                }}
                onError={() => {
                    setIsReady(true);
                    setNeedsUserStart(false);
                }}
                aria-label="Vikram Solar production process"
            >
                <source src={productionProcessVideo} type="video/mp4" />
            </video>
            <div className="pointer-events-none absolute inset-0 z-10 ring-1 ring-inset ring-white/35 dark:ring-white/10" />
            {needsUserStart && (
                <button
                    type="button"
                    onClick={() => void playVideo()}
                    className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/25 text-white transition-colors hover:bg-slate-950/35"
                >
                    <span className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg">
                        <Play className="h-4 w-4 fill-current" />
                        Play video
                    </span>
                </button>
            )}
        </div>
    );
}

function KpiCard({
    title,
    value,
    helper,
    icon: Icon,
    loading = false,
}: {
    title: string;
    value: string | number;
    helper: string;
    icon: typeof ClipboardList;
    loading?: boolean;
}) {
    return (
        <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{title}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                        {loading ? <Loader2 className="h-7 w-7 animate-spin text-[#CF181F]" /> : value}
                    </p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#CF181F]/10 text-[#CF181F] dark:bg-[#CF181F]/15 dark:text-red-200">
                    <Icon className="h-5 w-5" />
                </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{helper}</p>
        </article>
    );
}

function PeelTrendCard({
    trend,
    loading,
    error,
    className = '',
}: {
    trend: PeelTrendState;
    loading: boolean;
    error: string | null;
    className?: string;
}) {
    const { theme } = useTheme();
    const hasData = trend.labels.length > 0 && trend.values.length > 0;
    const textColor = theme === 'dark' ? '#e5e7eb' : '#1f2937';
    const mutedColor = theme === 'dark' ? '#94a3b8' : '#64748b';
    const gridColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.18)' : 'rgba(100, 116, 139, 0.16)';

    const chartData = useMemo<ChartData<'line'>>(() => ({
        labels: trend.labels,
        datasets: [
            {
                label: 'Average peel strength',
                data: trend.values,
                borderColor: ACCENT,
                backgroundColor: 'rgba(207, 24, 31, 0.12)',
                borderWidth: 2,
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 4,
                tension: 0.35,
            },
            {
                label: 'Minimum requirement',
                data: trend.values.map(() => 1),
                borderColor: theme === 'dark' ? '#fca5a5' : '#991b1b',
                borderDash: [5, 5],
                borderWidth: 1.5,
                pointRadius: 0,
            },
        ],
    }), [theme, trend.labels, trend.values]);

    const chartOptions = useMemo<ChartOptions<'line'>>(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        scales: {
            x: {
                ticks: {
                    color: mutedColor,
                    maxRotation: 0,
                    font: { size: 10 },
                },
                grid: {
                    display: false,
                },
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: mutedColor,
                    font: { size: 10 },
                },
                grid: {
                    color: gridColor,
                },
            },
        },
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: false,
            },
            tooltip: {
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                borderWidth: 1,
                titleColor: textColor,
                bodyColor: textColor,
                callbacks: {
                    label: (context) => {
                        const value = context.parsed.y;
                        const displayValue = typeof value === 'number' ? value.toFixed(2) : '-';
                        return `${context.dataset.label}: ${displayValue} N/mm`;
                    },
                },
            },
        },
    }), [gridColor, mutedColor, textColor, theme]);

    return (
        <article className={`min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 ${className}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Peel Test Trend</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">Recent peel strength performance</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {trend.stringer ? `Current month, stringer ${trend.stringer}, front + back` : 'Current month, front + back'}
                    </p>
                </div>
                <div className="text-left sm:text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Latest average</p>
                    <p className="text-xl font-semibold text-[#CF181F]">
                        {trend.latestAverage === null ? '-' : `${trend.latestAverage.toFixed(2)} N/mm`}
                    </p>
                </div>
            </div>

            <div className="mt-4 h-40 min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                {loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#CF181F]" />
                        Loading trend
                    </div>
                ) : hasData ? (
                    <Line data={chartData} options={chartOptions} />
                ) : (
                    <div className="flex h-full items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
                        {error || 'No recent data available'}
                    </div>
                )}
            </div>

            <div className="mt-4 flex justify-end">
                <Link
                    to="/peel-test"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#CF181F] transition-colors hover:text-red-700 dark:text-red-200 dark:hover:text-red-100"
                >
                    View full analysis
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
        </article>
    );
}

export default function Home() {
    const { ref: pageRef, width: pageWidth } = useElementWidth<HTMLDivElement>();
    const [kpis, setKpis] = useState<KpiState>(defaultKpis);
    const [trend, setTrend] = useState<PeelTrendState>(defaultPeelTrend);
    const [isLoadingKpis, setIsLoadingKpis] = useState(true);
    const [isLoadingTrend, setIsLoadingTrend] = useState(true);
    const [kpiError, setKpiError] = useState<string | null>(null);
    const [trendError, setTrendError] = useState<string | null>(null);
    const isHeroWide = pageWidth >= 980;
    const isActionsWide = pageWidth >= 620;
    const isKpiWide = pageWidth >= 1050;
    const isKpiMedium = pageWidth >= 700;
    const isQuickFourColumn = pageWidth >= 1180;
    const isQuickTwoColumn = pageWidth >= 680;
    const heroGridClass = isHeroWide
        ? 'grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)] items-center'
        : 'grid-cols-1';
    const actionLayoutClass = isActionsWide ? 'flex-row flex-wrap' : 'flex-col';
    const kpiGridClass = isKpiWide
        ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]'
        : isKpiMedium
            ? 'grid-cols-2'
            : 'grid-cols-1';
    const peelTrendClass = !isKpiWide && isKpiMedium ? 'col-span-2' : '';
    const quickGridClass = isQuickFourColumn
        ? 'grid-cols-4'
        : isQuickTwoColumn
            ? 'grid-cols-2'
            : 'grid-cols-1';
    const headingSizeClass = pageWidth >= 520 ? 'text-4xl' : 'text-3xl';

    useEffect(() => {
        if (!pageWidth) {
            return undefined;
        }

        const resizeTimer = window.setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 80);

        return () => window.clearTimeout(resizeTimer);
    }, [pageWidth]);

    useEffect(() => {
        let isMounted = true;

        async function loadKpis() {
            setIsLoadingKpis(true);
            setKpiError(null);

            try {
                const tasks = await fetchTasks();

                if (!isMounted) {
                    return;
                }

                setKpis({
                    ongoingTasks: tasks.filter((task) => task.status === 'To Do').length,
                    completedTasks: tasks.filter((task) => task.status === 'Done').length,
                });
            } catch {
                if (isMounted) {
                    setKpis(defaultKpis);
                    setKpiError('Task data unavailable');
                }
            } finally {
                if (isMounted) {
                    setIsLoadingKpis(false);
                }
            }
        }

        void loadKpis();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function loadTrend() {
            setIsLoadingTrend(true);
            setTrendError(null);

            try {
                const nextTrend = await fetchPeelTrend();

                if (isMounted) {
                    setTrend(nextTrend);
                }
            } catch {
                if (isMounted) {
                    setTrend(defaultPeelTrend);
                    setTrendError('No recent data available');
                }
            } finally {
                if (isMounted) {
                    setIsLoadingTrend(false);
                }
            }
        }

        void loadTrend();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <div
            ref={pageRef}
            className="w-full max-w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-950 shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
        >
            <section className="px-4 py-6 sm:px-6 lg:px-8">
                <div className={`grid min-w-0 gap-6 ${heroGridClass}`}>
                    <div className="min-w-0">
                        <h1 className={`${headingSizeClass} font-extrabold leading-tight text-[#CF181F] dark:text-white`}>
                            VSL QUALITY PORTAL
                        </h1>
                        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-200">
                            A centralized workspace for quality tasks, test records, audits, and performance insights.
                        </p>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Track daily actions, manage inspection data, review analysis trends, and access key quality workflows from one place.
                        </p>
                        <div className={`mt-6 flex gap-3 ${actionLayoutClass}`}>
                            {heroActions.map((action) => (
                                <Link
                                    key={action.path}
                                    to={action.path}
                                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 ${action.primary
                                        ? 'bg-[#CF181F] text-white shadow-sm hover:bg-red-700'
                                        : 'border border-slate-300 bg-white text-slate-800 hover:border-[#CF181F]/40 hover:text-[#CF181F] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-red-300/40 dark:hover:text-red-200'
                                        }`}
                                >
                                    {action.label}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            ))}
                        </div>
                    </div>
                    <PortalVideo />
                </div>
            </section>

            <section className="border-t border-slate-200 px-4 py-6 dark:border-slate-800 sm:px-6 lg:px-8">
                <div className="mb-4">
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Today&apos;s Quality Focus</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        A quick view of task progress and recent inspection performance.
                    </p>
                    {kpiError && <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">{kpiError}</p>}
                </div>
                <div className={`grid min-w-0 gap-4 ${kpiGridClass}`}>
                    <KpiCard
                        title="Ongoing Tasks"
                        value={kpis.ongoingTasks}
                        helper="Daily Meeting tasks currently marked To Do."
                        icon={ClipboardList}
                        loading={isLoadingKpis}
                    />
                    <KpiCard
                        title="Completed Tasks"
                        value={kpis.completedTasks}
                        helper="Daily Meeting tasks currently marked Done."
                        icon={CheckCircle2}
                        loading={isLoadingKpis}
                    />
                    <PeelTrendCard trend={trend} loading={isLoadingTrend} error={trendError} className={peelTrendClass} />
                </div>
            </section>

            <section className="border-t border-slate-200 px-4 py-6 dark:border-slate-800 sm:px-6 lg:px-8">
                <div className="mb-4">
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Quick Access</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Open the main quality workflows directly.</p>
                </div>
                <div className={`grid min-w-0 gap-4 ${quickGridClass}`}>
                    {quickLinks.map((item) => {
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className="group min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#CF181F]/35 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-[#CF181F]/45"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#CF181F]/10 text-[#CF181F] transition-colors group-hover:bg-[#CF181F] group-hover:text-white dark:bg-[#CF181F]/15 dark:text-red-200">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-[#CF181F]" />
                                </div>
                                <h3 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">{item.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                            </Link>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
