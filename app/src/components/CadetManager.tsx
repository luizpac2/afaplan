import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Users, Search, Edit2, Save, X, ChevronDown, AlertCircle, Info } from 'lucide-react';
import type { Cadet, CadetAlocacao, CadetQuadro, CadetTurma, CadetSituacao, Cohort } from '../types';

const ANO_ATUAL = new Date().getFullYear();

const QUADRO_LABEL: Record<CadetQuadro, string> = {
  CFOAV:  'Aviação',
  CFOINT: 'Intendência',
  CFOINF: 'Infantaria',
};

const TURMA_OPTIONS: CadetTurma[] = ['TURMA_A','TURMA_B','TURMA_C','TURMA_D','TURMA_E','TURMA_F'];
const SITUACAO_OPTIONS: CadetSituacao[] = ['ATIVO','DESLIGADO','TRANCADO','TRANSFERIDO'];

const SITUACAO_STYLE: Record<CadetSituacao, string> = {
  ATIVO:       'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  DESLIGADO:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  TRANCADO:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  TRANSFERIDO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

const QUADRO_COLOR: Record<CadetQuadro, string> = {
  CFOAV:  'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  CFOINT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  CFOINF: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
};

const COHORT_COLOR: Record<string, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  blue:  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  red:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  black: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
};

type EditState = Partial<Pick<Cadet, 'nome_guerra' | 'situacao' | 'cohort_id' | 'observacao'>>
  & { turma_aula?: CadetTurma };

