import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';

export default function QualityTests() {
    const navigate = useNavigate();
    const handleBackToHome = () => {
        navigate('/');
    };

    const handleTestClick = (testPath: string) => {
        navigate(testPath);
    };

    return (
        <div className="min-h-screen">
            <Header />
            
            <div className="max-w-7xl mx-auto">
                <div className="text-center text-white mb-10">
                    <button 
                        onClick={handleBackToHome}
                        className="bg-white/20 text-white border-2 border-white px-4 py-1 rounded-3xl cursor-pointer text-md font-bold transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-x-1"
                    >
                        <span className="font-bold text-lg">⇐</span> Back to Home
                    </button>
                </div>

                {/* Tests Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8 px-4">
                    {/* Gel Content Test Card */}
                    <div 
                        className="bg-white hover:bg-[radial-gradient(circle,rgba(106,17,203,0.15)_30%,rgba(37,117,252,0.1)_60%,transparent_90%)] opacity-100 text-[#321d53] p-10 rounded-2xl text-center cursor-pointer transition-all duration-600 relative overflow-hidden border-2 border-gray-200 hover:border-[#6a11cb] hover:scale-100 hover:-translate-y-3 hover:shadow-2xl"
                        onClick={() => handleTestClick('/gel-test')}
                    >
                        <h2 className="text-3xl font-bold mb-2 relative z-20">
                            Gel Content Test
                        </h2>
                        <p className="text-gray-600 relative z-20">
                            Detailed Gel Content Test results and metrics
                        </p>
                    </div>

                    {/* Peel Strength Test Card */}
                    <div 
                        className="bg-white hover:bg-[radial-gradient(circle,rgba(106,17,203,0.15)_30%,rgba(37,117,252,0.1)_60%,transparent_90%)] opacity-100 text-[#321d53] p-10 rounded-2xl text-center cursor-pointer transition-all duration-600 relative overflow-hidden border-2 border-gray-200 hover:border-[#6a11cb] hover:scale-100 hover:-translate-y-3 hover:shadow-2xl"
                        onClick={() => handleTestClick('/peel-test')}
                    >                        
                        <h2 className="text-3xl font-bold mb-2 relative z-20">
                            Peel Strength Test
                        </h2>
                        <p className="text-gray-600 relative z-20">
                            Detailed Peel Strength Test results and metrics
                        </p>
                    </div>

                    {/* B-Grade Trend Analysis Card */}
                    <div
                        className="bg-white hover:bg-[radial-gradient(circle,rgba(106,17,203,0.15)_30%,rgba(37,117,252,0.1)_60%,transparent_90%)] opacity-100 text-[#321d53] p-10 rounded-2xl text-center cursor-pointer transition-all duration-600 relative overflow-hidden border-2 border-gray-200 hover:border-[#6a11cb] hover:scale-100 hover:-translate-y-3 hover:shadow-2xl"
                        onClick={() => handleTestClick('/b-grade-trend')}
                    >
                        <h2 className="text-3xl font-bold mb-2 relative z-20">
                            B-Grade Trend Analysis
                        </h2>
                        <p className="text-gray-600 relative z-20">
                            Detailed B-Grade Trend analysis
                        </p>
                    </div>

                    {/* Coming Soon Card */}
                    <div 
                        className="col-2 bg-white hover:bg-[radial-gradient(circle,rgba(106,17,203,0.15)_30%,rgba(37,117,252,0.1)_60%,transparent_90%)] opacity-60 text-[#321d53] p-10 rounded-2xl text-center cursor-not-allowed transition-all duration-600 relative overflow-hidden border-2 border-gray-200 hover:border-[#6a11cb] hover:scale-100 hover:-translate-y-3 hover:shadow-2xl"
                    >
                        <h2 className="text-3xl font-bold mb-2 relative z-20">
                            Coming Soon
                        </h2>
                        <p className="text-gray-600 relative z-20">
                            Additional test types will be available soon
                        </p>
                    </div>
                </div>
            </div>

            {/* Alert Container - Fixed position for alerts */}
            <div id="alert-container" className="fixed top-5 right-5 z-50 w-80"></div>
        </div>
    );
};