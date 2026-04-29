
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCourseStore } from '../store/useCourseStore';
import { useTheme } from '../contexts/ThemeContext';
import { ShieldAlert, LogOut, User, GraduationCap, CheckCircle2, Send, BookOpen } from 'lucide-react';
import { supabase } from '../config/supabase';
import { Navigate } from 'react-router-dom';

export const PendingApproval = () => {
    const { user, userProfile, logout, loading } = useAuth();
    const { disciplines, cohorts } = useCourseStore();
    const { theme } = useTheme();


    const [requestedRole, setRequestedRole] = useState<'CADETE' | 'DOCENTE' | null>(null);
    const [squadron, setSquadron] = useState('');
    const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
    const [comments, setComments] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // If loading, show spinner
    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // If not logged in, redirect to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // If already approved (SUPER_ADMIN, ADMIN, DOCENTE, etc), redirect to dashboard
    if (userProfile?.status === 'APPROVED') {
        return <Navigate to="/" replace />;
    }

    // If status is PENDING, show wait screen
    if (userProfile?.status === 'PENDING') {
        return (
            <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                <div className={`max-w-md w-full rounded-2xl shadow-xl overflow-hidden text-center p-8 ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
                    <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 size={32} />
                    </div>

                    {/* DEBUG INFO - REMOVE LATER */}
                    <div className="mb-4 p-2 bg-gray-100 text-xs text-gray-500 rounded font-mono break-all">
                        Status: {userProfile?.status} | Role: {userProfile?.role} | Email: {user?.email}
                    </div>

                    <h1 className={`text-2xl  mb-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>Solicitação Enviada!</h1>
                    <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        Olá, <span className={` ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{userProfile?.displayName ?? user?.email}</span>!
                        <br />
                        Sua solicitação de acesso foi recebida e está aguardando aprovação dos administradores.
                    </p>

                    <div className={`border rounded-lg p-4 mb-8 text-sm text-left ${theme === 'dark' ? 'bg-blue-900/20 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                        <p className=" mb-1">Dados enviados:</p>
                        <p>Perfil: {userProfile.requestedRole}</p>
                        {userProfile.squadron && <p>Esquadrão: {userProfile.squadron}</p>}
                        {userProfile.teachingDisciplines && <p>Disciplinas: {userProfile.teachingDisciplines.length} selecionadas</p>}
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors  shadow-md"
                        >
                            <CheckCircle2 size={18} />
                            Verificar Aprovação Agora
                        </button>

                        <button
                            onClick={() => logout()}
                            className="flex items-center justify-center gap-2 w-full py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors "
                        >
                            <LogOut size={18} />
                            Sair
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const handleSubmit = async () => {
        if (!user || !requestedRole) return;

        setError('');

        // Validations
        if (requestedRole === 'CADETE' && !squadron) {
            setError('Por favor, selecione seu Esquadrão.');
            return;
        }
        if (requestedRole === 'DOCENTE' && selectedDisciplines.length === 0) {
            setError('Por favor, selecione pelo menos uma disciplina que você ministra.');
            return;
        }

        setIsSubmitting(true);

        try {
            const isSuperAdmin = (user.email ?? '').trim().toLowerCase() === 'pelicano307@gmail.com';
            const assignedRole = isSuperAdmin ? 'super_admin' : 'visitante';

            await supabase.from('user_roles').upsert({
                user_id: user.id,
                role: assignedRole,
                turma_id: requestedRole === 'CADETE' ? squadron : null,
            });

            if (requestedRole === 'DOCENTE' && selectedDisciplines.length > 0) {
                await supabase.auth.updateUser({
                    data: { teachingDisciplines: selectedDisciplines },
                });
            }

            // Force reload to pick up the new status immediately
            window.location.reload();
        } catch (err) {
            console.error(err);
            setError('Erro ao enviar solicitação. Tente novamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleDiscipline = (id: string) => {
        setSelectedDisciplines(prev =>
            prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
        );
    };

    return (
        <div className={`h-screen overflow-y-auto font-sans ${theme === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            <div className="flex flex-col items-center justify-center min-h-full p-4 py-12">
                <div className={`max-w-2xl w-full rounded-2xl shadow-xl overflow-hidden p-8 relative ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>

                    {/* Header with optional Back button */}
                    <div className="text-center mb-8 relative">
                        {requestedRole && (
                            <button
                                onClick={() => {
                                    setRequestedRole(null);
                                    setSquadron('');
                                    setSelectedDisciplines([]);
                                    setComments('');
                                    setError('');
                                }}
                                className="absolute left-0 top-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                title="Voltar"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
                            </button>
                        )}

                        <div className={`mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-4 transform rotate-3 ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                            <ShieldAlert size={28} />
                        </div>
                        <h1 className={`text-2xl  ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>Cadastro de Usuário</h1>
                        <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            Complete suas informações para solicitar acesso ao AFA Plan.
                        </p>
                    </div>

                    {/* Role Selection */}
                    {!requestedRole && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            <button
                                onClick={() => setRequestedRole('CADETE')}
                                className={`p-6 rounded-xl border-2 hover:shadow-md transition-all flex flex-col items-center gap-3 group ${theme === 'dark' ? 'border-slate-700 hover:border-blue-500 text-slate-300' : 'border-slate-200 hover:border-blue-400 text-slate-600'}`}
                            >
                                <div className={`p-3 rounded-full group-hover:scale-110 transition-transform ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                    <User size={32} />
                                </div>
                                <span className=" group-hover:text-blue-700 text-slate-900 dark:text-slate-100">Sou Cadete</span>
                            </button>

                            <button
                                onClick={() => setRequestedRole('DOCENTE')}
                                className={`p-6 rounded-xl border-2 hover:shadow-md transition-all flex flex-col items-center gap-3 group ${theme === 'dark' ? 'border-slate-700 hover:border-green-500 text-slate-300' : 'border-slate-200 hover:border-green-400 text-slate-600'}`}
                            >
                                <div className={`p-3 rounded-full group-hover:scale-110 transition-transform ${theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-600'}`}>
                                    <GraduationCap size={32} />
                                </div>
                                <span className=" group-hover:text-green-700 text-slate-900 dark:text-slate-100">Sou Docente</span>
                            </button>

                            <div className="col-span-1 md:col-span-2 mt-4 flex justify-center">
                                <button
                                    onClick={() => logout()}
                                    className="flex items-center gap-2 px-6 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm "
                                >
                                    <LogOut size={16} />
                                    Sair / Trocar Conta
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Conditional Forms */}
                    {requestedRole && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {requestedRole === 'CADETE' && (
                                <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                    <label className={`block text-sm  mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                        Qual seu Esquadrão?
                                    </label>
                                    <select
                                        value={squadron}
                                        onChange={(e) => setSquadron(e.target.value)}
                                        className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300'}`}
                                    >
                                        <option value="">Selecione...</option>
                                        {cohorts && cohorts.length > 0 ? (
                                            cohorts
                                                .sort((a, b) => b.entryYear - a.entryYear)
                                                .map(cohort => (
                                                    <option key={cohort.id} value={cohort.name}>
                                                        {cohort.name}
                                                    </option>
                                                ))
                                        ) : (
                                            <>
                                                <option value="1º Esquadrão">1º Esquadrão</option>
                                                <option value="2º Esquadrão">2º Esquadrão</option>
                                                <option value="3º Esquadrão">3º Esquadrão</option>
                                                <option value="4º Esquadrão">4º Esquadrão</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            )}

                            {requestedRole === 'DOCENTE' && (
                                <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                    <label className={`block text-sm  mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                        <BookOpen size={16} />
                                        Quais disciplinas você ministra?
                                    </label>
                                    <div className={`max-h-60 overflow-y-auto border rounded-lg p-2 space-y-1 custom-scrollbar ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'}`}>
                                        {disciplines.length > 0 ? [...disciplines].sort((a, b) => {
                                            const nameComp = a.name.localeCompare(b.name, 'pt-BR');
                                            if (nameComp !== 0) return nameComp;
                                            const yearA = a.year === 'ALL' ? 0 : (a.year ?? 0);
                                            const yearB = b.year === 'ALL' ? 0 : (b.year ?? 0);
                                            return yearA - yearB;
                                        }).map(discipline => (
                                            <div
                                                key={discipline.id}
                                                onClick={() => toggleDiscipline(discipline.id)}
                                                className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${selectedDisciplines.includes(discipline.id)
                                                    ? (theme === 'dark' ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-800')
                                                    : (theme === 'dark' ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedDisciplines.includes(discipline.id)
                                                    ? 'bg-green-600 border-green-600 text-white'
                                                    : (theme === 'dark' ? 'border-slate-500 bg-slate-700' : 'border-slate-300 bg-white')
                                                    }`}>
                                                    {selectedDisciplines.includes(discipline.id) && <CheckCircle2 size={14} />}
                                                </div>
                                                <span className="text-sm ">{discipline.name}</span>
                                                <span className="text-xs text-slate-400 ml-auto">{discipline.year === 'ALL' ? 'Todos' : `${discipline.year}º`} Esq</span>
                                            </div>
                                        )) : (
                                            <div className="p-4 text-center text-slate-400 text-sm">
                                                Nenhuma disciplina carregada.
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 text-right">
                                        {selectedDisciplines.length} disciplinas selecionadas
                                    </p>
                                </div>
                            )}

                            {/* Common Fields */}
                            <div>
                                <label className={`block text-sm  mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Comentários ou Observações (Opcional)
                                </label>
                                <textarea
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    placeholder="Alguma informação adicional para o administrador..."
                                    className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300'}`}
                                />

                                {error && (
                                    <div className="mt-4 p-3 bg-red-100 text-red-700 text-sm rounded-lg flex items-center gap-2 animate-pulse">
                                        <ShieldAlert size={16} />
                                        {error}
                                    </div>
                                )}

                                <div className="mt-8 flex gap-3 flex-col-reverse sm:flex-row">
                                    <button
                                        onClick={() => logout()}
                                        className="sm:w-1/3 w-full px-6 py-3 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50  transition-colors flex items-center justify-center gap-2"
                                    >
                                        <LogOut size={18} />
                                        Sair
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="sm:w-2/3 w-full px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800  transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Send size={18} />
                                                Enviar Solicitação
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
