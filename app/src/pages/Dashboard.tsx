import { useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { GanttView } from "../components/GanttView";
import { getAcademicColor } from "../components/AcademicEventForm";
import { subscribeToEventsByDateRange } from "../services/supabaseService";
import { formatDate } from "../utils/dateUtils";
import type { ScheduleEvent, CourseYear } from "../types";
import type { CohortColor } from "../types";
import { getCohortColorTokens } from "../utils/cohortColors";

const TODAY = formatDate(new Date());

export const Dashboard = () => {
  const { userProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { disciplines, notices, cohorts, classes: storeClasses, fetchYearlyEvents, dataReady } = useCourseStore();

  const [todayEvents, setTodayEvents] = useState<ScheduleEvent[]>([]);
  const [yearlyEvents, setYearlyEvents] = useState<ScheduleEvent[]>([]);

  const calendarYear = new Date().getFullYear();

  useEffect(() => {
    if (!dataReady) return;
    const unsub = subscribeToEventsByDateRange(TODAY, TODAY, setTodayEvents);
    fetchYearlyEvents(calendarYear).then(setYearlyEvents);
    return unsub;
  }, [dataReady, calendarYear, fetchYearlyEvents]);

  const userName = userProfile?.displayName?.split(" ")[0] || "Usuário";

  // eventCounts (aula atual / total) para cada evento
  const eventCounts = useMemo(() => {
    const counts: Record<string, { current: number; total: number }> = {};
    const source = yearlyEvents.length > 0 ? yearlyEvents : todayEvents;
    const groupings: Record<string, ScheduleEvent[]> = {};
    source.forEach((ev) => {
      if (ev.type === "ACADEMIC" || ev.disciplineId === "ACADEMIC") return;
      const key = `${ev.disciplineId}|${ev.classId}`;
      if (!groupings[key]) groupings[key] = [];
      groupings[key].push(ev);
    });
    Object.values(groupings).forEach((group) => {
      const disc = disciplines.find((d) => d.id === group[0].disciplineId);
      const cls  = storeClasses.find((c) => c.id === group[0].classId);
      const pkKey = cls ? `${cls.type}_${cls.year}` : "";
      const total = (disc?.ppcLoads && pkKey && disc.ppcLoads[pkKey]) || disc?.load_hours || group.length;
      group
        .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
        .forEach((ev, i) => { counts[String(ev.id)] = { current: i + 1, total }; });
    });
    return counts;
  }, [yearlyEvents, todayEvents, disciplines, storeClasses]);

  // Classes por esquadrão
  const classesBySquadron = useMemo(() => {
    const result: Record<number, string[]> = {};
    for (const sq of [1, 2, 3, 4] as CourseYear[]) {
      const prefix = String(sq);
      const fromEvents = [...new Set(
        todayEvents.filter((e) => e.classId?.startsWith(prefix) && e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC")
          .map((e) => e.classId)
      )].sort();
      result[sq] = fromEvents.length > 0
        ? fromEvents
        : ["A","B","C","D","E","F"].map((l) => `${sq}${l}`);
    }
    return result;
  }, [todayEvents]);

  // Avisos de hoje (todos os esquadrões)
  const todayNotices = useMemo(() =>
    notices.filter((n) => TODAY >= n.startDate && TODAY <= n.endDate),
    [notices]
  );

  // Eventos acadêmicos de hoje (todos os esquadrões)
  const todayAcademic = useMemo(() =>
    todayEvents.filter((e) => {
      if (e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC") return false;
      const end = (e as any).endDate ?? e.date;
      return TODAY >= e.date && TODAY <= end;
    }),
    [todayEvents]
  );

  // Tokens de cor por esquadrão
  const cohortTokens = useMemo(() => {
    const result: Record<number, ReturnType<typeof getCohortColorTokens>> = {};
    for (const sq of [1, 2, 3, 4]) {
      const entryYear = calendarYear - sq + 1;
      const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
      result[sq] = getCohortColorTokens((cohort?.color || "blue") as CohortColor);
    }
    return result;
  }, [cohorts, calendarYear]);

  const border = isDark ? "border-slate-700" : "border-slate-200";
  const card   = isDark ? "bg-slate-800/60 border-slate-700" : "bg-white border-slate-200 shadow-sm";

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 max-w-[1800px] mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <h1 className={`text-3xl md:text-4xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
          Olá, {userName}.
        </h1>
        <div className={`px-4 py-2 rounded-2xl border shadow-sm flex items-center gap-3 ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"}`}>
          <Calendar className="text-blue-500" size={20} />
          <span className="text-sm font-semibold uppercase tracking-wider tabular-nums">
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date())}
          </span>
        </div>
      </div>

      {/* Avisos + Eventos acadêmicos de hoje */}
      {(todayNotices.length > 0 || todayAcademic.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {todayAcademic.map((ev) => {
            const col = getAcademicColor(ev.targetSquadron as any, isDark);
            return (
              <div
                key={ev.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold"
                style={{ background: col.bg, borderColor: col.border, color: col.title }}
              >
                <span>📅</span>
                <span>{ev.description || ev.location || "Evento Acadêmico"}</span>
                {ev.targetSquadron && ev.targetSquadron !== "ALL" && (
                  <span className="opacity-60">· {ev.targetSquadron}º Esq</span>
                )}
              </div>
            );
          })}
          {todayNotices.map((n) => (
            <div
              key={n.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                n.type === "URGENT"
                  ? "bg-red-500/10 border-red-400/40 text-red-600 dark:text-red-400"
                  : isDark ? "bg-slate-800 border-slate-600 text-slate-300" : "bg-slate-100 border-slate-300 text-slate-700"
              }`}
            >
              <span>{n.type === "URGENT" ? "🚨" : "📣"}</span>
              <span>{n.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Gantt do dia — todos os esquadrões */}
      <div className={`rounded-xl border overflow-hidden ${card}`}>
        {([1, 2, 3, 4] as CourseYear[]).map((sq, idx) => {
          const tokens = cohortTokens[sq];
          return (
            <div key={sq} className={idx > 0 ? `border-t ${border}` : ""}>
              {/* Cabeçalho do esquadrão */}
              <div
                className="px-4 py-1.5 flex items-center gap-2"
                style={{ background: isDark ? `${tokens.primary}22` : tokens.light }}
              >
                <span
                  className="text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                  style={{ background: tokens.primary, color: "#fff" }}
                >
                  {sq}º ESQ
                </span>
                {/* Avisos do esquadrão hoje */}
                {notices
                  .filter((n) => TODAY >= n.startDate && TODAY <= n.endDate && (n.targetSquadron == null || Number(n.targetSquadron) === sq))
                  .map((n) => (
                    <span
                      key={n.id}
                      title={n.description || ""}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border truncate max-w-[180px] ${
                        n.type === "URGENT"
                          ? "bg-red-500/20 text-red-500 border-red-400/40"
                          : isDark ? "bg-amber-500/20 text-amber-400 border-amber-400/30" : "bg-amber-100 text-amber-700 border-amber-300"
                      }`}
                    >
                      {n.type === "URGENT" ? "🚨 " : "📣 "}{n.title}
                    </span>
                  ))}
                {/* Eventos acadêmicos do esquadrão hoje */}
                {todayAcademic
                  .filter((e) => e.targetSquadron === "ALL" || e.targetSquadron == null || Number(e.targetSquadron) === sq)
                  .map((e) => {
                    const col = getAcademicColor(e.targetSquadron as any, isDark);
                    return (
                      <span
                        key={e.id}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border truncate max-w-[180px]"
                        style={{ background: col.bg, borderColor: col.border, color: col.title }}
                      >
                        📅 {e.description || e.location || "Evento"}
                        {e.startTime ? ` ${e.startTime}` : ""}
                      </span>
                    );
                  })}
              </div>

              {/* Grid do esquadrão */}
              <div className="overflow-x-auto">
                <GanttView
                  date={TODAY}
                  events={todayEvents}
                  disciplines={disciplines}
                  classes={classesBySquadron[sq]}
                  canEdit={false}
                  eventCounts={eventCounts}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
