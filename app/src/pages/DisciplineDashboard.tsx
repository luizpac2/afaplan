import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, CheckCircle, Clock, AlertTriangle, TrendingUp,
  TrendingDown, Filter, Search, ChevronDown, ChevronUp,
  BarChart2, Target, Calendar, Layers
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";

const TODAY = new Date().toISOString().split("T")[0];

// ─── helpers ────────────────────────────────────────────────────────────────

function ppcKey(type: string, year: number) {
  return `${type}_${year}`;
}

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function statusColor(p: number) {
  if (p >= 100) return "text-green-500";
  if (p >= 70)  return "text-blue-500";
  if (p >= 40)  return "text-amber-500";
  return "text-red-500";
}

function statusBg(p: number) {
  if (p >= 100) return "bg-green-500";
  if (p >= 70)  return "bg-blue-500";
  if (p >= 40)  return "bg-amber-500";
  return "bg-red-500";
}

function statusLabel(p: number) {
  if (p >= 100) return "Concluída";
  if (p >= 70)  return "Em dia";
  if (p >= 40)  return "Atrasada";
  if (p > 0)    return "Crítica";
  return "Não iniciada";
}

// ─── types ──────────────────────────────────────────────────────────────────

interface DisciplineRow {
  id: string;
  code: string;
  name: string;
  trainingField: string;
  classId: string;
  className: string;
  cohortName: string;
  ppcLoad: number;        // Carga prevista no PPC
  planned: number;        // Aulas planejadas no ano
  executed: number;       // Aulas já ocorridas (date <= hoje)
  remaining: number;      // Aulas futuras planejadas
  pctPlanned: number;     // planned / ppcLoad
  pctExecuted: number;    // executed / ppcLoad
  instructorTrigram: string;
}

