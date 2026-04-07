import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Users, Search, Edit2, Save, X, ChevronDown,
  AlertCircle, Info, Plus, Trash2,
} from 'lucide-react';
import type { Cadet, CadetAlocacao, CadetQuadro, CadetTurma, CadetSituacao, Cohort } from '../types';

const ANO_ATUAL = new Date().getFullYear();

const QUADRO_LABEL: Record<CadetQuadro, string> = {
  CFOAV:  'Aviação',
  CFOINT: 'Intendência',
  CFOINF: 'Infantaria',
};

const TURMA_OPTIONS: CadetTurma[] = ['TURMA_A','TURMA_B','TURMA_C','TURMA_D','TURMA_E','TURMA_F'];
const SITUACAO_OPTIONS: CadetSituacao[] = ['ATIVO','DESLIGADO','TRANCADO','TRANSFERIDO'];
const QUADRO_OPTIONS: CadetQuadro[] = ['CFOAV','CFOINT','CFOINF'];

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

interface AddDraft {
  id: string;
  nome_guerra: string;
  nome_completo: string;
  quadro: CadetQuadro;
  cohort_id: string;
  situacao: CadetSituacao;
  turma_aula: CadetTurma | '';
}

const EMPTY_ADD: AddDraft = {
  id: '',
  nome_guerra: '',
  nome_completo: '',
  quadro: 'CFOAV',
  cohort_id: '',
  situacao: 'ATIVO',
  turma_aula: '',
};

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

  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editDraft, setEditDraft]   = useState<EditState>({});
  const [saving, setSaving]         = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addDraft, setAddDraft]       = useState<AddDraft>(EMPTY_ADD);
  const [addSaving, setAddSaving]     = useState(false);

  const canEdit = useMemo(
    () => ['SUPER_ADMIN', 'ADMIN'].includes(userProfile?.role ?? ''),
    [userProfile],
  );

  // ── Load ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [
        { data: cadetsData, error: cadetsErr },
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

  // Alocação para o ano selecionado
  const alocacaoMap = useMemo(
    () => Object.fromEntries(
      alocacoes
        .filter(a => a.ano === anoFiltro)
        .map(a => [a.cadet_id, a.turma_aula]),
    ),
    [alocacoes, anoFiltro],
  );

  // Alocação mais recente de cada cadete (fallback quando o ano selecionado não tem dados)
  const alocacaoRecenteMap = useMemo(() => {
    const map: Record<string, { turma_aula: CadetTurma; ano: number }> = {};
    [...alocacoes]
      .sort((a, b) => a.ano - b.ano) // crescente → o último sobrescreve = mais recente
      .forEach(a => { map[a.cadet_id] = { turma_aula: a.turma_aula, ano: a.ano }; });
    return map;
  }, [alocacoes]);

  // Cadetes com turma do ano selecionado OU do último ano disponível
  const cadetsComTurma = useMemo(
    () => cadets.map(c => {
      const exactTurma = alocacaoMap[c.id];
      const fallback   = alocacaoRecenteMap[c.id];
      return {
        ...c,
        turma_aula:     exactTurma ?? fallback?.turma_aula,
        turma_ano:      exactTurma ? anoFiltro : fallback?.ano, // qual ano é esse dado
        turma_fallback: !exactTurma && !!fallback,
      };
    }),
    [cadets, alocacaoMap, alocacaoRecenteMap, anoFiltro],
  );

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
      const { turma_aula, ...cadetFields } = editDraft;
      const { error: cadetErr } = await supabase
        .from('cadetes')
        .update({ ...cadetFields, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (cadetErr) throw cadetErr;

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

  // ── Add ─────────────────────────────────────────────────────
  const saveAdd = async () => {
    if (!addDraft.id.trim() || !addDraft.nome_guerra.trim() || !addDraft.nome_completo.trim()) {
      alert('Preencha Nº, N. Guerra e Nome Completo.');
      return;
    }
    setAddSaving(true);
    try {
      const { error: insertErr } = await supabase.from('cadetes').insert({
        id:            addDraft.id.trim(),
        nome_guerra:   addDraft.nome_guerra.trim(),
        nome_completo: addDraft.nome_completo.trim(),
        quadro:        addDraft.quadro,
        cohort_id:     addDraft.cohort_id || null,
        situacao:      addDraft.situacao,
        created_at:    new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      });
      if (insertErr) throw insertErr;

      if (addDraft.turma_aula) {
        const { error: alocErr } = await supabase.from('cadete_alocacoes').upsert(
          { cadet_id: addDraft.id.trim(), ano: anoFiltro, turma_aula: addDraft.turma_aula },
          { onConflict: 'cadet_id,ano' },
        );
        if (alocErr) throw alocErr;
        setAlocacoes(prev => [...prev, { cadet_id: addDraft.id.trim(), ano: anoFiltro, turma_aula: addDraft.turma_aula as CadetTurma }]);
      }

      const newCadet: Cadet = {
        id:            addDraft.id.trim(),
        nome_guerra:   addDraft.nome_guerra.trim(),
        nome_completo: addDraft.nome_completo.trim(),
        quadro:        addDraft.quadro,
        cohort_id:     addDraft.cohort_id || '',
        situacao:      addDraft.situacao,
      };
      setCadets(prev => [...prev, newCadet].sort((a, b) => a.id.localeCompare(b.id)));
      setAddDraft(EMPTY_ADD);
      setShowAddForm(false);
    } catch (e: unknown) {
      alert('Erro ao adicionar: ' + (e as Error).message);
    } finally {
      setAddSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const deleteCadet = async (id: string, nomeGuerra: string) => {
    if (!window.confirm(`Excluir o cadete "${nomeGuerra}" (${id})?\n\nEsta ação também remove todas as alocações de turma.`)) return;
    try {
      // Remove alocações primeiro
      await supabase.from('cadete_alocacoes').delete().eq('cadet_id', id);
      const { error: delErr } = await supabase.from('cadetes').delete().eq('id', id);
      if (delErr) throw delErr;
      setCadets(prev => prev.filter(c => c.id !== id));
      setAlocacoes(prev => prev.filter(a => a.cadet_id !== id));
    } catch (e: unknown) {
      alert('Erro ao excluir: ' + (e as Error).message);
    }
  };

  // ── Styles ──────────────────────────────────────────────────
  const isDark = theme === 'dark';
  const card   = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100';
  const text   = isDark ? 'text-slate-100' : 'text-slate-900';
  const muted  = isDark ? 'text-slate-400' : 'text-slate-500';
  const input  = isDark
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

        <div className="flex items-center gap-2">
          {/* Seletor de ano */}
          <div className="flex items-center gap-2">
            <span className={`text-xs ${muted}`}>Turmas em:</span>
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

          {/* Botão adicionar */}
          {canEdit && (
            <button
              onClick={() => { setShowAddForm(true); setEditingId(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              <Plus size={15} />
              Novo
            </button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className={`flex items-start gap-2 text-xs p-3 rounded-lg mb-4 ${isDark ? 'bg-blue-900/20 border border-blue-800/40 text-blue-300' : 'bg-blue-50 border border-blue-100 text-blue-700'}`}>
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          <strong>Esquadrão</strong> (Drakon, Perseu…) é permanente.
          A <strong>turma de aula</strong> (A–F) é anual — use o seletor de ano para ver dados de anos anteriores.
          Cadetes sem alocação no ano selecionado exibem a turma mais recente disponível{' '}
          <span className={isDark ? 'text-blue-400' : 'text-blue-600'}>(indicado com *)</span>.
        </span>
      </div>

      {/* Formulário de adição */}
      {showAddForm && canEdit && (
        <div className={`rounded-xl border p-4 mb-4 ${isDark ? 'bg-slate-700/60 border-indigo-700/50' : 'bg-indigo-50 border-indigo-200'}`}>
          <h3 className={`text-sm font-medium mb-3 ${text}`}>Novo Cadete</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div>
              <label className={`text-xs ${muted} block mb-1`}>Nº *</label>
              <input
                value={addDraft.id}
                onChange={e => setAddDraft(d => ({ ...d, id: e.target.value }))}
                placeholder="26-001"
                className={`w-full px-2 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
              />
            </div>
            <div>
              <label className={`text-xs ${muted} block mb-1`}>N. Guerra *</label>
              <input
                value={addDraft.nome_guerra}
                onChange={e => setAddDraft(d => ({ ...d, nome_guerra: e.target.value }))}
                placeholder="SILVA"
                className={`w-full px-2 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
              />
            </div>
            <div className="col-span-2 sm:col-span-1 lg:col-span-2">
              <label className={`text-xs ${muted} block mb-1`}>Nome Completo *</label>
              <input
                value={addDraft.nome_completo}
                onChange={e => setAddDraft(d => ({ ...d, nome_completo: e.target.value }))}
                placeholder="JOÃO DA SILVA"
                className={`w-full px-2 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
              />
            </div>
            <div className="relative">
              <label className={`text-xs ${muted} block mb-1`}>Quadro</label>
              <select
                value={addDraft.quadro}
                onChange={e => setAddDraft(d => ({ ...d, quadro: e.target.value as CadetQuadro }))}
                className={`w-full pl-2 pr-6 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
              >
                {QUADRO_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
              <ChevronDown size={11} className={`absolute right-1.5 bottom-2.5 pointer-events-none ${muted}`} />
            </div>
            <div className="relative">
              <label className={`text-xs ${muted} block mb-1`}>Esquadrão</label>
              <select
                value={addDraft.cohort_id}
                onChange={e => setAddDraft(d => ({ ...d, cohort_id: e.target.value }))}
                className={`w-full pl-2 pr-6 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
              >
                <option value="">—</option>
                {cohorts.map(c => <option key={c.id} value={String(c.id)}>{c.name} {c.entryYear}</option>)}
              </select>
              <ChevronDown size={11} className={`absolute right-1.5 bottom-2.5 pointer-events-none ${muted}`} />
            </div>
            <div className="relative">
              <label className={`text-xs ${muted} block mb-1`}>Situação</label>
              <select
                value={addDraft.situacao}
                onChange={e => setAddDraft(d => ({ ...d, situacao: e.target.value as CadetSituacao }))}
                className={`w-full pl-2 pr-6 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
              >
                {SITUACAO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={11} className={`absolute right-1.5 bottom-2.5 pointer-events-none ${muted}`} />
            </div>
            <div className="relative">
              <label className={`text-xs ${muted} block mb-1`}>T. Aula {anoFiltro}</label>
              <select
                value={addDraft.turma_aula}
                onChange={e => setAddDraft(d => ({ ...d, turma_aula: e.target.value as CadetTurma | '' }))}
                className={`w-full pl-2 pr-6 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
              >
                <option value="">—</option>
                {TURMA_OPTIONS.map(t => <option key={t} value={t}>{t.replace('TURMA_', 'Turma ')}</option>)}
              </select>
              <ChevronDown size={11} className={`absolute right-1.5 bottom-2.5 pointer-events-none ${muted}`} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={saveAdd}
              disabled={addSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-50"
            >
              <Save size={13} /> {addSaving ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddDraft(EMPTY_ADD); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-200'} ${muted}`}
            >
              <X size={13} /> Cancelar
            </button>
          </div>
        </div>
      )}

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

        {[
          <div key="cohort" className="relative">
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
          </div>,

          <div key="quadro" className="relative">
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
          </div>,

          <div key="turma" className="relative">
            <select
              value={filterTurma}
              onChange={e => setFilterTurma(e.target.value as CadetTurma | '')}
              className={`pl-3 pr-7 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
            >
              <option value="">Todas as t. de aula</option>
              {TURMA_OPTIONS.map(t => (
                <option key={t} value={t}>{t.replace('TURMA_', 'Turma ')}</option>
              ))}
            </select>
            <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
          </div>,

          <div key="sit" className="relative">
            <select
              value={filterSit}
              onChange={e => setFilterSit(e.target.value as CadetSituacao | '')}
              className={`pl-3 pr-7 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
            >
              <option value="">Todas as situações</option>
              {SITUACAO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
          </div>,
        ]}
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
                  Esquadrão <span className={`text-[10px] font-normal ${muted}`}>(perm.)</span>
                </th>
                <th className="text-left px-3 py-2 font-medium w-24">Quadro</th>
                <th className="text-left px-3 py-2 font-medium w-28">
                  T. Aula <span className={`text-[10px] font-normal ${muted}`}>(anual)</span>
                </th>
                <th className="text-left px-3 py-2 font-medium w-28">Situação</th>
                {canEdit && <th className="px-3 py-2 w-20" />}
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
                const isFallback = (c as typeof c & { turma_fallback?: boolean }).turma_fallback;
                const turmaAno   = (c as typeof c & { turma_ano?: number }).turma_ano;
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

                    {/* Esquadrão */}
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

                    {/* Turma de aula */}
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
                              <option key={t} value={t}>{t.replace('TURMA_', 'Turma ')}</option>
                            ))}
                          </select>
                          <ChevronDown size={11} className={`absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
                        </div>
                      ) : c.turma_aula ? (
                        <div className="flex items-center gap-1">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-semibold text-sm border ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-slate-100 border-slate-200 text-slate-800'}`}>
                            {c.turma_aula.replace('TURMA_', '')}
                          </span>
                          {isFallback && (
                            <span className={`text-[10px] ${isDark ? 'text-blue-400' : 'text-blue-500'}`} title={`Dado de ${turmaAno}`}>
                              *{turmaAno}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className={`text-xs italic ${muted}`}>—</span>
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
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(c)}
                              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${muted} hover:text-indigo-500 transition-colors`}
                              title="Editar"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => deleteCadet(c.id, c.nome_guerra)}
                              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-red-900/40' : 'hover:bg-red-50'} ${muted} hover:text-red-500 transition-colors`}
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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
        {anosDisponiveis.length > 1 && (
          <span> · <span className={isDark ? 'text-blue-400' : 'text-blue-500'}>* = turma de outro ano (sem alocação em {anoFiltro})</span></span>
        )}
      </p>
    </div>
  );
};
