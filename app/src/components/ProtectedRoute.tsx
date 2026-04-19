import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
    const { user, userProfile, loading, mustChangePassword } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (mustChangePassword) {
        return <Navigate to="/change-password" replace />;
    }

    // Usuário autenticado mas sem role no sistema — mostra mensagem de acesso negado
    if (!userProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="max-w-sm text-center p-8 bg-white rounded-2xl shadow-lg">
                    <p className="text-slate-700 font-medium mb-2">Acesso não autorizado</p>
                    <p className="text-slate-500 text-sm mb-6">
                        Seu usuário ainda não possui permissão de acesso. Contate o administrador do sistema.
                    </p>
                    <button
                        onClick={async () => { const { supabase } = await import('../config/supabase'); await supabase.auth.signOut(); }}
                        className="text-sm text-red-500 hover:text-red-700"
                    >
                        Sair
                    </button>
                </div>
            </div>
        );
    }

    if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
