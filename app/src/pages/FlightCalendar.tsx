import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plane,
  Loader2,
  Check,
  Minus,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import type { FlightDay, AircraftType } from "../types";
import {
  toggleFlightDay,
  subscribeToFlightDays,
} from "../services/flightService";

const AIRCRAFT: { id: AircraftType; label: string; color: string; darkColor: string }[] = [
  { id: "T-25", label: "T-25 Universal", color: "#2563eb", darkColor: "#3b82f6" },
  { id: "T-27", label: "T-27 Tucano", color: "#059669", darkColor: "#34d399" },
];

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export const FlightCalendar = () => {
  const { theme } = useTheme();
  const { userProfile } = useAuth();
  const isDark = theme === "dark";

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftType>("T-25");
  const [flightDays, setFlightDays] = useState<FlightDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Subscribe to flight days
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToFlightDays(currentYear, (data) => {
      setFlightDays(data);
      setLoading(false);
    });
    return unsub;
  }, [currentYear]);

  // Enabled dates set for current aircraft
  const enabledDates = useMemo(() => {
    const set = new Set<string>();
    flightDays
      .filter((d) => d.aircraft === selectedAircraft)
      .forEach((d) => set.add(d.date));
    return set;
  }, [flightDays, selectedAircraft]);

  // Calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startOffset = firstDay.getDay(); // 0=Sunday
    const totalDays = lastDay.getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);
    // Pad to fill last row
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentYear, currentMonth]);

  const handleToggle = useCallback(
    async (day: number) => {
      const monthStr = String(currentMonth + 1).padStart(2, "0");
      const dayStr = String(day).padStart(2, "0");
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

      // Only Mon-Sat (0=Sun is excluded)
      const dow = new Date(currentYear, currentMonth, day).getDay();
      if (dow === 0) return;

      const isEnabled = enabledDates.has(dateStr);

      // Optimistic update — Realtime não está habilitado neste projeto
      if (isEnabled) {
        setFlightDays((prev) =>
          prev.filter((d) => !(d.date === dateStr && d.aircraft === selectedAircraft)),
        );
      } else {
        setFlightDays((prev) => [
          ...prev,
          { id: dateStr, date: dateStr, aircraft: selectedAircraft, createdBy: userProfile?.uid ?? undefined },
        ]);
      }

      setToggling(dateStr);
      try {
        await toggleFlightDay(dateStr, selectedAircraft, userProfile?.uid);
      } catch (err) {
        console.error("Failed to toggle flight day:", err);
        // Reverter em caso de erro
        if (isEnabled) {
          setFlightDays((prev) => [
            ...prev,
            { id: dateStr, date: dateStr, aircraft: selectedAircraft, createdBy: userProfile?.uid ?? undefined },
          ]);
        } else {
          setFlightDays((prev) =>
            prev.filter((d) => !(d.date === dateStr && d.aircraft === selectedAircraft)),
          );
        }
      } finally {
        setToggling(null);
      }
    },
    [currentYear, currentMonth, selectedAircraft, userProfile, enabledDates],
  );

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Stats for this month
  const monthStats = useMemo(() => {
    const monthStr = String(currentMonth + 1).padStart(2, "0");
    const prefix = `${currentYear}-${monthStr}`;
    const t25 = flightDays.filter(
      (d) => d.aircraft === "T-25" && d.date.startsWith(prefix),
    ).length;
    const t27 = flightDays.filter(
      (d) => d.aircraft === "T-27" && d.date.startsWith(prefix),
    ).length;
    return { "T-25": t25, "T-27": t27 };
  }, [flightDays, currentYear, currentMonth]);

  const aircraftConfig = AIRCRAFT.find((a) => a.id === selectedAircraft)!;
  const accentColor = isDark ? aircraftConfig.darkColor : aircraftConfig.color;

  // Count Saturdays enabled this month
  const saturdayCount = useMemo(() => {
    const monthStr = String(currentMonth + 1).padStart(2, "0");
    const prefix = `${currentYear}-${monthStr}`;
    return flightDays.filter((d) => {
      if (d.aircraft !== selectedAircraft || !d.date.startsWith(prefix)) return false;
      const dow = new Date(d.date + "T12:00:00").getDay();
      return dow === 6;
    }).length;
  }, [flightDays, selectedAircraft, currentYear, currentMonth]);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <Plane style={{ color: accentColor }} size={24} />
          </div>
          <div>
            <h1
              className={`text-2xl font-bold tracking-tight ${isDark ? "text-slate-100" : "text-slate-900"}`}
            >
              Dias de Voo
            </h1>
            <p
              className={`text-xs font-medium uppercase tracking-widest mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              Selecione os dias habilitados para voo
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-full text-xs font-semibold animate-pulse">
            <Loader2 className="animate-spin" size={14} />
            Carregando...
          </div>
        )}
      </header>

      {/* Aircraft Selector */}
      <div
        className={`flex gap-3 p-1.5 rounded-xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"}`}
      >
        {AIRCRAFT.map((ac) => {
          const isSelected = selectedAircraft === ac.id;
          const color = isDark ? ac.darkColor : ac.color;
          return (
            <button
              key={ac.id}
              onClick={() => setSelectedAircraft(ac.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                isSelected ? "text-white shadow-md" : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"
              }`}
              style={isSelected ? { backgroundColor: color } : {}}
            >
              <Plane size={16} />
              {ac.label}
              <span
                className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : isDark
                      ? "bg-slate-800 text-slate-500"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {monthStats[ac.id]} dias
              </span>
            </button>
          );
        })}
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          className={`p-2 rounded-lg border transition-all ${isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"}`}
        >
          <ChevronLeft size={20} />
        </button>
        <h2
          className={`text-lg font-bold uppercase tracking-wide ${isDark ? "text-slate-200" : "text-slate-800"}`}
        >
          {MONTHS[currentMonth]} {currentYear}
        </h2>
        <button
          onClick={handleNextMonth}
          className={`p-2 rounded-lg border transition-all ${isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"}`}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div
        className={`rounded-2xl border overflow-hidden ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} shadow-sm`}
      >
        {/* Weekday headers */}
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((wd, i) => (
            <div
              key={wd}
              className={`py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-b ${
                i === 0
                  ? isDark
                    ? "text-slate-600 bg-slate-900 border-slate-800"
                    : "text-slate-300 bg-slate-50 border-slate-200"
                  : isDark
                    ? "text-slate-400 bg-slate-800/50 border-slate-800"
                    : "text-slate-500 bg-slate-50 border-slate-200"
              }`}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  className={`aspect-square border-b border-r ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-slate-50/50 border-slate-100"}`}
                />
              );
            }

            const monthStr = String(currentMonth + 1).padStart(2, "0");
            const dayStr = String(day).padStart(2, "0");
            const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
            const dow = new Date(currentYear, currentMonth, day).getDay();
            const isSunday = dow === 0;
            const isSaturday = dow === 6;
            const isEnabled = enabledDates.has(dateStr);
            const isToggling = toggling === dateStr;
            const isToday =
              new Date().toISOString().slice(0, 10) === dateStr;

            return (
              <div
                key={day}
                onClick={() => !isSunday && handleToggle(day)}
                className={`aspect-square border-b border-r flex flex-col items-center justify-center gap-1 transition-all relative ${
                  isSunday
                    ? isDark
                      ? "bg-slate-950 border-slate-800 cursor-not-allowed"
                      : "bg-slate-100 border-slate-200 cursor-not-allowed"
                    : isEnabled
                      ? "cursor-pointer hover:opacity-80"
                      : isDark
                        ? "bg-slate-900 border-slate-800 cursor-pointer hover:bg-slate-800"
                        : "bg-white border-slate-100 cursor-pointer hover:bg-slate-50"
                }`}
                style={
                  isEnabled && !isSunday
                    ? {
                        backgroundColor: isDark
                          ? `${accentColor}18`
                          : `${accentColor}10`,
                      }
                    : {}
                }
              >
                {isToday && (
                  <div
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                )}

                <span
                  className={`text-sm font-bold ${
                    isSunday
                      ? isDark
                        ? "text-slate-700"
                        : "text-slate-300"
                      : isEnabled
                        ? "text-white"
                        : isDark
                          ? "text-slate-300"
                          : "text-slate-700"
                  }`}
                  style={isEnabled && !isSunday ? { color: accentColor } : {}}
                >
                  {day}
                </span>

                {isSunday ? (
                  <Minus
                    size={12}
                    className={isDark ? "text-slate-800" : "text-slate-200"}
                  />
                ) : isToggling ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                    style={{ color: accentColor }}
                  />
                ) : isEnabled ? (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <div
                    className={`w-6 h-6 rounded-full border-2 border-dashed ${isDark ? "border-slate-700" : "border-slate-200"}`}
                  />
                )}

                {isSaturday && isEnabled && (
                  <span
                    className="absolute bottom-0.5 text-[7px] font-bold uppercase tracking-wider"
                    style={{ color: accentColor }}
                  >
                    SÁB
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div
        className={`flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl border text-xs ${isDark ? "bg-slate-900/50 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"}`}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: accentColor }}
          >
            <Check size={12} className="text-white" strokeWidth={3} />
          </div>
          <span>Dia de voo habilitado</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-5 h-5 rounded-full border-2 border-dashed ${isDark ? "border-slate-700" : "border-slate-200"}`}
          />
          <span>Sem voo</span>
        </div>
        <div className="flex items-center gap-2">
          <Minus size={14} className={isDark ? "text-slate-700" : "text-slate-300"} />
          <span>Domingo (indisponível)</span>
        </div>
        {saturdayCount > 0 && (
          <div
            className="ml-auto px-3 py-1 rounded-full text-[10px] font-bold uppercase"
            style={{
              backgroundColor: `${accentColor}15`,
              color: accentColor,
            }}
          >
            {saturdayCount} sábado{saturdayCount !== 1 ? "s" : ""} com voo
          </div>
        )}
      </div>
    </div>
  );
};
