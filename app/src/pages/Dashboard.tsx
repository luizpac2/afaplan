import { useAuth } from "../contexts/AuthContext";
import { formatClassId, formatNoticeType } from "../utils/formatters";
import { useTheme } from "../contexts/ThemeContext";
import { Megaphone, Search, Calendar, GraduationCap, ChevronRight, AlertCircle } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Badge } from "../components/common/Badge";

import { useCourseStore } from "../store/useCourseStore";
import { formatDateForDisplay } from "../utils/dateUtils";
import type { ScheduleEvent, VisualConfig } from "../types";
import { getCohortColorTokens } from "../utils/cohortColors";

export const Dashboard = () => {
  const { disciplines, notices, cohorts, visualConfigs, fetchYearlyEvents } =
    useCourseStore();
  const { userProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const visualYear = new Date().getFullYear();
  const selectedYear = visualYear;

  const [allYearEvents, setAllYearEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    Promise.all([
      fetchYearlyEvents(selectedYear),
      fetchYearlyEvents(selectedYear + 1),
    ]).then(([eventsThisYear, eventsNextYear]) => {
      setAllYearEvents([...eventsThisYear, ...eventsNextYear]);
    });
  }, [selectedYear, fetchYearlyEvents]);

  const evaluationEvents = useMemo(() => {
    return allYearEvents
      .filter((e) => e.type === "EVALUATION")
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allYearEvents]);

  const academicEvents = useMemo(() => {
    return allYearEvents
      .filter((e) => e.type === "ACADEMIC" || e.disciplineId === "ACADEMIC")
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allYearEvents]);

  const [filterSquadron, setFilterSquadron] = useState<string>("ALL");
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);

  const userName = userProfile?.displayName?.split(" ")[0] || "Usuário";
  const nowLocal = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { filteredAvisos, filteredCalendario } = useMemo(() => {
    if (!userProfile) return { filteredAvisos: [], filteredCalendario: [] };
    if (userProfile.role === "VISITANTE") return { filteredAvisos: [], filteredCalendario: [] };

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userProfile.role);
    const next30Days = new Date();
    next30Days.setDate(nowLocal.getDate() + 30);

    const standardNotices = notices.filter((notice) => {
      const [sYear, sMonth, sDay] = notice.startDate.split("-").map(Number);
      const start = new Date(sYear, sMonth - 1, sDay);
      const [eYear, eMonth, eDay] = notice.endDate.split("-").map(Number);
      const end = new Date(eYear, eMonth - 1, eDay);
      end.setHours(23, 59, 59, 999);
      if (end < nowLocal || start > next30Days) return false;
      if (!isAdmin) {
        if (notice.targetRoles && !notice.targetRoles.includes(userProfile.role)) return false;
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

    const groupedAcademicMap = new Map<string, any>();
    academicEvents.forEach((event) => {
      if (!isAdmin) {
        if (userProfile.role === "CADETE" && userProfile.squadron) {
          const userSquadron = userProfile.squadron.match(/(\d+)/)?.[1];
          if (event.targetSquadron && event.targetSquadron !== "ALL" && String(event.targetSquadron) !== userSquadron) {
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
          targetSquadron: event.targetSquadron === "ALL" ? undefined : event.targetSquadron,
          targetClass: event.targetClass === "ALL" ? undefined : event.targetClass,
          originalEvent: event,
        });
      }
    });

    const mappedAcademic = Array.from(groupedAcademicMap.values()).filter((event) => {
      const [eYear, eMonth, eDay] = event.endDate.split("-").map(Number);
      const end = new Date(eYear, eMonth - 1, eDay);
      end.setHours(23, 59, 59, 999);
      return end >= nowLocal;
    });

    const filteredAvisos = standardNotices.sort((a, b) => a.startDate.localeCompare(b.startDate));
    const filteredCalendario = mappedAcademic
      .filter((item) => {
        if (filterSquadron !== "ALL" && item.targetSquadron?.toString() !== filterSquadron) return false;
        if (filterClass !== "ALL" && item.targetClass !== filterClass) return false;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          if (!item.title.toLowerCase().includes(term) && !item.description?.toLowerCase().includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    return { filteredAvisos, filteredCalendario };
  }, [notices, academicEvents, userProfile, filterSquadron, filterClass, searchTerm, nowLocal]);

  const getEvaluationRingStyle = (event: ScheduleEvent) => {
    if (!visualConfigs) return null;
    const activeConfig = (visualConfigs as VisualConfig[])
      .filter((c) => c.active && c.ruleType === "EVALUATION")
      .sort((a, b) => b.priority - a.priority)
      .find((c) => !c.evaluationType || c.evaluationType === event.evaluationType);
    if (!activeConfig || !activeConfig.showRing) return null;
    const ringColor =
      theme === "light" && activeConfig.ringColor.toLowerCase() === "#ffffff"
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
      AVIATION: "#1e40af", INTENDANCY: "#d97706", INFANTRY: "#15803d",
    };
    const letter = classId.slice(-1).toUpperCase();
    if (["A", "B", "C", "D"].includes(letter)) return COURSE_COLORS.AVIATION;
    if (letter === "E") return COURSE_COLORS.INTENDANCY;
    if (letter === "F") return COURSE_COLORS.INFANTRY;
    const squadron = parseInt(classId.charAt(0));
    const entryYear = visualYear - squadron + 1;
    const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
    return cohort?.color ? getCohortColorTokens(cohort.color, theme)?.dark || "#64748b" : "#64748b";
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
        if (filterSquadron !== "ALL" && !e.classId.startsWith(filterSquadron)) return false;
        if (filterClass !== "ALL" && e.classId !== filterClass) return false;
        return true;
      })
      .slice(0, 6);
  }, [evaluationEvents, userProfile, filterSquadron, filterClass]);

  // ── Shared card styles ────────────────────────────────────
  const card = isDark
    ? "bg-slate-900 border border-slate-800"
    : "bg-white border border-slate-200 shadow-card";

  const sectionTitle = `text-sm font-semibold flex items-center gap-2 ${isDark ? "text-slate-200" : "text-slate-800"}`;

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 animate-fade-in">

      {/* ── GREETING ROW ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
            Olá, {userName}
          </h1>
          <p className={`text-sm mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
          </p>
        </div>

        {/* Filter bar */}
        <div className={`flex items-center gap-2 p-2 rounded-xl ${card}`}>
          {/* Squadron filter */}
          <div className="flex gap-1">
            {["1", "2", "3", "4"].map((id) => {
              const isSelected = filterSquadron === id;
              const squadronYear = visualYear - parseInt(id) + 1;
              const cohort = cohorts.find((c) => Number(c.entryYear) === squadronYear);
              const cohortColor = cohort?.color ? getCohortColorTokens(cohort.color, theme) : null;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setFilterSquadron(filterSquadron === id ? "ALL" : id);
                    setFilterClass("ALL");
                  }}
                  className={`w-9 h-8 rounded-lg text-xs font-bold border transition-all duration-150 flex-shrink-0 ${isSelected ? "shadow-sm scale-105" : "opacity-60 hover:opacity-90"}`}
                  style={cohortColor ? {
                    backgroundColor: isSelected ? cohortColor.primary : isDark ? "rgba(0,0,0,0.3)" : cohortColor.light,
                    borderColor: cohortColor.primary,
                    color: isSelected ? "#fff" : cohortColor.dark,
                  } : {}}
                >
                  {id}º
                </button>
              );
            })}
          </div>

          <div className={`w-px h-6 ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />

          {/* Search */}
          <div className="relative">
            <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-600" : "text-slate-400"}`} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-7 pr-3 h-8 text-xs rounded-lg w-40 border focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all
                ${isDark
                  ? "bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600"
                  : "bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400"
                }`}
            />
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Column 1: Avaliações ──────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className={sectionTitle}>
              <GraduationCap size={16} className="text-violet-500" />
              Avaliações
            </h3>
            {visibleEvaluations.length > 0 && (
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${isDark ? "bg-violet-900/30 text-violet-400" : "bg-violet-50 text-violet-600"}`}>
                {visibleEvaluations.length}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {visibleEvaluations.length === 0 ? (
              <div className={`rounded-xl p-6 text-center ${card}`}>
                <GraduationCap size={24} className={`mx-auto mb-2 ${isDark ? "text-slate-700" : "text-slate-300"}`} />
                <p className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>Nenhuma avaliação próxima</p>
              </div>
            ) : (
              visibleEvaluations.map((event) => {
                const disc = disciplines.find((d) => d.id === event.disciplineId);
                const ring = getEvaluationRingStyle(event);
                const accentColor = disc?.color || "#6366f1";
                return (
                  <div
                    key={event.id}
                    className={`rounded-xl p-3 flex flex-col gap-2 transition-all duration-150 hover:shadow-card-md ${card}`}
                    style={{
                      borderLeftWidth: "3px",
                      borderLeftColor: accentColor,
                      ...(ring ? { borderWidth: ring.borderWidth, borderColor: ring.borderColor, borderLeftWidth: "3px" } : {}),
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
                        {formatDateForDisplay(event.date)}
                      </span>
                      <span
                        className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ backgroundColor: getBadgeStyle(event.classId) }}
                      >
                        {formatClassId(event.classId)}
                      </span>
                    </div>
                    <p className={`text-xs font-semibold truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {disc?.name || "Disciplina"}
                    </p>
                    <div className={`flex items-center justify-between pt-1.5 border-t text-[10px] font-medium ${isDark ? "border-slate-800 text-slate-600" : "border-slate-100 text-slate-400"}`}>
                      <span>{event.instructorTrigram || disc?.instructorTrigram || "—"}</span>
                      <span>{disc?.location || "a definir"}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Column 2: Avisos ──────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className={sectionTitle}>
              <Megaphone size={16} className="text-blue-500" />
              Avisos
            </h3>
            {filteredAvisos.length > 0 && (
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${isDark ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                {filteredAvisos.length}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {filteredAvisos.length === 0 ? (
              <div className={`rounded-xl p-6 text-center ${card}`}>
                <Megaphone size={24} className={`mx-auto mb-2 ${isDark ? "text-slate-700" : "text-slate-300"}`} />
                <p className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>Nenhum aviso ativo</p>
              </div>
            ) : (
              filteredAvisos.map((item) => {
                const isUrgent = item.type === "URGENT";
                const accentColor = isUrgent ? "#ef4444" : "#64748b";
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-3 flex flex-col gap-2 transition-all duration-150 ${card}`}
                    style={{ borderLeftWidth: "3px", borderLeftColor: accentColor }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {formatDateForDisplay(item.startDate)}
                      </span>
                      <Badge variant={isUrgent ? "red" : "slate"} className="text-[9px]">
                        {formatNoticeType(item.type)}
                      </Badge>
                    </div>
                    <p className={`text-xs font-semibold leading-snug ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {item.title}
                    </p>
                    <p className={`text-[11px] leading-relaxed line-clamp-3 ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                      {item.description}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Column 3: Calendário ─────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className={sectionTitle}>
              <Calendar size={16} className="text-emerald-500" />
              Calendário
            </h3>
            {filteredCalendario.length > 0 && (
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${isDark ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                {filteredCalendario.length}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {filteredCalendario.length === 0 ? (
              <div className={`rounded-xl p-6 text-center ${card}`}>
                <Calendar size={24} className={`mx-auto mb-2 ${isDark ? "text-slate-700" : "text-slate-300"}`} />
                <p className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>Nenhum evento no período</p>
              </div>
            ) : (
              filteredCalendario.map((item) => (
                <button
                  key={item.id}
                  onClick={() => item.originalEvent && setSelectedEvent(item.originalEvent)}
                  className={`group w-full text-left rounded-xl p-3 flex items-start gap-3 transition-all duration-150 hover:shadow-card-md ${card} ${item.originalEvent ? "cursor-pointer hover:border-emerald-400/60 dark:hover:border-emerald-600/40" : ""}`}
                  style={{ borderLeftWidth: "3px", borderLeftColor: "#10b981" }}
                >
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-semibold ${isDark ? "text-emerald-500" : "text-emerald-600"}`}>
                      {formatDateForDisplay(item.startDate)}
                    </span>
                    <p className={`text-xs font-semibold mt-0.5 truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {item.title.replace("[CALENDÁRIO] ", "")}
                    </p>
                  </div>
                  {item.originalEvent && (
                    <ChevronRight size={14} className={`flex-shrink-0 mt-0.5 transition-transform duration-150 group-hover:translate-x-0.5 ${isDark ? "text-slate-700" : "text-slate-300"}`} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── EVENT DETAIL MODAL ───────────────────────────── */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-6 shadow-card-lg animate-scale-in ${isDark ? "bg-slate-900 border border-slate-700" : "bg-white border border-slate-200"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-lg ${isDark ? "bg-emerald-900/30" : "bg-emerald-50"}`}>
                <Calendar size={18} className="text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  Evento Acadêmico
                </p>
                <h2 className={`text-base font-bold leading-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {selectedEvent.location}
                </h2>
              </div>
            </div>

            <div className={`p-4 rounded-xl mb-5 ${isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-50 border border-slate-100"}`}>
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className={`mt-0.5 flex-shrink-0 ${isDark ? "text-slate-600" : "text-slate-400"}`} />
                <p className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {selectedEvent.description || "Sem descrição adicional."}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
