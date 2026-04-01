import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Shield, BadgeCheck, Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const Profile = () => {
    const { user, userProfile } = useAuth();
    const { theme } = useTheme();

    return (
        <div className="max-w-4xl mx-auto p-8">
            <h1 className={`text-3xl  mb-8 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>Meu Perfil</h1>

            <div className={`rounded-2xl shadow-sm border overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                {/* Cover / Header */}
                <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative"></div>

                <div className="px-8 pb-8 relative">
                    {/* Avatar */}
                    <div className="relative -mt-16 mb-6">
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center border-4 shadow-md text-4xl  ${theme === 'dark'
                                ? 'bg-slate-700 text-slate-300 border-slate-800'
                                : 'bg-slate-100 text-slate-400 border-white'
                            }`}>
                            {userProfile?.displayName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <span className={`absolute bottom-2 right-2 bg-green-500 w-6 h-6 rounded-full border-4 ${theme === 'dark' ? 'border-slate-800' : 'border-white'}`} title="Online"></span>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div>
                            <h2 className={`text-2xl  flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                                {userProfile?.displayName}
                                <BadgeCheck className="text-blue-500" size={24} />
                            </h2>
                            <p className={` ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{user?.email}</p>

                            <div className="flex gap-2 mt-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm  border ${theme === 'dark'
                                        ? 'bg-blue-900/30 text-blue-300 border-blue-800'
                                        : 'bg-blue-50 text-blue-700 border-blue-100'
                                    }`}>
                                    <Shield size={14} />
                                    {userProfile?.role}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3 w-full md:w-auto">
                            <button className={`flex-1 md:flex-none px-4 py-2  rounded-lg transition-colors ${theme === 'dark'
                                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}>
                                Editar Perfil
                            </button>
                            <button className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white  rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                                Alterar Senha
                            </button>
                        </div>
                    </div>

                    <div className={`mt-8 pt-8 border-t grid grid-cols-1 md:grid-cols-2 gap-8 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                        <div>
                            <h3 className={`text-lg  mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                                <User size={20} className="text-slate-400" />
                                Informações Pessoais
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs  text-slate-400 uppercase tracking-wider block mb-1">Nome Completo</label>
                                    <p className={` px-3 py-2 rounded-lg border ${theme === 'dark'
                                            ? 'text-slate-300 bg-slate-900/50 border-slate-700'
                                            : 'text-slate-700 bg-slate-50 border-slate-100'
                                        }`}>{userProfile?.displayName}</p>
                                </div>
                                <div>
                                    <label className="text-xs  text-slate-400 uppercase tracking-wider block mb-1">Email</label>
                                    <p className={` px-3 py-2 rounded-lg border flex items-center gap-2 ${theme === 'dark'
                                            ? 'text-slate-300 bg-slate-900/50 border-slate-700'
                                            : 'text-slate-700 bg-slate-50 border-slate-100'
                                        }`}>
                                        <Mail size={16} />
                                        {user?.email}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className={`text-lg  mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                                <Clock size={20} className="text-slate-400" />
                                Atividade Recente
                            </h3>
                            <div className={`rounded-lg p-4 border text-center text-sm ${theme === 'dark'
                                    ? 'bg-slate-900/50 border-slate-700 text-slate-400'
                                    : 'bg-slate-50 border-slate-100 text-slate-500'
                                }`}>
                                Nenhuma atividade recente registrada.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
