import { useAuth } from "../contexts/AuthContext";
import { formatClassId, formatNoticeType } from "../utils/formatters";
import { useTheme } from "../contexts/ThemeContext";
import { Megaphone, Search, Calendar, GraduationCap } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Badge } from "../components/common/Badge";

import { useCourseStore } from "../store/useCourseStore";
import { formatDateForDisplay } from "../utils/dateUtils";
import type { ScheduleEvent, VisualConfig } from "../types";
import { COHORT_COLORS } from "../utils/cohortColors";

export const Dashboard = () => {
  const { disciplines, notices, cohorts, visualConfigs, fetchYearlyEvents } =
    useCourseStore();
  const { userProfile } = useAuth();
  const { theme } = useTheme();

  const visualYear = new Date().getFullYear();
  const selectedYear = visualYear;

  // Local state for events to enable real-time updates
  const [allYearEvents, setAllYearEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    Promise.all([
      fetchYearlyEvents(selectedYear),
      fetchYearlyEvents(selectedYear + 1),
    ]).then(([eventsThisYear, eventsNextYear]) => {
      setAllYearEvents([...eventsThisYear, ...eventsNextYear]);
    });
  }, [selectedYear, fetchYearlyEvents]);

  // Derived reactive states from store
  const evaluationEvents = useMemo(() => {
    return allYearEvents
      .filter((e) => e.type === "EVALUATION")
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  }, [allYearEvents]);

  const academicEvents = useMemo(() => {
    return allYearEvents
      .filter((e) => e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC")
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  }, [allYearEvents]);

  // Filters for Notice Board
  const [filterSquadron, setFilterSquadron] = useState<string>("ALL");
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(
    null,
  );

  const userName = userProfile?.displayName?.split(" ")[0] || "Usuário";
  // useMemo para evitar criar novo objeto Date a cada render (causava recomputação infinita do useMemo abaixo)
  const nowLocal = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Filtered data for display
  const { filteredAvisos, filteredCalendario } = useMemo(() => {
    if (!userProfile) return { filteredAvisos: [], filteredCalendario: [] };

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userProfile.role);
    const next30Days = new Date();
    next30Days.setDate(nowLocal.getDate() + 30);

    // 1. Avisos normais
    const standardNotices = notices.filter((notice) => {
      if (!notice.startDate || !notice.endDate) return false;
      const [sYear, sMonth, sDay] = notice.startDate.split("-").map(Number);
      const start = new Date(sYear, sMonth - 1, sDay);

      const [eYear, eMonth, eDay] = notice.endDate.split("-").map(Number);
      const end = new Date(eYear, eMonth - 1, eDay);
      end.setHours(23, 59, 59, 999);

      if (end < nowLocal || start > next30Days) return false;

      if (!isAdmin) {
        if (
          notice.targetRoles &&
          !notice.targetRoles.includes(userProfile.role)
        )
          return false;
        if (notice.targetSquadron) {
          if (userProfile.role === "CADETE") {
            const match = userProfile.squadron?.match(/(\d+)/);
            const year = match ? parseInt(match[1]) : null;
            if (year !== notice.targetSquadron) return false;
          }
        }
      }
      return true;
    });

    // 2. Eventos Acadêmicos
    const groupedAcademicMap = new Map<string, any>();
    academicEvents.forEach((event) => {
      if (!isAdmin) {
        if (userProfile.role === "CADETE" && userProfile.squadron) {
          const userSquadron = userProfile.squadron.match(/(\d+)/)?.[1];
          if (
            event.targetSquadron &&
            event.targetSquadron !== "ALL" &&
            String(event.targetSquadron) !== userSquadron
          ) {
            return;
          }
        }
      }

      const title = event.location || "Evento Acadêmico";
      const description = event.description || "";
      const groupKey = `${title}|${description}|${event.targetSquadron}|${event.targetClass}`;

      if (groupedAcademicMap.has(groupKey)) {
        const existing = groupedAcademicMap.get(groupKey);
        if (event.date < existing.startDate) existing.startDate = event.date;
        if (event.date > existing.endDate) existing.endDate = event.date;
      } else {
        groupedAcademicMap.set(groupKey, {
          id: `acad-${event.id}`,
          title: `[CALENDÁRIO] ${title}`,
          description: description,
          type: "ACADEMIC",
          startDate: event.date,
          endDate: event.date,
          targetSquadron:
            event.targetSquadron === "ALL" ? undefined : event.targetSquadron,
          targetClass:
            event.targetClass === "ALL" ? undefined : event.targetClass,
          originalEvent: event,
        });
      }
    });

    const mappedAcademic = Array.from(groupedAcademicMap.values()).filter(
      (event) => {
        if (!event.endDate) return false;
        const [eYear, eMonth, eDay] = event.endDate.split("-").map(Number);
        const end = new Date(eYear, eMonth - 1, eDay);
        end.setHours(23, 59, 59, 999);
        return end >= nowLocal;
      },
    );

    const filteredAvisos = standardNotices.sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );

    const filteredCalendario = mappedAcademic
      .filter((item) => {
        if (
          filterSquadron !== "ALL" &&
          item.targetSquadron?.toString() !== filterSquadron
        )
          return false;
        if (filterClass !== "ALL" && item.targetClass !== filterClass)
          return false;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          if (
            !item.title.toLowerCase().includes(term) &&
            !item.description?.toLowerCase().includes(term)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    return { filteredAvisos, filteredCalendario };
  }, [
    notices,
    academicEvents,
    userProfile,
    filterSquadron,
    filterClass,
    searchTerm,
    nowLocal,
  ]);

  // Helpers
  const getEvaluationRingStyle = (event: ScheduleEvent) => {
    if (!visualConfigs) return null;
    const activeConfig = (visualConfigs as VisualConfig[])
      .filter((c) => c.active && c.ruleType === "EVALUATION")
      .sort((a, b) => b.priority - a.priority)
      .find(
        (c) => !c.evaluationType || c.evaluationType === event.evaluationType,
      );

    if (!activeConfig || !activeConfig.showRing) return null;
    const ringColor =
      theme === "light" && activeConfig.ringColor?.toLowerCase() === "#ffffff"
        ? "#cbd5e1"
        : activeConfig.ringColor;

    return {
      borderWidth: `${activeConfig.ringWidth || 2}px`,
      borderColor: ringColor,
      config: activeConfig,
    };
  };

  const getBadgeStyle = (classId: string) => {
    const COURSE_COLORS = {
      AVIATION: "#1e40af",
      INTENDANCY: "#d97706",
      INFANTRY: "#15803d",
    };
    const letter = classId.slice(-1).toUpperCase();
    if (["A", "B", "C", "D"].includes(letter)) return COURSE_COLORS.AVIATION;
    if (letter === "E") return COURSE_COLORS.INTENDANCY;
    if (letter === "F") return COURSE_COLORS.INFANTRY;

    const squadron = parseInt(classId.charAt(0));
    const entryYear = visualYear - squadron + 1;
    const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
    return cohort?.color
      ? COHORT_COLORS[cohort.color]?.dark || "#64748b"
      : "#64748b";
  };

  const visibleEvaluations = useMemo(() => {
    if (!userProfile) return [];
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userProfile.role);
    return evaluationEvents
      .filter((e) => {
        if (!isAdmin && userProfile.role === "CADETE" && userProfile.squadron) {
          const match = userProfile.squadron.match(/(\d+)/);
          if (match && !e.classId.startsWith(match[1])) return false;
        }
        if (filterSquadron !== "ALL" && !e.classId.startsWith(filterSquadron))
          return false;
        if (filterClass !== "ALL" && e.classId !== filterClass) return false;
        return true;
      })
      .slice(0, 5); // Limita para reduzir altura total da página
  }, [evaluationEvents, userProfile, filterSquadron, filterClass]);

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col space-y-4 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
        <div>
          <h1
            className={`text-3xl md:text-4xl font-bold tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}
          >
            Olá, {userName}.
          </h1>
        </div>
        <div
          className={`px-4 py-2 rounded-2xl border shadow-sm flex items-center gap-3 ${theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"}`}
        >
          <Calendar className="text-blue-500" size={20} />
          <span className="text-sm font-semibold uppercase tracking-wider tabular-nums">
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(
              new Date(),
            )}
          </span>
        </div>
      </div>

      <div
        className={`p-2 md:p-3 rounded-xl border flex-shrink-0 shadow-sm flex flex-col lg:flex-row gap-3 lg:gap-6 items-center ${theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"}`}
      >
        <div className="flex-1 w-full flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-slate-500 pl-1">
            Esquadrão:
          </span>
          <div className="flex gap-2 flex-1 overflow-x-auto custom-scrollbar">
            {["1", "2", "3", "4"].map((id) => {
              const isSelected = filterSquadron === id;
              const squadronYear = visualYear - parseInt(id) + 1;
              const cohort = cohorts.find(
                (c) => Number(c.entryYear) === squadronYear,
              );
              const style = cohort?.color
                ? {
                    backgroundColor: isSelected
                      ? COHORT_COLORS[cohort.color].primary
                      : theme === "dark"
                        ? "rgba(0,0,0,0.2)"
                        : COHORT_COLORS[cohort.color].light,
                    borderColor: COHORT_COLORS[cohort.color].primary,
                    color: isSelected
                      ? "#fff"
                      : COHORT_COLORS[cohort.color].dark,
                  }
                : {};

              return (
                <button
                  key={id}
                  onClick={() => {
                    setFilterSquadron(filterSquadron === id ? "ALL" : id);
                    setFilterClass("ALL");
                  }}
                  style={style}
                  className={`px-3 h-8 rounded-lg text-xs font-black border transition-all ${isSelected ? "shadow-md scale-105" : "opacity-80"}`}
                >
                  {id}º
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-8 pr-3 h-8 text-xs border rounded-lg w-full ${theme === "dark" ? "bg-slate-900/50 border-slate-800 text-slate-200" : "bg-white border-slate-200"}`}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Column 1: Avaliações */}
        <div className="flex flex-col space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <GraduationCap size={20} className="text-indigo-500" /> Avaliações
          </h3>
          <div className="flex flex-col gap-2">
            {visibleEvaluations.map((event) => {
              const disc = disciplines.find((d) => d.id === event.disciplineId);
              const ring = getEvaluationRingStyle(event);
              return (
                <div
                  key={event.id}
                  className={`rounded-xl border px-2.5 py-1.5 flex flex-col gap-1 transition-all hover:shadow-md ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}
                  style={{
                    borderLeft: `4px solid ${disc?.color || "#6366f1"}`,
                    ...(ring
                      ? {
                          borderWidth: ring.borderWidth,
                          borderColor: ring.borderColor,
                          borderLeftWidth: "4px",
                        }
                      : {}),
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      {formatDateForDisplay(event.date)}
                    </span>
                    <div className="flex gap-1">
                      <span
                        className="px-1.5 py-0.5 rounded text-[8px] font-black text-white"
                        style={{
                          backgroundColor: getBadgeStyle(event.classId),
                        }}
                      >
                        {formatClassId(event.classId)}
                      </span>
                    </div>
                  </div>
                  <h4 className="text-[11px] font-bold truncate">
                    {disc?.name || "Disciplina"}
                  </h4>
                  <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/30 pt-1">
                    <span className="text-[8px] font-bold text-slate-500 uppercase">
                      {event.instructorTrigram || disc?.instructorTrigram}
                    </span>
                    <span className="text-[8px] font-bold text-slate-500">
                      {disc?.location || "a definir"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2: Avisos */}
        <div className="flex flex-col space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Megaphone size={20} className="text-blue-500" /> Avisos
          </h3>
          <div className="flex flex-col gap-3">
            {filteredAvisos.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-3 flex flex-col gap-2 transition-all ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
                style={{
                  borderLeft: `6px solid ${item.type === "URGENT" ? "#ef4444" : "#64748b"}`,
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold">
                    {formatDateForDisplay(item.startDate)}
                  </span>
                  <Badge
                    variant={item.type === "URGENT" ? "red" : "slate"}
                    className="text-[8px]"
                  >
                    {formatNoticeType(item.type)}
                  </Badge>
                </div>
                <h4 className="text-xs font-bold leading-tight">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-500 whitespace-pre-wrap line-clamp-3">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Calendário */}
        <div className="flex flex-col space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Calendar size={20} className="text-emerald-500" /> Calendário
          </h3>
          <p className="text-[9px] font-bold uppercase opacity-40 -mt-2">
            Clique para detalhes
          </p>
          <div className="flex flex-col gap-3">
            {filteredCalendario.map((item) => (
              <div
                key={item.id}
                onClick={() =>
                  item.originalEvent && setSelectedEvent(item.originalEvent)
                }
                className={`rounded-xl border p-3 flex flex-col gap-2 cursor-pointer transition-all hover:border-emerald-500/30 ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
                style={{ borderLeft: "6px solid #10b981" }}
              >
                <span className="text-[10px] font-bold text-emerald-500">
                  {formatDateForDisplay(item.startDate)}
                </span>
                <h4 className="text-xs font-bold truncate">
                  {item.title.replace("[CALENDÁRIO] ", "")}
                </h4>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedEvent && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl p-6 relative ${theme === "dark" ? "bg-slate-900 border border-slate-700 text-slate-100" : "bg-white text-slate-900"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">{selectedEvent.location}</h2>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 mb-6">
              <p className="text-sm leading-relaxed">
                {selectedEvent.description || "Sem descrição adicional."}
              </p>
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase tracking-widest"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
