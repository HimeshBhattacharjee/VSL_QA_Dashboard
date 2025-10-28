import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { AlertProvider } from './context/AlertContext';
import { PreviewModalProvider } from './context/PreviewModalContext';
import { ConfirmModalProvider } from './context/ConfirmModalContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Admin from './pages/Admin';
import QualityTests from './pages/QualityTests';
import GelTest from './pages/GelTest';
import PeelTest from './pages/PeelTest';
import BGradeTrend from './pages/BGradeTrend';
import QualityAnalysis from './pages/QualityAnalysis';
import PreLam from './pages/PreLam';
import PreEL from './pages/PreEL';
import Visual from './pages/Visual';
import LamQC from './pages/LamQC';
import FQC from './pages/FQC';
import QualityAudit from './pages/QualityAudit';
import Test from './pages/Test';

function ProtectedLayout() {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    if (!isLoggedIn) return <Navigate to="/login" replace />;
    return <Outlet />;
}

function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <AlertProvider>
            <PreviewModalProvider>
                <ConfirmModalProvider>
                    {children}
                </ConfirmModalProvider>
            </PreviewModalProvider>
        </AlertProvider>
    );
}

export default function App() {
    return (
        <AppProviders>
            <Router>
                <div className="min-h-screen bg-[linear-gradient(135deg,_rgb(102,126,234)_0%,_rgb(118,75,162)_100%)]">
                    <Routes>
                        <Route path="/" element={<Login />} />
                        <Route element={<ProtectedLayout />}>
                            <Route path="/home" element={<Home />} />
                            <Route path="/admin" element={<Admin />} />
                            <Route path="/quality-tests" element={<QualityTests />} />
                            <Route path="/gel-test" element={<GelTest />} />
                            <Route path="/peel-test" element={<PeelTest />} />
                            <Route path="/b-grade-trend" element={<BGradeTrend />} />
                            <Route path="/quality-analysis" element={<QualityAnalysis />} />
                            <Route path="/prelam" element={<PreLam />} />
                            <Route path="/pre-el" element={<PreEL />} />
                            <Route path="/visual" element={<Visual />} />
                            <Route path="/lamqc" element={<LamQC />} />
                            <Route path="/fqc" element={<FQC />} />
                            <Route path="/quality-audit" element={<QualityAudit />} />
                            <Route path="/test" element={<Test />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </Router>
        </AppProviders>
    );
}