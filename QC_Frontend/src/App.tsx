import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import QualityTests from './pages/QualityTests';
import QualityAnalysis from './pages/QualityAnalysis';
import QualityAudit from './pages/QualityAudit';
import GelTest from './pages/GelTest';
import PeelTest from './pages/PeelTest';
import BGradeTrend from './pages/BGradeTrend';

export default function App() {
    return (
        <Router>
            <div className="min-h-screen bg-[linear-gradient(135deg,_rgb(102,126,234)_0%,_rgb(118,75,162)_100%)]">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/quality-tests" element={<QualityTests />} />
                    <Route path="/quality-analysis" element={<QualityAnalysis />} />
                    <Route path="/quality-audit" element={<QualityAudit />} />
                    <Route path="/gel-test" element={<GelTest />} />
                    <Route path="/peel-test" element={<PeelTest />} />
                    <Route path="/b-grade-trend" element={<BGradeTrend />} />
                </Routes>
            </div>
        </Router>
    );
}