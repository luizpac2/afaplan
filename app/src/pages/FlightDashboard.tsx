import { useState, useEffect, useMemo } from "react";
import {
  Plane,
  Loader2,
  CalendarCheck,
  TrendingUp,
  Sun,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import type { FlightDay, AircraftType } from "../types";
import { subscribeToFlightDays } from "../services/flightService";

const AIRCRAFT_META: Record<
  AircraftType,
  { label: string; full: string; color: string; darkColor: string }
> = {
  "T-25": {
    label: "T-25",
    full: "T-25 Universal",
    color: "#2563eb",
    darkColor: "#3b82f6",
  },
  "T-27": {
    label: "T-27",
    full: "T-27 Tucano",
    color: "#059669",
    darkColor: "#34d399",
  },
};

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const FlightDashboard = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [flightDays, setFlightDays] = useState<FlightDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToFlightDays(currentYear, (data) => {
      setFlightDays(data);
      setLoading(false);
    });
    return unsub;
  }, [currentYear]);

  // Per-aircraft per-month breakdown
  const monthlyData = useMemo(() => {
    const result: Record<AircraftType, number[]> = {
      "T-25": Array(12).fill(0),
      "T-27": Array(12).fill(0),
    };
    flightDays.forEach((fd) => {
      const month = parseInt(fd.date.slice(5, 7)) - 1;
      result[fd.aircraft][month]++;
    });
    return result;
  }, [flightDays]);

  // Saturday counts per aircraft
  const saturdayCounts = useMemo(() => {
    const result: Record<AircraftType, number> = { "T-25": 0, "T-27": 0 };
    flightDays.forEach((fd) => {
      const dow = new Date(fd.date + "T12:00:00").getDay();
      if (dow === 6) result[fd.aircraft]++;
    });
    return result;
  }, [flightDays]);

  // Yearly totals
  const yearTotals = useMemo(() => {
    return {
      "T-25": flightDays.filter((d) => d.aircraft === "T-25").length,
      "T-27": flightDays.filter((d) => d.aircraft === "T-27").length,
    };
  }, [flightDays]);

  // Max in any month (for bar chart scaling)
  const maxMonthly = useMemo(() => {
    let m = 1;
    (["T-25", "T-27"] as AircraftType[]).forEach((ac) => {
      monthlyData[ac].forEach((v) => {
        if (v > m) m = v;
      });
    });
    return m;
  }, [monthlyData]);


  const currentMonthIdx = new Date().getMonth();

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl">
            <TrendingUp className="text-amber-500" size={24} />
          </div>
          <div>
            <h1
              className={`text-2xl font-bold tracking-tight ${isDark ? "text-slate-100" : "text-slate-900"}`}
            >
              Painel de Instrução Aérea
            </h1>
            <p
              className={`text-xs font-medium uppercase tracking-widest mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              Visão geral dos dias voáveis — {currentYear}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentYear((y) => y - 1)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {currentYear - 1}
          </button>
          <span
            className={`px-4 py-1.5 rounded-lg text-sm font-bold ${isDark ? "bg-slate-700 text-white" : "bg-slate-900 text-white"}`}
          >
            {currentYear}
          </span>
          <button
            onClick={() => setCurrentYear((y) => y + 1)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {currentYear + 1}
          </button>
          {loading && (
            <Loader2 className="animate-spin text-blue-500 ml-2" size={18} />
          )}
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["T-25", "T-27"] as AircraftType[]).map((ac) => {
          const meta = AIRCRAFT_META[ac];
          const color = isDark ? meta.darkColor : meta.color;
          return (
            <div
              key={`total-${ac}`}
              className={`rounded-xl border p-4 transition-all ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}
              style={{ borderLeft: `4px solid ${color}` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Plane size={16} style={{ color }} />
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {meta.label}
                </span>
              </div>
              <div className="text-3xl font-black" style={{ color }}>
                {yearTotals[ac]}
              </div>
              <div
                className={`text-[10px] uppercase tracking-wider mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
              >
                dias voáveis no ano
              </div>
            </div>
          );
        })}

        {(["T-25", "T-27"] as AircraftType[]).map((ac) => {
          const meta = AIRCRAFT_META[ac];
          const color = isDark ? meta.darkColor : meta.color;
          return (
            <div
              key={`sat-${ac}`}
              className={`rounded-xl border p-4 transition-all ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sun size={16} style={{ color }} />
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {meta.label} Sábados
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black" style={{ color }}>
                  {saturdayCounts[ac]}
                </span>
                <span
                  className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  / {yearTotals[ac]} total
                </span>
              </div>
              <div
                className={`text-[10px] uppercase tracking-wider mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
              >
                voos excepcionais
              </div>
            </div>
          );
        })}
      </div>

      {/* Monthly Chart */}
      <div
        className={`rounded-2xl border p-5 ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}
      >
        <h3
          className={`text-sm font-bold uppercase tracking-wider mb-4 ${isDark ? "text-slate-300" : "text-slate-700"}`}
        >
          <CalendarCheck size={16} className="inline mr-2 opacity-50" />
          Dias de Voo por Mês
        </h3>
        <div className="space-y-2">
          {MONTHS.map((m, i) => {
            const isCurrent = i === currentMonthIdx;
            const v25 = monthlyData["T-25"][i];
            const v27 = monthlyData["T-27"][i];
            return (
              <div key={m} className="flex items-center gap-2">
                <span className={`w-8 text-[10px] font-bold uppercase tracking-wider text-right flex-shrink-0 ${isCurrent ? "text-amber-500" : isDark ? "text-slate-500" : "text-slate-400"}`}>
                  {m}
                </span>
                {/* Two independent bars, each relative to maxMonthly */}
                <div className="flex-1 flex flex-col gap-0.5">
                  {(["T-25","T-27"] as AircraftType[]).map((ac) => {
                    const v     = monthlyData[ac][i];
                    const meta  = AIRCRAFT_META[ac];
                    const color = isDark ? meta.darkColor : meta.color;
                    const pct   = maxMonthly > 0 ? (v / maxMonthly) * 100 : 0;
                    return (
                      <div key={ac} className={`relative h-3 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all"
                          style={{ width: v > 0 ? `${Math.max(pct, 3)}%` : "0%", backgroundColor: color, opacity: isCurrent ? 1 : 0.65 }}
                        />
                        {v > 0 && (
                          <span className="absolute inset-y-0 flex items-center text-[8px] font-bold text-white pl-1.5">
                            {pct >= 15 ? `${ac} · ${v}d` : ""}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 w-16 flex-shrink-0 justify-end">
                  <span className="text-[10px] font-bold" style={{ color: isDark ? AIRCRAFT_META["T-25"].darkColor : AIRCRAFT_META["T-25"].color }}>{v25 || "–"}</span>
                  <span className="text-[10px] font-bold" style={{ color: isDark ? AIRCRAFT_META["T-27"].darkColor : AIRCRAFT_META["T-27"].color }}>{v27 || "–"}</span>
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-dashed"
          style={{ borderColor: isDark ? "#334155" : "#e2e8f0" }}
        >
          {(["T-25", "T-27"] as AircraftType[]).map((ac) => {
            const meta = AIRCRAFT_META[ac];
            return (
              <div key={ac} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: isDark ? meta.darkColor : meta.color,
                  }}
                />
                <span
                  className={`text-[10px] font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {meta.full}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Detail Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                className={isDark ? "bg-slate-800" : "bg-slate-50"}
              >
                <th
                  className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Mês
                </th>
                <th
                  className={`px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider`}
                  style={{
                    color: isDark
                      ? AIRCRAFT_META["T-25"].darkColor
                      : AIRCRAFT_META["T-25"].color,
                  }}
                >
                  T-25 Dias
                </th>
                <th
                  className={`px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider`}
                  style={{
                    color: isDark
                      ? AIRCRAFT_META["T-27"].darkColor
                      : AIRCRAFT_META["T-27"].color,
                  }}
                >
                  T-27 Dias
                </th>
                <th
                  className={`px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Ambas
                </th>
              </tr>
            </thead>
            <tbody>
              {MONTHS_FULL.map((m, i) => {
                const isCurrent = i === currentMonthIdx;
                const t25 = monthlyData["T-25"][i];
                const t27 = monthlyData["T-27"][i];
                return (
                  <tr
                    key={m}
                    className={`border-t transition-colors ${
                      isCurrent
                        ? isDark
                          ? "bg-amber-900/10 border-slate-700"
                          : "bg-amber-50 border-slate-200"
                        : isDark
                          ? "border-slate-800 hover:bg-slate-800/50"
                          : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-sm font-medium ${
                          isCurrent
                            ? "text-amber-500 font-bold"
                            : isDark
                              ? "text-slate-300"
                              : "text-slate-700"
                        }`}
                      >
                        {m}
                        {isCurrent && (
                          <span className="ml-2 text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full font-bold uppercase">
                            atual
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className="text-sm font-bold"
                        style={{
                          color:
                            t25 > 0
                              ? isDark
                                ? AIRCRAFT_META["T-25"].darkColor
                                : AIRCRAFT_META["T-25"].color
                              : isDark
                                ? "#475569"
                                : "#cbd5e1",
                        }}
                      >
                        {t25 || "–"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className="text-sm font-bold"
                        style={{
                          color:
                            t27 > 0
                              ? isDark
                                ? AIRCRAFT_META["T-27"].darkColor
                                : AIRCRAFT_META["T-27"].color
                              : isDark
                                ? "#475569"
                                : "#cbd5e1",
                        }}
                      >
                        {t27 || "–"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
                      >
                        {t25 + t27 || "–"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Totals Row */}
              <tr
                className={`border-t-2 font-bold ${isDark ? "bg-slate-800 border-slate-600" : "bg-slate-100 border-slate-300"}`}
              >
                <td
                  className={`px-4 py-3 text-sm uppercase tracking-wider ${isDark ? "text-slate-200" : "text-slate-700"}`}
                >
                  Total Anual
                </td>
                <td
                  className="px-4 py-3 text-center text-lg"
                  style={{
                    color: isDark
                      ? AIRCRAFT_META["T-25"].darkColor
                      : AIRCRAFT_META["T-25"].color,
                  }}
                >
                  {yearTotals["T-25"]}
                </td>
                <td
                  className="px-4 py-3 text-center text-lg"
                  style={{
                    color: isDark
                      ? AIRCRAFT_META["T-27"].darkColor
                      : AIRCRAFT_META["T-27"].color,
                  }}
                >
                  {yearTotals["T-27"]}
                </td>
                <td
                  className={`px-4 py-3 text-center text-lg ${isDark ? "text-slate-200" : "text-slate-700"}`}
                >
                  {yearTotals["T-25"] + yearTotals["T-27"]}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
