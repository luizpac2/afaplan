import { useState, useEffect, useMemo } from "react";
import { Plane, Loader2, TrendingUp, Sun } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import type { FlightDay, AircraftType } from "../types";
import { subscribeToFlightDays } from "../services/flightService";

const AC: { id: AircraftType; full: string; color: string; dark: string }[] = [
  { id: "T-25", full: "T-25 Universal", color: "#2563eb", dark: "#3b82f6" },
  { id: "T-27", full: "T-27 Tucano",   color: "#059669", dark: "#34d399" },
];

const MONTHS_FULL = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const MONTHS_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export const FlightDashboard = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [flightDays, setFlightDays]   = useState<FlightDay[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToFlightDays(currentYear, (data) => {
      setFlightDays(data);
      setLoading(false);
    });
    return unsub;
  }, [currentYear]);

  const currentMonthIdx = new Date().getMonth();

  // Per-month stats: days, saturdays, "both aircraft" days
  const monthly = useMemo(() => {
    type MonthRow = { t25: number; t27: number; satT25: number; satT27: number; both: number };
    const rows: MonthRow[] = Array.from({ length: 12 }, () => ({ t25: 0, t27: 0, satT25: 0, satT27: 0, both: 0 }));
    const byMonth: Record<number, { t25: Set<string>; t27: Set<string> }> = {};
    for (let i = 0; i < 12; i++) byMonth[i] = { t25: new Set(), t27: new Set() };

    flightDays.forEach((fd) => {
      const m   = parseInt(fd.date.slice(5, 7)) - 1;
      const dow = new Date(fd.date + "T12:00:00").getDay();
      const isSat = dow === 6;
      if (fd.aircraft === "T-25") { rows[m].t25++; if (isSat) rows[m].satT25++; byMonth[m].t25.add(fd.date); }
      if (fd.aircraft === "T-27") { rows[m].t27++; if (isSat) rows[m].satT27++; byMonth[m].t27.add(fd.date); }
    });
    for (let i = 0; i < 12; i++) {
      byMonth[i].t25.forEach((d) => { if (byMonth[i].t27.has(d)) rows[i].both++; });
    }
    return rows;
  }, [flightDays]);

  const yearTotals = useMemo(() => ({
    t25:    monthly.reduce((s, r) => s + r.t25, 0),
    t27:    monthly.reduce((s, r) => s + r.t27, 0),
    satT25: monthly.reduce((s, r) => s + r.satT25, 0),
    satT27: monthly.reduce((s, r) => s + r.satT27, 0),
    both:   monthly.reduce((s, r) => s + r.both, 0),
  }), [monthly]);

  const maxVal = useMemo(() =>
    Math.max(1, ...monthly.flatMap((r) => [r.t25, r.t27])),
  [monthly]);

  const c25 = isDark ? AC[0].dark : AC[0].color;
  const c27 = isDark ? AC[1].dark : AC[1].color;

  const cardCls = `rounded-xl border p-4 shadow-sm ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`;
  const dimCls  = `text-[10px] uppercase tracking-wider mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl">
            <TrendingUp className="text-amber-500" size={24} />
          </div>
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Painel de Instrução Aérea
            </h1>
            <p className={`text-xs font-medium uppercase tracking-widest mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Visão geral dos dias voáveis — {currentYear}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentYear((y) => y - 1)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {currentYear - 1}
          </button>
          <span className={`px-4 py-1.5 rounded-lg text-sm font-bold ${isDark ? "bg-slate-700 text-white" : "bg-slate-900 text-white"}`}>
            {currentYear}
          </span>
          <button onClick={() => setCurrentYear((y) => y + 1)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {currentYear + 1}
          </button>
          {loading && <Loader2 className="animate-spin text-blue-500 ml-2" size={18} />}
        </div>
      </header>

      {/* Summary cards — one per aircraft + combined */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {AC.map((ac) => {
          const color  = isDark ? ac.dark : ac.color;
          const total  = ac.id === "T-25" ? yearTotals.t25 : yearTotals.t27;
          const sats   = ac.id === "T-25" ? yearTotals.satT25 : yearTotals.satT27;
          const weekd  = total - sats;
          return (
            <div key={ac.id} className={cardCls} style={{ borderLeft: `4px solid ${color}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Plane size={15} style={{ color }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{ac.full}</span>
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-3xl font-black" style={{ color }}>{total}</div>
                  <div className={dimCls}>dias no ano</div>
                </div>
                <div className="flex flex-col gap-0.5 pb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>{weekd}</span>
                    <span className={dimCls}>dias úteis</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sun size={11} style={{ color }} />
                    <span className={`text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>{sats}</span>
                    <span className={dimCls}>sábados</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {/* Shared days card */}
        <div className={cardCls} style={{ borderLeft: "4px solid #8b5cf6" }}>
          <div className="flex items-center gap-2 mb-3">
            <Plane size={15} className="text-violet-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-violet-500">Ambas Aeronaves</span>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <div className="text-3xl font-black text-violet-500">{yearTotals.both}</div>
              <div className={dimCls}>dias em comum</div>
            </div>
            <div className="flex flex-col gap-0.5 pb-0.5">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>{yearTotals.t25 + yearTotals.t27}</span>
                <span className={dimCls}>total combinado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>{yearTotals.satT25 + yearTotals.satT27}</span>
                <span className={dimCls}>sábados total</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Merged monthly table with inline bars */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
        <table className="w-full">
          <thead>
            <tr className={isDark ? "bg-slate-800" : "bg-slate-50"}>
              <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"} w-28`}>Mês</th>
              <th className={`px-3 py-3 text-[10px] font-bold uppercase tracking-wider`} style={{ color: c25 }}>T-25</th>
              <th className={`px-3 py-3 text-[10px] font-bold uppercase tracking-wider hidden sm:table-cell`} style={{ color: c25 }}>Sáb T-25</th>
              <th className="px-4 py-3 hidden md:table-cell" />
              <th className={`px-3 py-3 text-[10px] font-bold uppercase tracking-wider`} style={{ color: c27 }}>T-27</th>
              <th className={`px-3 py-3 text-[10px] font-bold uppercase tracking-wider hidden sm:table-cell`} style={{ color: c27 }}>Sáb T-27</th>
              <th className="px-4 py-3 hidden md:table-cell" />
              <th className={`px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-violet-500`}>Ambas</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((row, i) => {
              const isCurrent = i === currentMonthIdx;
              const pct25 = maxVal > 0 ? (row.t25 / maxVal) * 100 : 0;
              const pct27 = maxVal > 0 ? (row.t27 / maxVal) * 100 : 0;
              const rowCls = isCurrent
                ? isDark ? "bg-amber-900/10 border-slate-700" : "bg-amber-50 border-slate-200"
                : isDark ? "border-slate-800 hover:bg-slate-800/40" : "border-slate-100 hover:bg-slate-50";
              const numCls = (v: number) =>
                `text-sm font-bold text-center ${v === 0 ? (isDark ? "text-slate-700" : "text-slate-300") : ""}`;

              return (
                <tr key={i} className={`border-t transition-colors ${rowCls}`}>
                  {/* Month */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase w-7 ${isCurrent ? "text-amber-500" : isDark ? "text-slate-500" : "text-slate-400"}`}>
                        {MONTHS_SHORT[i]}
                      </span>
                      <span className={`text-sm font-medium hidden sm:inline ${isCurrent ? "text-amber-500 font-bold" : isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {MONTHS_FULL[i]}
                        {isCurrent && <span className="ml-1.5 text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full font-bold uppercase">atual</span>}
                      </span>
                    </div>
                  </td>

                  {/* T-25 count */}
                  <td className="px-3 py-2.5 text-center">
                    <span className={numCls(row.t25)} style={row.t25 > 0 ? { color: c25 } : {}}>
                      {row.t25 || "–"}
                    </span>
                  </td>

                  {/* T-25 saturdays */}
                  <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                    <span className={`text-xs ${row.satT25 > 0 ? "font-bold" : (isDark ? "text-slate-700" : "text-slate-300")}`}
                      style={row.satT25 > 0 ? { color: c25 } : {}}>
                      {row.satT25 || "–"}
                    </span>
                  </td>

                  {/* T-25 inline bar */}
                  <td className="px-2 py-2.5 hidden md:table-cell w-36">
                    <div className={`relative h-2.5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                        style={{ width: row.t25 > 0 ? `${Math.max(pct25, 4)}%` : "0%", backgroundColor: c25, opacity: isCurrent ? 1 : 0.6 }} />
                    </div>
                  </td>

                  {/* T-27 count */}
                  <td className="px-3 py-2.5 text-center">
                    <span className={numCls(row.t27)} style={row.t27 > 0 ? { color: c27 } : {}}>
                      {row.t27 || "–"}
                    </span>
                  </td>

                  {/* T-27 saturdays */}
                  <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                    <span className={`text-xs ${row.satT27 > 0 ? "font-bold" : (isDark ? "text-slate-700" : "text-slate-300")}`}
                      style={row.satT27 > 0 ? { color: c27 } : {}}>
                      {row.satT27 || "–"}
                    </span>
                  </td>

                  {/* T-27 inline bar */}
                  <td className="px-2 py-2.5 hidden md:table-cell w-36">
                    <div className={`relative h-2.5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                        style={{ width: row.t27 > 0 ? `${Math.max(pct27, 4)}%` : "0%", backgroundColor: c27, opacity: isCurrent ? 1 : 0.6 }} />
                    </div>
                  </td>

                  {/* Both */}
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-sm font-bold ${row.both > 0 ? "text-violet-500" : (isDark ? "text-slate-700" : "text-slate-300")}`}>
                      {row.both || "–"}
                    </span>
                  </td>
                </tr>
              );
            })}

            {/* Totals */}
            <tr className={`border-t-2 ${isDark ? "bg-slate-800 border-slate-600" : "bg-slate-100 border-slate-300"}`}>
              <td className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-600"}`}>Total Anual</td>
              <td className="px-3 py-3 text-center text-base font-black" style={{ color: c25 }}>{yearTotals.t25}</td>
              <td className="px-3 py-3 text-center text-sm font-bold hidden sm:table-cell" style={{ color: c25 }}>{yearTotals.satT25}</td>
              <td className="hidden md:table-cell" />
              <td className="px-3 py-3 text-center text-base font-black" style={{ color: c27 }}>{yearTotals.t27}</td>
              <td className="px-3 py-3 text-center text-sm font-bold hidden sm:table-cell" style={{ color: c27 }}>{yearTotals.satT27}</td>
              <td className="hidden md:table-cell" />
              <td className="px-3 py-3 text-center text-base font-black text-violet-500">{yearTotals.both}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
};