// ─── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  const { theme } = useTheme();
  return (
    <div className={`rounded-xl p-4 border flex gap-3 items-start ${
      theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-sm"
    }`}>
      <div className={`p-2 rounded-lg ${color} bg-opacity-10 flex-shrink-0`}>
        <Icon size={20} className={color} />
      </div>
      <div className="min-w-0">
        <p className={`text-xs mb-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
        <p className={`text-2xl font-bold ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}>{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Progress bar ────────────────────────────────────────────────────────────

function ProgressBar({ pct: p, showLabel = false }: { pct: number; showLabel?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${statusBg(p)}`}
          style={{ width: `${Math.min(p, 100)}%` }}
        />
      </div>
      {showLabel && <span className={`text-xs font-medium w-8 text-right ${statusColor(p)}`}>{p}%</span>}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type SortKey = "code" | "pctPlanned" | "pctExecuted" | "planned" | "executed" | "ppcLoad";
type SortDir = "asc" | "desc";

export const DisciplineDashboard = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { disciplines, classes, cohorts, fetchYearlyEvents, dataReady } = useCourseStore();

  const [yearlyEvents, setYearlyEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterField, setFilterField] = useState<string>("ALL");
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("pctExecuted");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [calendarYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!dataReady) return;
    fetchYearlyEvents(calendarYear).then(setYearlyEvents);
  }, [dataReady, calendarYear, fetchYearlyEvents]);

  // ── Build rows ──────────────────────────────────────────────────────────────
  const rows = useMemo<DisciplineRow[]>(() => {
    if (!yearlyEvents.length || !disciplines.length) return [];

    // Group events by discipline + class
    const groups: Record<string, any[]> = {};
    yearlyEvents.forEach((ev) => {
      if (ev.type === "ACADEMIC" || ev.disciplineId === "ACADEMIC") return;
      const key = `${ev.disciplineId}|${ev.classId}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    });

    return Object.entries(groups).flatMap(([key, evs]) => {
      const [discId, classId] = key.split("|");
      const disc = disciplines.find((d) => d.id === discId);
      if (!disc) return [];

      const classObj = classes.find((c) => c.id === classId);
      const cohortId = cohorts.find((co) => {
        const entryYear = co.entryYear;
        const yr = classObj?.year;
        return yr ? (new Date().getFullYear() - Number(entryYear) + 1) === yr : false;
      });

      // PPC load
      const pkKey = classObj ? ppcKey(classObj.type, classObj.year) : "";
      const ppcLoad =
        (disc.ppcLoads && pkKey && disc.ppcLoads[pkKey]) ||
        disc.load_hours ||
        0;

      const planned = evs.length;
      const executed = evs.filter((e) => e.date <= TODAY).length;
      const remaining = planned - executed;

      return [{
        id: discId,
        code: disc.code,
        name: disc.name,
        trainingField: disc.trainingField || "GERAL",
        classId,
        className: classObj ? `${classObj.year}º Esq` : classId,
        cohortName: cohortId?.name || "",
        ppcLoad,
        planned,
        executed,
        remaining,
        pctPlanned: pct(planned, ppcLoad),
        pctExecuted: pct(executed, ppcLoad),
        instructorTrigram: disc.instructorTrigram || disc.instructor || "—",
      }];
    });
  }, [yearlyEvents, disciplines, classes, cohorts]);

  // ── KPIs globais ────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalPpc = rows.reduce((s, r) => s + r.ppcLoad, 0);
    const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
    const totalExecuted = rows.reduce((s, r) => s + r.executed, 0);
    const concluded = rows.filter((r) => r.pctExecuted >= 100).length;
    const critical = rows.filter((r) => r.pctExecuted > 0 && r.pctExecuted < 40).length;
    const notStarted = rows.filter((r) => r.pctExecuted === 0).length;
    const onTrack = rows.filter((r) => r.pctExecuted >= 70 && r.pctExecuted < 100).length;
    return { totalPpc, totalPlanned, totalExecuted, concluded, critical, notStarted, onTrack, total: rows.length };
  }, [rows]);

  // ── Filter + sort ────────────────────────────────────────────────────────────
  const uniqueFields = useMemo(() => [...new Set(rows.map((r) => r.trainingField))], [rows]);
  const uniqueClasses = useMemo(() => [...new Set(rows.map((r) => r.className))], [rows]);

  const filtered = useMemo(() => {
    let data = rows;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    }
    if (filterField !== "ALL") data = data.filter((r) => r.trainingField === filterField);
    if (filterClass !== "ALL") data = data.filter((r) => r.className === filterClass);
    if (filterStatus !== "ALL") {
      data = data.filter((r) => {
        if (filterStatus === "CONCLUIDA") return r.pctExecuted >= 100;
        if (filterStatus === "EM_DIA") return r.pctExecuted >= 70 && r.pctExecuted < 100;
        if (filterStatus === "ATRASADA") return r.pctExecuted >= 40 && r.pctExecuted < 70;
        if (filterStatus === "CRITICA") return r.pctExecuted > 0 && r.pctExecuted < 40;
        if (filterStatus === "NAO_INICIADA") return r.pctExecuted === 0;
        return true;
      });
    }
    return [...data].sort((a, b) => {
      const va = a[sortKey] as any;
      const vb = b[sortKey] as any;
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [rows, search, filterField, filterClass, filterStatus, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  const card = theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-sm";
  const text = theme === "dark" ? "text-slate-100" : "text-slate-800";
  const muted = theme === "dark" ? "text-slate-400" : "text-slate-500";
  const rowHover = theme === "dark" ? "hover:bg-slate-700/40" : "hover:bg-slate-50";
  const thClass = `px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide ${muted} cursor-pointer select-none`;
  const inputClass = `text-sm px-3 py-1.5 rounded-lg border outline-none ${
    theme === "dark"
      ? "bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400"
      : "bg-white border-slate-200 text-slate-700 placeholder-slate-400"
  }`;

  const fieldLabels: Record<string, string> = {
    GERAL: "Geral", MILITAR: "Militar", PROFISSIONAL: "Profissional",
    ATIVIDADES_COMPLEMENTARES: "Ativ. Comp."
  };

  if (!dataReady || !yearlyEvents.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold ${text}`}>Dashboard de Disciplinas</h1>
          <p className={`text-sm ${muted}`}>Execução do PPC — Ano letivo {calendarYear}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${theme === "dark" ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}>
          Referência: {new Date().toLocaleDateString("pt-BR")}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="col-span-2">
          <KpiCard icon={Layers} label="Total de Disciplinas" value={kpis.total}
            sub={`${kpis.total} combinações disc. × turma`} color="text-blue-500" />
        </div>
        <div className="col-span-2">
          <KpiCard icon={Target} label="Aulas Previstas (PPC)" value={kpis.totalPpc}
            sub={`${kpis.totalPlanned} planejadas (${pct(kpis.totalPlanned, kpis.totalPpc)}% do PPC)`} color="text-purple-500" />
        </div>
        <div className="col-span-2">
          <KpiCard icon={CheckCircle} label="Aulas Executadas" value={kpis.totalExecuted}
            sub={`${pct(kpis.totalExecuted, kpis.totalPpc)}% da carga total do PPC`} color="text-green-500" />
        </div>
        <div className="col-span-2">
          <KpiCard icon={Calendar} label="Aulas Restantes" value={kpis.totalPlanned - kpis.totalExecuted}
            sub="Planejadas e ainda não ocorridas" color="text-amber-500" />
        </div>
        <div className="col-span-2">
          <KpiCard icon={CheckCircle} label="Concluídas" value={kpis.concluded}
            sub={`${pct(kpis.concluded, kpis.total)}% das disciplinas`} color="text-green-500" />
        </div>
        <div className="col-span-2">
          <KpiCard icon={TrendingUp} label="Em Dia (≥70%)" value={kpis.onTrack}
            sub={`${pct(kpis.onTrack, kpis.total)}% das disciplinas`} color="text-blue-500" />
        </div>
        <div className="col-span-2">
          <KpiCard icon={TrendingDown} label="Críticas (<40%)" value={kpis.critical}
            sub={`${pct(kpis.critical, kpis.total)}% das disciplinas`} color="text-red-500" />
        </div>
        <div className="col-span-2">
          <KpiCard icon={AlertTriangle} label="Não Iniciadas" value={kpis.notStarted}
            sub={`${pct(kpis.notStarted, kpis.total)}% das disciplinas`} color="text-slate-400" />
        </div>
      </div>

      {/* Status summary pills */}
      <div className={`rounded-xl border p-4 ${card}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${muted}`}>Distribuição por Status</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Concluídas", count: kpis.concluded, bg: "bg-green-500" },
            { label: "Em Dia", count: kpis.onTrack, bg: "bg-blue-500" },
            { label: "Atrasadas", count: rows.filter(r => r.pctExecuted >= 40 && r.pctExecuted < 70).length, bg: "bg-amber-500" },
            { label: "Críticas", count: kpis.critical, bg: "bg-red-500" },
            { label: "Não Iniciadas", count: kpis.notStarted, bg: "bg-slate-400" },
          ].map(({ label, count, bg }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${bg}`} />
              <span className={`text-xs ${muted}`}>{label}: <span className={`font-semibold ${text}`}>{count}</span></span>
            </div>
          ))}
        </div>
        {/* Progress bar geral */}
        <div className="mt-4 flex items-center gap-3">
          <span className={`text-xs ${muted} w-32`}>Execução geral do PPC</span>
          <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(pct(kpis.totalExecuted, kpis.totalPpc), 100)}%` }} />
          </div>
          <span className={`text-sm font-bold ${statusColor(pct(kpis.totalExecuted, kpis.totalPpc))}`}>
            {pct(kpis.totalExecuted, kpis.totalPpc)}%
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-xl border p-3 flex flex-wrap gap-2 items-center ${card}`}>
        <Filter size={14} className={muted} />
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${muted}`} />
          <input
            className={`${inputClass} pl-7 w-full`}
            placeholder="Buscar disciplina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={inputClass} value={filterField} onChange={(e) => setFilterField(e.target.value)}>
          <option value="ALL">Todos os campos</option>
          {uniqueFields.map((f) => <option key={f} value={f}>{fieldLabels[f] || f}</option>)}
        </select>
        <select className={inputClass} value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="ALL">Todas as turmas</option>
          {uniqueClasses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={inputClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="ALL">Todos os status</option>
          <option value="CONCLUIDA">Concluídas</option>
          <option value="EM_DIA">Em Dia (≥70%)</option>
          <option value="ATRASADA">Atrasadas (40-69%)</option>
          <option value="CRITICA">Críticas (&lt;40%)</option>
          <option value="NAO_INICIADA">Não Iniciadas</option>
        </select>
        <span className={`text-xs ${muted} ml-auto`}>{filtered.length} disciplinas</span>
      </div>

      {/* Table */}
      <div className={`rounded-xl border overflow-hidden ${card}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${theme === "dark" ? "border-slate-700 bg-slate-900/40" : "border-slate-100 bg-slate-50"}`}>
                <th className={thClass} onClick={() => handleSort("code")}>
                  <span className="flex items-center gap-1">Código <SortIcon k="code" /></span>
                </th>
                <th className={`${thClass} hidden md:table-cell`}>Disciplina</th>
                <th className={`${thClass} hidden lg:table-cell`}>Campo</th>
                <th className={thClass}>Turma</th>
                <th className={thClass} onClick={() => handleSort("ppcLoad")}>
                  <span className="flex items-center gap-1">PPC <SortIcon k="ppcLoad" /></span>
                </th>
                <th className={thClass} onClick={() => handleSort("planned")}>
                  <span className="flex items-center gap-1">Plan. <SortIcon k="planned" /></span>
                </th>
                <th className={thClass} onClick={() => handleSort("executed")}>
                  <span className="flex items-center gap-1">Exec. <SortIcon k="executed" /></span>
                </th>
                <th className={thClass} onClick={() => handleSort("pctPlanned")}>
                  <span className="flex items-center gap-1">% Plan. <SortIcon k="pctPlanned" /></span>
                </th>
                <th className={thClass} onClick={() => handleSort("pctExecuted")}>
                  <span className="flex items-center gap-1">% Exec. <SortIcon k="pctExecuted" /></span>
                </th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr
                  key={`${row.id}-${row.classId}-${i}`}
                  className={`border-b transition-colors cursor-pointer ${rowHover} ${
                    theme === "dark" ? "border-slate-700/50" : "border-slate-50"
                  }`}
                  onClick={() => navigate(`/discipline-report/${row.id}`)}
                >
                  <td className={`px-3 py-2.5 font-mono font-semibold text-xs ${text}`}>{row.code}</td>
                  <td className={`px-3 py-2.5 hidden md:table-cell max-w-[220px] ${text}`}>
                    <span className="truncate block">{row.name}</span>
                    <span className={`text-[10px] ${muted}`}>{row.instructorTrigram}</span>
                  </td>
                  <td className={`px-3 py-2.5 hidden lg:table-cell text-xs ${muted}`}>
                    {fieldLabels[row.trainingField] || row.trainingField}
                  </td>
                  <td className={`px-3 py-2.5 text-xs ${muted}`}>
                    <span>{row.className}</span>
                    {row.cohortName && <span className={`block text-[10px]`}>{row.cohortName}</span>}
                  </td>
                  <td className={`px-3 py-2.5 text-xs font-medium ${text}`}>{row.ppcLoad}</td>
                  <td className={`px-3 py-2.5 text-xs ${text}`}>{row.planned}</td>
                  <td className={`px-3 py-2.5 text-xs ${text}`}>{row.executed}</td>
                  <td className="px-3 py-2.5 min-w-[80px]">
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-medium ${statusColor(row.pctPlanned)}`}>{row.pctPlanned}%</span>
                      <ProgressBar pct={row.pctPlanned} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 min-w-[80px]">
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-medium ${statusColor(row.pctExecuted)}`}>{row.pctExecuted}%</span>
                      <ProgressBar pct={row.pctExecuted} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${statusBg(row.pctExecuted)}`}>
                      {statusLabel(row.pctExecuted)}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className={`px-4 py-10 text-center text-sm ${muted}`}>
                    <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                    Nenhuma disciplina encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown por campo de formação */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(fieldLabels).map(([field, label]) => {
          const fieldRows = rows.filter((r) => r.trainingField === field);
          if (!fieldRows.length) return null;
          const totalExec = fieldRows.reduce((s, r) => s + r.executed, 0);
          const totalPpc = fieldRows.reduce((s, r) => s + r.ppcLoad, 0);
          const p = pct(totalExec, totalPpc);
          return (
            <div key={field} className={`rounded-xl border p-4 ${card}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${muted}`}>{label}</p>
              <p className={`text-2xl font-bold ${statusColor(p)}`}>{p}%</p>
              <p className={`text-xs ${muted} mb-2`}>{totalExec}/{totalPpc} aulas</p>
              <ProgressBar pct={p} />
              <p className={`text-xs mt-2 ${muted}`}>{fieldRows.length} disciplinas</p>
            </div>
          );
        })}
      </div>

    </div>
  );
};
