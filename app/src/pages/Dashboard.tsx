import { useEffect, useMemo, useState } from "react";
import { Calendar, Bell, BookOpen, AlertTriangle, Info, CalendarDays, Zap, Plus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { GanttView } from "../components/GanttView";
import { AcademicEventForm, getAcademicColor } from "../components/AcademicEventForm";
import { NoticeForm } from "../components/NoticeForm";
import { subscribeToEventsByDateRange, saveDocument } from "../services/supabaseService";
import { supabase } from "../config/supabase";
import { formatDate } from "../utils/dateUtils";
import type { ScheduleEvent, CourseYear, SystemNotice } from "../types";
import type { CohortColor } from "../types";
import { getCohortColorTokens } from "../utils/cohortColors";

const TODAY = formatDate(new Date());

const NOTICE_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  URGENT:     { bg: "bg-red-500/15 border-red-400/40",     text: "text-red-400",    icon: <AlertTriangle size={11} /> },
  WARNING:    { bg: "bg-amber-500/15 border-amber-400/40", text: "text-amber-400",  icon: <AlertTriangle size={11} /> },
  INFO:       { bg: "bg-blue-500/15 border-blue-400/40",   text: "text-blue-400",   icon: <Info size={11} /> },
  EVENT:      { bg: "bg-purple-500/15 border-purple-400/40",text: "text-purple-400",icon: <CalendarDays size={11} /> },
  EVALUATION: { bg: "bg-orange-500/15 border-orange-400/40",text: "text-orange-400",icon: <Zap size={11} /> },
  GENERAL:    { bg: "bg-slate-500/15 border-slate-400/40", text: "text-slate-400",  icon: <Info size={11} /> },
};

