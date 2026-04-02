import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Download, Database, ShieldCheck, Cloud, LogOut, ArrowUpCircle, Link2, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';
import { exportData } from '../utils/backupService';
import { useAuth } from '../contexts/AuthContext';
import { useCourseStore } from '../store/useCourseStore';
import { batchSave } from '../services/supabaseService';
import { supabase } from '../config/supabase';
import type { Instructor, Discipline } from '../types';

type RebuildResult = {
    instructorsUpdated: number;
    disciplinesUpdated: number;
    pairsFound: number;
    source: 'relational' | 'events' | 'none';
    errors: string[];
};

export const Settings = () => {
    const { user, logout } = useAuth();
    const { theme } = useTheme();
    const store = useCourseStore();
    const isDark = theme === 'dark';

    const [isMigrating, setIsMigrating] = useState(false);
    const [isRebuilding, setIsRebuilding] = useState(false);
    const [rebuildResult, setRebuildResult] = useState<RebuildResult | null>(null);
    const [rebuildStep, setRebuildStep] = useState('');

    // ── Force Sync ──────────────────────────────────────────────────────
    const handleMigration = async () => {
        if (!user) { alert('Faça login primeiro.'); return; }
        if (!window.confirm('Isso salvará forçadamente todos os dados atuais na nuvem. Continuar?')) return;
        setIsMigrating(true);
        try {
            await batchSave('disciplines', store.disciplines);
            await batchSave('events', store.events);
            await batchSave('classes', store.classes);
            await batchSave('cohorts', store.cohorts);
            alert('Sincronização concluída com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro na sincronização. Verifique o console.');
        } finally {
            setIsMigrating(false);
        }
    };

    // ── Rebuild Instructor ↔ Discipline Relationships ───────────────────
    const handleRebuildRelationships = async () => {
        if (!user) { alert('Faça login primeiro.'); return; }
        if (!window.confirm(
            'Isso irá reconstruir os vínculos docente↔disciplina a partir dos dados de programação.\n\n' +
            '• Instrutores sem matérias habilitadas receberão as disciplinas que ministraram.\n' +
            '• Disciplinas sem docente titular receberão o docente que mais as ministrou.\n\n' +
            'Continuar?'
        )) return;

        setIsRebuilding(true);
        setRebuildResult(null);
        setRebuildStep('Consultando dados de programação...');

        const errors: string[] = [];

        try {
            // ── STRATEGY 1: Relational path (docentes + disciplinas tables) ──
            let instrDiscCodes = new Map<string, Set<string>>();
            let discInstrCount = new Map<string, Map<string, number>>();
            let pairsFound = 0;
            let source: RebuildResult['source'] = 'none';

            setRebuildStep('Buscando dados relacionais (docentes/disciplinas)...');

            const [evRes, docRes, discRelRes] = await Promise.allSettled([
                supabase
                    .from('programacao_aulas')
                    .select('docente_id, disciplina_id')
                    .not('docente_id', 'is', null)
                    .not('disciplina_id', 'is', null),
                supabase.from('docentes').select('id, trigrama'),
                supabase.from('disciplinas').select('id, sigla'),
            ]);

            const events = evRes.status === 'fulfilled' ? evRes.value.data ?? [] : [];
            const docentes = docRes.status === 'fulfilled' ? docRes.value.data ?? [] : [];
            const discRelacional = discRelRes.status === 'fulfilled' ? discRelRes.value.data ?? [] : [];

            if (events.length > 0 && docentes.length > 0 && discRelacional.length > 0) {
                // Build lookup maps: UUID → identifier
                const docenteById = new Map(docentes.map((d: any) => [d.id, d.trigrama]));
                const disciplinaById = new Map(discRelacional.map((d: any) => [d.id, d.sigla]));

                for (const ev of events as any[]) {
                    const trigram: string = docenteById.get(ev.docente_id);
                    const code: string = disciplinaById.get(ev.disciplina_id);
                    if (!trigram || !code) continue;

                    pairsFound++;
                    if (!instrDiscCodes.has(trigram)) instrDiscCodes.set(trigram, new Set());
                    instrDiscCodes.get(trigram)!.add(code);

                    if (!discInstrCount.has(code)) discInstrCount.set(code, new Map());
                    const cm = discInstrCount.get(code)!;
                    cm.set(trigram, (cm.get(trigram) || 0) + 1);
                }

                if (pairsFound > 0) source = 'relational';
            }

            // ── STRATEGY 2: App-events fallback (instructorTrigram + disciplineId) ──
            if (pairsFound === 0) {
                setRebuildStep('Usando cache de eventos do app como fallback...');

                // Build lookup: app disciplineId → discipline code
                const discById = new Map(store.disciplines.map(d => [d.id, d.code]));

                // Try from yearEventsCache
                const allCachedEvents = Object.values(store.yearEventsCache).flat();

                // Also try fetching current year from DB
                let dbEvents: any[] = [];
                try {
                    const year = new Date().getFullYear();
                    const { data } = await supabase
                        .from('programacao_aulas')
                        .select('*')
                        .gte('data', `${year}-01-01`)
                        .lte('data', `${year}-12-31`);
                    dbEvents = data ?? [];
                } catch {
                    // ignore
                }

                const allEvents = [...allCachedEvents, ...dbEvents];

                for (const ev of allEvents) {
                    // Support both camelCase (app format) and snake_case (relational format)
                    const trigram: string = ev.instructorTrigram || ev.docente_trigrama;
                    const discId: string = ev.disciplineId || ev.disciplina_id;
                    const discCode: string = discById.get(discId) || ev.disciplina_sigla;
                    if (!trigram || !discCode) continue;

                    pairsFound++;
                    if (!instrDiscCodes.has(trigram)) instrDiscCodes.set(trigram, new Set());
                    instrDiscCodes.get(trigram)!.add(discCode);

                    if (!discInstrCount.has(discCode)) discInstrCount.set(discCode, new Map());
                    const cm = discInstrCount.get(discCode)!;
                    cm.set(trigram, (cm.get(trigram) || 0) + 1);
                }

                if (pairsFound > 0) source = 'events';
            }

            if (pairsFound === 0) {
                setRebuildResult({ instructorsUpdated: 0, disciplinesUpdated: 0, pairsFound: 0, source: 'none', errors: ['Nenhum dado de programação encontrado para reconstruir os vínculos.'] });
                return;
            }

            // ── Map discipline codes to app discipline IDs ──
            const disciplineByCode = new Map(store.disciplines.map(d => [d.code, d]));

            // ── Update Instructors ─────────────────────────────────────────
            setRebuildStep(`Atualizando docentes (${instrDiscCodes.size} com vínculos encontrados)...`);

            const updatedInstructors: Instructor[] = [];
            const newInstructorList = store.instructors.map(instructor => {
                const discCodes = instrDiscCodes.get(instructor.trigram);
                if (!discCodes || discCodes.size === 0) return instructor;

                const newEnabled = Array.from(discCodes)
                    .map(code => disciplineByCode.get(code)?.id)
                    .filter(Boolean) as string[];
                if (newEnabled.length === 0) return instructor;

                const updated = { ...instructor, enabledDisciplines: newEnabled };
                updatedInstructors.push(updated);
                return updated;
            });

            if (updatedInstructors.length > 0) {
                store.setInstructors(newInstructorList);
                try {
                    // Batch save — add id field (instructors table uses id = trigram as PK)
                    await batchSave('instructors', updatedInstructors.map(i => ({ id: i.trigram, ...i })));
                    // Clear cache so fresh data is loaded next session
                    localStorage.removeItem('afa_cache_instructors');
                } catch (err) {
                    const msg = `Erro ao salvar docentes: ${String(err)}`;
                    errors.push(msg);
                    console.error(msg);
                }
            }

            // ── Update Disciplines ─────────────────────────────────────────
            setRebuildStep(`Atualizando disciplinas sem docente titular...`);

            const updatedDisciplines: Discipline[] = [];
            const newDisciplineList = store.disciplines.map(disc => {
                // Only update disciplines that have no instructor assigned
                if (disc.instructorTrigram || disc.noSpecificInstructor) return disc;

                const countMap = discInstrCount.get(disc.code);
                if (!countMap || countMap.size === 0) return disc;

                // Find most frequent instructor for this discipline
                let maxCount = 0, bestTrigram = '';
                for (const [trigram, count] of countMap) {
                    if (count > maxCount) { maxCount = count; bestTrigram = trigram; }
                }
                if (!bestTrigram) return disc;

                const bestInstr = store.instructors.find(i => i.trigram === bestTrigram);
                const updated = {
                    ...disc,
                    instructorTrigram: bestTrigram,
                    instructor: bestInstr?.warName || bestTrigram,
                };
                updatedDisciplines.push(updated);
                return updated;
            });

            if (updatedDisciplines.length > 0) {
                store.setDisciplines(newDisciplineList);
                try {
                    await batchSave('disciplines', updatedDisciplines);
                    localStorage.removeItem('afa_cache_disciplines');
                } catch (err) {
                    const msg = `Erro ao salvar disciplinas: ${String(err)}`;
                    errors.push(msg);
                    console.error(msg);
                }
            }

            setRebuildResult({
                instructorsUpdated: updatedInstructors.length,
                disciplinesUpdated: updatedDisciplines.length,
                pairsFound,
                source,
                errors,
            });

        } catch (err) {
            console.error('Rebuild error:', err);
            setRebuildResult({
                instructorsUpdated: 0,
                disciplinesUpdated: 0,
                pairsFound: 0,
                source: 'none',
                errors: [String(err)],
            });
        } finally {
            setIsRebuilding(false);
            setRebuildStep('');
        }
    };

    // ── Shared styles ────────────────────────────────────────────────────
    const card = `rounded-xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-card'}`;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">

            {/* ── Header ── */}
            <div>
                <h1 className={`text-2xl font-bold tracking-tight flex items-center gap-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    <Database size={24} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                    Configurações & Backup
                </h1>
                <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Gerencie os dados do sistema, manutenção e opções de segurança.
                </p>
            </div>

            {/* ── REBUILD RELATIONSHIPS ──────────────────────────────────── */}
            <div className={card}>
                <div className="flex items-start gap-4 mb-5">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${isDark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                        <Link2 size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                            Reconstruir Vínculos Docente ↔ Disciplina
                        </h2>
                        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Durante a migração Firebase → Supabase, os campos <code className="font-mono text-xs px-1 rounded bg-slate-100 dark:bg-slate-800">enabledDisciplines</code> dos
                            docentes e <code className="font-mono text-xs px-1 rounded bg-slate-100 dark:bg-slate-800">instructorTrigram</code> das disciplinas podem ter ficado
                            vazios. Esta operação os reconstrói a partir da grade de aulas registrada.
                        </p>
                    </div>
                </div>

                {/* Info box */}
                <div className={`flex items-start gap-2.5 p-3.5 rounded-lg text-sm mb-5 ${isDark ? 'bg-blue-900/20 border border-blue-800/40 text-blue-300' : 'bg-blue-50 border border-blue-100 text-blue-700'}`}>
                    <Info size={15} className="flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p><strong>O que faz:</strong> Consulta <code className="font-mono text-xs">programacao_aulas</code>, identifica quais docentes ministram quais disciplinas e atualiza os registros no banco.</p>
                        <p><strong>Seguro:</strong> Só preenche campos vazios — não sobrescreve vínculos já existentes.</p>
                    </div>
                </div>

                <button
                    onClick={handleRebuildRelationships}
                    disabled={isRebuilding || !user}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${isRebuilding || !user
                        ? 'opacity-50 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-500'
                        : isDark
                            ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-card hover:shadow-card-md'
                    }`}
                >
                    {isRebuilding ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>{rebuildStep || 'Processando...'}</span>
                        </>
                    ) : (
                        <>
                            <Link2 size={16} />
                            Reconstruir Vínculos
                        </>
                    )}
                </button>

                {/* Result */}
                {rebuildResult && (
                    <div className={`mt-4 p-4 rounded-lg border animate-slide-up ${
                        rebuildResult.errors.length > 0
                            ? isDark ? 'bg-red-900/20 border-red-800/40' : 'bg-red-50 border-red-100'
                            : isDark ? 'bg-emerald-900/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-100'
                    }`}>
                        {rebuildResult.source === 'none' ? (
                            <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                                <AlertCircle size={16} />
                                <span>Nenhum dado de programação encontrado para reconstruir os vínculos. Verifique se a tabela <code className="font-mono text-xs">programacao_aulas</code> tem dados.</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className={`flex items-center gap-2 text-sm font-semibold ${rebuildResult.errors.length ? (isDark ? 'text-amber-400' : 'text-amber-700') : (isDark ? 'text-emerald-400' : 'text-emerald-700')}`}>
                                    {rebuildResult.errors.length ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                                    <span>
                                        {rebuildResult.errors.length ? 'Concluído com avisos' : 'Vínculos reconstruídos com sucesso!'}
                                    </span>
                                </div>
                                <div className={`grid grid-cols-3 gap-3 mt-2`}>
                                    {[
                                        { label: 'Pares encontrados', value: rebuildResult.pairsFound },
                                        { label: 'Docentes atualizados', value: rebuildResult.instructorsUpdated },
                                        { label: 'Disciplinas atualizadas', value: rebuildResult.disciplinesUpdated },
                                    ].map(({ label, value }) => (
                                        <div key={label} className={`text-center p-2 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white border border-slate-100'}`}>
                                            <p className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{value}</p>
                                            <p className={`text-[10px] uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Fonte: {rebuildResult.source === 'relational' ? 'tabelas relacionais (docentes + disciplinas)' : 'cache de eventos do app'}
                                </p>
                                {rebuildResult.errors.map((e, i) => (
                                    <p key={i} className={`text-xs font-mono ${isDark ? 'text-red-400' : 'text-red-600'}`}>{e}</p>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── CLOUD SYNC ─────────────────────────────────────────────── */}
            <div className={card}>
                <div className="flex items-start gap-4 mb-5">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${isDark ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                        <Cloud size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Sincronização em Nuvem</h2>
                                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {user ? `Conectado como ${user.email}` : 'Faça login para sincronizar.'}
                                </p>
                            </div>
                            {user && (
                                <button
                                    onClick={logout}
                                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-2 flex-shrink-0 ${isDark
                                        ? 'text-red-400 hover:bg-red-900/20 border-red-800'
                                        : 'text-red-600 hover:bg-red-50 border-red-200'}`}
                                >
                                    <LogOut size={14} /> Sair
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {user ? (
                    <div className={`border rounded-lg p-4 ${isDark ? 'border-indigo-800/40 bg-indigo-900/10' : 'border-indigo-100 bg-indigo-50/30'}`}>
                        <h3 className={`text-sm font-medium mb-1.5 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            <ArrowUpCircle size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                            Sincronização Manual
                        </h3>
                        <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Envia todos os dados atuais para o banco de dados. Use caso perceba alguma falha na sincronização automática.
                        </p>
                        <button
                            onClick={handleMigration}
                            disabled={isMigrating}
                            className={`w-full py-2 text-sm font-medium rounded-lg transition-colors shadow-card disabled:opacity-50 ${isDark
                                ? 'bg-indigo-700 hover:bg-indigo-600 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                        >
                            {isMigrating ? 'Enviando...' : 'Forçar Sincronização'}
                        </button>
                    </div>
                ) : (
                    <p className={`text-sm italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Vá para a tela de login para conectar.
                    </p>
                )}
            </div>

            {/* ── BACKUP ─────────────────────────────────────────────────── */}
            <div className={card}>
                <div className="flex items-start gap-4 mb-5">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h2 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Backup e Restauração</h2>
                        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Salve uma cópia de segurança dos seus dados para armazenamento externo.
                        </p>
                    </div>
                </div>
                <div className={`border rounded-lg p-4 ${isDark ? 'border-slate-700' : 'border-slate-100 bg-slate-50/50'}`}>
                    <h3 className={`text-sm font-medium mb-1.5 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        <Download size={16} className={isDark ? 'text-green-400' : 'text-green-600'} />
                        Exportar Dados (Backup)
                    </h3>
                    <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Baixe um arquivo JSON com disciplinas, aulas, turmas e histórico.
                    </p>
                    <button
                        onClick={exportData}
                        className={`w-full py-2 text-sm rounded-lg transition-colors shadow-card border ${isDark
                            ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600'}`}
                    >
                        Baixar Backup (JSON)
                    </button>
                </div>
            </div>

            {/* ── DB STATUS ──────────────────────────────────────────────── */}
            <div className={card}>
                <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${isDark ? 'bg-amber-900/30 text-amber-500' : 'bg-amber-50 text-amber-600'}`}>
                        <Database size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className={`text-base font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Status do Banco de Dados</h2>
                        <div className={`p-4 rounded-lg border font-mono text-xs space-y-2 ${isDark ? 'bg-slate-950 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                            {[
                                { label: 'Armazenamento', value: 'Supabase (PostgreSQL)', color: isDark ? 'text-blue-400' : 'text-blue-700' },
                                { label: 'Persistência', value: 'Nuvem (segura)', color: isDark ? 'text-green-400' : 'text-green-600' },
                                { label: 'Disciplinas', value: `${store.disciplines.length} registros`, color: '' },
                                { label: 'Docentes', value: `${store.instructors.length} registros`, color: '' },
                                { label: 'Turmas', value: `${store.classes.length} registros`, color: '' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="flex justify-between items-center">
                                    <span>{label}:</span>
                                    <span className={`font-semibold ${color}`}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
