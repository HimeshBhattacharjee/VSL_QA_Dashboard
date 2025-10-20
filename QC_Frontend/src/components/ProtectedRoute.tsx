import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");

    if (!isLoggedIn) {
        // User not logged in → redirect to login page
        return <Navigate to="/" replace />;
    }

    // User logged in → show protected page
    return <>{children}</>;
}