import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { User, Mail, Shield, BadgeCheck, KeyRound, Eye, EyeOff, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const Profile = () => {
    const { user, userProfile } = useAuth();
    const { theme } = useTheme();

    const [showPwdForm, setShowPwdForm] = useState(false);
    const [currentPwd, setCurrentPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [showNew, setShowNew] = useState(false);
    const [pwdError, setPwdError] = useState<string | null>(null);
    const [pwdSuccess, setPwdSuccess] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleChangePassword = async () => {
        setPwdError(null);
        if (newPwd.length < 8) { setPwdError("A senha deve ter ao menos 8 caracteres."); return; }
        if (!/[A-Z]/.test(newPwd)) { setPwdError("A senha deve conter ao menos uma letra maiúscula."); return; }
        if (!/[0-9]/.test(newPwd)) { setPwdError("A senha deve conter ao menos um número."); return; }
        if (newPwd !== confirmPwd) { setPwdError("As senhas não coincidem."); return; }

        setIsSaving(true);
        try {
            // Re-autentica com a senha atual para validar
            const { error: signInErr } = await supabase.auth.signInWithPassword({
                email: user?.email ?? "",
                password: currentPwd,
            });
            if (signInErr) { setPwdError("Senha atual incorreta."); return; }

            const { error } = await supabase.auth.updateUser({
                password: newPwd,
                data: { must_change_password: false },
            });
            if (error) { setPwdError(error.message); return; }

            setPwdSuccess(true);
            setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
            setTimeout(() => { setPwdSuccess(false); setShowPwdForm(false); }, 2500);
        } finally {
            setIsSaving(false);
        }
    };

    const inputCls = `w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
        theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900'
    }`;

    return (
        <div className="max-w-4xl mx-auto p-8">
            <h1 className={`text-3xl mb-8 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>Meu Perfil</h1>

            <div className={`rounded-2xl shadow-sm border overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative" />

                <div className="px-8 pb-8 relative">
                    <div className="relative -mt-16 mb-6">
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center border-4 shadow-md text-4xl ${
                            theme === 'dark' ? 'bg-slate-700 text-slate-300 border-slate-800' : 'bg-slate-100 text-slate-400 border-white'
                        }`}>
                            {userProfile?.displayName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <span className={`absolute bottom-2 right-2 bg-green-500 w-6 h-6 rounded-full border-4 ${theme === 'dark' ? 'border-slate-800' : 'border-white'}`} />
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div>
                            <h2 className={`text-2xl flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                                {userProfile?.displayName}
                                <BadgeCheck className="text-blue-500" size={24} />
                            </h2>
                            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{user?.email}</p>
                            <div className="flex gap-2 mt-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border ${
                                    theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-100'
                                }`}>
                                    <Shield size={14} />
                                    {userProfile?.role}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => { setShowPwdForm((v) => !v); setPwdError(null); setPwdSuccess(false); }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm"
                        >
                            <KeyRound size={16} />
                            Alterar Senha
                        </button>
                    </div>

                    {/* Formulário de Alterar Senha */}
                    {showPwdForm && (
                        <div className={`mt-6 p-5 rounded-xl border ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <h3 className={`text-base font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                                <KeyRound size={16} className="text-blue-500" />
                                Alterar Senha
                            </h3>
                            <div className="space-y-3 max-w-sm">
                                <div>
                                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Senha Atual</label>
                                    <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} className={inputCls} placeholder="Sua senha atual" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Nova Senha</label>
                                    <div className="relative">
                                        <input type={showNew ? "text" : "password"} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className={inputCls} placeholder="Mín. 8 chars, 1 maiúscula, 1 número" />
                                        <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Confirmar Nova Senha</label>
                                    <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} className={inputCls} placeholder="Repita a nova senha" />
                                </div>
                                {pwdError && <p className="text-red-500 text-sm">{pwdError}</p>}
                                {pwdSuccess && (
                                    <p className="text-green-500 text-sm flex items-center gap-1">
                                        <Check size={14} /> Senha alterada com sucesso!
                                    </p>
                                )}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => void handleChangePassword()}
                                        disabled={isSaving || !currentPwd || !newPwd || !confirmPwd}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        {isSaving ? "Salvando..." : "Confirmar"}
                                    </button>
                                    <button
                                        onClick={() => { setShowPwdForm(false); setPwdError(null); setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); }}
                                        className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`mt-8 pt-8 border-t grid grid-cols-1 md:grid-cols-2 gap-8 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                        <div>
                            <h3 className={`text-lg mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                                <User size={20} className="text-slate-400" />
                                Informações Pessoais
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Nome</label>
                                    <p className={`px-3 py-2 rounded-lg border ${theme === 'dark' ? 'text-slate-300 bg-slate-900/50 border-slate-700' : 'text-slate-700 bg-slate-50 border-slate-100'}`}>
                                        {userProfile?.displayName}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Email</label>
                                    <p className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300 bg-slate-900/50 border-slate-700' : 'text-slate-700 bg-slate-50 border-slate-100'}`}>
                                        <Mail size={16} />
                                        {user?.email}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
