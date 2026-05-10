import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    ArrowRight,
    BarChart3,
    ClipboardCheck,
    Factory,
    FileCheck2,
    LockKeyhole,
    ShieldCheck,
    Sparkles,
    Users,
} from 'lucide-react';

interface PortalModule {
    title: string;
    eyebrow: string;
    description: string;
    route?: string;
    icon: LucideIcon;
    focus: string;
    actionLabel: string;
    statusLabel: string;
    locked?: boolean;
    glowClass: string;
    iconClass: string;
    badgeClass: string;
    buttonClass: string;
}

const HERO_VIDEO_SOURCE = 'https://videos.pexels.com/video-files/7211094/7211094-uhd_3840_2160_30fps.mp4';
const HERO_FALLBACK_IMAGE = '/IMAGES/home-hero-fallback.svg';

const portalModules: PortalModule[] = [
    {
        title: 'IPQC Audit',
        eyebrow: 'Audit command',
        description: 'Launch in-process quality audits with stage-aware coverage, strong traceability, and fast decision handoffs.',
        route: '/quality-audit',
        icon: ShieldCheck,
        focus: 'Stage-driven inspection flow',
        actionLabel: 'Open audit workspace',
        statusLabel: 'Live module',
        glowClass: 'from-cyan-400/35 via-cyan-400/10 to-transparent',
        iconClass: 'border-cyan-300/20 bg-cyan-400/15 text-cyan-100',
        badgeClass: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
        buttonClass: 'from-cyan-500 to-sky-500',
    },
    {
        title: 'Quality Reports',
        eyebrow: 'Executive review',
        description: 'Surface batch insights, trend visibility, and presentation-ready reporting for fast quality reviews.',
        route: '/b-grade-trend',
        icon: BarChart3,
        focus: 'Trend and exception visibility',
        actionLabel: 'View report center',
        statusLabel: 'Insight ready',
        glowClass: 'from-indigo-400/35 via-indigo-400/10 to-transparent',
        iconClass: 'border-indigo-300/20 bg-indigo-400/15 text-indigo-100',
        badgeClass: 'border-indigo-300/20 bg-indigo-400/10 text-indigo-100',
        buttonClass: 'from-indigo-500 to-blue-500',
    },
    {
        title: 'Checksheets',
        eyebrow: 'Line discipline',
        description: 'Move critical checks into structured digital checkpoints for tighter process discipline on the floor.',
        route: '/prelam',
        icon: ClipboardCheck,
        focus: 'Process confirmation checkpoints',
        actionLabel: 'Open checksheets',
        statusLabel: 'Operator ready',
        glowClass: 'from-emerald-400/35 via-emerald-400/10 to-transparent',
        iconClass: 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100',
        badgeClass: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
        buttonClass: 'from-emerald-500 to-teal-500',
    },
    {
        title: 'Analytics',
        eyebrow: 'Performance intelligence',
        description: 'Track production quality health with clear analysis layers built for supervisors and management teams.',
        route: '/fqc',
        icon: Activity,
        focus: 'Production quality intelligence',
        actionLabel: 'Open analytics',
        statusLabel: 'Decision support',
        glowClass: 'from-fuchsia-400/35 via-fuchsia-400/10 to-transparent',
        iconClass: 'border-fuchsia-300/20 bg-fuchsia-400/15 text-fuchsia-100',
        badgeClass: 'border-fuchsia-300/20 bg-fuchsia-400/10 text-fuchsia-100',
        buttonClass: 'from-fuchsia-500 to-pink-500',
    },
    {
        title: 'User Management',
        eyebrow: 'Administration',
        description: 'Control roles, access, and identity governance through the secured admin workspace.',
        route: '/admin',
        icon: Users,
        focus: 'Role and access governance',
        actionLabel: 'Admin workspace',
        statusLabel: 'Restricted',
        locked: true,
        glowClass: 'from-amber-400/35 via-amber-400/10 to-transparent',
        iconClass: 'border-amber-300/20 bg-amber-400/15 text-amber-100',
        badgeClass: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
        buttonClass: 'from-amber-500 to-orange-500',
    },
];

