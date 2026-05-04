export default function GoalMeetingPage() {
    return (
        <div className="relative min-h-[85vh] overflow-hidden rounded-3xl bg-slate-50 p-6 transition-colors duration-300 dark:bg-slate-900">
            <div className="pointer-events-none absolute left-[-10%] top-[-5%] h-72 w-72 rounded-full bg-red-500/15 blur-[90px] dark:bg-red-400/20" />
            <div className="pointer-events-none absolute bottom-[-15%] right-[-5%] h-80 w-80 rounded-full bg-blue-500/10 blur-[110px] dark:bg-blue-400/10" />

            <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col gap-4">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                    Goal Meeting
                </h1>

                <section className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80">
                    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center dark:border-slate-600 dark:bg-slate-900/40">
                        <div className="space-y-3">
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                Goal Meeting
                            </h2>
                            <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                                Goal tracking and milestone management will be implemented here soon
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}