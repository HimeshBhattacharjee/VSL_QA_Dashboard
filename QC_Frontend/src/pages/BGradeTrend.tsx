import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';

export default function BGradeTrend() {
    const navigate = useNavigate();
    const handleBackToTests = () => { navigate('/quality-tests'); };

    return (
        <div className="min-h-screen">
            <Header />
            <div className="max-w-7xl mx-auto">
                <div className="text-center text-white mb-10">
                    <button
                        onClick={handleBackToTests}
                        className="bg-white/20 text-white border-2 border-white px-4 py-1 rounded-3xl cursor-pointer text-md font-bold transition-all duration-300 hover:bg-white hover:text-[#667eea] hover:-translate-x-1"
                    >
                        <span className="font-bold text-lg">⇐</span> Back to Quality Tests
                    </button>
                </div>
            </div>
            <div id="alert-container" className="fixed top-5 right-5 z-50 w-80"></div>
        </div>
    );
};