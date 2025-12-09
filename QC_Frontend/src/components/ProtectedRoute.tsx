import { Navigate } from "react-router-dom";

interface ProtectedRouteProps { children: React.ReactNode; }

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    if (!isLoggedIn) return <Navigate to="/" replace />;
    return <>{children}</>;
}