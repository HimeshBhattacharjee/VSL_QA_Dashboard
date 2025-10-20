import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';

export default function QualityAnalysis() {
    const navigate = useNavigate();
    const handleBackToHome = () => { navigate('/home'); };

    return (
        <div className="min-h-screen">
            <Header />
            <div className="max-w-7xl mx-auto">
                <div className="text-center text-white mb-10">
                    <button
                        onClick={handleBackToHome}
                        className="bg-white/20 text-white border-2 border-white px-4 py-1 rounded-3xl cursor-pointer text-sm font-bold transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-x-1"
                    >
                        <span className="font-bold text-md">⇐</span> Back to Home
                    </button>
                </div>
            </div>
            <div id="alert-container" className="fixed top-5 right-5 z-50 w-80"></div>
        </div>
    );
};