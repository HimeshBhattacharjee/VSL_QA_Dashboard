import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AlertProvider } from './context/AlertContext';
import { ConfirmModalProvider } from './context/ConfirmModalContext';
import { LineProvider } from './context/LineContext';
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedLayout from './components/ProtectedLayout';
import ScrollToTop from './components/ScrollToTop';
import Login from './pages/Login';
import Home from './pages/Home';
import Admin from './pages/Admin';
import GelTest from './pages/GelTest';
import AdhesionTest from './pages/AdhesionTest';
import PottingRatioMeasurement from './pages/PottingRatioMeasurement';
import JBSealantWtMeasurement from './pages/JBSealantWtMeasurement';
import FrameSealantWtMeasurement from './pages/FrameSealantWtMeasurement';
import BusRibbonPullStrengthTest from './pages/BusRibbonPullStrengthTest';
import PeelStrengthBusRibbonJBSolderingTest from './pages/PeelStrengthBusRibbonJBSolderingTest';
import JBContactBlockMaintenanceReport from './pages/JBContactBlockMaintenanceDailyWorkflow';
import SSHTest from './pages/SSHTest';
import PeelTest from './pages/PeelTest';
import RoTTest from './pages/RoTTest';
import WetLeakageTest from './pages/WetLeakageTest';
import BGradeTrend from './pages/BGradeTrend';
import PreLam from './pages/PreLam';
import PreEL from './pages/PreEL';
import Visual from './pages/Visual';
import LamQC from './pages/LamQC';
import FQC from './pages/FQC';
import QualityAudit from './pages/QualityAudit';
import StringerParameterReport from './pages/StringerParameterReport';
import DailyMeeting from './pages/DailyMeeting';
import GoalMeeting from './pages/GoalMeeting';
import {
    IPQCLandingPage,
    QualityAnalysisLandingPage,
    TaskManagementLandingPage,
} from './pages/SectionLandingPages';
import {
    getCurrentTaskManagementRole,
    getTaskManagementPermissions,
} from './utilities/taskAccess';

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

function TaskManagementRoute({ children }: { children: React.ReactNode }) {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const userRole = sessionStorage.getItem('userRole');
    const taskRole = getCurrentTaskManagementRole();
    const permissions = getTaskManagementPermissions(taskRole);

    if (!isLoggedIn) return <Navigate to="/login" replace />;
    if (userRole === 'Admin') return <Navigate to="/admin" replace />;
    if (!permissions.canAccessTaskManagement) return <Navigate to="/home" replace />;
    return <>{children}</>;
}

function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <AlertProvider>
            <ConfirmModalProvider>
                <LineProvider>
                    <ThemeProvider>
                        {children}
                    </ThemeProvider>
                </LineProvider>
            </ConfirmModalProvider>
        </AlertProvider>
    );
}

export default function App() {
    return (
        <AppProviders>
            <Router>
                <ScrollToTop />
                <div className="min-h-screen dark:bg-slate-800 bg-gray-100">
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
                            <Route path="/task-management" element={
                                <TaskManagementRoute>
                                    <TaskManagementLandingPage />
                                </TaskManagementRoute>
                            } />
                            <Route path="/daily-meeting" element={
                                <TaskManagementRoute>
                                    <DailyMeeting />
                                </TaskManagementRoute>
                            } />
                            <Route path="/goal-meeting" element={
                                <TaskManagementRoute>
                                    <GoalMeeting />
                                </TaskManagementRoute>
                            } />
                            <Route path="/ipqc" element={
                                <UserRoute>
                                    <IPQCLandingPage />
                                </UserRoute>
                            } />
                            <Route path="/gel-test" element={
                                <UserRoute>
                                    <GelTest />
                                </UserRoute>
                            } />
                            <Route path="/adhesion-test" element={
                                <UserRoute>
                                    <AdhesionTest />
                                </UserRoute>
                            } />
                            <Route path="/potting" element={
                                <UserRoute>
                                    <PottingRatioMeasurement />
                                </UserRoute>
                            } />
                            <Route path="/jb-sealant-wt" element={
                                <UserRoute>
                                    <JBSealantWtMeasurement />
                                </UserRoute>
                            } />
                            <Route path="/frame-sealant-wt" element={
                                <UserRoute>
                                    <FrameSealantWtMeasurement />
                                </UserRoute>
                            } />
                            <Route path="/bus-ribbon-pull-strength" element={
                                <UserRoute>
                                    <BusRibbonPullStrengthTest />
                                </UserRoute>
                            } />
                            <Route path="/peel-strength-bus-ribbon-jb-soldering" element={
                                <UserRoute>
                                    <PeelStrengthBusRibbonJBSolderingTest />
                                </UserRoute>
                            } />
                            <Route path="/jb-contact-block-maintenance" element={
                                <UserRoute>
                                    <JBContactBlockMaintenanceReport />
                                </UserRoute>
                            } />
                            <Route path="/ssh-test" element={
                                <UserRoute>
                                    <SSHTest />
                                </UserRoute>
                            } />
                            <Route path="/peel-test" element={
                                <UserRoute>
                                    <PeelTest />
                                </UserRoute>
                            } />
                            <Route path="/rot-test" element={
                                <UserRoute>
                                    <RoTTest />
                                </UserRoute>
                            } />
                            <Route path="/wet-leakage-test" element={
                                <UserRoute>
                                    <WetLeakageTest />
                                </UserRoute>
                            } />
                            <Route path="/quality-analysis" element={
                                <UserRoute>
                                    <QualityAnalysisLandingPage />
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
                            <Route path="/quality-audit" element={<Navigate to="/ipqc-audits" replace />} />
                            <Route path="/ipqc-audits" element={
                                <UserRoute>
                                    <QualityAudit />
                                </UserRoute>
                            } />
                            <Route path="/stringer-parameter-report" element={
                                <UserRoute>
                                    <StringerParameterReport />
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
