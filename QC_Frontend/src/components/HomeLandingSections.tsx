import { motion, useScroll, useTransform } from 'framer-motion';
import type { ReactNode } from 'react';
import {
    ArrowRight,
    Award,
    BadgeCheck,
    Factory,
    Leaf,
    Lightbulb,
    ShieldCheck,
    Sparkles,
    SunMedium,
    Zap,
    type LucideIcon,
} from 'lucide-react';

type VideoBackdropProps = {
    webmSrc?: string;
    mp4Src: string;
    posterSrc?: string;
    label: string;
    className?: string;
    overlayClassName?: string;
    fallbackClassName?: string;
};

export type FeatureItem = {
    title: string;
    body: string;
    icon: LucideIcon;
};

export const qualityPillars: FeatureItem[] = [
    {
        title: 'Quality Excellence',
        body: 'A unified environment for disciplined checks, approvals, and manufacturing confidence.',
        icon: ShieldCheck,
    },
    {
        title: 'Manufacturing Precision',
        body: 'Purpose-built for solar module processes where consistency and traceability matter.',
        icon: Factory,
    },
    {
        title: 'Sustainable Innovation',
        body: 'Supporting cleaner energy outcomes through smarter quality practices.',
        icon: Leaf,
    },
];

export const premiumHighlights = [
    'Process discipline',
    'Audit readiness',
    'Solar manufacturing focus',
    'Continuous improvement',
];

export function VideoBackdrop({
    webmSrc,
    mp4Src,
    posterSrc,
    label,
    className = '',
    overlayClassName = '',
    fallbackClassName = '',
}: VideoBackdropProps) {
    return (
        <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
            <div className={`absolute inset-0 ${fallbackClassName}`} />
            <video
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={posterSrc}
                aria-label={label}
            >
                {webmSrc && <source src={webmSrc} type="video/webm" />}
                <source src={mp4Src} type="video/mp4" />
            </video>
            <div className={`absolute inset-0 ${overlayClassName}`} />
        </div>
    );
}

export function Reveal({
    children,
    delay = 0,
    className = '',
}: {
    children: ReactNode;
    delay?: number;
    className?: string;
}) {
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.65, ease: 'easeOut', delay }}
        >
            {children}
        </motion.div>
    );
}

export function PremiumButton({
    children,
    variant = 'primary',
}: {
    children: ReactNode;
    variant?: 'primary' | 'secondary';
}) {
    const classes =
        variant === 'primary'
            ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'
            : 'border border-slate-300/80 bg-white/65 text-slate-900 backdrop-blur-md hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15';

    return (
        <button
            type="button"
            className={`group inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 ${classes}`}
        >
            {children}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
    );
}

export function GlassFeatureCard({ item, index = 0 }: { item: FeatureItem; index?: number }) {
    const Icon = item.icon;

    return (
        <motion.article
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: index * 0.08 }}
            whileHover={{ y: -6 }}
            className="group relative overflow-hidden rounded-lg border border-white/60 bg-white/70 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/55 dark:shadow-black/20"
        >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-all duration-300 group-hover:bg-red-600 group-hover:text-white dark:bg-red-500/10 dark:text-red-300 dark:group-hover:bg-red-500">
                <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p>
        </motion.article>
    );
}

export function BrandMark({ label = 'Vikram Solar Quality Portal' }: { label?: string }) {
    return (
        <div className="inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-white/75 px-3 py-2 text-xs font-semibold uppercase text-slate-700 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-white">
                <SunMedium className="h-4 w-4" />
            </span>
            {label}
        </div>
    );
}

export function FloatingQualityRail() {
    const items = [
        { label: 'Excellence', icon: Award },
        { label: 'Integrity', icon: BadgeCheck },
        { label: 'Innovation', icon: Lightbulb },
        { label: 'Energy', icon: Zap },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((item, index) => {
                const Icon = item.icon;
                return (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, scale: 0.96 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.45, delay: index * 0.06 }}
                        className="rounded-lg border border-slate-200 bg-white/70 p-4 text-center shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/10"
                    >
                        <Icon className="mx-auto h-5 w-5 text-red-600 dark:text-red-300" />
                        <p className="mt-2 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">{item.label}</p>
                    </motion.div>
                );
            })}
        </div>
    );
}

export function TechGrid() {
    return (
        <div className="pointer-events-none absolute inset-0 opacity-[0.18] dark:opacity-[0.28]" aria-hidden="true">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.35)_1px,transparent_1px)] bg-[size:42px_42px]" />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(14,165,233,0.18),transparent,rgba(239,68,68,0.14),transparent)]" />
        </div>
    );
}

export function ScrollProgressLine() {
    const { scrollYProgress } = useScroll();
    const scaleX = useTransform(scrollYProgress, [0, 1], [0.08, 1]);

    return (
        <motion.div
            className="fixed left-0 top-16 z-30 h-1 origin-left bg-gradient-to-r from-red-600 via-sky-500 to-emerald-400"
            style={{ scaleX, width: '100%' }}
        />
    );
}

export function SparkleBadge({ children }: { children: ReactNode }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-lg border border-red-200/70 bg-red-50/80 px-3 py-2 text-xs font-semibold uppercase text-red-700 backdrop-blur-md dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
            <Sparkles className="h-4 w-4" />
            {children}
        </div>
    );
}
