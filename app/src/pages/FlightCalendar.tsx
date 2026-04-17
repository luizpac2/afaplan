import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plane, Loader2, Check, Minus } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import type { FlightDay, AircraftType } from "../types";
import { toggleFlightDay, subscribeToFlightDays } from "../services/flightService";

const AIRCRAFT: { id: AircraftType; label: string; color: string; darkColor: string; bg: string; darkBg: string }[] = [
  { id: "T-25", label: "T-25", color: "#2563eb", darkColor: "#3b82f6", bg: "#2563eb18", darkBg: "#3b82f618" },
  { id: "T-27", label: "T-27", color: "#059669", darkColor: "#34d399", bg: "#05966918", darkBg: "#34d39918" },
];

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const WEEKDAYS = ["DOM","SEG","TER","QUA","QUI","SEX","SÁB"];

export const FlightCalendar = () => {
  const { theme } = useTheme();
  const { userProfile } = useAuth();
  const isDark = theme === "dark";

  const [currentYear, setCurrentYear]   = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [flightDays, setFlightDays]     = useState<FlightDay[]>([]);
  const [loading, setLoading]           = useState(true);
  const [toggling, setToggling]         = useState<string | null>(null); // "date|aircraft"

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToFlightDays(currentYear, (data) => {
      setFlightDays(data);
      setLoading(false);
    });
    return unsub;
  }, [currentYear]);

  const enabledSet = useMemo(() => {
    const s = new Set<string>();
    flightDays.forEach((d) => s.add(`${d.date}|${d.aircraft}`));
    return s;
  }, [flightDays]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startOffset = firstDay.getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentYear, currentMonth]);

  const handleToggle = useCallback(async (day: number, aircraft: AircraftType) => {
    const monthStr = String(currentMonth + 1).padStart(2, "0");
    const dayStr   = String(day).padStart(2, "0");
    const dateStr  = `${currentYear}-${monthStr}-${dayStr}`;
    const dow      = new Date(currentYear, currentMonth, day).getDay();
    if (dow === 0) return;

    const key       = `${dateStr}|${aircraft}`;
    const isEnabled = enabledSet.has(key);

    // Optimistic
    if (isEnabled) {
      setFlightDays((p) => p.filter((d) => !(d.date === dateStr && d.aircraft === aircraft)));
    } else {
      setFlightDays((p) => [...p, { id: key, date: dateStr, aircraft, createdBy: userProfile?.uid ?? undefined }]);
    }

    setToggling(key);
    try {
      await toggleFlightDay(dateStr, aircraft, userProfile?.uid);
    } catch (err) {
      console.error("Failed to toggle flight day:", err);
      // Revert
      if (isEnabled) {
        setFlightDays((p) => [...p, { id: key, date: dateStr, aircraft, createdBy: userProfile?.uid ?? undefined }]);
      } else {
        setFlightDays((p) => p.filter((d) => !(d.date === dateStr && d.aircraft === aircraft)));
      }
    } finally {
      setToggling(null);
    }
  }, [currentYear, currentMonth, userProfile, enabledSet]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  const monthStats = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    return {
      "T-25": flightDays.filter((d) => d.aircraft === "T-25" && d.date.startsWith(prefix)).length,
      "T-27": flightDays.filter((d) => d.aircraft === "T-27" && d.date.startsWith(prefix)).length,
    };
  }, [flightDays, currentYear, currentMonth]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10">
            <Plane className="text-blue-500" size={24} />
          </div>
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Dias de Voo
            </h1>
            <p className={`text-xs font-medium uppercase tracking-widest mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Selecione os dias habilitados por aeronave
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Month stats pills */}
          {AIRCRAFT.map((ac) => (
            <div key={ac.id} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ backgroundColor: isDark ? ac.darkBg : ac.bg, color: isDark ? ac.darkColor : ac.color }}>
              <Plane size={11} />
              {ac.label}: {monthStats[ac.id]} dias
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-full text-xs font-semibold animate-pulse">
              <Loader2 className="animate-spin" size={12} /> Carregando...
            </div>
          )}
        </div>
      </header>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={handlePrevMonth}
          className={`p-2 rounded-lg border transition-all ${isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"}`}>
          <ChevronLeft size={20} />
        </button>
        <h2 className={`text-lg font-bold uppercase tracking-wide ${isDark ? "text-slate-200" : "text-slate-800"}`}>
          {MONTHS[currentMonth]} {currentYear}
        </h2>
        <button onClick={handleNextMonth}
          className={`p-2 rounded-lg border transition-all ${isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"}`}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
        {/* Weekday headers */}
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((wd, i) => (
            <div key={wd}
              className={`py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-b ${
                i === 0
                  ? isDark ? "text-slate-600 bg-slate-900 border-slate-800" : "text-slate-300 bg-slate-50 border-slate-200"
                  : isDark ? "text-slate-400 bg-slate-800/50 border-slate-800" : "text-slate-500 bg-slate-50 border-slate-200"
              }`}>
              {wd}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return (
                <div key={`e-${idx}`}
                  className={`border-b border-r min-h-[72px] ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-slate-50/50 border-slate-100"}`} />
              );
            }

            const monthStr  = String(currentMonth + 1).padStart(2, "0");
            const dayStr    = String(day).padStart(2, "0");
            const dateStr   = `${currentYear}-${monthStr}-${dayStr}`;
            const dow       = new Date(currentYear, currentMonth, day).getDay();
            const isSunday  = dow === 0;
            const isToday   = today === dateStr;

            return (
              <div key={day}
                className={`border-b border-r min-h-[72px] flex flex-col p-1.5 gap-1 ${
                  isSunday
                    ? isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
                    : isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                }`}>
                {/* Day number */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold leading-none ${
                    isToday ? "text-amber-500" :
                    isSunday ? isDark ? "text-slate-700" : "text-slate-300" :
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}>
                    {day}
                  </span>
                  {isToday && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </div>

                {/* Aircraft toggle buttons */}
                {isSunday ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Minus size={14} className={isDark ? "text-slate-800" : "text-slate-200"} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 flex-1">
                    {AIRCRAFT.map((ac) => {
                      const key        = `${dateStr}|${ac.id}`;
                      const isEnabled  = enabledSet.has(key);
                      const isSpinning = toggling === key;
                      const color      = isDark ? ac.darkColor : ac.color;
                      return (
                        <button
                          key={ac.id}
                          onClick={() => handleToggle(day, ac.id)}
                          disabled={isSpinning}
                          className={`w-full flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                            isEnabled
                              ? "text-white"
                              : isDark
                                ? "bg-slate-800 text-slate-500 hover:bg-slate-700"
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                          }`}
                          style={isEnabled ? { backgroundColor: color } : {}}
                        >
                          <span>{ac.label}</span>
                          {isSpinning ? (
                            <Loader2 size={9} className="animate-spin" />
                          ) : isEnabled ? (
                            <Check size={9} strokeWidth={3} className="text-white" />
                          ) : (
                            <div className={`w-2 h-2 rounded-full border border-dashed ${isDark ? "border-slate-600" : "border-slate-300"}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className={`flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl border text-xs ${isDark ? "bg-slate-900/50 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
        {AIRCRAFT.map((ac) => (
          <div key={ac.id} className="flex items-center gap-2">
            <div className="w-5 h-4 rounded flex items-center justify-between px-1"
              style={{ backgroundColor: isDark ? ac.darkColor : ac.color }}>
              <span className="text-[8px] font-bold text-white">{ac.label}</span>
              <Check size={8} className="text-white" strokeWidth={3} />
            </div>
            <span>{ac.id === "T-25" ? "T-25 habilitado" : "T-27 habilitado"}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Minus size={14} className={isDark ? "text-slate-700" : "text-slate-300"} />
          <span>Domingo (indisponível)</span>
        </div>
      </div>
    </div>
  );
};
