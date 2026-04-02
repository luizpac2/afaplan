import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';

export const Login = () => {
    const { user, signInWithEmail, loading } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError]       = useState<string | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        if (isLoggingIn || loading) return;
        setIsLoggingIn(true);
        setError(null);
        try {
            await signInWithEmail(email, password);
        } catch (err) {
            const e = err as { message?: string };
            if (e.message?.includes('Invalid login')) {
                setError('Email ou senha incorretos. Verifique suas credenciais.');
            } else if (e.message?.includes('Email not confirmed')) {
                setError('Email não confirmado. Verifique sua caixa de entrada.');
            } else {
                setError(e.message ?? 'Erro ao conectar. Tente novamente.');
            }
        } finally {
            setIsLoggingIn(false);
        }
    };

    useEffect(() => {
        if (user) navigate('/');
    }, [user, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-500 text-sm font-medium">Verificando sessão...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex">

            {/* ── LEFT PANEL: Brand ─────────────────────────── */}
            <div
                className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col items-center justify-center overflow-hidden"
                style={{ backgroundImage: "url('/background_login.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
                {/* Gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-blue-950/75" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center text-center px-12 max-w-lg">
                    <div className="mb-8 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
                        <img
                            src="/logo.png?v=2"
                            alt="AFA"
                            className="w-20 h-20 object-contain drop-shadow-lg"
                        />
                    </div>

                    <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight mb-3">
                        AFA Planner
                    </h1>
                    <p className="text-blue-200/80 text-lg font-medium mb-6">
                        Academia da Força Aérea
                    </p>
                    <p className="text-slate-300/70 text-sm leading-relaxed max-w-sm">
                        Sistema integrado de planejamento e gestão de cursos da Divisão de Ensino.
                    </p>

                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-2 mt-8 justify-center">
                        {['Programação', 'Relatórios', 'Automação', 'Calendário'].map((f) => (
                            <span
                                key={f}
                                className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/70 border border-white/15 backdrop-blur-sm"
                            >
                                {f}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Bottom: version */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                    <span className="text-[11px] text-slate-600 font-medium">v1.9.0 · 2026</span>
                </div>
            </div>

            {/* ── RIGHT PANEL: Form ─────────────────────────── */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 bg-white dark:bg-slate-950 relative">

                {/* Mobile logo (visible only on small screens) */}
                <div className="lg:hidden flex flex-col items-center mb-10">
                    <img src="/logo.png?v=2" alt="AFA" className="h-16 w-16 object-contain mb-3" />
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AFA Planner</h1>
                    <p className="text-slate-400 text-sm mt-1">Academia da Força Aérea</p>
                </div>

                <div className="w-full max-w-sm animate-slide-up">
                    {/* Form header */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            Bem-vindo de volta
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">
                            Insira suas credenciais para acessar o sistema.
                        </p>
                    </div>

                    {/* Error alert */}
                    {error && (
                        <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 animate-slide-up">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                            <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={(e) => { void handleLogin(e); }} className="space-y-4">
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                            >
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="
                                    w-full px-3.5 py-2.5 rounded-xl text-sm
                                    border border-slate-200 dark:border-slate-700
                                    bg-white dark:bg-slate-900
                                    text-slate-900 dark:text-slate-100
                                    placeholder:text-slate-400 dark:placeholder:text-slate-600
                                    focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-blue-400
                                    transition-all duration-150
                                "
                                placeholder="seu@email.com"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                            >
                                Senha
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="
                                        w-full px-3.5 py-2.5 pr-10 rounded-xl text-sm
                                        border border-slate-200 dark:border-slate-700
                                        bg-white dark:bg-slate-900
                                        text-slate-900 dark:text-slate-100
                                        placeholder:text-slate-400 dark:placeholder:text-slate-600
                                        focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-blue-400
                                        transition-all duration-150
                                    "
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoggingIn}
                            className="
                                w-full flex items-center justify-center gap-2 mt-2
                                bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                                text-white font-semibold text-sm
                                py-2.5 px-4 rounded-xl
                                transition-all duration-150
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2
                                disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                                shadow-card hover:shadow-card-md
                            "
                        >
                            {isLoggingIn ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Conectando...</span>
                                </>
                            ) : (
                                <>
                                    <span>Entrar</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer note */}
                    <div className="mt-8 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-600">
                        <Shield size={12} className="flex-shrink-0" />
                        <span>Acesso restrito a usuários autorizados. Problemas? Contate o administrador.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
