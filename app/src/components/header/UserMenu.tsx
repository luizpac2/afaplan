import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCourseStore } from '../../store/useCourseStore';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Settings, Shield, MessageSquare } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Badge } from '../common/Badge';
import type { BadgeVariant } from '../common/Badge';

export const UserMenu = () => {
    const { user, userProfile, logout } = useAuth();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const clearStore = useCourseStore(state => state.clearStore);
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
            clearStore();
            navigate('/login');
        } catch (error) {
            console.error('Failed to log out', error);
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'SUPER_ADMIN': return 'Superadministrador';
            case 'ADMIN': return 'Administrador';
            case 'CADETE': return 'Ensino';
            case 'DOCENTE': return 'Docente';
            default: return 'Visitante';
        }
    };

    const getRoleVariant = (role: string): BadgeVariant => {
        switch (role) {
            case 'SUPER_ADMIN': return 'purple';
            case 'ADMIN': return 'red';
            case 'DOCENTE': return 'blue';
            case 'CADETE': return 'emerald';
            default: return 'slate';
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 pl-1 p-1 rounded-full md:rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}
            >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm  border ${theme === 'dark' ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>

                <div className="hidden lg:block text-right">
                    <p className={`text-sm  leading-none ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                        {userProfile?.displayName?.split(' ')[0]}
                    </p>
                    <Badge variant={getRoleVariant(userProfile?.role || '')} className="inline-block mt-1 shadow-sm">
                        {userProfile?.role || 'Visitante'}
                    </Badge>
                </div>
            </button>

            {isOpen && (
                <div className={`absolute right-0 top-full mt-2 w-64 rounded-xl shadow-xl border py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                    <div className={`px-4 py-3 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                        <p className={`text-sm  ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{userProfile?.displayName}</p>
                        <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{user?.email}</p>
                        <div className={`mt-2 text-xs inline-flex items-center gap-1.5 px-2 py-1 rounded border ${theme === 'dark' ? 'bg-slate-700/50 text-slate-400 border-slate-600' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                            <Shield size={10} />
                            {getRoleLabel(userProfile?.role || '')}
                        </div>
                    </div>

                    <div className="py-1">
                        <button
                            onClick={() => { navigate('/profile'); setIsOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'}`}
                        >
                            <User size={16} />
                            Meu Perfil
                        </button>
                        <button
                            onClick={() => { navigate('/settings'); setIsOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'}`}
                        >
                            <Settings size={16} />
                            Configurações
                        </button>
                        <button
                            onClick={() => {
                                navigate('/inbox', {
                                    state: {
                                        compose: true,
                                        defaultSubject: `Feedback AFA Planner - ${userProfile?.displayName || 'Usuário'}`,
                                        defaultGroup: 'ADMINS'
                                    }
                                });
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'}`}
                        >
                            <MessageSquare size={16} />
                            Enviar Feedback
                        </button>
                    </div>

                    <div className={`border-t pt-1 mt-1 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                        <button
                            onClick={handleLogout}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors  ${theme === 'dark' ? 'text-red-400 hover:bg-red-400/10' : 'text-red-600 hover:bg-red-50'}`}
                        >
                            <LogOut size={16} />
                            Sair da conta
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
