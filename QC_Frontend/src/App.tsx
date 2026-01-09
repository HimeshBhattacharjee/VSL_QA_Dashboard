import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AlertProvider } from './context/AlertContext';
import { ConfirmModalProvider } from './context/ConfirmModalContext';
import { LineProvider } from './context/LineContext';
import ProtectedLayout from './components/ProtectedLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import Admin from './pages/Admin';
import GelTest from './pages/GelTest';
import PeelTest from './pages/PeelTest';
import BGradeTrend from './pages/BGradeTrend';
import PreLam from './pages/PreLam';
import PreEL from './pages/PreEL';
import Visual from './pages/Visual';
import LamQC from './pages/LamQC';
import FQC from './pages/FQC';
import QualityAudit from './pages/QualityAudit';

function UserRoute({ children }: { children: React.ReactNode }) {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    const userRole = sessionStorage.getItem("userRole");

    if (!isLoggedIn) return <Navigate to="/login" replace />;
    if (userRole === 'Admin') return <Navigate to="/admin" replace />;
    return <>{children}</>;
}

function AdminRoute() {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    const userRole = sessionStorage.getItem("userRole");

    if (!isLoggedIn) return <Navigate to="/login" replace />;
    if (userRole !== 'Admin') return <Navigate to="/home" replace />;
    return <Admin />;
}

function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <AlertProvider>
            <ConfirmModalProvider>
                <LineProvider>
                    {children}
                </LineProvider>
            </ConfirmModalProvider>
        </AlertProvider>
    );
}

export default function App() {
    return (
        <AppProviders>
            <Router>
                <div className="min-h-screen bg-[linear-gradient(135deg,_rgb(102,126,234)_0%,_rgb(118,75,162)_100%)]">
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={<Navigate to="/login" replace />} />
                        <Route path="/admin" element={<AdminRoute />} />
                        <Route element={<ProtectedLayout />}>
                            <Route path="/home" element={
                                <UserRoute>
                                    <Home />
                                </UserRoute>
                            } />
                            <Route path="/gel-test" element={
                                <UserRoute>
                                    <GelTest />
                                </UserRoute>
                            } />
                            <Route path="/peel-test" element={
                                <UserRoute>
                                    <PeelTest />
                                </UserRoute>
                            } />
                            <Route path="/b-grade-trend" element={
                                <UserRoute>
                                    <BGradeTrend />
                                </UserRoute>
                            } />
                            <Route path="/prelam" element={
                                <UserRoute>
                                    <PreLam />
                                </UserRoute>
                            } />
                            <Route path="/pre-el" element={
                                <UserRoute>
                                    <PreEL />
                                </UserRoute>
                            } />
                            <Route path="/visual" element={
                                <UserRoute>
                                    <Visual />
                                </UserRoute>
                            } />
                            <Route path="/lamqc" element={
                                <UserRoute>
                                    <LamQC />
                                </UserRoute>
                            } />
                            <Route path="/fqc" element={
                                <UserRoute>
                                    <FQC />
                                </UserRoute>
                            } />
                            <Route path="/quality-audit" element={
                                <UserRoute>
                                    <QualityAudit />
                                </UserRoute>
                            } />
                        </Route>
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </div>
            </Router>
        </AppProviders>
    );
}