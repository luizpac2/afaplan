import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useTheme } from '../contexts/ThemeContext';
import {
  Users, AlertCircle, BarChart2, GraduationCap,
  Shield, BookOpen, TrendingDown, Search,
  ChevronRight, Award, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import type { Cadet, CadetAlocacao, Cohort } from '../types';

const ANO_ATUAL = new Date().getFullYear();

const TURMAS: Array<{ key: string; letter: string; curso: string; cursoShort: string }> = [
  { key: 'TURMA_A', letter: 'A', curso: 'Aviação',     cursoShort: 'AV' },
  { key: 'TURMA_B', letter: 'B', curso: 'Aviação',     cursoShort: 'AV' },
  { key: 'TURMA_C', letter: 'C', curso: 'Aviação',     cursoShort: 'AV' },
  { key: 'TURMA_D', letter: 'D', curso: 'Aviação',     cursoShort: 'AV' },
  { key: 'TURMA_E', letter: 'E', curso: 'Intendência', cursoShort: 'INT' },
  { key: 'TURMA_F', letter: 'F', curso: 'Infantaria',  cursoShort: 'INF' },
];

const CURSO_STYLE: Record<string, string> = {
  AV:  'bg-sky-600 text-white',
  INT: 'bg-amber-600 text-white',
  INF: 'bg-orange-600 text-white',
};

const QUADRO_LABEL: Record<string, string> = {
  CFOAV: 'Aviação', CFOINT: 'Intendência', CFOINF: 'Infantaria',
};

const QUADRO_COLOR: Record<string, { bg: string; text: string }> = {
  CFOAV:  { bg: 'bg-sky-100 dark:bg-sky-900/30',      text: 'text-sky-700 dark:text-sky-300' },
  CFOINT: { bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-300' },
  CFOINF: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
};

const SITUACAO_STYLE: Record<string, string> = {
  ATIVO:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  DESLIGADO:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  TRANCADO:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  TRANSFERIDO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

// Cor do indicador lateral de cada turma
const TURMA_COLOR: Record<string, string> = {
  TURMA_A: 'bg-sky-500',
  TURMA_B: 'bg-violet-500',
  TURMA_C: 'bg-emerald-500',
  TURMA_D: 'bg-rose-500',
  TURMA_E: 'bg-amber-500',
  TURMA_F: 'bg-orange-500',
};

const TURMA_BORDER: Record<string, string> = {
  TURMA_A: 'border-sky-500',
  TURMA_B: 'border-violet-500',
  TURMA_C: 'border-emerald-500',
  TURMA_D: 'border-rose-500',
  TURMA_E: 'border-amber-500',
  TURMA_F: 'border-orange-500',
};

interface FaltaRow {
  cadet_id: string;
  nome_guerra: string;
  data_aula: string;
  disciplina_sigla: string;
  disciplina_nome: string;
  turma_aula: string | null;
  motivo: string;
}

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export const TurmasAula = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [cadets,    setCadets]    = useState<Cadet[]>([]);
  const [alocacoes, setAlocacoes] = useState<CadetAlocacao[]>([]);
  const [cohorts,   setCohorts]   = useState<Cohort[]>([]);
  const [faltas,    setFaltas]    = useState<FaltaRow[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Hierarquia: Esquadrão (null = todos) → Turma (null = todas)
  const [esquadraoSel, setEsquadraoSel] = useState<number | null>(null);
  const [turmaSel,     setTurmaSel]     = useState<string | null>(null);
  const [search,       setSearch]       = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: c }, { data: a }, { data: co }, { data: f }] = await Promise.all([
        supabase.from('cadetes').select('*').order('nome_guerra'),
        supabase.from('cadete_alocacoes').select('*').order('ano', { ascending: false }),
        supabase.from('cohorts').select('*').order('entryYear', { ascending: false }),
        supabase.from('vw_faltas_resumo').select(
          'cadet_id,nome_guerra,data_aula,disciplina_sigla,disciplina_nome,turma_aula,motivo'
        ),
      ]);
      setCadets((c as Cadet[]) ?? []);
      setAlocacoes((a as CadetAlocacao[]) ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCohorts(((co ?? []) as any[]).map((x) => ({ ...x, name: x.nome || x.name, entryYear: x.ano_ingresso ?? x.entryYear })) as Cohort[]);
      setFaltas((f as FaltaRow[]) ?? []);
      setLoading(false);
    };
    void load();
  }, []);

  // ── squadrons sorted 1º → 4º ──────────────────────────────────────────────
  const cohortMap = useMemo(() => new Map(cohorts.map((co) => [co.id, co])), [cohorts]);

  const squadrons = useMemo(() =>
    [...cohorts]
      .map((co) => ({ ...co, num: ANO_ATUAL - co.entryYear + 1 }))
      .filter((co) => co.num >= 1 && co.num <= 4)
      .sort((a, b) => a.num - b.num),
    [cohorts],
  );

  const squadronNumOf = (cohortId: string) => {
    const co = cohortMap.get(cohortId);
    return co ? ANO_ATUAL - co.entryYear + 1 : 99;
  };

  // ── enrich cadetes with turma_aula ───────────────────────────────────────
  const enriched = useMemo(() => {
    // alocacoes vem ordenado por ano desc — o Map mantém o primeiro valor inserido por chave,
    // então map.get(id) = turma_aula do ano mais recente para cada cadete
    const map = new Map<string, string>();
    alocacoes.forEach((a) => { if (!map.has(a.cadet_id)) map.set(a.cadet_id, a.turma_aula); });
    return cadets.map((c) => ({ ...c, turma_aula: map.get(c.id) ?? c.turma_aula ?? null }));
  }, [cadets, alocacoes]);

  // ── filtered cadetes (esquadrão + turma) ─────────────────────────────────
  const cadetesFiltBase = useMemo(() => {
    let list = enriched;
    if (esquadraoSel !== null)
      list = list.filter((c) => squadronNumOf(c.cohort_id) === esquadraoSel);
    if (turmaSel !== null)
      list = list.filter((c) => c.turma_aula === turmaSel);
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched, esquadraoSel, turmaSel, cohortMap]);

  const cadetesFiltrados = useMemo(() => {
    const txt = search.toLowerCase();
    if (!txt) return cadetesFiltBase;
    return cadetesFiltBase.filter(
      (c) => c.nome_guerra.toLowerCase().includes(txt) ||
             c.nome_completo.toLowerCase().includes(txt) ||
             c.id.includes(txt),
    );
  }, [cadetesFiltBase, search]);

  const ativos   = useMemo(() => cadetesFiltBase.filter((c) => c.situacao === 'ATIVO'), [cadetesFiltBase]);
  const inativos = useMemo(() => cadetesFiltBase.filter((c) => c.situacao !== 'ATIVO'), [cadetesFiltBase]);

  // ── faltas filtered ───────────────────────────────────────────────────────
  const faltasFilt = useMemo(() => {
    let list = faltas;
    if (turmaSel !== null) list = list.filter((f) => f.turma_aula === turmaSel);
    if (esquadraoSel !== null) {
      const cohortIds = new Set(squadrons.filter((s) => s.num === esquadraoSel).map((s) => s.id));
      const cadetIds  = new Set(enriched.filter((c) => cohortIds.has(c.cohort_id)).map((c) => c.id));
      list = list.filter((f) => cadetIds.has(f.cadet_id));
    }
    return list;
  }, [faltas, turmaSel, esquadraoSel, squadrons, enriched]);

  const faltasPorCadete = useMemo(() => {
    const acc: Record<string, number> = {};
    faltasFilt.forEach((f) => { acc[f.cadet_id] = (acc[f.cadet_id] ?? 0) + 1; });
    return acc;
  }, [faltasFilt]);

  const faltasPorMotivo = useMemo(() => {
    const acc: Record<string, number> = {};
    faltasFilt.forEach((f) => { acc[f.motivo] = (acc[f.motivo] ?? 0) + 1; });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([motivo, total]) => ({ motivo, total }));
  }, [faltasFilt]);

  const faltasPorDisciplina = useMemo(() => {
    const acc: Record<string, { sigla: string; nome: string; total: number }> = {};
    faltasFilt.forEach((f) => {
      if (!acc[f.disciplina_sigla])
        acc[f.disciplina_sigla] = { sigla: f.disciplina_sigla, nome: f.disciplina_nome, total: 0 };
      acc[f.disciplina_sigla].total++;
    });
    return Object.values(acc).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [faltasFilt]);

  const topFaltosos = useMemo(() =>
    Object.entries(faltasPorCadete)
      .map(([cadet_id, total]) => ({ cadet_id, total, cadet: enriched.find((c) => c.id === cadet_id) }))
      .filter((x) => x.cadet?.situacao === 'ATIVO')
      .sort((a, b) => b.total - a.total).slice(0, 5),
    [faltasPorCadete, enriched],
  );

  const ultimasFaltas = useMemo(
    () => [...faltasFilt].sort((a, b) => b.data_aula.localeCompare(a.data_aula)).slice(0, 8),
    [faltasFilt],
  );

  const porQuadro = useMemo(() => {
    const acc: Record<string, number> = { CFOAV: 0, CFOINT: 0, CFOINF: 0 };
    ativos.forEach((c) => { if (c.quadro in acc) acc[c.quadro]++; });
    return Object.entries(acc).filter(([, v]) => v > 0)
      .map(([quadro, total]) => ({ quadro, label: QUADRO_LABEL[quadro], total }));
  }, [ativos]);

  // composição por turma (dentro do esquadrão selecionado, ou geral)
  const porTurma = useMemo(() => {
    return TURMAS.map((t) => {
      let list = enriched.filter((c) => c.turma_aula === t.key && c.situacao === 'ATIVO');
      if (esquadraoSel !== null)
        list = list.filter((c) => squadronNumOf(c.cohort_id) === esquadraoSel);
      return { ...t, total: list.length };
    }).filter((t) => t.total > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched, esquadraoSel, cohortMap]);

  // count ativos por turma para os tabs (sem filtro de esquadrão)
  const countByTurma = useMemo(() => {
    const acc: Record<string, number> = {};
    enriched.forEach((c) => {
      if (c.situacao === 'ATIVO' && c.turma_aula) {
        if (esquadraoSel === null || squadronNumOf(c.cohort_id) === esquadraoSel)
          acc[c.turma_aula] = (acc[c.turma_aula] ?? 0) + 1;
      }
    });
    return acc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched, esquadraoSel, cohortMap]);

  // ── styles ────────────────────────────────────────────────────────────────
  const bg    = dark ? 'bg-slate-950' : 'bg-slate-50';
  const card  = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const text  = dark ? 'text-slate-100' : 'text-slate-900';
  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  const input = dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900';
  const axis  = dark ? '#94a3b8' : '#64748b';
  const gridC = dark ? '#1e293b' : '#f1f5f9';

  const dotSel = turmaSel ? (TURMA_COLOR[turmaSel] ?? 'bg-slate-400') : 'bg-slate-400';

  // label do contexto atual
  const ctxLabel = [
    esquadraoSel !== null ? `${esquadraoSel}º Esq. · ${squadrons.find((s) => s.num === esquadraoSel)?.name ?? ''}` : null,
    turmaSel !== null ? `Turma ${turmaSel.replace('TURMA_', '')} · ${TURMAS.find((t) => t.key === turmaSel)?.curso ?? ''}` : null,
  ].filter(Boolean).join(' › ') || `Todos os esquadrões · Todas as turmas`;

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${bg}`}>
        <div className={`text-sm animate-pulse ${muted}`}>Carregando dados…</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} p-4 md:p-6 space-y-5`}>

      {/* ── HEADER com filtros integrados ──────────────────────────────────── */}
      <div className={`rounded-xl border p-4 ${card}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">

          {/* Título + contexto */}
          <div className="min-w-0">
            <h1 className={`text-lg font-bold ${text}`}>Turmas de Aula · {ANO_ATUAL}</h1>
            <p className={`text-xs mt-0.5 ${muted}`}>{ctxLabel}</p>
          </div>

          {/* Busca */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${input}`}>
            <Search size={14} className={muted} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cadete…"
              className="bg-transparent text-sm outline-none w-36 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className={`my-4 h-px ${dark ? 'bg-slate-800' : 'bg-slate-100'}`} />

        {/* Nível 1: Esquadrão */}
        <div className="space-y-2">
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>Esquadrão</p>
          <div className="flex gap-2 flex-wrap">
            {/* Todos */}
            <button
              onClick={() => { setEsquadraoSel(null); setTurmaSel(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all
                ${esquadraoSel === null
                  ? `border-slate-500 ${dark ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white'}`
                  : `border-transparent ${dark ? 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}`}
            >
              Todos
            </button>
            {squadrons.map((sq) => {
              const active = esquadraoSel === sq.num;
              const countEsq = enriched.filter((c) => c.situacao === 'ATIVO' && squadronNumOf(c.cohort_id) === sq.num).length;
              return (
                <button
                  key={sq.id}
                  onClick={() => { setEsquadraoSel(sq.num); setTurmaSel(null); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all
                    ${active
                      ? `border-blue-500 ${dark ? 'bg-slate-700 text-white' : 'bg-blue-50 text-blue-900'}`
                      : `border-transparent ${dark ? 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}`}
                >
                  <span>{sq.num}º {sq.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? (dark ? 'bg-blue-900/60 text-blue-300' : 'bg-blue-100 text-blue-700') : (dark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500')}`}>
                    {countEsq}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`my-3 h-px ${dark ? 'bg-slate-800' : 'bg-slate-100'}`} />

        {/* Nível 2: Turma de Aula */}
        <div className="space-y-2">
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>Turma de Aula</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTurmaSel(null)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all
                ${turmaSel === null
                  ? `border-slate-500 ${dark ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white'}`
                  : `border-transparent ${dark ? 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}`}
            >
              Todas
            </button>
            {TURMAS.map((t) => {
              const active  = turmaSel === t.key;
              const count   = countByTurma[t.key] ?? 0;
              const border  = TURMA_BORDER[t.key];
              return (
                <button
                  key={t.key}
                  onClick={() => setTurmaSel(active ? null : t.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all
                    ${active
                      ? `${border} ${dark ? 'bg-slate-700 text-white' : 'bg-white text-slate-900'} shadow`
                      : `border-transparent ${dark ? 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}`}
                >
                  <span className="font-bold">{t.letter}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CURSO_STYLE[t.cursoShort]}`}>
                    {t.cursoShort}
                  </span>
                  <span className={`text-xs ${active ? muted : 'text-slate-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Resumo contextual ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {turmaSel && <div className={`h-1 w-8 rounded-full ${dotSel}`} />}
        <span className={`text-sm ${muted}`}>
          <span className="font-semibold">{ativos.length}</span> ativos
          {inativos.length > 0 && <> · <span className="font-semibold">{inativos.length}</span> inativos</>}
          {' '}· <span className="font-semibold">{faltasFilt.length}</span> faltas registradas
        </span>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users,        label: 'Cadetes',           value: cadetesFiltBase.length, sub: `${ativos.length} ativos` },
          { icon: TrendingDown, label: 'Total de faltas',   value: faltasFilt.length, sub: ativos.length ? `${(faltasFilt.length / ativos.length).toFixed(1)} p/ cadete` : '—' },
          { icon: Award,        label: 'Maior faltoso',     value: topFaltosos[0]?.total ?? 0, sub: topFaltosos[0]?.cadet?.nome_guerra ?? '—' },
          { icon: BookOpen,     label: 'Disciplinas c/ falta', value: faltasPorDisciplina.length, sub: faltasPorDisciplina[0]?.sigla ?? '—' },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className={`rounded-xl border p-4 ${card}`}>
            <div className="flex items-start justify-between mb-2">
              <p className={`text-xs font-medium ${muted}`}>{label}</p>
              <Icon size={16} className={muted} />
            </div>
            <p className={`text-2xl font-bold ${text}`}>{value}</p>
            <p className={`text-xs mt-1 ${muted} truncate`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Composição por turma + Faltas por motivo ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className={`rounded-xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className={muted} />
            <h3 className={`text-sm font-semibold ${text}`}>
              {turmaSel ? 'Composição por Quadro' : 'Cadetes por Turma de Aula'}
            </h3>
          </div>
          {turmaSel ? (
            porQuadro.length === 0 ? <p className={`text-sm ${muted}`}>Sem dados.</p> : (
              <div className="space-y-3">
                {porQuadro.map(({ quadro, label, total }) => (
                  <div key={quadro} className="flex items-center gap-3">
                    <span className={`text-xs w-24 ${muted}`}>{label}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${dotSel}`}
                        style={{ width: `${ativos.length ? (total / ativos.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-5 text-right ${text}`}>{total}</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            porTurma.length === 0 ? <p className={`text-sm ${muted}`}>Sem dados.</p> : (
              <div className="space-y-3">
                {porTurma.map((t) => (
                  <div key={t.key} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white ${TURMA_COLOR[t.key]}`}>
                      {t.letter}
                    </div>
                    <span className={`text-xs w-20 ${muted}`}>{t.curso}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${TURMA_COLOR[t.key]}`}
                        style={{ width: `${ativos.length ? (t.total / ativos.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-5 text-right ${text}`}>{t.total}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className={`rounded-xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={16} className={muted} />
            <h3 className={`text-sm font-semibold ${text}`}>Faltas por Motivo (top 6)</h3>
          </div>
          {faltasPorMotivo.length === 0 ? (
            <p className={`text-sm ${muted}`}>Nenhuma falta registrada.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={faltasPorMotivo} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridC} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axis }} />
                <YAxis type="category" dataKey="motivo" width={130}
                  tick={{ fontSize: 10, fill: axis }}
                  tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + '…' : v}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [v, 'Faltas']}
                  contentStyle={{ fontSize: 12, background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8 }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Faltas por disciplina ─────────────────────────────────────────── */}
      {faltasPorDisciplina.length > 0 && (
        <div className={`rounded-xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className={muted} />
            <h3 className={`text-sm font-semibold ${text}`}>Faltas por Disciplina</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={faltasPorDisciplina} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridC} vertical={false} />
              <XAxis dataKey="sigla" tick={{ fontSize: 11, fill: axis }} />
              <YAxis tick={{ fontSize: 11, fill: axis }} allowDecimals={false} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, _: any, p: any) => [v, p.payload.nome]}
                contentStyle={{ fontSize: 12, background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8 }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {faltasPorDisciplina.map((_, i) => (
                  <Cell key={i} fill={['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#818cf8','#4f46e5','#4338ca','#3730a3'][i % 8]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top faltosos + Últimas faltas ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`rounded-xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={16} className={muted} />
            <h3 className={`text-sm font-semibold ${text}`}>Mais Faltas (ativos)</h3>
          </div>
          {topFaltosos.length === 0 ? (
            <p className={`text-sm ${muted}`}>Nenhuma falta registrada.</p>
          ) : (
            <div className="space-y-2">
              {topFaltosos.map(({ cadet_id, total, cadet }, rank) => (
                <div key={cadet_id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${dark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                  <span className={`text-xs font-bold w-5 text-center ${rank === 0 ? 'text-red-500' : muted}`}>{rank + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${text}`}>{cadet?.nome_guerra ?? cadet_id}</p>
                    <p className={`text-xs truncate ${muted}`}>{cadet?.nome_completo ?? ''}</p>
                  </div>
                  <span className={`text-sm font-bold ${rank === 0 ? 'text-red-500' : text}`}>{total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`rounded-xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className={muted} />
            <h3 className={`text-sm font-semibold ${text}`}>Últimas Faltas</h3>
          </div>
          {ultimasFaltas.length === 0 ? (
            <p className={`text-sm ${muted}`}>Nenhuma falta registrada.</p>
          ) : (
            <div className="space-y-2">
              {ultimasFaltas.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`text-xs w-12 shrink-0 ${muted}`}>{fmtDate(f.data_aula)}</span>
                  <span className={`text-xs font-semibold w-14 shrink-0 ${text}`}>{f.disciplina_sigla}</span>
                  <span className={`text-xs flex-1 truncate font-medium ${text}`}>{f.nome_guerra}</span>
                  <span className={`text-xs truncate max-w-[100px] ${muted}`}>{f.motivo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Lista de cadetes ─────────────────────────────────────────────── */}
      <div className={`rounded-xl border ${card}`}>
        <div className={`flex flex-wrap items-center justify-between gap-3 p-5 border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className={muted} />
            <h3 className={`text-sm font-semibold ${text}`}>
              {turmaSel ? `Cadetes · Turma ${turmaSel.replace('TURMA_', '')}` : 'Cadetes'}
              {esquadraoSel !== null && ` · ${esquadraoSel}º Esquadrão`}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
              {cadetesFiltBase.length}
            </span>
          </div>
        </div>

        {cadetesFiltrados.length === 0 ? (
          <div className={`p-8 text-center text-sm ${muted}`}>
            Nenhum cadete encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...cadetesFiltrados]
              .sort((a, b) => {
                if (a.situacao === 'ATIVO' && b.situacao !== 'ATIVO') return -1;
                if (a.situacao !== 'ATIVO' && b.situacao === 'ATIVO') return 1;
                return a.nome_guerra.localeCompare(b.nome_guerra, 'pt-BR');
              })
              .map((c) => {
                const nFaltas = faltasPorCadete[c.id] ?? 0;
                const co = cohortMap.get(c.cohort_id);
                const esqNum = squadronNumOf(c.cohort_id);
                const turmaLetter = c.turma_aula?.replace('TURMA_', '') ?? '—';
                return (
                  <div key={c.id} className={`flex items-center gap-3 px-5 py-3 transition-colors ${dark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm
                      ${c.quadro === 'CFOAV'  ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                      : c.quadro === 'CFOINT' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'}`}>
                      {c.nome_guerra.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${text}`}>{c.nome_guerra}</p>
                      <p className={`text-xs truncate ${muted}`}>{c.nome_completo}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                      {!turmaSel && c.turma_aula && (
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white ${TURMA_COLOR[c.turma_aula] ?? 'bg-slate-400'}`}>
                          {turmaLetter}
                        </div>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${QUADRO_COLOR[c.quadro]?.bg ?? ''} ${QUADRO_COLOR[c.quadro]?.text ?? ''}`}>
                        {QUADRO_LABEL[c.quadro] ?? c.quadro}
                      </span>
                      {co && <span className={`text-xs ${muted}`}>{esqNum}º · {co.name}</span>}
                    </div>
                    <div className={`text-xs font-bold px-2 py-0.5 rounded-full min-w-[52px] text-center
                      ${nFaltas === 0 ? (dark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')
                      : nFaltas <= 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                      {nFaltas} {nFaltas === 1 ? 'falta' : 'faltas'}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full hidden md:inline-block ${SITUACAO_STYLE[c.situacao] ?? ''}`}>
                      {c.situacao}
                    </span>
                    <ChevronRight size={14} className={muted} />
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};
