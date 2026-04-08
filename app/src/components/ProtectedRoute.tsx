import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

import type { UserRole } from '../types';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
    const { user, userProfile, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user) {
        // Redirect to login page but save the attempted url
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!userProfile) {
        // If user is authenticated but has no profile (e.g. was deleted), redirect to Pending Approval (where they can re-register)
        // OR redirect to login. Given the requirement "treated as a new visitor", sending to approval/registration seems appropriate.
        // We verify if we are already there to avoid loop.
        if (location.pathname !== '/pending-approval') {
            return <Navigate to="/pending-approval" replace />;
        }
        // If we are already at pending-approval, let it render (it will handle the null profile)
        return <>{children}</>;
    }

    // Role-based access control
    if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
        // User does not have permission
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
