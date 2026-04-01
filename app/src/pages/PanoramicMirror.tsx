import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { YearlyGrid } from "../components/YearlyGrid";
import { useCourseStore } from "../store/useCourseStore";
import type { ScheduleEvent } from "../types";

export const PanoramicMirror = () => {
  const { theme } = useTheme();
  const { fetchYearlyEvents } = useCourseStore();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setIsLoading(true);
    fetchYearlyEvents(currentYear).then((data) => {
      setEvents(data);
      setIsLoading(false);
    });
  }, [currentYear, fetchYearlyEvents]);

  return (
    <div className="p-6 md:p-12 pt-10 md:pt-16 max-w-7xl mx-auto space-y-8">
      <header className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl">
              <CalendarIcon className="text-blue-500" size={24} />
            </div>
            <div>
              <h1
                className={`text-2xl font-bold uppercase tracking-tight ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
              >
                Calendário Acadêmico
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
                Visão mensal dos eventos acadêmicos
              </p>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-full text-xs font-semibold animate-pulse">
              <Loader2 className="animate-spin" size={14} />
              Carregando dados do ano...
            </div>
          )}
        </div>
      </header>

      {/* Componente Anual (Somente Consulta) */}
      <div
        className={`w-full overflow-hidden rounded-2xl border ${
          theme === "dark"
            ? "bg-slate-900 border-slate-800"
            : "bg-white border-slate-200"
        } shadow-sm relative`}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        )}
        <YearlyGrid year={currentYear} events={events} readOnly={true} />
      </div>

      <footer
        className={`p-4 rounded-xl border text-xs leading-relaxed ${
          theme === "dark"
            ? "bg-slate-900/50 border-slate-800 text-slate-500"
            : "bg-slate-50 border-slate-200 text-slate-400"
        }`}
      >
        <p>
          <strong>Nota:</strong> Esta página é destinada apenas à visualização.
          Para realizar alterações no calendário acadêmico ou na programação dos
          esquadrões, utilize as abas correspondentes no menu de{" "}
          <strong>Planejamento</strong> (acesso restrito a administradores).
        </p>
      </footer>
    </div>
  );
};
