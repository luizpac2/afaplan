import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { CadetManager } from '../components/CadetManager';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { Users, GraduationCap, Shield, TrendingDown } from 'lucide-react';
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

const SITUACAO_COLORS: Record<string, string> = {
  ATIVO: '#22c55e',
  DESLIGADO: '#ef4444',
  TRANCADO: '#eab308',
  TRANSFERIDO: '#3b82f6',
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

  // Cadets enriquecidos com turma_aula do ano selecionado
  const enriched = useMemo(() => {
    const map = new Map(
      alocacoes.filter((a) => a.ano === anoFiltro).map((a) => [a.cadet_id, a.turma_aula]),
    );
    return cadets.map((c) => ({ ...c, turma_aula: map.get(c.id) }));
  }, [cadets, alocacoes, anoFiltro]);

  const ativos = enriched.filter((c) => c.situacao === 'ATIVO');

  // ── Estatísticas por esquadrão (cohort) ────────────────────────
  const cohortMap = useMemo(() => new Map(cohorts.map((co) => [co.id, co])), [cohorts]);

  const byCohort = useMemo(() => {
    const acc: Record<string, { total: number; CFOAV: number; CFOINT: number; CFOINF: number; name: string }> = {};
    ativos.forEach((c) => {
      if (!acc[c.cohort_id]) {
        const co = cohortMap.get(c.cohort_id);
        acc[c.cohort_id] = { total: 0, CFOAV: 0, CFOINT: 0, CFOINF: 0, name: co?.name ?? `Esquadrão ${c.cohort_id}` };
      }
      acc[c.cohort_id].total++;
      if (c.quadro === 'CFOAV') acc[c.cohort_id].CFOAV++;
      else if (c.quadro === 'CFOINT') acc[c.cohort_id].CFOINT++;
      else if (c.quadro === 'CFOINF') acc[c.cohort_id].CFOINF++;
    });
    return Object.values(acc).sort((a, b) => b.total - a.total);
  }, [ativos, cohortMap]);

  // ── Estatísticas por quadro (curso) ───────────────────────────
  const byQuadro = useMemo(() => {
    const acc: Record<string, number> = { CFOAV: 0, CFOINT: 0, CFOINF: 0 };
    ativos.forEach((c) => { if (c.quadro in acc) acc[c.quadro]++; });
    return Object.entries(acc).map(([quadro, value]) => ({ quadro, label: QUADRO_LABEL[quadro], value }));
  }, [ativos]);

  // ── Situação geral ─────────────────────────────────────────────
  const bySituacao = useMemo(() => {
    const acc: Record<string, number> = {};
    enriched.forEach((c) => { acc[c.situacao] = (acc[c.situacao] ?? 0) + 1; });
    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  }, [enriched]);

  // ── Anos disponíveis ───────────────────────────────────────────
  const anosDisponiveis = useMemo(() => {
    const anos = [...new Set(alocacoes.map((a) => a.ano))].sort((a, b) => b - a);
    return anos.length ? anos : [ANO_ATUAL];
  }, [alocacoes]);

  const card = `rounded-xl border p-5 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;
  const label = dark ? 'text-slate-400' : 'text-slate-500';
  const axis = dark ? '#94a3b8' : '#64748b';
  const grid = dark ? '#1e293b' : '#f1f5f9';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-3xl tracking-tight ${dark ? 'text-slate-100' : 'text-slate-900'}`}>
            Gestão de Cadetes
          </h1>
          <p className={`mt-1 text-sm ${label}`}>
            Distribuição por esquadrão, curso e situação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${label}`}>Ano de referência:</span>
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
          {/* ── KPI Cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={card}>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className={`text-xs uppercase tracking-wide ${label}`}>Total Ativos</span>
              </div>
              <p className={`text-3xl font-light ${dark ? 'text-slate-100' : 'text-slate-900'}`}>{ativos.length}</p>
            </div>

            {byQuadro.map(({ quadro, label: ql, value }) => (
              <div key={quadro} className={card}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: QUADRO_COLORS[quadro] + '22' }}>
                    <GraduationCap size={18} style={{ color: QUADRO_COLORS[quadro] }} />
                  </div>
                  <span className={`text-xs uppercase tracking-wide ${label}`}>{ql}</span>
                </div>
                <p className={`text-3xl font-light ${dark ? 'text-slate-100' : 'text-slate-900'}`}>{value}</p>
                <p className={`text-xs mt-1 ${label}`}>
                  {ativos.length ? Math.round((value / ativos.length) * 100) : 0}% do total
                </p>
              </div>
            ))}
          </div>

          {/* ── Charts row 1 ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cadetes por Esquadrão — stacked bar */}
            <div className={`${card} col-span-1`}>
              <h2 className={`text-sm font-medium uppercase tracking-wide mb-4 ${label}`}>
                Cadetes por Esquadrão (ativos {anoFiltro})
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byCohort} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: axis }} />
                  <YAxis tick={{ fontSize: 11, fill: axis }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: dark ? '#e2e8f0' : '#1e293b' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="CFOAV" name="Aviação" stackId="a" fill={QUADRO_COLORS.CFOAV} radius={[0,0,0,0]} />
                  <Bar dataKey="CFOINT" name="Intendência" stackId="a" fill={QUADRO_COLORS.CFOINT} radius={[0,0,0,0]} />
                  <Bar dataKey="CFOINF" name="Infantaria" stackId="a" fill={QUADRO_COLORS.CFOINF} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Distribuição por Situação — pie */}
            <div className={`${card} col-span-1`}>
              <h2 className={`text-sm font-medium uppercase tracking-wide mb-4 ${label}`}>
                Distribuição por Situação (todos os esquadrões)
              </h2>
              <div className="flex items-center justify-center gap-8">
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie
                      data={bySituacao}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {bySituacao.map((entry) => (
                        <Cell key={entry.name} fill={SITUACAO_COLORS[entry.name] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {bySituacao.map((s) => (
                    <div key={s.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: SITUACAO_COLORS[s.name] ?? '#94a3b8' }} />
                      <span className={`text-xs ${label}`}>{s.name}</span>
                      <span className={`text-xs font-medium ml-auto pl-4 ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Charts row 2: comparativo por curso ──────────────── */}
          <div className={card}>
            <h2 className={`text-sm font-medium uppercase tracking-wide mb-4 ${label}`}>
              Comparativo por Curso — Ativos por Esquadrão
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byCohort} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: axis }} />
                <YAxis tick={{ fontSize: 11, fill: axis }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: dark ? '#e2e8f0' : '#1e293b' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="CFOAV" name="Aviação" fill={QUADRO_COLORS.CFOAV} radius={[4,4,0,0]} />
                <Bar dataKey="CFOINT" name="Intendência" fill={QUADRO_COLORS.CFOINT} radius={[4,4,0,0]} />
                <Bar dataKey="CFOINF" name="Infantaria" fill={QUADRO_COLORS.CFOINF} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Desligamentos / não ativos ──────────────────────── */}
          {enriched.filter((c) => c.situacao !== 'ATIVO').length > 0 && (
            <div className={`${card} flex items-center gap-4`}>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                <TrendingDown size={20} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className={`text-sm font-medium ${dark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {enriched.filter((c) => c.situacao !== 'ATIVO').length} cadete(s) com situação irregular
                </p>
                <p className={`text-xs mt-0.5 ${label}`}>
                  {enriched.filter((c) => c.situacao === 'DESLIGADO').length} desligado(s) ·{' '}
                  {enriched.filter((c) => c.situacao === 'TRANCADO').length} trancado(s) ·{' '}
                  {enriched.filter((c) => c.situacao === 'TRANSFERIDO').length} transferido(s)
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Shield size={14} className={label} />
                <span className={`text-xs ${label}`}>
                  {ativos.length} / {enriched.length} ativos
                </span>
              </div>
            </div>
          )}

          {/* ── Tabela de gestão ──────────────────────────────────── */}
          <div>
            <CadetManager />
          </div>
        </>
      )}
    </div>
  );
};