const operationalStats = [
    { value: '05', label: 'Priority modules' },
    { value: 'Live', label: 'Operational pulse' },
    { value: 'Secure', label: 'Role-aware access' },
    { value: 'Tablet', label: 'Responsive ready' },
];

const pulseHighlights = [
    {
        title: 'Audit traceability',
        description: 'Structure inspections with tighter stage context and cleaner review trails.',
    },
    {
        title: 'Faster escalation',
        description: 'Push reports and checksheets into a single quality control surface for quick action.',
    },
    {
        title: 'Management visibility',
        description: 'Present a sharper operational narrative with polished dashboards and executive-ready modules.',
    },
];

const showcasePoints = [
    'Smart Manufacturing Quality Intelligence',
    'Next Generation Quality Assurance Platform',
    'Industrial-grade workflows with premium UI polish',
];

const floatingOrbs = [
    { size: 'h-44 w-44', className: 'top-[12%] left-[8%] bg-cyan-400/20', delay: 0 },
    { size: 'h-60 w-60', className: 'top-[18%] right-[12%] bg-orange-400/15', delay: 0.8 },
    { size: 'h-40 w-40', className: 'bottom-[20%] left-[18%] bg-sky-400/15', delay: 1.4 },
    { size: 'h-72 w-72', className: 'bottom-[-8%] right-[6%] bg-fuchsia-500/12', delay: 2.1 },
];

const quickLinks = [
    { label: 'IPQC Audit', route: '/quality-audit' },
    { label: 'Reports', route: '/b-grade-trend' },
    { label: 'Checksheets', route: '/prelam' },
];

const heroTransition: Transition = {
    duration: 0.7,
    ease: [0.22, 1, 0.36, 1] as const,
};

