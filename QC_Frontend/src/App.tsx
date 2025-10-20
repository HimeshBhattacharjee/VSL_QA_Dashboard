import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import QualityTests from './pages/QualityTests';
import QualityAnalysis from './pages/QualityAnalysis';
import QualityAudit from './pages/QualityAudit';
import GelTest from './pages/GelTest';
import PeelTest from './pages/PeelTest';
import BGradeTrend from './pages/BGradeTrend';

function ProtectedLayout() {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    if (!isLoggedIn) return <Navigate to="/login" replace />;
    return <Outlet />; // renders child routes if logged in
}

export default function App() {
    return (
        <Router>
            <div className="min-h-screen bg-[linear-gradient(135deg,_rgb(102,126,234)_0%,_rgb(118,75,162)_100%)]">
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route element={<ProtectedLayout />}>
                        <Route path="/home" element={<Home />} />
                        <Route path="/quality-tests" element={<QualityTests />} />
                        <Route path="/quality-analysis" element={<QualityAnalysis />} />
                        <Route path="/quality-audit" element={<QualityAudit />} />
                        <Route path="/gel-test" element={<GelTest />} />
                        <Route path="/peel-test" element={<PeelTest />} />
                        <Route path="/b-grade-trend" element={<BGradeTrend />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </Router>
    );
}