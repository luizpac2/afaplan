import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useTheme } from '../contexts/ThemeContext';
import type { Cohort } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Download, Search, ChevronDown, Users, FileText, Shield } from 'lucide-react';

interface FaltaRow {
  id: string;
  cadet_id: string;
  nome_guerra: string;
  nome_completo: string;
  quadro: string;
  cohort_id: string;
  data_aula: string;
  disciplina_sigla: string;
  disciplina_nome: string;
  turma_nome: string;
  turma_aula: string | null;
  motivo: string;
  observacao: string | null;
  chefe_nome_guerra: string;
}

const TURMAS_AULA = ['', 'TURMA_A', 'TURMA_B', 'TURMA_C', 'TURMA_D', 'TURMA_E', 'TURMA_F'];
const ANO_ATUAL = new Date().getFullYear();

export const FaltasReport = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [faltas, setFaltas]     = useState<FaltaRow[]>([]);
  const [cohorts, setCohorts]   = useState<Cohort[]>([]);
  const [loading, setLoading]   = useState(true);

  // Filtros
  const [search, setSearch]           = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroEsq, setFiltroEsq]     = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('');
  const [aba, setAba]                 = useState<'individual' | 'turma' | 'esquadrao'>('individual');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: f }, { data: co }] = await Promise.all([
        supabase.from('vw_faltas_resumo').select('*').order('data_aula', { ascending: false }),
        supabase.from('cohorts').select('*').order('entryYear', { ascending: false }),
      ]);
      setFaltas((f as FaltaRow[]) ?? []);
      setCohorts((co as Cohort[]) ?? []);
      setLoading(false);
    };
    void load();
  }, []);

  const cohortMap = useMemo(
    () => Object.fromEntries(cohorts.map((c) => [c.id, c])),
    [cohorts]
  );

  // Número do esquadrão em relação ao ano atual
  const squadronNum = (cohortId: string) => {
    const co = cohortMap[cohortId];
    return co ? ANO_ATUAL - co.entryYear + 1 : 99;
  };

  const faltasFiltradas = useMemo(() => {
    return faltas.filter((f) => {
      const txt = search.toLowerCase();
      const matchSearch = !txt ||
        f.nome_guerra.toLowerCase().includes(txt) ||
        f.cadet_id.includes(txt) ||
        f.nome_completo.toLowerCase().includes(txt) ||
        f.disciplina_sigla.toLowerCase().includes(txt);
      const matchTurma = !filtroTurma || f.turma_aula === filtroTurma;
      const matchEsq   = !filtroEsq  || f.cohort_id === filtroEsq;
      const matchMotivo = !filtroMotivo || f.motivo === filtroMotivo;
      return matchSearch && matchTurma && matchEsq && matchMotivo;
    });
  }, [faltas, search, filtroTurma, filtroEsq, filtroMotivo]);

  // Agrupamento por cadete
  const porCadete = useMemo(() => {
    const acc: Record<string, { cadet_id: string; nome: string; cohort_id: string; turma_aula: string; total: number; motivos: Record<string, number> }> = {};
    faltasFiltradas.forEach((f) => {
      if (!acc[f.cadet_id]) {
        acc[f.cadet_id] = { cadet_id: f.cadet_id, nome: f.nome_guerra, cohort_id: f.cohort_id, turma_aula: f.turma_aula ?? '', total: 0, motivos: {} };
      }
      acc[f.cadet_id].total++;
      acc[f.cadet_id].motivos[f.motivo] = (acc[f.cadet_id].motivos[f.motivo] ?? 0) + 1;
    });
    return Object.values(acc).sort((a, b) => b.total - a.total);
  }, [faltasFiltradas]);

  // Agrupamento por turma de aula
  const porTurma = useMemo(() => {
    const acc: Record<string, { turma: string; total: number; cadetes: number }> = {};
    faltasFiltradas.forEach((f) => {
      const key = f.turma_aula ?? 'sem turma';
      if (!acc[key]) acc[key] = { turma: key, total: 0, cadetes: 0 };
      acc[key].total++;
    });
    Object.values(acc).forEach((t) => {
      t.cadetes = porCadete.filter((c) => (c.turma_aula || 'sem turma') === t.turma).length;
    });
    return Object.values(acc).sort((a, b) => b.total - a.total);
  }, [faltasFiltradas, porCadete]);

  // Agrupamento por esquadrão
  const porEsquadrao = useMemo(() => {
    const acc: Record<string, { cohort_id: string; nome: string; num: number; total: number; cadetes: number }> = {};
    faltasFiltradas.forEach((f) => {
      if (!acc[f.cohort_id]) {
        const co = cohortMap[f.cohort_id];
        acc[f.cohort_id] = {
          cohort_id: f.cohort_id,
          nome: co?.name ?? f.cohort_id,
          num: squadronNum(f.cohort_id),
          total: 0, cadetes: 0,
        };
      }
      acc[f.cohort_id].total++;
    });
    return Object.values(acc).sort((a, b) => a.num - b.num);
  }, [faltasFiltradas, cohortMap]);

  // Motivos únicos para filtro
  const motivosUnicos = useMemo(() =>
    [...new Set(faltas.map((f) => f.motivo))].sort(), [faltas]);

  // Exportar CSV da aba individual
  const exportCSV = () => {
    const rows = [
      ['Nº', 'N. Guerra', 'Nome Completo', 'Data', 'Disciplina', 'Motivo', 'Observação', 'Chefe'].join(';'),
      ...faltasFiltradas.map((f) => [
        f.cadet_id, f.nome_guerra, f.nome_completo,
        new Date(f.data_aula + 'T00:00:00').toLocaleDateString('pt-BR'),
        f.disciplina_sigla + ' — ' + f.disciplina_nome,
        f.motivo, f.observacao ?? '', f.chefe_nome_guerra,
      ].join(';')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'faltas_cadetes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Estilos ──────────────────────────────────────────────
  const card  = `rounded-xl border ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;
  const lbl   = dark ? 'text-slate-400' : 'text-slate-500';
  const text  = dark ? 'text-slate-100' : 'text-slate-900';
  const sel   = `appearance-none px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 pr-8 ${dark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`;
  const axis  = dark ? '#94a3b8' : '#64748b';
  const grid  = dark ? '#1e293b' : '#f1f5f9';

  const COLORS = ['#6366f1','#0ea5e9','#f59e0b','#f97316','#10b981','#ef4444'];

  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-2xl tracking-tight ${text}`}>Relatório de Faltas</h1>
          <p className={`mt-1 text-sm ${lbl}`}>{faltasFiltradas.length} falta(s) no filtro atual · {faltas.length} total</p>
        </div>
        <button
          onClick={exportCSV}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className={`${card} p-4 flex flex-wrap gap-3 items-center`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className={`absolute left-2 top-1/2 -translate-y-1/2 ${lbl}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cadete ou disciplina…"
            className={`w-full pl-7 pr-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 ${dark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300'}`}
          />
        </div>

        <div className="relative">
          <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} className={sel}>
            <option value="">Todas as Turmas</option>
            {TURMAS_AULA.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t.replace('TURMA_', 'Turma ')}</option>
            ))}
          </select>
          <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${lbl}`} />
        </div>

        <div className="relative">
          <select value={filtroEsq} onChange={(e) => setFiltroEsq(e.target.value)} className={sel}>
            <option value="">Todos os Esquadrões</option>
            {cohorts.map((co) => (
              <option key={co.id} value={co.id}>
                {squadronNum(co.id)}º Esq — {co.name}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${lbl}`} />
        </div>

        <div className="relative">
          <select value={filtroMotivo} onChange={(e) => setFiltroMotivo(e.target.value)} className={sel}>
            <option value="">Todos os Motivos</option>
            {motivosUnicos.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${lbl}`} />
        </div>
      </div>

      {/* Abas */}
      <div className={`flex gap-1 p-1 rounded-xl ${dark ? 'bg-slate-800' : 'bg-slate-100'} w-fit`}>
        {([
          { key: 'individual', label: 'Individual', icon: FileText },
          { key: 'turma',      label: 'Por Turma',  icon: Users },
          { key: 'esquadrao',  label: 'Por Esquadrão', icon: Shield },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              aba === key
                ? 'bg-indigo-600 text-white shadow-sm'
                : dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      {aba === 'individual' && (
        <div className="space-y-4">
          {/* KPI por motivo */}
          <div className={`${card} p-4`}>
            <h3 className={`text-xs uppercase tracking-wide mb-3 ${lbl}`}>Distribuição por Motivo</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={motivosUnicos.map((m) => ({ motivo: m, total: faltasFiltradas.filter((f) => f.motivo === m).length }))}
                margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="motivo" tick={{ fontSize: 9, fill: axis }} interval={0} angle={-25} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 10, fill: axis }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {motivosUnicos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela de cadetes */}
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-xs uppercase tracking-wide ${lbl} ${dark ? 'bg-slate-800' : 'bg-slate-50'} border-b ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <th className="text-left px-4 py-3">Nº</th>
                    <th className="text-left px-4 py-3">N. Guerra</th>
                    <th className="text-left px-4 py-3">Total Faltas</th>
                    <th className="text-left px-4 py-3">Principal Motivo</th>
                    <th className="text-left px-4 py-3">Turma</th>
                    <th className="text-left px-4 py-3">Esquadrão</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${dark ? 'divide-slate-700/60' : 'divide-slate-100'}`}>
                  {porCadete.map((c) => {
                    const principalMotivo = Object.entries(c.motivos).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
                    const co = cohortMap[c.cohort_id];
                    return (
                      <tr key={c.cadet_id} className={dark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                        <td className={`px-4 py-2 font-mono text-xs ${lbl}`}>{c.cadet_id}</td>
                        <td className={`px-4 py-2 font-medium ${text}`}>{c.nome}</td>
                        <td className="px-4 py-2">
                          <span className={`font-bold ${c.total >= 5 ? 'text-red-500' : c.total >= 3 ? 'text-amber-500' : 'text-green-500'}`}>
                            {c.total}
                          </span>
                        </td>
                        <td className={`px-4 py-2 text-xs ${lbl}`}>{principalMotivo}</td>
                        <td className={`px-4 py-2 text-xs ${lbl}`}>{c.turma_aula.replace('TURMA_', 'T.') || '—'}</td>
                        <td className={`px-4 py-2 text-xs ${lbl}`}>{squadronNum(c.cohort_id)}º — {co?.name ?? c.cohort_id}</td>
                      </tr>
                    );
                  })}
                  {porCadete.length === 0 && (
                    <tr><td colSpan={6} className={`text-center py-8 ${lbl}`}>Nenhuma falta no filtro selecionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {aba === 'turma' && (
        <div className={`${card} overflow-hidden`}>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porTurma} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="turma" tickFormatter={(v) => v.replace('TURMA_', 'T.')} tick={{ fontSize: 11, fill: axis }} />
                <YAxis tick={{ fontSize: 11, fill: axis }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="total" name="Faltas" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-xs uppercase tracking-wide ${lbl} ${dark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <th className="text-left px-4 py-3">Turma de Aula</th>
                  <th className="text-left px-4 py-3">Total Faltas</th>
                  <th className="text-left px-4 py-3">Cadetes com falta</th>
                  <th className="text-left px-4 py-3">Média por cadete</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? 'divide-slate-700/60' : 'divide-slate-100'}`}>
                {porTurma.map((t) => (
                  <tr key={t.turma} className={dark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className={`px-4 py-2 font-medium ${text}`}>{t.turma.replace('TURMA_', 'Turma ')}</td>
                    <td className={`px-4 py-2 font-bold text-indigo-500`}>{t.total}</td>
                    <td className={`px-4 py-2 ${lbl}`}>{t.cadetes}</td>
                    <td className={`px-4 py-2 ${lbl}`}>{t.cadetes ? (t.total / t.cadetes).toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'esquadrao' && (
        <div className={`${card} overflow-hidden`}>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porEsquadrao} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: axis }} />
                <YAxis tick={{ fontSize: 11, fill: axis }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="total" name="Faltas" radius={[4, 4, 0, 0]}>
                  {porEsquadrao.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-xs uppercase tracking-wide ${lbl} ${dark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <th className="text-left px-4 py-3">Esquadrão</th>
                  <th className="text-left px-4 py-3">Total Faltas</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? 'divide-slate-700/60' : 'divide-slate-100'}`}>
                {porEsquadrao.map((e) => (
                  <tr key={e.cohort_id} className={dark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className={`px-4 py-2 font-medium ${text}`}>{e.num}º Esquadrão — {e.nome}</td>
                    <td className={`px-4 py-2 font-bold text-indigo-500`}>{e.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela completa de registros */}
      {aba === 'individual' && (
        <div className={`${card} overflow-hidden`}>
          <div className={`px-4 py-3 border-b ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
            <h3 className={`text-xs font-medium uppercase tracking-wide ${lbl}`}>Detalhamento completo</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-xs uppercase tracking-wide ${lbl} ${dark ? 'bg-slate-800' : 'bg-slate-50'} border-b ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <th className="text-left px-4 py-2">Data</th>
                  <th className="text-left px-4 py-2">Cadete</th>
                  <th className="text-left px-4 py-2">Disciplina</th>
                  <th className="text-left px-4 py-2">Motivo</th>
                  <th className="text-left px-4 py-2">Obs.</th>
                  <th className="text-left px-4 py-2">Registrado por</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? 'divide-slate-700/60' : 'divide-slate-100'}`}>
                {faltasFiltradas.slice(0, 200).map((f) => (
                  <tr key={f.id} className={dark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className={`px-4 py-2 text-xs whitespace-nowrap ${lbl}`}>{fmtDate(f.data_aula)}</td>
                    <td className={`px-4 py-2 font-medium ${text}`}>
                      {f.nome_guerra}
                      <span className={`ml-1 text-xs ${lbl}`}>{f.cadet_id}</span>
                    </td>
                    <td className={`px-4 py-2 text-xs ${lbl}`}>{f.disciplina_sigla}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                        {f.motivo}
                      </span>
                    </td>
                    <td className={`px-4 py-2 text-xs ${lbl}`}>{f.observacao ?? '—'}</td>
                    <td className={`px-4 py-2 text-xs ${lbl}`}>{f.chefe_nome_guerra}</td>
                  </tr>
                ))}
                {faltasFiltradas.length === 0 && (
                  <tr><td colSpan={6} className={`text-center py-8 ${lbl}`}>Nenhuma falta encontrada.</td></tr>
                )}
              </tbody>
            </table>
            {faltasFiltradas.length > 200 && (
              <p className={`text-center py-2 text-xs ${lbl}`}>
                Exibindo 200 de {faltasFiltradas.length}. Use os filtros para refinar.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