const Home = () => {
    const navigate = useNavigate();
    const prefersReducedMotion = useReducedMotion();
    const modulesRef = useRef<HTMLDivElement | null>(null);
    const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const [videoFailed, setVideoFailed] = useState(false);

    const saveDataEnabled = typeof navigator !== 'undefined'
        && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const isAdmin = typeof window !== 'undefined' && sessionStorage.getItem('userRole') === 'Admin';

    useEffect(() => {
        if (prefersReducedMotion || saveDataEnabled) {
            return;
        }

        const timer = window.setTimeout(() => {
            setShouldLoadVideo(true);
        }, 180);

        return () => window.clearTimeout(timer);
    }, [prefersReducedMotion, saveDataEnabled]);

    const scrollToModules = () => {
        modulesRef.current?.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start',
        });
    };

    const canPlayVideo = shouldLoadVideo && !prefersReducedMotion && !saveDataEnabled && !videoFailed;

    return (
        <div className="relative isolate min-h-[calc(100vh-5.5rem)] overflow-hidden rounded-[32px] border border-slate-200/10 bg-slate-950 text-white shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
            <div className="absolute inset-0 overflow-hidden">
                {/* Keep the fallback artwork visible until the video is ready. */}
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-85"
                    style={{ backgroundImage: `url(${HERO_FALLBACK_IMAGE})` }}
                />

                {canPlayVideo && (
                    <video
                        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${videoReady ? 'opacity-60' : 'opacity-0'}`}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        poster={HERO_FALLBACK_IMAGE}
                        aria-hidden="true"
                        onLoadedData={() => setVideoReady(true)}
                        onError={() => setVideoFailed(true)}
                    >
                        <source src={HERO_VIDEO_SOURCE} type="video/mp4" />
                    </video>
                )}

                <div className="absolute inset-0 bg-slate-950/35" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.18),transparent_30%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/5 via-slate-950/45 to-slate-950" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[length:110px_110px] opacity-20" />

                {floatingOrbs.map((orb) => (
                    <motion.div
                        key={`${orb.className}-${orb.delay}`}
                        className={`absolute rounded-full blur-3xl ${orb.size} ${orb.className}`}
                        animate={prefersReducedMotion ? undefined : { y: [0, -16, 0], scale: [1, 1.06, 1] }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: orb.delay,
                        }}
                    />
                ))}

                {!prefersReducedMotion && (
                    <motion.div
                        className="absolute inset-y-0 left-[-25%] w-[42%] bg-gradient-to-r from-transparent via-white/10 to-transparent blur-3xl"
                        animate={{ x: ['-5%', '140%'] }}
                        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                    />
                )}
            </div>

            <div className="relative z-10 flex min-h-[calc(100vh-5.5rem)] flex-col">
                <motion.div
                    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...heroTransition, delay: 0.05 }}
                    className="px-4 pb-4 pt-4 sm:px-6 lg:px-8"
                >
                    <div className="mx-auto flex max-w-7xl flex-col gap-4 rounded-[28px] border border-white/10 bg-white/10 px-4 py-4 shadow-[0_20px_50px_rgba(15,23,42,0.35)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                                <img
                                    src="/LOGOS/VSL_Logo (2).png"
                                    alt="Vikram Solar Limited"
                                    className="h-8 w-auto object-contain"
                                />
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
                                    Enterprise cockpit
                                </p>
                                <h2 className="text-sm font-semibold text-white sm:text-base">
                                    Quality Portal Control Deck
                                </h2>
                            </div>
                        </div>

                        <div className="hidden items-center gap-2 lg:flex">
                            {quickLinks.map((link) => (
                                <button
                                    key={link.route}
                                    type="button"
                                    onClick={() => navigate(link.route)}
                                    className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-50"
                                >
                                    {link.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </motion.div>

                <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 pb-10 sm:px-6 lg:px-8">
                    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:pt-6">
                        <motion.section
                            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 32 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...heroTransition, delay: 0.15 }}
                            className="space-y-8"
                        >
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                                    <Sparkles className="h-4 w-4" />
                                    Premium industrial interface
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-200">
                                    <Factory className="h-4 w-4" />
                                    Smart manufacturing quality intelligence
                                </span>
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium uppercase tracking-[0.45em] text-slate-300/80">
                                        Vikram Solar Limited
                                    </p>
                                    <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl xl:text-7xl">
                                        Quality <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-orange-200 bg-clip-text text-transparent">Portal</span>
                                    </h1>
                                </div>

                                <p className="max-w-3xl text-base leading-8 text-slate-200/88 sm:text-lg">
                                    A futuristic quality assurance landing experience built for audits, reporting, traceability, and confident manufacturing decisions across the solar production floor.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate('/quality-audit')}
                                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_45px_rgba(14,165,233,0.32)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(14,165,233,0.4)]"
                                >
                                    Enter Portal
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={scrollToModules}
                                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/12"
                                >
                                    Explore Modules
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/b-grade-trend')}
                                    className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-6 py-3 text-sm font-semibold text-orange-50 transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-300/30 hover:bg-orange-400/16"
                                >
                                    View Reports
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {showcasePoints.map((point) => (
                                    <div
                                        key={point}
                                        className="rounded-full border border-white/10 bg-slate-950/45 px-4 py-2 text-sm text-slate-200/90 backdrop-blur-sm"
                                    >
                                        {point}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                {operationalStats.map((item) => (
                                    <div
                                        key={item.label}
                                        className="rounded-[24px] border border-white/10 bg-white/7 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
                                    >
                                        <p className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
                                            {item.value}
                                        </p>
                                        <p className="mt-2 text-sm text-slate-300/80">
                                            {item.label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </motion.section>

                        <motion.aside
                            initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 28 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ ...heroTransition, delay: 0.22 }}
                            className="relative overflow-hidden rounded-[30px] border border-white/10 bg-slate-950/45 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.4)] backdrop-blur-2xl"
                        >
                            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />
                            <div className="absolute -right-10 top-[-30px] h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />

                            <div className="relative space-y-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
                                            Operational pulse
                                        </p>
                                        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                                            Presentation-ready quality control
                                        </h3>
                                    </div>
                                    <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100">
                                        System live
                                    </div>
                                </div>

                                <div className="rounded-[24px] border border-white/10 bg-white/6 p-5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-slate-300">
                                                Design intent
                                            </p>
                                            <p className="mt-2 text-lg font-semibold text-white">
                                                High-end SaaS polish with industrial clarity
                                            </p>
                                        </div>
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/12 text-cyan-100">
                                            <Sparkles className="h-6 w-6" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {pulseHighlights.map((highlight) => (
                                        <div
                                            key={highlight.title}
                                            className="rounded-[22px] border border-white/10 bg-slate-950/50 p-4 transition-all duration-300 hover:border-cyan-300/20 hover:bg-slate-900/55"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/7 text-cyan-100">
                                                    <FileCheck2 className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-base font-semibold text-white">
                                                        {highlight.title}
                                                    </p>
                                                    <p className="mt-1 text-sm leading-6 text-slate-300/82">
                                                        {highlight.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.aside>
                    </div>

                    <motion.section
                        ref={modulesRef}
                        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 26 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...heroTransition, delay: 0.28 }}
                        className="space-y-6"
                    >
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300/75">
                                    Launch surfaces
                                </p>
                                <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                                    Glassmorphic modules built for action
                                </h2>
                                <p className="max-w-3xl text-sm leading-7 text-slate-300/82 sm:text-base">
                                    A curated landing grid for audits, reports, checksheets, analytics, and governance with smooth motion, strong contrast, and responsive enterprise presentation quality.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => navigate('/fqc')}
                                className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/12"
                            >
                                Open analytics console
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {portalModules.map((module, index) => {
                                const Icon = module.icon;
                                const isLocked = module.locked && !isAdmin;
                                const canNavigate = Boolean(module.route) && !isLocked;

                                return (
                                    <motion.button
                                        key={module.title}
                                        type="button"
                                        onClick={() => {
                                            if (canNavigate && module.route) {
                                                navigate(module.route);
                                            }
                                        }}
                                        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ ...heroTransition, delay: 0.32 + (index * 0.06) }}
                                        whileHover={prefersReducedMotion ? undefined : { y: -8 }}
                                        className={`group relative overflow-hidden rounded-[30px] border border-white/10 bg-white/6 text-left shadow-[0_20px_50px_rgba(15,23,42,0.28)] backdrop-blur-xl transition-all duration-300 ${canNavigate ? 'cursor-pointer hover:border-white/18' : 'cursor-not-allowed hover:border-amber-300/20'}`}
                                    >
                                        <div className={`absolute -right-12 top-[-38px] h-40 w-40 rounded-full bg-gradient-to-br ${module.glowClass} blur-3xl transition duration-500 group-hover:opacity-90`} />
                                        <div className="absolute inset-px rounded-[29px] bg-slate-950/58" />

                                        <div className="relative flex h-full flex-col p-6">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${module.iconClass} shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]`}>
                                                    <Icon className="h-7 w-7" />
                                                </div>
                                                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] ${module.badgeClass}`}>
                                                    {isLocked ? <LockKeyhole className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                                                    {module.statusLabel}
                                                </span>
                                            </div>

                                            <div className="mt-6 space-y-3">
                                                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                                                    {module.eyebrow}
                                                </p>
                                                <h3 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                                                    {module.title}
                                                </h3>
                                                <p className="text-sm leading-7 text-slate-300/82">
                                                    {module.description}
                                                </p>
                                            </div>

                                            <div className="mt-auto pt-6">
                                                <div className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">
                                                        Focus
                                                    </p>
                                                    <div className="mt-3 flex items-center justify-between gap-4">
                                                        <p className="text-sm font-medium text-white">
                                                            {module.focus}
                                                        </p>
                                                        {isLocked ? (
                                                            <LockKeyhole className="h-5 w-5 text-amber-100" />
                                                        ) : (
                                                            <ArrowRight className="h-5 w-5 text-slate-200 transition-transform duration-300 group-hover:translate-x-1" />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className={`mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r px-4 py-2 text-sm font-semibold text-white ${module.buttonClass}`}>
                                                    {module.actionLabel}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.section>
                </div>
            </div>
        </div>
    );
};

export default Home;
