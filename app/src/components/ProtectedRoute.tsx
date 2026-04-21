import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
    const { user, userProfile, loading, profileLoading, mustChangePassword } = useAuth();
    const location = useLocation();

    // Sessão ainda carregando
    if (loading || profileLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (mustChangePassword) {
        return <Navigate to="/change-password" replace />;
    }

    // Perfil não encontrado após carregamento completo — sem role no sistema
    if (!userProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="max-w-sm text-center p-8 bg-slate-800 rounded-2xl shadow-lg border border-slate-700">
                    <p className="text-slate-200 font-medium mb-2">Acesso não autorizado</p>
                    <p className="text-slate-400 text-sm mb-6">
                        Seu usuário ainda não possui permissão de acesso. Contate o administrador do sistema.
                    </p>
                    <button
                        onClick={async () => { const { supabase } = await import('../config/supabase'); await supabase.auth.signOut(); }}
                        className="text-sm text-red-400 hover:text-red-300"
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
