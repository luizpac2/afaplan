import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Users, Search, Edit2, Save, X, ChevronDown, AlertCircle } from 'lucide-react';
import type { Cadet, CadetQuadro, CadetTurma, CadetSituacao } from '../types';

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

type EditState = Partial<Pick<Cadet, 'nome_guerra' | 'turma_aula' | 'situacao' | 'observacao'>>;

export const CadetManager = ({ cohortId }: { cohortId?: string }) => {
  const { userProfile } = useAuth();
  const { theme } = useTheme();

  const [cadets, setCadets]       = useState<Cadet[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [filterQuadro, setFilterQuadro] = useState<CadetQuadro | ''>('');
  const [filterTurma, setFilterTurma]   = useState<CadetTurma | ''>('');
  const [filterSit, setFilterSit]       = useState<CadetSituacao | ''>('ATIVO');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditState>({});
  const [saving, setSaving]       = useState(false);

  const canEdit = useMemo(
    () => ['SUPER_ADMIN', 'ADMIN'].includes(userProfile?.role ?? ''),
    [userProfile],
  );

  // ── Load ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase.from('cadetes').select('*').order('id');
      if (cohortId) q = q.eq('cohort_id', cohortId);
      const { data, error } = await q;
      if (error) setError(error.message);
      else setCadets(data as Cadet[]);
      setLoading(false);
    };
    void load();
  }, [cohortId]);

  // ── Filtering ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return cadets.filter(c => {
      if (filterQuadro && c.quadro !== filterQuadro) return false;
      if (filterTurma  && c.turma_aula !== filterTurma) return false;
      if (filterSit    && c.situacao !== filterSit) return false;
      if (s && !c.nome_guerra.toLowerCase().includes(s) && !c.nome_completo.toLowerCase().includes(s) && !c.id.includes(s)) return false;
      return true;
    });
  }, [cadets, search, filterQuadro, filterTurma, filterSit]);

  const counts = useMemo(() => ({
    total: cadets.length,
    ativos: cadets.filter(c => c.situacao === 'ATIVO').length,
    av: cadets.filter(c => c.quadro === 'CFOAV' && c.situacao === 'ATIVO').length,
    int: cadets.filter(c => c.quadro === 'CFOINT' && c.situacao === 'ATIVO').length,
    inf: cadets.filter(c => c.quadro === 'CFOINF' && c.situacao === 'ATIVO').length,
  }), [cadets]);

  // ── Edit ────────────────────────────────────────────────────
  const startEdit = (c: Cadet) => {
    setEditingId(c.id);
    setEditDraft({ nome_guerra: c.nome_guerra, turma_aula: c.turma_aula, situacao: c.situacao, observacao: c.observacao ?? '' });
  };

  const cancelEdit = () => { setEditingId(null); setEditDraft({}); };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('cadetes')
      .update({ ...editDraft, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('Erro ao salvar: ' + error.message);
    } else {
      setCadets(prev => prev.map(c => c.id === id ? { ...c, ...editDraft } as Cadet : c));
      setEditingId(null);
    }
    setSaving(false);
  };

  // ── Render ──────────────────────────────────────────────────
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className={`text-xl flex items-center gap-2 ${text}`}>
            <Users className={isDark ? 'text-indigo-400' : 'text-indigo-600'} size={22} />
            Cadetes
          </h2>
          <p className={`text-sm mt-1 ${muted}`}>
            {counts.ativos} ativos de {counts.total} &nbsp;·&nbsp;
            <span className="text-sky-500">{counts.av} Av</span> &nbsp;·&nbsp;
            <span className="text-amber-500">{counts.int} Int</span> &nbsp;·&nbsp;
            <span className="text-orange-500">{counts.inf} Inf</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou Nº..."
            className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
          />
        </div>

        {/* Quadro filter */}
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

        {/* Turma filter */}
        <div className="relative">
          <select
            value={filterTurma}
            onChange={e => setFilterTurma(e.target.value as CadetTurma | '')}
            className={`pl-3 pr-7 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
          >
            <option value="">Todas as turmas</option>
            {TURMA_OPTIONS.map(t => (
              <option key={t} value={t}>{t.replace('TURMA_', 'Turma ')}</option>
            ))}
          </select>
          <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
        </div>

        {/* Situação filter */}
        <div className="relative">
          <select
            value={filterSit}
            onChange={e => setFilterSit(e.target.value as CadetSituacao | '')}
            className={`pl-3 pr-7 py-1.5 rounded-lg border text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-400 ${input}`}
          >
            <option value="">Todas as situações</option>
            {SITUACAO_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
        </div>
      </div>

      {/* Loading / Error */}
      {loading && <p className={`text-sm py-8 text-center ${muted}`}>Carregando cadetes...</p>}
      {error && (
        <div className={`flex items-center gap-2 text-sm p-3 rounded-lg mb-4 ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'}`}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? 'bg-slate-900/60 text-slate-400' : 'bg-slate-50 text-slate-500'}>
                <th className="text-left px-3 py-2 font-medium w-20">Nº</th>
                <th className="text-left px-3 py-2 font-medium w-28">N. Guerra</th>
                <th className="text-left px-3 py-2 font-medium">Nome Completo</th>
                <th className="text-left px-3 py-2 font-medium w-24">Quadro</th>
                <th className="text-left px-3 py-2 font-medium w-24">Turma</th>
                <th className="text-left px-3 py-2 font-medium w-28">Situação</th>
                {canEdit && <th className="px-3 py-2 w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className={`text-center py-8 ${muted}`}>
                    Nenhum cadete encontrado.
                  </td>
                </tr>
              )}
              {filtered.map(c => {
                const isEditing = editingId === c.id;
                return (
                  <tr
                    key={c.id}
                    className={`transition-colors ${isEditing
                      ? (isDark ? 'bg-indigo-900/20' : 'bg-indigo-50/60')
                      : (isDark ? 'hover:bg-slate-700/40' : 'hover:bg-slate-50')
                    }`}
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
                    <td className={`px-3 py-2 ${muted} text-xs`}>{c.nome_completo}</td>

                    {/* Quadro */}
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${QUADRO_COLOR[c.quadro]}`}>
                        {c.quadro}
                      </span>
                    </td>

                    {/* Turma */}
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="relative">
                          <select
                            value={editDraft.turma_aula ?? c.turma_aula}
                            onChange={e => setEditDraft(d => ({ ...d, turma_aula: e.target.value as CadetTurma }))}
                            className={`w-full pl-2 pr-6 py-1 rounded border text-xs appearance-none ${input}`}
                          >
                            {TURMA_OPTIONS.map(t => <option key={t} value={t}>{t.replace('TURMA_','')}</option>)}
                          </select>
                          <ChevronDown size={11} className={`absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
                        </div>
                      ) : (
                        <span className={`text-xs ${muted}`}>{c.turma_aula.replace('TURMA_','Turma ')}</span>
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
