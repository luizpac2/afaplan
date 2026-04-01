import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export const Login = () => {
    const { user, signInWithEmail, loading } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
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
                setError('Email ou senha incorretos.');
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
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-slate-900 bg-cover bg-center p-4 relative"
            style={{ backgroundImage: "url('/background_login.jpg')" }}
        >
            <div className="absolute inset-0 bg-slate-900/60 z-0"></div>
            <div className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden p-8 text-center animate-in fade-in zoom-in duration-300 relative z-10">
                <img
                    src="/logo.png?v=2"
                    alt="Logo AFA"
                    className="mx-auto w-auto h-24 mb-6 object-contain"
                />

                <h1 className="text-2xl text-slate-900 mb-2">AFA Planner</h1>
                <p className="text-slate-500 mb-8 text-sm">Faça login para acessar o sistema da Divisão de Ensino.</p>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-left">
                        {error}
                    </div>
                )}

                <form onSubmit={(e) => { void handleLogin(e); }} className="space-y-4 text-left">
                    <div>
                        <label className="block text-sm text-slate-600 mb-1" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="seu@email.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-600 mb-1" htmlFor="password">Senha</label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoggingIn}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoggingIn ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Conectando...
                            </span>
                        ) : 'Entrar'}
                    </button>
                </form>

                <p className="text-xs text-slate-400 mt-8">
                    Apenas usuários autorizados. Problemas de acesso? Contate o administrador.
                </p>
            </div>
        </div>
    );
};
