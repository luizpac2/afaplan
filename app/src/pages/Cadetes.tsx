import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { CadetManager } from '../components/CadetManager';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts';
import { Users, GraduationCap, TrendingDown, Shield } from 'lucide-react';
import type { Cadet, CadetAlocacao, Cohort } from '../types';

const QUADRO_LABEL: Record<string, string> = {
  CFOAV: 'Aviação',
  CFOINT: 'Intendência',
  CFOINF: 'Infantaria',
};

const QUADRO_COLORS: Record<string, string> = {
  CFOAV: '#0ea5e9',
  CFOINT: '#f59e0b',
  CFOINF: '#f97316',
};

const ANO_ATUAL = new Date().getFullYear();

export const Cadetes = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [cadets, setCadets] = useState<Cadet[]>([]);
  const [alocacoes, setAlocacoes] = useState<CadetAlocacao[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [anoFiltro, setAnoFiltro] = useState(ANO_ATUAL);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: c }, { data: a }, { data: co }] = await Promise.all([
        supabase.from('cadetes').select('*').order('id'),
        supabase.from('cadete_alocacoes').select('*'),
        supabase.from('cohorts').select('*').order('entryYear', { ascending: false }),
      ]);
      setCadets((c as Cadet[]) ?? []);
      setAlocacoes((a as CadetAlocacao[]) ?? []);
      setCohorts((co as Cohort[]) ?? []);
      setLoading(false);
    };
    void load();
  }, []);

  const enriched = useMemo(() => {
    const map = new Map(
      alocacoes.filter((a) => a.ano === anoFiltro).map((a) => [a.cadet_id, a.turma_aula]),
    );
    return cadets.map((c) => ({ ...c, turma_aula: map.get(c.id) }));
  }, [cadets, alocacoes, anoFiltro]);

  const ativos = enriched.filter((c) => c.situacao === 'ATIVO');

  const cohortMap = useMemo(() => new Map(cohorts.map((co) => [co.id, co])), [cohorts]);

  const byCohort = useMemo(() => {
    const acc: Record<string, { total: number; CFOAV: number; CFOINT: number; CFOINF: number; name: string }> = {};
    ativos.forEach((c) => {
      if (!acc[c.cohort_id]) {
        const co = cohortMap.get(c.cohort_id);
        acc[c.cohort_id] = { total: 0, CFOAV: 0, CFOINT: 0, CFOINF: 0, name: co?.name ?? `Esq. ${c.cohort_id}` };
      }
      acc[c.cohort_id].total++;
      if (c.quadro === 'CFOAV') acc[c.cohort_id].CFOAV++;
      else if (c.quadro === 'CFOINT') acc[c.cohort_id].CFOINT++;
      else if (c.quadro === 'CFOINF') acc[c.cohort_id].CFOINF++;
    });
    return Object.values(acc).sort((a, b) => b.total - a.total);
  }, [ativos, cohortMap]);

  const byQuadro = useMemo(() => {
    const acc: Record<string, number> = { CFOAV: 0, CFOINT: 0, CFOINF: 0 };
    ativos.forEach((c) => { if (c.quadro in acc) acc[c.quadro]++; });
    return Object.entries(acc).map(([quadro, value]) => ({ quadro, label: QUADRO_LABEL[quadro], value }));
  }, [ativos]);

  const anosDisponiveis = useMemo(() => {
    const anos = [...new Set(alocacoes.map((a) => a.ano))].sort((a, b) => b - a);
    return anos.length ? anos : [ANO_ATUAL];
  }, [alocacoes]);

  const card = `rounded-xl border p-5 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;
  const lbl = dark ? 'text-slate-400' : 'text-slate-500';
  const axis = dark ? '#94a3b8' : '#64748b';
  const grid = dark ? '#1e293b' : '#f1f5f9';
  const labelFill = dark ? '#e2e8f0' : '#334155';

  // Custom label for top of stacked bar (shows total)
  const StackedTotalLabel = (props: Record<string, unknown>) => {
    const { x, y, width, index } = props as { x: number; y: number; width: number; index: number };
    const total = byCohort[index]?.total ?? 0;
    if (!total) return null;
    return (
      <text
        x={x + width / 2}
        y={y - 5}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={labelFill}
      >
        {total}
      </text>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-3xl tracking-tight ${dark ? 'text-slate-100' : 'text-slate-900'}`}>
            Gestão de Cadetes
          </h1>
          <p className={`mt-1 text-sm ${lbl}`}>
            Distribuição por esquadrão e curso
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${lbl}`}>Ano de referência (gráficos):</span>
          <select
            value={anoFiltro}
            onChange={(e) => setAnoFiltro(Number(e.target.value))}
            className={`rounded-lg border px-3 py-1.5 text-sm ${dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
          >
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={card}>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className={`text-xs uppercase tracking-wide ${lbl}`}>Total Ativos</span>
              </div>
              <p className={`text-3xl font-light ${dark ? 'text-slate-100' : 'text-slate-900'}`}>{ativos.length}</p>
            </div>

            {byQuadro.map(({ quadro, label: ql, value }) => (
              <div key={quadro} className={card}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: QUADRO_COLORS[quadro] + '22' }}>
                    <GraduationCap size={18} style={{ color: QUADRO_COLORS[quadro] }} />
                  </div>
                  <span className={`text-xs uppercase tracking-wide ${lbl}`}>{ql}</span>
                </div>
                <p className={`text-3xl font-light ${dark ? 'text-slate-100' : 'text-slate-900'}`}>{value}</p>
                <p className={`text-xs mt-1 ${lbl}`}>
                  {ativos.length ? Math.round((value / ativos.length) * 100) : 0}% do total
                </p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stacked bar — cadetes por esquadrão */}
            <div className={card}>
              <h2 className={`text-sm font-medium uppercase tracking-wide mb-4 ${lbl}`}>
                Cadetes por Esquadrão — ativos {anoFiltro}
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byCohort} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: axis }} />
                  <YAxis tick={{ fontSize: 11, fill: axis }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: dark ? '#e2e8f0' : '#1e293b' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="CFOAV" name="Aviação" stackId="a" fill={QUADRO_COLORS.CFOAV}>
                    <LabelList dataKey="CFOAV" position="inside" style={{ fontSize: 10, fill: '#fff', fontWeight: 600 }} formatter={(v: unknown) => ((v as number) > 0 ? String(v) : '') as string} />
                  </Bar>
                  <Bar dataKey="CFOINT" name="Intendência" stackId="a" fill={QUADRO_COLORS.CFOINT}>
                    <LabelList dataKey="CFOINT" position="inside" style={{ fontSize: 10, fill: '#fff', fontWeight: 600 }} formatter={(v: unknown) => ((v as number) > 0 ? String(v) : '') as string} />
                  </Bar>
                  <Bar dataKey="CFOINF" name="Infantaria" stackId="a" fill={QUADRO_COLORS.CFOINF} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="CFOINF" position="inside" style={{ fontSize: 10, fill: '#fff', fontWeight: 600 }} formatter={(v: unknown) => ((v as number) > 0 ? String(v) : '') as string} />
                    <LabelList content={StackedTotalLabel as never} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Grouped bar — comparativo por curso */}
            <div className={card}>
              <h2 className={`text-sm font-medium uppercase tracking-wide mb-4 ${lbl}`}>
                Comparativo por Curso — Ativos por Esquadrão
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byCohort} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: axis }} />
                  <YAxis tick={{ fontSize: 11, fill: axis }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: dark ? '#e2e8f0' : '#1e293b' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="CFOAV" name="Aviação" fill={QUADRO_COLORS.CFOAV} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="CFOAV" position="top" style={{ fontSize: 10, fill: labelFill, fontWeight: 600 }} formatter={(v: unknown) => ((v as number) > 0 ? String(v) : '') as string} />
                  </Bar>
                  <Bar dataKey="CFOINT" name="Intendência" fill={QUADRO_COLORS.CFOINT} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="CFOINT" position="top" style={{ fontSize: 10, fill: labelFill, fontWeight: 600 }} formatter={(v: unknown) => ((v as number) > 0 ? String(v) : '') as string} />
                  </Bar>
                  <Bar dataKey="CFOINF" name="Infantaria" fill={QUADRO_COLORS.CFOINF} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="CFOINF" position="top" style={{ fontSize: 10, fill: labelFill, fontWeight: 600 }} formatter={(v: unknown) => ((v as number) > 0 ? String(v) : '') as string} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Banner situação irregular */}
          {cadets.filter((c) => c.situacao !== 'ATIVO').length > 0 && (
            <div className={`${card} flex items-center gap-4`}>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                <TrendingDown size={20} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className={`text-sm font-medium ${dark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {cadets.filter((c) => c.situacao !== 'ATIVO').length} cadete(s) com situação irregular
                </p>
                <p className={`text-xs mt-0.5 ${lbl}`}>
                  {cadets.filter((c) => c.situacao === 'DESLIGADO').length} desligado(s) ·{' '}
                  {cadets.filter((c) => c.situacao === 'TRANCADO').length} trancado(s) ·{' '}
                  {cadets.filter((c) => c.situacao === 'TRANSFERIDO').length} transferido(s)
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Shield size={14} className={lbl} />
                <span className={`text-xs ${lbl}`}>
                  {cadets.filter((c) => c.situacao === 'ATIVO').length} / {cadets.length} ativos
                </span>
              </div>
            </div>
          )}

          {/* Tabela de gestão */}
          <CadetManager />
        </>
      )}
    </div>
  );
};
