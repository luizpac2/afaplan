import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Download, Database, ShieldCheck, Cloud, LogOut, ArrowUpCircle } from 'lucide-react';
import { exportData } from '../utils/backupService';
import { useAuth } from '../contexts/AuthContext';
import { useCourseStore } from '../store/useCourseStore';
import { batchSave } from '../services/supabaseService';

export const Settings = () => {
    const { user, logout } = useAuth();
    const { theme } = useTheme();
    const store = useCourseStore();

    const [isMigrating, setIsMigrating] = useState(false);

    const handleMigration = async () => {
        if (!user) {
            alert('Faça login primeiro.');
            return;
        }

        // This is now just a manual force sync since we are already connected
        if (!window.confirm('Isso salvará forçadamente todos os dados atuais na nuvem. Continuar?')) return;

        setIsMigrating(true);
        try {
            await batchSave('disciplines', store.disciplines);
            await batchSave('events', store.events);
            await batchSave('classes', store.classes);
            await batchSave('cohorts', store.cohorts);
            alert('Migração concluída com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro na migração. Verifique o console.');
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <header className="mb-8">
                <h1 className={`text-3xl  tracking-tight flex items-center gap-3 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                    <Database className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} size={32} />
                    Configurações & Backup
                </h1>
                <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Gerencie os dados do sistema e opções de segurança.</p>
            </header>

            <div className="space-y-6">

                {/* Cloud Sync Section */}
                <div className={`rounded-xl shadow-sm border p-6 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-start gap-4 mb-6">
                        <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            <Cloud size={24} />
                        </div>
                        <div className="flex-1">
                            <h2 className={`text-xl  ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Sincronização em Nuvem (Firebase)</h2>
                            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                {user
                                    ? `Conectado como ${user.email}`
                                    : 'Conecte-se para sincronizar seus dados em tempo real.'}
                            </p>
                        </div>
                        {user && (
                            <button
                                onClick={logout}
                                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-2 ${theme === 'dark'
                                    ? 'text-red-400 hover:bg-red-900/20 border-red-800'
                                    : 'text-red-600 hover:bg-red-50 border-red-200'
                                    }`}
                            >
                                <LogOut size={14} /> Sair
                            </button>
                        )}
                    </div>

                    {!user ? (
                        <div className="flex justify-center p-4">
                            <p className="text-slate-500 dark:text-slate-400 italic">Vá para a tela de login para conectar.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            <div className={`border rounded-lg p-5 ${theme === 'dark' ? 'border-indigo-800 bg-indigo-900/10' : 'border-indigo-100 bg-indigo-50/30'}`}>
                                <h3 className={` mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                    <ArrowUpCircle size={18} className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} />
                                    Sincronização Manual
                                </h3>
                                <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Envia todos os dados atuais para o banco de dados.
                                    Use isso caso perceba alguma falha na sincronização automática.
                                </p>
                                <button
                                    onClick={handleMigration}
                                    disabled={isMigrating}
                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white  rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {isMigrating ? 'Enviando...' : 'Forçar Sincronização'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Backup Section */}
                <div className={`rounded-xl shadow-sm border p-6 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-start gap-4 mb-6">
                        <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h2 className={`text-xl  ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Backup e Restauração</h2>
                            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                Salve uma cópia de segurança dos seus dados ou restaure um backup anterior.
                                Isso é importante pois os dados atuais estão salvos apenas no seu navegador.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className={`border rounded-lg p-5 transition-colors ${theme === 'dark'
                            ? 'border-slate-600 hover:border-blue-500 bg-slate-800/50'
                            : 'border-slate-200 hover:border-blue-300 bg-slate-50/50'
                            }`}>
                            <h3 className={` mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                <Download size={18} className={theme === 'dark' ? 'text-green-400' : 'text-green-600'} />
                                Exportar Dados (Backup)
                            </h3>
                            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                Baixe um arquivo JSON contendo todas as disciplinas, aulas, turmas e histórico.
                            </p>
                            <button
                                onClick={exportData}
                                className={`w-full py-2  rounded-lg transition-colors shadow-sm border ${theme === 'dark'
                                    ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-blue-400'
                                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-blue-600'
                                    }`}
                            >
                                Baixar Backup
                            </button>
                        </div>
                    </div>
                </div>

                {/* Database Info */}
                <div className={`rounded-xl shadow-sm border p-6 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-amber-900/30 text-amber-500' : 'bg-amber-50 text-amber-600'}`}>
                            <Database size={24} />
                        </div>
                        <div>
                            <h2 className={`text-xl  ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Status do Banco de Dados</h2>
                            <div className={`mt-4 p-4 rounded-lg border font-mono text-sm ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                <div className="flex justify-between mb-2">
                                    <span>Tipo de Armazenamento:</span>
                                    <span className={` ${theme === 'dark' ? 'text-blue-400' : 'text-blue-800'}`}>Firestore (Google Cloud)</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span>Persistência:</span>
                                    <span className={` ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>Segura (Nuvem)</span>
                                </div>
                                <div className={`text-xs mt-2 border-t pt-2 ${theme === 'dark' ? 'text-slate-500 border-slate-700' : 'text-slate-400 border-slate-200'}`}>
                                    Seus dados estão sendo salvos automaticamente na nuvem. Você pode acessar de qualquer dispositivo fazendo login.
                                    Backups manuais (JSON) ainda podem ser úteis para versionamento.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
