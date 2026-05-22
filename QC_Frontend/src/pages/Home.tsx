import { motion } from 'framer-motion';
import { Factory, Leaf, Milestone, ShieldCheck, Sparkles, SunMedium } from 'lucide-react';
import {
    PremiumButton,
    Reveal,
    ScrollProgressLine,
    SparkleBadge,
    VideoBackdrop,
} from '../components/HomeLandingSections';

const journey = [
    {
        title: 'Set the standard',
        body: 'Quality begins as a shared manufacturing language: precise, calm, and consistent.',
        icon: ShieldCheck,
    },
    {
        title: 'Build with discipline',
        body: 'Every process interaction reinforces confidence in the way solar modules are made.',
        icon: Factory,
    },
    {
        title: 'Advance clean energy',
        body: 'The portal frames quality as a visible part of Vikram Solar sustainability leadership.',
        icon: Leaf,
    },
];

const productionProcessVideo = '/VIDEOS/Vikram%20Solar-%20Production%20Process.mp4';

const Home = () => {
    return (
        <div className="relative overflow-hidden rounded-lg bg-white text-slate-950 shadow-sm transition-colors duration-300 dark:bg-slate-950 dark:text-white">
            <ScrollProgressLine />
            <section className="relative min-h-[calc(100vh-6rem)] overflow-hidden">
                <VideoBackdrop
                    mp4Src={productionProcessVideo}
                    label="Vikram Solar production process"
                    fallbackClassName="bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_36%,#dbeafe_68%,#fee2e2_100%)] dark:bg-[linear-gradient(135deg,#020617_0%,#111827_42%,#2b0909_100%)]"
                    overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0.86)_84%,rgba(255,255,255,1)_100%)] dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.38)_0%,rgba(2,6,23,0.88)_82%,rgba(2,6,23,1)_100%)]"
                />
                <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-7xl flex-col justify-end px-4 pb-12 pt-16 sm:px-8 lg:px-12">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}
                        className="max-w-4xl"
                    >
                        <SparkleBadge>Storytelling Experience</SparkleBadge>
                        <h1 className="mt-8 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                            Vikram Solar Quality Portal
                        </h1>
                        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg dark:text-slate-200">
                            A premium brand-led entrance into quality culture, manufacturing pride, and sustainable energy excellence.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <PremiumButton>Begin the Journey</PremiumButton>
                            <PremiumButton variant="secondary">Our Mission</PremiumButton>
                        </div>
                    </motion.div>
                </div>
            </section>

            <section className="relative border-y border-slate-200 bg-slate-50 px-4 py-16 dark:border-white/10 dark:bg-slate-900 sm:px-8 lg:px-12">
                <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
                    <Reveal>
                        <div>
                            <p className="text-sm font-semibold uppercase text-red-600 dark:text-red-300">Mission statement</p>
                            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
                                Quality as a visible promise to customers, teams, and the future.
                            </h2>
                        </div>
                    </Reveal>
                    <div className="grid gap-4 md:grid-cols-3">
                        {journey.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <Reveal key={item.title} delay={index * 0.08}>
                                    <motion.article
                                        whileHover={{ y: -6 }}
                                        className="h-full rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-white/10"
                                    >
                                        <Icon className="h-6 w-6 text-red-600 dark:text-red-300" />
                                        <h3 className="mt-6 text-lg font-semibold">{item.title}</h3>
                                        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p>
                                    </motion.article>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="relative min-h-[64vh] overflow-hidden px-4 py-16 sm:px-8 lg:px-12">
                <VideoBackdrop
                    mp4Src={productionProcessVideo}
                    label="Vikram Solar manufacturing line in motion"
                    fallbackClassName="bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_45%,#fef2f2_100%)] dark:bg-[linear-gradient(135deg,#020617_0%,#082f49_48%,#111827_100%)]"
                    overlayClassName="bg-[linear-gradient(90deg,rgba(255,255,255,0.94),rgba(255,255,255,0.7),rgba(255,255,255,0.32))] dark:bg-[linear-gradient(90deg,rgba(2,6,23,0.94),rgba(2,6,23,0.74),rgba(2,6,23,0.46))]"
                />
                <div className="relative z-10 mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-end">
                    <Reveal>
                        <div className="max-w-3xl">
                            <p className="text-sm font-semibold uppercase text-sky-700 dark:text-sky-300">Manufacturing journey</p>
                            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-5xl">
                                From disciplined process to trusted solar performance.
                            </h2>
                            <p className="mt-5 text-base leading-8 text-slate-700 dark:text-slate-200">
                                This concept turns the homepage into an elegant narrative, using motion and section transitions to make quality feel strategic rather than operational.
                            </p>
                        </div>
                    </Reveal>
                    <Reveal delay={0.12}>
                        <div className="rounded-lg border border-white/70 bg-white/70 p-5 shadow-xl shadow-slate-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55 dark:shadow-black/30">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white">
                                    <Milestone className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">High-level achievement</p>
                                    <p className="text-lg font-semibold">Certified quality culture</p>
                                </div>
                            </div>
                            <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                Dummy leadership-safe messaging only: excellence, governance, sustainability, and innovation.
                            </p>
                        </div>
                    </Reveal>
                </div>
            </section>

            <section className="bg-slate-950 px-4 py-14 text-white dark:bg-black sm:px-8 lg:px-12">
                <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                        <div className="flex items-center gap-3 text-red-300">
                            <SunMedium className="h-5 w-5" />
                            <span className="text-sm font-semibold uppercase">Quality Portal</span>
                        </div>
                        <h2 className="mt-4 text-3xl font-semibold">A polished first impression for enterprise quality leadership.</h2>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/10 px-4 py-3">
                        <Sparkles className="h-5 w-5 text-emerald-300" />
                        <span className="text-sm font-semibold">Premium brand review concept</span>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;