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

// ─── constants ────────────────────────────────────────────────────────────────

const ANO_ATUAL = new Date().getFullYear();

const TURMAS: Array<{ key: string; label: string; letter: string }> = [
  { key: 'TURMA_A', label: 'Turma A', letter: 'A' },
  { key: 'TURMA_B', label: 'Turma B', letter: 'B' },
  { key: 'TURMA_C', label: 'Turma C', letter: 'C' },
  { key: 'TURMA_D', label: 'Turma D', letter: 'D' },
  { key: 'TURMA_E', label: 'Turma E', letter: 'E' },
  { key: 'TURMA_F', label: 'Turma F', letter: 'F' },
];

const TURMA_CURSO: Record<string, string> = {
  TURMA_A: 'Aviação', TURMA_B: 'Aviação', TURMA_C: 'Aviação', TURMA_D: 'Aviação',
  TURMA_E: 'Intendência', TURMA_F: 'Infantaria',
};

const QUADRO_LABEL: Record<string, string> = {
  CFOAV: 'Aviação', CFOINT: 'Intendência', CFOINF: 'Infantaria',
};

const QUADRO_COLOR: Record<string, { bg: string; text: string; bar: string }> = {
  CFOAV:  { bg: 'bg-sky-100 dark:bg-sky-900/30',    text: 'text-sky-700 dark:text-sky-300',    bar: '#0ea5e9' },
  CFOINT: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', bar: '#f59e0b' },
  CFOINF: { bg: 'bg-orange-100 dark:bg-orange-900/30',text: 'text-orange-700 dark:text-orange-300',bar: '#f97316' },
};

