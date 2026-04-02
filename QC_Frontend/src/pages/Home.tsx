import Greeting from "../components/Greeting";

const Home = () => {
    return (
        <div className="relative flex flex-col items-center justify-center min-h-[85vh] w-full bg-slate-50 dark:bg-slate-900 overflow-hidden transition-colors duration-300 rounded-3xl p-6">
            <div className="absolute top-[-10%] w-full h-88 bg-red-600/20 dark:bg-red-500/30 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-[30rem] h-[30rem] bg-blue-600/5 dark:bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center justify-center space-y-12">
                <div className="text-center space-y-4 animate-fade-in-up">
                    <Greeting />
                    <p className="text-md md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-medium">
                        Welcome to the Quality Assurance Portal. Let's drive excellence and uphold the highest standards in solar manufacturing today.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl pt-4">
                    <div className="group relative flex flex-col items-center text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 hover:border-[#e31e24]/50 dark:hover:border-[#ff3b41]/50 transition-all duration-300 cursor-pointer overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative z-10 w-16 h-16 bg-red-50 dark:bg-slate-700/50 text-[#e31e24] dark:text-[#ff3b41] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[#e31e24] group-hover:text-white dark:group-hover:bg-[#ff3b41] transition-all duration-300">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        </div>
                        <h3 className="relative z-10 text-xl font-bold text-slate-800 dark:text-white mb-2">Initiate Test</h3>
                        <p className="relative z-10 text-slate-500 dark:text-slate-400 text-sm">Log new parameters and execute standard production line tests.</p>
                    </div>
                    <div className="group relative flex flex-col items-center text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 hover:border-[#e31e24]/50 dark:hover:border-[#ff3b41]/50 transition-all duration-300 cursor-pointer overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative z-10 w-16 h-16 bg-red-50 dark:bg-slate-700/50 text-[#e31e24] dark:text-[#ff3b41] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[#e31e24] group-hover:text-white dark:group-hover:bg-[#ff3b41] transition-all duration-300">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <h3 className="relative z-10 text-xl font-bold text-slate-800 dark:text-white mb-2">Review Analysis</h3>
                        <p className="relative z-10 text-slate-500 dark:text-slate-400 text-sm">Access deep dives and reports on recent manufacturing batches.</p>
                    </div>
                    <div className="group relative flex flex-col items-center text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 hover:border-[#e31e24]/50 dark:hover:border-[#ff3b41]/50 transition-all duration-300 cursor-pointer overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative z-10 w-16 h-16 bg-red-50 dark:bg-slate-700/50 text-[#e31e24] dark:text-[#ff3b41] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[#e31e24] group-hover:text-white dark:group-hover:bg-[#ff3b41] transition-all duration-300">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        </div>
                        <h3 className="relative z-10 text-xl font-bold text-slate-800 dark:text-white mb-2">Compliance & Audits</h3>
                        <p className="relative z-10 text-slate-500 dark:text-slate-400 text-sm">Prepare for and review internal quality compliance checklists.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;