export const CadetManager = () => {
  const { userProfile } = useAuth();
  const { theme } = useTheme();

  const [cadets, setCadets]       = useState<Cadet[]>([]);
  const [alocacoes, setAlocacoes] = useState<CadetAlocacao[]>([]);
  const [cohorts, setCohorts]     = useState<Cohort[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [anoFiltro, setAnoFiltro] = useState(ANO_ATUAL);
  const [search, setSearch]       = useState('');
  const [filterCohort, setFilterCohort] = useState<string>('');
  const [filterQuadro, setFilterQuadro] = useState<CadetQuadro | ''>('');
  const [filterTurma, setFilterTurma]   = useState<CadetTurma | ''>('');
  const [filterSit, setFilterSit]       = useState<CadetSituacao | ''>('ATIVO');
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editDraft, setEditDraft]       = useState<EditState>({});
  const [saving, setSaving]             = useState(false);

  const canEdit = useMemo(
    () => ['SUPER_ADMIN', 'ADMIN'].includes(userProfile?.role ?? ''),
    [userProfile],
  );

  // ── Load ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [
        { data: cadetsData,    error: cadetsErr },
        { data: alocacoesData },
        { data: cohortsData },
      ] = await Promise.all([
        supabase.from('cadetes').select('*').order('id'),
        supabase.from('cadete_alocacoes').select('*'),
        supabase.from('cohorts').select('*').order('entryYear', { ascending: false }),
      ]);

      if (cadetsErr) setError(cadetsErr.message);
      else setCadets(cadetsData as Cadet[]);
      if (alocacoesData) setAlocacoes(alocacoesData as CadetAlocacao[]);
      if (cohortsData)   setCohorts(cohortsData as Cohort[]);
      setLoading(false);
    };
    void load();
  }, []);

  const cohortMap = useMemo(
    () => Object.fromEntries(cohorts.map(c => [String(c.id), c])),
    [cohorts],
  );

  // Mapa: cadet_id → turma_aula para o ano selecionado
  const alocacaoMap = useMemo(
    () => Object.fromEntries(
      alocacoes
        .filter(a => a.ano === anoFiltro)
        .map(a => [a.cadet_id, a.turma_aula]),
    ),
    [alocacoes, anoFiltro],
  );

  // Cadetes enriquecidos com a turma do ano selecionado
  const cadetsComTurma = useMemo(
    () => cadets.map(c => ({ ...c, turma_aula: alocacaoMap[c.id] })),
    [cadets, alocacaoMap],
  );

  // Anos disponíveis nos dados (para o seletor)
  const anosDisponiveis = useMemo(
    () => [...new Set(alocacoes.map(a => a.ano))].sort((a, b) => b - a),
    [alocacoes],
  );

  // ── Filtering ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return cadetsComTurma.filter(c => {
      if (filterCohort && c.cohort_id !== filterCohort) return false;
      if (filterQuadro && c.quadro !== filterQuadro) return false;
      if (filterTurma  && c.turma_aula !== filterTurma) return false;
      if (filterSit    && c.situacao !== filterSit) return false;
      if (s && !c.nome_guerra.toLowerCase().includes(s)
            && !c.nome_completo.toLowerCase().includes(s)
            && !c.id.includes(s)) return false;
      return true;
    });
  }, [cadetsComTurma, search, filterCohort, filterQuadro, filterTurma, filterSit]);

  const counts = useMemo(() => {
    const base = filterCohort
      ? cadets.filter(c => c.cohort_id === filterCohort)
      : cadets;
    return {
      total:  base.length,
      ativos: base.filter(c => c.situacao === 'ATIVO').length,
      av:     base.filter(c => c.quadro === 'CFOAV'  && c.situacao === 'ATIVO').length,
      int:    base.filter(c => c.quadro === 'CFOINT' && c.situacao === 'ATIVO').length,
      inf:    base.filter(c => c.quadro === 'CFOINF' && c.situacao === 'ATIVO').length,
    };
  }, [cadets, filterCohort]);

  // ── Edit ────────────────────────────────────────────────────
  const startEdit = (c: Cadet & { turma_aula?: CadetTurma }) => {
    setEditingId(c.id);
    setEditDraft({
      nome_guerra: c.nome_guerra,
      situacao:    c.situacao,
      cohort_id:   c.cohort_id,
      turma_aula:  c.turma_aula,
      observacao:  c.observacao ?? '',
    });
  };
  const cancelEdit = () => { setEditingId(null); setEditDraft({}); };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      // 1. Atualiza campos permanentes do cadete
      const { turma_aula, ...cadetFields } = editDraft;
      const { error: cadetErr } = await supabase
        .from('cadetes')
        .update({ ...cadetFields, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (cadetErr) throw cadetErr;

      // 2. Upsert alocação anual (turma_aula é do ano, não do cadete)
      if (turma_aula) {
        const { error: alocErr } = await supabase
          .from('cadete_alocacoes')
          .upsert({ cadet_id: id, ano: anoFiltro, turma_aula }, { onConflict: 'cadet_id,ano' });
        if (alocErr) throw alocErr;
        setAlocacoes(prev => {
          const out = prev.filter(a => !(a.cadet_id === id && a.ano === anoFiltro));
          return [...out, { cadet_id: id, ano: anoFiltro, turma_aula }];
        });
      }

      setCadets(prev => prev.map(c =>
        c.id === id ? { ...c, ...cadetFields } as Cadet : c,
      ));
      setEditingId(null);
    } catch (e: unknown) {
      alert('Erro ao salvar: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────
  const isDark = theme === 'dark';
  const card  = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100';
  const text  = isDark ? 'text-slate-100' : 'text-slate-900';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const input = isDark
    ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400';

  return (
    <div className={`rounded-xl shadow-sm border p-6 transition-colors ${card}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h2 className={`text-xl flex items-center gap-2 ${text}`}>
            <Users className={isDark ? 'text-indigo-400' : 'text-indigo-600'} size={22} />
            Cadetes
          </h2>
          <p className={`text-sm mt-1 ${muted}`}>
            {counts.ativos} ativos de {counts.total}
            &nbsp;·&nbsp;<span className="text-sky-500">{counts.av} Av</span>
            &nbsp;·&nbsp;<span className="text-amber-500">{counts.int} Int</span>
            &nbsp;·&nbsp;<span className="text-orange-500">{counts.inf} Inf</span>
          </p>
        </div>

        {/* Seletor de ano */}
        <div className="flex items-center gap-2">
          <span className={`text-xs ${muted}`}>Turmas de aula em:</span>
          <div className="relative">
            <select
              value={anoFiltro}
              onChange={e => setAnoFiltro(Number(e.target.value))}
              className={`pl-3 pr-7 py-1.5 rounded-lg border text-sm appearance-none font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
            >
              {anosDisponiveis.length > 0
                ? anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)
                : <option value={ANO_ATUAL}>{ANO_ATUAL}</option>
              }
            </select>
            <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
          </div>
        </div>
      </div>

      {/* Aviso informativo */}
      <div className={`flex items-start gap-2 text-xs p-3 rounded-lg mb-4 ${isDark ? 'bg-blue-900/20 border border-blue-800/40 text-blue-300' : 'bg-blue-50 border border-blue-100 text-blue-700'}`}>
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          <strong>Esquadrão</strong> (Drakon, Perseu…) é permanente e não muda.
          A <strong>seção de aula</strong> (A, B, C…) é anual — pode ser atualizada a cada ano letivo sem alterar o vínculo com o Esquadrão.
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou Nº..."
            className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
          />
        </div>

        <div className="relative">
          <select
            value={filterCohort}
            onChange={e => setFilterCohort(e.target.value)}
            className={`pl-3 pr-7 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
          >
            <option value="">Todos os Esquadrões</option>
            {cohorts.map(c => (
              <option key={c.id} value={String(c.id)}>{c.name} {c.entryYear}</option>
            ))}
          </select>
          <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
        </div>

        <div className="relative">
          <select
            value={filterQuadro}
            onChange={e => setFilterQuadro(e.target.value as CadetQuadro | '')}
            className={`pl-3 pr-7 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
          >
            <option value="">Todos os quadros</option>
            {(Object.keys(QUADRO_LABEL) as CadetQuadro[]).map(q => (
              <option key={q} value={q}>{QUADRO_LABEL[q]}</option>
            ))}
          </select>
          <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
        </div>

        <div className="relative">
          <select
            value={filterTurma}
            onChange={e => setFilterTurma(e.target.value as CadetTurma | '')}
            className={`pl-3 pr-7 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
          >
            <option value="">Todas as seções</option>
            {TURMA_OPTIONS.map(t => (
              <option key={t} value={t}>{t.replace('TURMA_', 'Seção ')}</option>
            ))}
          </select>
          <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
        </div>

        <div className="relative">
          <select
            value={filterSit}
            onChange={e => setFilterSit(e.target.value as CadetSituacao | '')}
            className={`pl-3 pr-7 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
          >
            <option value="">Todas as situações</option>
            {SITUACAO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
        </div>
      </div>

      {loading && <p className={`text-sm py-8 text-center ${muted}`}>Carregando cadetes...</p>}
      {error && (
        <div className={`flex items-center gap-2 text-sm p-3 rounded-lg mb-4 ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'}`}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? 'bg-slate-900/60 text-slate-400' : 'bg-slate-50 text-slate-500'}>
                <th className="text-left px-3 py-2 font-medium w-20">Nº</th>
                <th className="text-left px-3 py-2 font-medium w-28">N. Guerra</th>
                <th className="text-left px-3 py-2 font-medium">Nome Completo</th>
                <th className="text-left px-3 py-2 font-medium w-28">
                  Esquadrão
                  <span className={`ml-1 text-[10px] font-normal ${muted}`}>(permanente)</span>
                </th>
                <th className="text-left px-3 py-2 font-medium w-24">Quadro</th>
                <th className="text-left px-3 py-2 font-medium w-28">
                  Seção {anoFiltro}
                  <span className={`ml-1 text-[10px] font-normal ${muted}`}>(anual)</span>
                </th>
                <th className="text-left px-3 py-2 font-medium w-28">Situação</th>
                {canEdit && <th className="px-3 py-2 w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className={`text-center py-8 ${muted}`}>
                    Nenhum cadete encontrado.
                  </td>
                </tr>
              )}
              {filtered.map(c => {
                const cohort    = cohortMap[c.cohort_id ?? ''];
                const isEditing = editingId === c.id;
                return (
                  <tr
                    key={c.id}
                    className={`transition-colors ${isEditing
                      ? (isDark ? 'bg-indigo-900/20' : 'bg-indigo-50/60')
                      : (isDark ? 'hover:bg-slate-700/40' : 'hover:bg-slate-50')}`}
                  >
                    <td className={`px-3 py-2 font-mono text-xs ${muted}`}>{c.id}</td>

                    {/* Nome de guerra */}
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={editDraft.nome_guerra ?? ''}
                          onChange={e => setEditDraft(d => ({ ...d, nome_guerra: e.target.value }))}
                          className={`w-full px-2 py-1 rounded border text-sm ${input}`}
                        />
                      ) : (
                        <span className={`font-medium ${text}`}>{c.nome_guerra}</span>
                      )}
                    </td>

                    {/* Nome completo */}
                    <td className={`px-3 py-2 text-xs ${muted}`}>{c.nome_completo}</td>

                    {/* Esquadrão — permanente */}
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="relative">
                          <select
                            value={editDraft.cohort_id ?? c.cohort_id ?? ''}
                            onChange={e => setEditDraft(d => ({ ...d, cohort_id: e.target.value }))}
                            className={`w-full pl-2 pr-6 py-1 rounded border text-xs appearance-none ${input}`}
                          >
                            <option value="">—</option>
                            {cohorts.map(co => (
                              <option key={co.id} value={String(co.id)}>
                                {co.name} {co.entryYear}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={11} className={`absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
                        </div>
                      ) : cohort ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COHORT_COLOR[cohort.color] ?? COHORT_COLOR.blue}`}>
                          {cohort.name}
                        </span>
                      ) : <span className={`text-xs ${muted}`}>—</span>}
                    </td>

                    {/* Quadro */}
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${QUADRO_COLOR[c.quadro]}`}>
                        {c.quadro}
                      </span>
                    </td>

                    {/* Seção de aula — anual */}
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="relative">
                          <select
                            value={editDraft.turma_aula ?? c.turma_aula ?? ''}
                            onChange={e => setEditDraft(d => ({ ...d, turma_aula: e.target.value as CadetTurma }))}
                            className={`w-full pl-2 pr-6 py-1 rounded border text-xs appearance-none ${input}`}
                          >
                            <option value="">—</option>
                            {TURMA_OPTIONS.map(t => (
                              <option key={t} value={t}>{t.replace('TURMA_', 'Seção ')}</option>
                            ))}
                          </select>
                          <ChevronDown size={11} className={`absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
                        </div>
                      ) : c.turma_aula ? (
                        <span className={`text-xs font-medium ${text}`}>
                          {c.turma_aula.replace('TURMA_', 'Seção ')}
                        </span>
                      ) : (
                        <span className={`text-xs italic ${muted}`}>não definida</span>
                      )}
                    </td>

                    {/* Situação */}
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="relative">
                          <select
                            value={editDraft.situacao ?? c.situacao}
                            onChange={e => setEditDraft(d => ({ ...d, situacao: e.target.value as CadetSituacao }))}
                            className={`w-full pl-2 pr-6 py-1 rounded border text-xs appearance-none ${input}`}
                          >
                            {SITUACAO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <ChevronDown size={11} className={`absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
                        </div>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SITUACAO_STYLE[c.situacao]}`}>
                          {c.situacao}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    {canEdit && (
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => saveEdit(c.id)}
                              disabled={saving}
                              className="p-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                              title="Salvar"
                            >
                              <Save size={13} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${muted}`}
                              title="Cancelar"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(c)}
                            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${muted} hover:text-indigo-500 transition-colors`}
                            title="Editar"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className={`text-xs mt-3 ${muted}`}>
        {filtered.length} de {cadets.length} cadetes exibidos
      </p>
    </div>
  );
};