const SITUACAO_STYLE: Record<string, string> = {
  ATIVO:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  DESLIGADO:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  TRANCADO:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  TRANSFERIDO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

const TURMA_ACCENT: Record<string, string> = {
  TURMA_A: 'border-sky-500 bg-sky-500',
  TURMA_B: 'border-violet-500 bg-violet-500',
  TURMA_C: 'border-emerald-500 bg-emerald-500',
  TURMA_D: 'border-rose-500 bg-rose-500',
  TURMA_E: 'border-amber-500 bg-amber-500',
  TURMA_F: 'border-orange-500 bg-orange-500',
};

// ─── types ───────────────────────────────────────────────────────────────────

interface FaltaRow {
  cadet_id: string;
  nome_guerra: string;
  data_aula: string;
  disciplina_sigla: string;
  disciplina_nome: string;
  turma_aula: string | null;
  motivo: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

// ─── component ───────────────────────────────────────────────────────────────

export const TurmasAula = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [cadets,    setCadets]    = useState<Cadet[]>([]);
  const [alocacoes, setAlocacoes] = useState<CadetAlocacao[]>([]);
  const [cohorts,   setCohorts]   = useState<Cohort[]>([]);
  const [faltas,    setFaltas]    = useState<FaltaRow[]>([]);
  const [loading,   setLoading]   = useState(true);

  const [anoFiltro,   setAnoFiltro]   = useState(ANO_ATUAL);
  const [turmaSel,    setTurmaSel]    = useState('TURMA_A');
  const [search,      setSearch]      = useState('');

  // ── data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: c }, { data: a }, { data: co }, { data: f }] = await Promise.all([
        supabase.from('cadetes').select('*').order('nome_guerra'),
        supabase.from('cadete_alocacoes').select('*'),
        supabase.from('cohorts').select('*').order('entryYear', { ascending: false }),
        supabase.from('vw_faltas_resumo').select(
          'cadet_id,nome_guerra,data_aula,disciplina_sigla,disciplina_nome,turma_aula,motivo'
        ),
      ]);
      setCadets((c as Cadet[]) ?? []);
      setAlocacoes((a as CadetAlocacao[]) ?? []);
      setCohorts((co as Cohort[]) ?? []);
      setFaltas((f as FaltaRow[]) ?? []);
      setLoading(false);
    };
    void load();
  }, []);

  // ── derived: cadetes enriquecidos com turma_aula do ano selecionado ───────

  const enriched = useMemo(() => {
    const map = new Map(
      alocacoes.filter((a) => a.ano === anoFiltro).map((a) => [a.cadet_id, a.turma_aula]),
    );
    return cadets.map((c) => ({ ...c, turma_aula: map.get(c.id) ?? c.turma_aula ?? null }));
  }, [cadets, alocacoes, anoFiltro]);

  const cohortMap = useMemo(() => new Map(cohorts.map((co) => [co.id, co])), [cohorts]);

  const squadronNum = (cohortId: string) => {
    const co = cohortMap.get(cohortId);
    return co ? anoFiltro - co.entryYear + 1 : 99;
  };

  // ── cadetes da turma selecionada ──────────────────────────────────────────

  const cadetesTurma = useMemo(
    () => enriched.filter((c) => c.turma_aula === turmaSel),
    [enriched, turmaSel],
  );

  const cadetesFiltrados = useMemo(() => {
    const txt = search.toLowerCase();
    if (!txt) return cadetesTurma;
    return cadetesTurma.filter(
      (c) =>
        c.nome_guerra.toLowerCase().includes(txt) ||
        c.nome_completo.toLowerCase().includes(txt) ||
        c.id.includes(txt),
    );
  }, [cadetesTurma, search]);

  const ativos    = useMemo(() => cadetesTurma.filter((c) => c.situacao === 'ATIVO'), [cadetesTurma]);
  const inativos  = useMemo(() => cadetesTurma.filter((c) => c.situacao !== 'ATIVO'), [cadetesTurma]);

  // ── faltas da turma selecionada ────────────────────────────────────────────

  const faltasTurma = useMemo(
    () => faltas.filter((f) => f.turma_aula === turmaSel),
    [faltas, turmaSel],
  );

  const faltasPorCadete = useMemo(() => {
    const acc: Record<string, number> = {};
    faltasTurma.forEach((f) => { acc[f.cadet_id] = (acc[f.cadet_id] ?? 0) + 1; });
    return acc;
  }, [faltasTurma]);

  const faltasPorMotivo = useMemo(() => {
    const acc: Record<string, number> = {};
    faltasTurma.forEach((f) => { acc[f.motivo] = (acc[f.motivo] ?? 0) + 1; });
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([motivo, total]) => ({ motivo, total }));
  }, [faltasTurma]);

  const faltasPorDisciplina = useMemo(() => {
    const acc: Record<string, { sigla: string; nome: string; total: number }> = {};
    faltasTurma.forEach((f) => {
      if (!acc[f.disciplina_sigla]) acc[f.disciplina_sigla] = { sigla: f.disciplina_sigla, nome: f.disciplina_nome, total: 0 };
      acc[f.disciplina_sigla].total++;
    });
    return Object.values(acc).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [faltasTurma]);

  const topFaltosos = useMemo(
    () =>
      Object.entries(faltasPorCadete)
        .map(([cadet_id, total]) => ({
          cadet_id,
          total,
          cadet: enriched.find((c) => c.id === cadet_id),
        }))
        .filter((x) => x.cadet?.situacao === 'ATIVO')
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
    [faltasPorCadete, enriched],
  );

  const ultimasFaltas = useMemo(
    () => [...faltasTurma].sort((a, b) => b.data_aula.localeCompare(a.data_aula)).slice(0, 8),
    [faltasTurma],
  );

  // ── por quadro ────────────────────────────────────────────────────────────

  const porQuadro = useMemo(() => {
    const acc: Record<string, number> = { CFOAV: 0, CFOINT: 0, CFOINF: 0 };
    ativos.forEach((c) => { if (c.quadro in acc) acc[c.quadro]++; });
    return Object.entries(acc)
      .filter(([, v]) => v > 0)
      .map(([quadro, total]) => ({ quadro, label: QUADRO_LABEL[quadro], total }));
  }, [ativos]);

  // ── por esquadrão ─────────────────────────────────────────────────────────

  const porEsquadrao = useMemo(() => {
    const acc: Record<string, { nome: string; num: number; total: number }> = {};
    ativos.forEach((c) => {
      if (!acc[c.cohort_id]) {
        const co = cohortMap.get(c.cohort_id);
        acc[c.cohort_id] = { nome: co?.name ?? c.cohort_id, num: squadronNum(c.cohort_id), total: 0 };
      }
      acc[c.cohort_id].total++;
    });
    return Object.values(acc).sort((a, b) => a.num - b.num);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativos, cohortMap, anoFiltro]);

  // ── anos disponíveis ──────────────────────────────────────────────────────

  const anosDisponiveis = useMemo(() => {
    const anos = [...new Set(alocacoes.map((a) => a.ano))].sort((a, b) => b - a);
    return anos.length ? anos : [ANO_ATUAL];
  }, [alocacoes]);

  // ── styles ────────────────────────────────────────────────────────────────

  const bg    = dark ? 'bg-slate-950' : 'bg-slate-50';
  const card  = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const text  = dark ? 'text-slate-100' : 'text-slate-900';
  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  const input = dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900';
  const axis  = dark ? '#94a3b8' : '#64748b';
  const grid  = dark ? '#1e293b' : '#f1f5f9';

  const accent = TURMA_ACCENT[turmaSel] ?? 'border-slate-400 bg-slate-400';

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${bg}`}>
        <div className={`text-sm animate-pulse ${muted}`}>Carregando dados da turma…</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} p-4 md:p-6 space-y-6`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${text}`}>Turmas de Aula</h1>
          <p className={`text-sm ${muted}`}>Composição, indicadores e faltas por turma de aula.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className={`text-sm font-medium ${muted}`}>Ano:</label>
          <select
            value={anoFiltro}
            onChange={(e) => setAnoFiltro(Number(e.target.value))}
            className={`px-3 py-2 text-sm rounded-lg border ${input}`}
          >
            {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* ── Seletor de turma (tabs) ─────────────────────────────────────────── */}
      <div className={`flex gap-2 flex-wrap`}>
        {TURMAS.map((t) => {
          const count = enriched.filter((c) => c.turma_aula === t.key && c.situacao === 'ATIVO').length;
          const active = turmaSel === t.key;
          const acc = TURMA_ACCENT[t.key].split(' ')[0]; // border color class
          return (
            <button
              key={t.key}
              onClick={() => setTurmaSel(t.key)}
              className={`flex flex-col items-center px-5 py-3 rounded-xl border-2 transition-all duration-200 min-w-[80px]
                ${active
                  ? `${acc} border-opacity-100 ${dark ? 'bg-slate-800' : 'bg-white'} shadow-md`
                  : `border-transparent ${dark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-white/70 hover:bg-white'}`}
              `}
            >
              <span className={`text-lg font-bold ${active ? (dark ? 'text-white' : 'text-slate-900') : muted}`}>
                {t.letter}
              </span>
              <span className={`text-xs ${active ? (dark ? 'text-slate-300' : 'text-slate-600') : muted}`}>
                {count} ativos
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Curso badge ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className={`h-1 w-10 rounded-full ${accent.split(' ')[1]}`} />
        <span className={`text-sm font-semibold ${muted}`}>
          Curso de {TURMA_CURSO[turmaSel]} · {ativos.length} cadetes ativos
          {inativos.length > 0 && ` · ${inativos.length} inativo${inativos.length > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users,        label: 'Total na turma',   value: cadetesTurma.length,  sub: `${ativos.length} ativos` },
          { icon: TrendingDown, label: 'Total de faltas',  value: faltasTurma.length,   sub: ativos.length ? `${(faltasTurma.length / ativos.length).toFixed(1)} p/ cadete` : '—' },
          { icon: Award,        label: 'Maior número',     value: topFaltosos[0]?.total ?? 0, sub: topFaltosos[0]?.cadet?.nome_guerra ?? '—' },
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

      {/* ── Row: composição + faltas por motivo ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Composição por esquadrão */}
        <div className={`rounded-xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className={muted} />
            <h3 className={`text-sm font-semibold ${text}`}>Composição por Esquadrão</h3>
          </div>
          {porEsquadrao.length === 0 ? (
            <p className={`text-sm ${muted}`}>Sem dados para o ano selecionado.</p>
          ) : (
            <div className="space-y-3">
              {porEsquadrao.map((s) => (
                <div key={s.nome} className="flex items-center gap-3">
                  <span className={`text-xs w-24 truncate font-medium ${muted}`}>{s.num}º · {s.nome}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${ativos.length ? (s.total / ativos.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-5 text-right ${text}`}>{s.total}</span>
                </div>
              ))}
            </div>
          )}

          {/* por quadro */}
          {porQuadro.length > 0 && (
            <div className={`mt-5 pt-4 border-t ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
              <p className={`text-xs font-semibold mb-3 ${muted}`}>Por Quadro</p>
              <div className="flex gap-3 flex-wrap">
                {porQuadro.map(({ quadro, label, total }) => (
                  <div key={quadro} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${QUADRO_COLOR[quadro].bg}`}>
                    <span className={`text-xs font-semibold ${QUADRO_COLOR[quadro].text}`}>{label}</span>
                    <span className={`text-sm font-bold ${QUADRO_COLOR[quadro].text}`}>{total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Faltas por motivo */}
        <div className={`rounded-xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={16} className={muted} />
            <h3 className={`text-sm font-semibold ${text}`}>Faltas por Motivo (top 6)</h3>
          </div>
          {faltasPorMotivo.length === 0 ? (
            <p className={`text-sm ${muted}`}>Nenhuma falta registrada para esta turma.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={faltasPorMotivo} layout="vertical" margin={{ left: 8, right: 20, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axis }} />
                <YAxis
                  type="category" dataKey="motivo" width={130}
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
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="sigla" tick={{ fontSize: 11, fill: axis }} />
              <YAxis tick={{ fontSize: 11, fill: axis }} allowDecimals={false} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, _: any, p: any) => [v, p.payload.nome]}
                contentStyle={{ fontSize: 12, background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8 }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {faltasPorDisciplina.map((_, i) => (
                  <Cell key={i} fill={['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#818cf8','#4f46e5','#4338ca'][i % 8]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Row: top faltosos + últimas faltas ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top faltosos */}
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
                  <span className={`text-xs font-bold w-5 text-center ${rank === 0 ? 'text-red-500' : muted}`}>
                    {rank + 1}
                  </span>
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

        {/* Últimas faltas */}
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
              Cadetes da Turma {turmaSel.replace('TURMA_', '')}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
              {cadetesTurma.length}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${input} w-full sm:w-auto`}>
            <Search size={14} className={muted} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cadete…"
              className="bg-transparent text-sm outline-none w-40 placeholder:text-slate-400"
            />
          </div>
        </div>

        {cadetesFiltrados.length === 0 ? (
          <div className={`p-8 text-center text-sm ${muted}`}>
            {cadetesTurma.length === 0
              ? `Nenhum cadete alocado na Turma ${turmaSel.replace('TURMA_', '')} em ${anoFiltro}.`
              : 'Nenhum cadete encontrado para a busca.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {cadetesFiltrados
              .sort((a, b) => {
                if (a.situacao === 'ATIVO' && b.situacao !== 'ATIVO') return -1;
                if (a.situacao !== 'ATIVO' && b.situacao === 'ATIVO') return 1;
                return a.nome_guerra.localeCompare(b.nome_guerra, 'pt-BR');
              })
              .map((c) => {
                const faltas = faltasPorCadete[c.id] ?? 0;
                const co = cohortMap.get(c.cohort_id);
                const esqNum = squadronNum(c.cohort_id);
                return (
                  <div key={c.id} className={`flex items-center gap-3 px-5 py-3 hover:${dark ? 'bg-slate-800/40' : 'bg-slate-50'} transition-colors`}>
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm
                      ${c.quadro === 'CFOAV' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                      : c.quadro === 'CFOINT' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'}`}>
                      {c.nome_guerra.charAt(0)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${text}`}>{c.nome_guerra}</p>
                      <p className={`text-xs truncate ${muted}`}>{c.nome_completo}</p>
                    </div>

                    {/* Meta */}
                    <div className="hidden sm:flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${QUADRO_COLOR[c.quadro]?.bg ?? ''} ${QUADRO_COLOR[c.quadro]?.text ?? ''}`}>
                        {QUADRO_LABEL[c.quadro] ?? c.quadro}
                      </span>
                      {co && (
                        <span className={`text-xs ${muted}`}>{esqNum}º Esq · {co.name}</span>
                      )}
                    </div>

                    {/* Faltas badge */}
                    <div className={`text-xs font-bold px-2 py-0.5 rounded-full min-w-[40px] text-center
                      ${faltas === 0 ? (dark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')
                      : faltas <= 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                      {faltas} {faltas === 1 ? 'falta' : 'faltas'}
                    </div>

                    {/* Situação */}
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