export const Dashboard = () => {
  const { userProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const {
    disciplines, notices, cohorts, classes: storeClasses,
    fetchYearlyEvents, dataReady, addNotice, addEvent,
  } = useCourseStore();

  const [todayEvents, setTodayEvents] = useState<ScheduleEvent[]>([]);
  const [yearlyEvents, setYearlyEvents] = useState<ScheduleEvent[]>([]);
  const [noticeFormSquadron, setNoticeFormSquadron] = useState<number | null>(null);
  const [academicFormSquadron, setAcademicFormSquadron] = useState<number | null>(null);
  const [editingAcademic, setEditingAcademic] = useState<ScheduleEvent | null>(null);

  const calendarYear = new Date().getFullYear();
  const canEdit = ["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role || "");

  useEffect(() => {
    if (!dataReady) return;
    const unsub = subscribeToEventsByDateRange(TODAY, TODAY, setTodayEvents);
    fetchYearlyEvents(calendarYear).then(setYearlyEvents);
    return unsub;
  }, [dataReady, calendarYear, fetchYearlyEvents]);

  const userName = userProfile?.displayName?.split(" ")[0] || "Usuário";

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

  const classesBySquadron = useMemo(() => {
    const result: Record<number, string[]> = {};
    for (const sq of [1, 2, 3, 4] as CourseYear[]) {
      const prefix = String(sq);
      const fromEvents = [...new Set(
        todayEvents
          .filter((e) => e.classId?.startsWith(prefix) && e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC")
          .map((e) => e.classId)
      )].sort();
      result[sq] = fromEvents.length > 0 ? fromEvents : ["A","B","C","D","E","F"].map((l) => `${sq}${l}`);
    }
    return result;
  }, [todayEvents]);

  const cohortTokens = useMemo(() => {
    const result: Record<number, ReturnType<typeof getCohortColorTokens>> = {};
    for (const sq of [1, 2, 3, 4]) {
      const entryYear = calendarYear - sq + 1;
      const cohort = cohorts.find((c) => Number(c.entryYear) === entryYear);
      result[sq] = getCohortColorTokens((cohort?.color || "blue") as CohortColor);
    }
    return result;
  }, [cohorts, calendarYear]);

  const squadronNotices = (sq: number) =>
    notices.filter((n) =>
      TODAY >= n.startDate && TODAY <= n.endDate &&
      (n.targetSquadron == null || Number(n.targetSquadron) === sq)
    );

  const squadronAcademic = (sq: number) =>
    todayEvents.filter((e) => {
      if (e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC") return false;
      const end = (e as any).endDate ?? e.date;
      if (TODAY < e.date || TODAY > end) return false;
      const ts = e.targetSquadron;
      return ts === "ALL" || ts == null || Number(ts) === sq;
    });

  const handleNoticeSubmit = (data: Partial<SystemNotice>) => {
    addNotice({
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: userProfile?.uid || "system",
    } as SystemNotice);
    setNoticeFormSquadron(null);
  };

  const handleAcademicSubmit = (data: Omit<ScheduleEvent, "id">) => {
    const id = crypto.randomUUID();
    const newEvent = { ...data, id };
    addEvent(newEvent);
    setTodayEvents((prev) => [...prev, newEvent]);
    const dbPayload: Record<string, any> = {
      id, date: data.date, startTime: data.startTime ?? null, endTime: data.endTime ?? null,
      description: data.description ?? null, notes: (data as any).notes ?? null,
      endDate: (data as any).endDate ?? null, location: data.location ?? null,
      targetSquadron: data.targetSquadron != null ? String(data.targetSquadron) : null,
      targetCourse: data.targetCourse ?? null, targetClass: data.targetClass ?? null,
      type: data.type ?? null, disciplineId: data.disciplineId, classId: data.classId, color: data.color ?? null,
    };
    saveDocument("programacao_aulas", id, dbPayload).catch((err) => console.error("[AcademicSave]", err));
    setAcademicFormSquadron(null);
  };

  const handleAcademicUpdate = (data: Omit<ScheduleEvent, "id">) => {
    if (!editingAcademic) return;
    const dbPayload: Record<string, any> = {
      date: data.date, startTime: data.startTime ?? null, endTime: data.endTime ?? null,
      description: data.description ?? null, notes: (data as any).notes ?? null,
      endDate: (data as any).endDate ?? null, location: data.location ?? null,
      targetSquadron: data.targetSquadron != null ? String(data.targetSquadron) : null,
      targetCourse: data.targetCourse ?? null, targetClass: data.targetClass ?? null,
      type: data.type ?? null, color: data.color ?? null,
    };
    const merged = { ...editingAcademic, ...data };
    setTodayEvents((prev) => prev.map((e) => e.id === editingAcademic.id ? merged : e));
    useCourseStore.setState((s) => ({
      events: s.events.map((e) => e.id === editingAcademic.id ? merged : e),
    }));
    supabase.functions
      .invoke("admin-manage-content", { body: { action: "update_event", id: editingAcademic.id, updates: dbPayload } })
      .then(({ error }) => { if (error) console.error("[AcademicUpdate]", error.message); });
    setEditingAcademic(null);
  };

  const handleAcademicDelete = (id: string) => {
    useCourseStore.getState().deleteEvent(id);
    setTodayEvents((prev) => prev.filter((e) => e.id !== id));
    setEditingAcademic(null);
  };

  const border    = isDark ? "border-slate-700" : "border-slate-200";
  const card      = isDark ? "bg-slate-800/60 border-slate-700" : "bg-white border-slate-200 shadow-sm";
  const muted     = isDark ? "text-slate-400" : "text-slate-500";
  const sidebarBg = isDark ? "bg-slate-900/60" : "bg-slate-50/80";

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

      {/* Gantt do dia — todos os esquadrões */}
      <div className={`rounded-xl border overflow-hidden ${card}`}>
        {([1, 2, 3, 4] as CourseYear[]).map((sq, idx) => {
          const tokens    = cohortTokens[sq];
          const notices_  = squadronNotices(sq);
          const academic_ = squadronAcademic(sq);
          const hasSidebar = notices_.length > 0 || academic_.length > 0 || canEdit;

          return (
            <div key={sq} className={idx > 0 ? `border-t ${border}` : ""}>
              {/* Cabeçalho */}
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
              </div>

              {/* Corpo: Gantt + Sidebar */}
              <div className="flex">
                <div className="flex-1 overflow-x-auto">
                  <GanttView
                    date={TODAY}
                    events={todayEvents}
                    disciplines={disciplines}
                    classes={classesBySquadron[sq]}
                    canEdit={false}
                    eventCounts={eventCounts}
                  />
                </div>

                {hasSidebar && (
                  <div className={`w-52 flex-shrink-0 border-l ${border} ${sidebarBg} flex flex-col gap-0`}>

                    {/* Avisos */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${muted}`}>
                          <Bell size={10} /> Avisos
                        </span>
                        {canEdit && (
                          <button
                            onClick={() => setNoticeFormSquadron(sq)}
                            className="text-[10px] text-blue-500 hover:text-blue-400 flex items-center gap-0.5 transition-colors"
                          >
                            <Plus size={10} /> Novo
                          </button>
                        )}
                      </div>
                      {notices_.length === 0 ? (
                        <p className={`text-[10px] italic ${muted} opacity-60`}>Sem avisos</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {notices_.map((n) => {
                            const style = NOTICE_STYLES[n.type] || NOTICE_STYLES.GENERAL;
                            return (
                              <div key={n.id} className={`rounded-lg border px-2 py-1.5 ${style.bg}`}>
                                <div className={`flex items-center gap-1 ${style.text} font-semibold text-[10px] leading-tight`}>
                                  {style.icon}
                                  <span className="truncate">{n.title}</span>
                                </div>
                                {n.description && (
                                  <p className={`text-[9px] leading-tight mt-0.5 ${muted} line-clamp-2`}>{n.description}</p>
                                )}
                                {n.startDate !== n.endDate && (
                                  <p className={`text-[8px] mt-0.5 ${muted} opacity-70`}>até {n.endDate}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className={`mx-3 border-t ${border}`} />

                    {/* Eventos acadêmicos */}
                    <div className="px-3 pt-2 pb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${muted}`}>
                          <BookOpen size={10} /> Eventos
                        </span>
                        {canEdit && (
                          <button
                            onClick={() => setAcademicFormSquadron(sq)}
                            className="text-[10px] text-purple-500 hover:text-purple-400 flex items-center gap-0.5 transition-colors"
                          >
                            <Plus size={10} /> Novo
                          </button>
                        )}
                      </div>
                      {academic_.length === 0 ? (
                        <p className={`text-[10px] italic ${muted} opacity-60`}>Sem eventos</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {academic_.map((ev) => {
                            const col = getAcademicColor(ev.targetSquadron, isDark);
                            return (
                              <div
                                key={ev.id}
                                className={`rounded-lg border ${col.border} ${col.bg} px-2 py-1.5 transition-colors ${canEdit ? `cursor-pointer ${col.hover}` : ""}`}
                                onClick={() => canEdit && setEditingAcademic(ev)}
                                title={canEdit ? "Clique para editar" : undefined}
                              >
                                <p className={`text-[10px] font-semibold leading-tight ${col.title}`}>
                                  {ev.description || ev.location || "Evento acadêmico"}
                                </p>
                                {(ev as any).notes && (
                                  <p className={`text-[9px] mt-0.5 leading-snug ${col.sub}`}>{(ev as any).notes}</p>
                                )}
                                {ev.startTime && (
                                  <p className={`text-[9px] mt-0.5 ${col.sub}`}>
                                    🕐 {ev.startTime}{ev.endTime && ev.endTime !== ev.startTime ? ` – ${ev.endTime}` : ""}
                                  </p>
                                )}
                                {ev.location && ev.description && (
                                  <p className={`text-[9px] ${col.sub}`}>📍 {ev.location}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Novo Aviso */}
      {noticeFormSquadron !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setNoticeFormSquadron(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg mx-4">
            <NoticeForm
              initialData={{ startDate: TODAY, endDate: TODAY, targetSquadron: noticeFormSquadron as CourseYear }}
              onSubmit={handleNoticeSubmit}
              onCancel={() => setNoticeFormSquadron(null)}
            />
          </div>
        </div>
      )}

      {/* Modal: Novo Evento Acadêmico */}
      {academicFormSquadron !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setAcademicFormSquadron(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg mx-4">
            <AcademicEventForm
              initialData={{ date: TODAY, type: "ACADEMIC", disciplineId: "ACADEMIC", classId: `${academicFormSquadron}ESQ`, targetSquadron: academicFormSquadron as unknown as CourseYear }}
              onSubmit={handleAcademicSubmit}
              onCancel={() => setAcademicFormSquadron(null)}
            />
          </div>
        </div>
      )}

      {/* Modal: Editar Evento Acadêmico */}
      {editingAcademic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setEditingAcademic(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg mx-4">
            <AcademicEventForm
              initialData={editingAcademic}
              onSubmit={handleAcademicUpdate}
              onDelete={handleAcademicDelete}
              onCancel={() => setEditingAcademic(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
