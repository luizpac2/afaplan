import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
    const { user, userProfile, loading, profileLoading, mustChangePassword, isInactive } = useAuth();
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

    if (isInactive) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="max-w-sm text-center p-8 bg-slate-800 rounded-2xl shadow-lg border border-slate-700">
                    <div className="w-14 h-14 rounded-full bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                    <p className="text-slate-200 font-medium mb-2">Conta Inativa</p>
                    <p className="text-slate-400 text-sm mb-6">
                        Sua conta foi desativada. Entre em contato com o administrador do sistema para reativá-la.
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
