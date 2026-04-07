import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { MOTIVOS_FALTA } from '../types';
import type { Cadet, FaltaCadete } from '../types';
import {
  ClipboardList, ChevronDown, Check, X, AlertCircle,
  Search, Save, Calendar,
} from 'lucide-react';

interface AulaPassada {
  id: string;
  data: string;
  horario_inicio: string;
  horario_fim: string;
  disciplina_sigla: string;
  disciplina_nome: string;
  turma_nome: string;
  turma_aula: string | null;
}

interface FaltaRascunho {
  cadet_id: string;
  motivo: string;
  observacao: string;
}

const TURMA_LETTER: Record<string, string> = {
  TURMA_A: 'A', TURMA_B: 'B', TURMA_C: 'C',
  TURMA_D: 'D', TURMA_E: 'E', TURMA_F: 'F',
};

export const ChefeTurmaLancamento = () => {
  const { userProfile } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [aulas, setAulas] = useState<AulaPassada[]>([]);
  const [aulaSelecionada, setAulaSelecionada] = useState<AulaPassada | null>(null);
  const [cadetesDaTurma, setCadetesDaTurma] = useState<Cadet[]>([]);
  const [faltasExistentes, setFaltasExistentes] = useState<FaltaCadete[]>([]);
  const [rascunhos, setRascunhos] = useState<Record<string, FaltaRascunho>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const turmaAula = userProfile?.turmaAula ?? '';
  const cadetId   = userProfile?.cadetId ?? '';

  // Carregar aulas passadas e cadetes da turma
  useEffect(() => {
    if (!turmaAula || !cadetId) return;
    const load = async () => {
      setLoading(true);

      // Aulas passadas dos últimos 30 dias filtradas pela turma do chefe
      // (a turma de aula do chefe determina a seção, mas a aula pertence à turma/esquadrão)
      const hoje = new Date().toISOString().slice(0, 10);
      const limite = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

      const { data: aulasData } = await supabase
        .from('programacao_aulas')
        .select(`
          id, data, horario_inicio, horario_fim,
          disciplinas(sigla, nome),
          turmas(nome),
          turma_secoes(secao)
        `)
        .lt('data', hoje)
        .gte('data', limite)
        .order('data', { ascending: false })
        .order('horario_inicio', { ascending: false });

      // Filtrar pelo turma_aula do chefe
      const letter = TURMA_LETTER[turmaAula] ?? turmaAula.replace('TURMA_', '');
      const aulasFiltradas: AulaPassada[] = ((aulasData ?? []) as unknown[]).flatMap((a) => {
        const row = a as {
          id: string; data: string; horario_inicio: string; horario_fim: string;
          disciplinas: { sigla: string; nome: string } | null;
          turmas: { nome: string } | null;
          turma_secoes: { secao: string } | null;
        };
        const secao = row.turma_secoes?.secao ?? null;
        // Inclui aulas sem seção (turma inteira) ou da seção certa
        if (secao !== null && secao !== letter) return [];
        return [{
          id: row.id,
          data: row.data,
          horario_inicio: row.horario_inicio,
          horario_fim: row.horario_fim,
          disciplina_sigla: row.disciplinas?.sigla ?? '',
          disciplina_nome: row.disciplinas?.nome ?? '',
          turma_nome: row.turmas?.nome ?? '',
          turma_aula: secao,
        }];
      });
      setAulas(aulasFiltradas);

      // Cadetes da mesma turma de aula (via alocacao do ano atual)
      const anoAtual = new Date().getFullYear();
      const { data: alocacoes } = await supabase
        .from('cadete_alocacoes')
        .select('cadet_id')
        .eq('turma_aula', turmaAula)
        .eq('ano', anoAtual);

      const ids = (alocacoes ?? []).map((a: { cadet_id: string }) => a.cadet_id);

      if (ids.length > 0) {
        const { data: cadetes } = await supabase
          .from('cadetes')
          .select('*')
          .in('id', ids)
          .eq('situacao', 'ATIVO')
          .order('nome_guerra');
        setCadetesDaTurma((cadetes as Cadet[]) ?? []);
      }

      setLoading(false);
    };
    void load();
  }, [turmaAula, cadetId]);

  // Carregar faltas já existentes quando muda a aula selecionada
  useEffect(() => {
    if (!aulaSelecionada) { setFaltasExistentes([]); setRascunhos({}); return; }
    const load = async () => {
      const { data } = await supabase
        .from('faltas_cadetes')
        .select('*')
        .eq('aula_id', aulaSelecionada.id);
      const faltas = (data as FaltaCadete[]) ?? [];
      setFaltasExistentes(faltas);
      // Pré-preencher rascunhos com faltas existentes
      const draft: Record<string, FaltaRascunho> = {};
      faltas.forEach((f) => {
        draft[f.cadet_id] = { cadet_id: f.cadet_id, motivo: f.motivo, observacao: f.observacao ?? '' };
      });
      setRascunhos(draft);
    };
    void load();
  }, [aulaSelecionada]);

  const cadetesFiltrados = useMemo(() =>
    cadetesDaTurma.filter((c) =>
      c.nome_guerra.toLowerCase().includes(search.toLowerCase()) ||
      c.nome_completo.toLowerCase().includes(search.toLowerCase()) ||
      c.id.includes(search)
    ), [cadetesDaTurma, search]);

  const toggleFalta = (cadetId: string) => {
    setRascunhos((prev) => {
      if (prev[cadetId]) {
        const next = { ...prev };
        delete next[cadetId];
        return next;
      }
      return { ...prev, [cadetId]: { cadet_id: cadetId, motivo: 'DESCONHECIDO', observacao: '' } };
    });
  };

  const updateMotivo = (cadetId: string, motivo: string) => {
    setRascunhos((prev) => ({ ...prev, [cadetId]: { ...prev[cadetId], motivo } }));
  };

  const updateObs = (cadetId: string, observacao: string) => {
    setRascunhos((prev) => ({ ...prev, [cadetId]: { ...prev[cadetId], observacao } }));
  };

  const handleSalvar = async () => {
    if (!aulaSelecionada || !cadetId) return;
    setSaving(true);
    setMsg(null);

    // Faltas a deletar (estavam registradas mas foram desmarcadas)
    const idsDesmarcados = faltasExistentes
      .filter((f) => !rascunhos[f.cadet_id])
      .map((f) => f.id);

    // Upserts (novas ou atualizadas)
    const upserts = Object.values(rascunhos).map((r) => ({
      aula_id: aulaSelecionada.id,
      cadet_id: r.cadet_id,
      motivo: r.motivo,
      observacao: r.observacao || null,
      chefe_cadet_id: cadetId,
    }));

    let erroGlobal: unknown = null;

    if (idsDesmarcados.length > 0) {
      const { error } = await supabase.from('faltas_cadetes').delete().in('id', idsDesmarcados);
      if (error) erroGlobal = error;
    }
    if (upserts.length > 0) {
      const { error } = await supabase.from('faltas_cadetes')
        .upsert(upserts, { onConflict: 'aula_id,cadet_id' });
      if (error) erroGlobal = error;
    }

    const erro = erroGlobal;
    if (erro) {
      setMsg({ text: 'Erro ao salvar. Tente novamente.', type: 'error' });
    } else {
      setMsg({ text: 'Faltas salvas com sucesso!', type: 'success' });
      // Recarregar faltas existentes
      const { data } = await supabase.from('faltas_cadetes').select('*').eq('aula_id', aulaSelecionada.id);
      setFaltasExistentes((data as FaltaCadete[]) ?? []);
    }
    setSaving(false);
  };

  // ── Estilos ───────────────────────────────────────────────
  const card = `rounded-xl border ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;
  const lbl  = dark ? 'text-slate-400' : 'text-slate-500';
  const text = dark ? 'text-slate-100' : 'text-slate-900';
  const inp  = `w-full px-2 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`;

  const fmtData = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-2xl tracking-tight ${text}`}>Lançamento de Faltas</h1>
        <p className={`mt-1 text-sm ${lbl}`}>
          Turma {TURMA_LETTER[turmaAula] ?? turmaAula} — você é Chefe de Turma desta semana
        </p>
      </div>

      {/* Seleção de aula */}
      <div className={`${card} p-5`}>
        <h2 className={`text-sm font-medium uppercase tracking-wide mb-3 ${lbl}`}>
          <Calendar size={14} className="inline mr-1" />
          1. Selecione a aula
        </h2>
        {aulas.length === 0 ? (
          <p className={`text-sm ${lbl}`}>Nenhuma aula passada encontrada nos últimos 30 dias.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {aulas.map((a) => (
              <button
                key={a.id}
                onClick={() => setAulaSelecionada(a)}
                className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                  aulaSelecionada?.id === a.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                    : dark
                      ? 'border-slate-700 hover:border-slate-500 text-slate-300'
                      : 'border-slate-200 hover:border-slate-400 text-slate-700'
                }`}
              >
                <div className="font-semibold">{a.disciplina_sigla} — {a.disciplina_nome}</div>
                <div className={`text-xs mt-0.5 ${lbl}`}>
                  {fmtData(a.data)} · {a.horario_inicio.slice(0,5)}–{a.horario_fim.slice(0,5)}
                  {a.turma_aula && <span className="ml-2">· T. {a.turma_aula}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista de cadetes */}
      {aulaSelecionada && (
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <h2 className={`text-sm font-medium uppercase tracking-wide ${lbl}`}>
              <ClipboardList size={14} className="inline mr-1" />
              2. Marque os faltosos — {aulaSelecionada.disciplina_sigla} · {fmtData(aulaSelecionada.data)}
            </h2>
            <div className="relative">
              <Search size={14} className={`absolute left-2 top-1/2 -translate-y-1/2 ${lbl}`} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cadete…"
                className={`pl-7 pr-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300'}`}
              />
            </div>
          </div>

          <div className="space-y-2">
            {cadetesFiltrados.map((c) => {
              const faltou = !!rascunhos[c.id];
              return (
                <div
                  key={c.id}
                  className={`rounded-xl border transition-colors ${
                    faltou
                      ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
                      : dark ? 'border-slate-700' : 'border-slate-100'
                  }`}
                >
                  {/* Linha principal */}
                  <div className="flex items-center gap-3 p-3">
                    <button
                      onClick={() => toggleFalta(c.id)}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        faltou
                          ? 'bg-red-500 border-red-500 text-white'
                          : dark ? 'border-slate-600' : 'border-slate-300'
                      }`}
                    >
                      {faltou && <X size={12} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium text-sm ${faltou ? 'text-red-700 dark:text-red-400' : text}`}>
                        {c.nome_guerra}
                      </span>
                      <span className={`ml-2 text-xs ${lbl}`}>{c.id}</span>
                    </div>
                    {!faltou && (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Check size={12} /> Presente
                      </span>
                    )}
                  </div>

                  {/* Motivo + observação (só quando faltou) */}
                  {faltou && (
                    <div className="px-3 pb-3 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="relative">
                        <select
                          value={rascunhos[c.id]?.motivo ?? 'DESCONHECIDO'}
                          onChange={(e) => updateMotivo(c.id, e.target.value)}
                          className={`appearance-none ${inp} pr-7`}
                        >
                          {MOTIVOS_FALTA.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${lbl}`} />
                      </div>
                      <input
                        value={rascunhos[c.id]?.observacao ?? ''}
                        onChange={(e) => updateObs(c.id, e.target.value)}
                        placeholder="Observação (opcional)"
                        className={inp}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Resumo + salvar */}
          <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
            <span className={`text-sm ${lbl}`}>
              {Object.keys(rascunhos).length} falta(s) registrada(s) de {cadetesDaTurma.length} cadetes
            </span>
            <div className="flex items-center gap-3">
              {msg && (
                <span className={`flex items-center gap-1.5 text-sm ${msg.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {msg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                  {msg.text}
                </span>
              )}
              <button
                onClick={handleSalvar}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Save size={14} />
                )}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instrução inicial */}
      {!aulaSelecionada && !loading && (
        <div className={`${card} p-8 text-center`}>
          <ClipboardList size={32} className={`mx-auto mb-3 ${lbl}`} />
          <p className={`text-sm ${lbl}`}>Selecione uma aula acima para lançar as faltas.</p>
        </div>
      )}
    </div>
  );
};
