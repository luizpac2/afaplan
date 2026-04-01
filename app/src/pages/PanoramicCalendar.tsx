import { useState, useMemo, useEffect } from "react";
import { useCourseStore } from "../store/useCourseStore";
import { YearlyGrid } from "../components/YearlyGrid";
import { useTheme } from "../contexts/ThemeContext";
import { Calendar as CalendarIcon } from "lucide-react";
import type { ScheduleEvent } from "../types";

export const PanoramicCalendar = () => {
  const { theme } = useTheme();
  const { fetchYearlyEvents } = useCourseStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Window Query state
  const [yearEvents, setYearEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    fetchYearlyEvents(selectedYear).then((data) => {
      setYearEvents(data);
    });
  }, [selectedYear, fetchYearlyEvents]);

  const filteredEvents = useMemo(() => {
    return yearEvents;
  }, [yearEvents]);

  return (
    <div className="pt-8 pb-4 px-4 md:pt-14 md:pb-8 md:px-10 md:h-full flex flex-col max-w-[1600px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1
            className={`text-3xl  uppercase tracking-tighter flex items-center gap-3 ${theme === "dark" ? "text-white" : "text-slate-900"}`}
          >
            <CalendarIcon size={32} className="text-blue-500" />
            Calendário Acadêmico - Admin
          </h1>
          <p
            className={`text-lg  ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
          >
            Visão anual de todas as atividades, avaliações e bloqueios dividida
            por esquadrão.
          </p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className={`px-4 py-2 rounded-xl border text-lg  outline-none cursor-pointer shadow-sm focus:ring-2 focus:ring-blue-500/20 ${theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}
        >
          {Array.from(
            { length: 11 },
            (_, i) => new Date().getFullYear() - 5 + i,
          ).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full flex-1 min-h-[500px]">
        <YearlyGrid year={selectedYear} events={filteredEvents} />
      </div>
    </div>
  );
};
