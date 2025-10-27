import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Greeting from '../components/Greeting';

export default function Home() {
    const navigate = useNavigate();

    return (
        <div>
            <Header />
            <Greeting />
            <div className="grid gap-8 grid-cols-3 px-4">
                <div
                        className="bg-white hover:bg-[radial-gradient(circle,rgba(106,17,203,0.15)_30%,rgba(37,117,252,0.1)_60%,transparent_90%)] opacity-100 text-[#321d53] p-10 rounded-2xl text-center cursor-pointer transition-all duration-600 relative overflow-hidden border-2 border-gray-200 hover:border-[#6a11cb] hover:scale-100 hover:-translate-y-3 hover:shadow-2xl"
                    onClick={() => navigate('/quality-tests')}
                >
                    <div className="text-4xl mb-2 relative z-20">🧪</div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2 relative z-20">
                        Quality Tests
                    </h2>
                    <p className="text-gray-600 relative z-20">
                        Access detailed quality test reports and metrics
                    </p>
                </div>
                <div
                        className="bg-white hover:bg-[radial-gradient(circle,rgba(106,17,203,0.15)_30%,rgba(37,117,252,0.1)_60%,transparent_90%)] opacity-100 text-[#321d53] p-10 rounded-2xl text-center cursor-pointer transition-all duration-600 relative overflow-hidden border-2 border-gray-200 hover:border-[#6a11cb] hover:scale-100 hover:-translate-y-3 hover:shadow-2xl"
                    onClick={() => navigate('/quality-analysis')}
                >
                    <div className="text-4xl mb-2 relative z-20">📊</div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2 relative z-20">
                        Quality Analysis
                    </h2>
                    <p className="text-gray-600 relative z-20">
                        View comprehensive quality analysis and insights
                    </p>
                </div>
                <div
                        className="bg-white hover:bg-[radial-gradient(circle,rgba(106,17,203,0.15)_30%,rgba(37,117,252,0.1)_60%,transparent_90%)] opacity-100 text-[#321d53] p-10 rounded-2xl text-center cursor-pointer transition-all duration-600 relative overflow-hidden border-2 border-gray-200 hover:border-[#6a11cb] hover:scale-100 hover:-translate-y-3 hover:shadow-2xl"
                    onClick={() => navigate('/quality-audit')}
                >
                    <div className="text-4xl mb-2 relative z-20">📝</div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2 relative z-20">
                        IPQC Audit
                    </h2>
                    <p className="text-gray-600 relative z-20">
                        Maintain detailed quality audit checksheets
                    </p>
                </div>
            </div>
        </div>
    );
};