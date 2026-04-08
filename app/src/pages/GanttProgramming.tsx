import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, MousePointer2, Link2, Trash2, X,
  Plus, Bell, CalendarDays, AlertTriangle, Info, Zap, BookOpen,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToEventsByDateRange } from "../services/supabaseService";
import { GanttView } from "../components/GanttView";
import { EventForm } from "../components/EventForm";
import { AcademicEventForm } from "../components/AcademicEventForm";
import { NoticeForm } from "../components/NoticeForm";
import { LinkChangeRequestModal } from "../components/LinkChangeRequestModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  getStartOfWeek, addDays, formatDate, getWeekDays, formatDateForDisplay,
} from "../utils/dateUtils";
import { TIME_SLOTS } from "../utils/constants";
import type { ScheduleEvent, CourseYear, SystemNotice } from "../types";
import { getCohortColorTokens } from "../utils/cohortColors";
import type { CohortColor } from "../types";

const DAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const NOTICE_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  URGENT:     { bg: "bg-red-500/15 border-red-400/40",    text: "text-red-400",    icon: <AlertTriangle size={11} /> },
  WARNING:    { bg: "bg-amber-500/15 border-amber-400/40", text: "text-amber-400",  icon: <AlertTriangle size={11} /> },
  INFO:       { bg: "bg-blue-500/15 border-blue-400/40",   text: "text-blue-400",   icon: <Info size={11} /> },
  EVENT:      { bg: "bg-purple-500/15 border-purple-400/40",text: "text-purple-400",icon: <CalendarDays size={11} /> },
  EVALUATION: { bg: "bg-orange-500/15 border-orange-400/40",text: "text-orange-400",icon: <Zap size={11} /> },
  GENERAL:    { bg: "bg-slate-500/15 border-slate-400/40", text: "text-slate-400",  icon: <Info size={11} /> },
};

export const GanttProgramming = () => {
  const { squadronId } = useParams<{ squadronId: string }>();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { userProfile } = useAuth();

  const {
    disciplines, classes, cohorts, notices,
    updateEvent, deleteBatchEvents, addNotice, addEvent, dataReady,
    fetchYearlyEvents,
  } = useCourseStore();

  const currentSquadron = useMemo(() => {
    const id = parseInt(squadronId || "1");
    return (id >= 1 && id <= 4 ? id : 1) as CourseYear;
  }, [squadronId]);

  const canEdit = useMemo(
    () => ["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role || ""),
    [userProfile]
  );

  const dateParam = searchParams.get("date");
  const [currentDate, setCurrentDate] = useState(() => {
    if (dateParam) {
      const d = new Date(dateParam + "T12:00:00");
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  const [weekEvents, setWeekEvents]   = useState<ScheduleEvent[]>([]);
  const [yearlyEvents, setYearlyEvents] = useState<ScheduleEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calendarYear] = useState(new Date().getFullYear());

  // ── Selection mode ────────────────────────────────────────────────────────
  const [isSelectionMode, setIsSelectionMode]   = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen]   = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // ── Sidebar: notice / event creation / editing ───────────────────────────
  const [noticeFormDate, setNoticeFormDate]       = useState<string | null>(null);
  const [academicFormDate, setAcademicFormDate]   = useState<string | null>(null);
  const [editingAcademic, setEditingAcademic]     = useState<ScheduleEvent | null>(null);

  const startOfWeek = getStartOfWeek(currentDate);
  const weekDays    = getWeekDays(startOfWeek);
  const startDayStr = formatDate(startOfWeek);
  const endDayStr   = formatDate(addDays(startOfWeek, 6));

  useEffect(() => {
    if (!dataReady) return;
    const unsub = subscribeToEventsByDateRange(startDayStr, endDayStr, (data) => {
      setWeekEvents(data as ScheduleEvent[]);
    });
    return () => unsub();
  }, [startDayStr, endDayStr, dataReady]);

  useEffect(() => {
    if (!dataReady) return;
    fetchYearlyEvents(calendarYear).then(setYearlyEvents);
  }, [dataReady, calendarYear, fetchYearlyEvents]);

  // ── eventCounts ───────────────────────────────────────────────────────────
  const eventCounts = useMemo(() => {
    const counts: Record<string, { current: number; total: number }> = {};
    const source = yearlyEvents.length > 0 ? yearlyEvents : weekEvents;
    const groupings: Record<string, ScheduleEvent[]> = {};
    source.forEach((ev) => {
      if (ev.type === "ACADEMIC" || ev.disciplineId === "ACADEMIC") return;
      if (new Date(ev.date).getFullYear() !== calendarYear) return;
      const key = `${ev.disciplineId}|${ev.classId}`;
      if (!groupings[key]) groupings[key] = [];
      groupings[key].push(ev);
    });
    Object.values(groupings).forEach((group) => {
      const disc = disciplines.find((d) => d.id === group[0].disciplineId);
      const cls  = classes.find((c) => c.id === group[0].classId);
      const pkKey = cls ? `${cls.type}_${cls.year}` : "";
      const total = (disc?.ppcLoads && pkKey && disc.ppcLoads[pkKey]) || disc?.load_hours || group.length;
      group
        .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
        .forEach((ev, i) => { counts[String(ev.id)] = { current: i + 1, total }; });
    });
    return counts;
  }, [yearlyEvents, weekEvents, calendarYear, disciplines, classes]);

  const squadronClasses = useMemo(() => {
    const prefix = String(currentSquadron);
    const fromEvents = [...new Set(weekEvents.filter((e) => e.classId?.startsWith(prefix)).map((e) => e.classId))].sort();
    if (fromEvents.length) return fromEvents;
    return ["A","B","C","D","E","F"].map((l) => `${currentSquadron}${l}`);
  }, [weekEvents, currentSquadron]);

  const cohortColorTokens = useMemo(() => {
    const targetEntryYear = calendarYear - currentSquadron + 1;
    const cohort = cohorts.find((c) => Number(c.entryYear) === targetEntryYear);
    return getCohortColorTokens((cohort?.color || "blue") as CohortColor);
  }, [cohorts, calendarYear, currentSquadron]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleEventClick = (ev: ScheduleEvent) => {
    if (!canEdit) return;
    setEditingEvent(ev);
    setIsModalOpen(true);
  };

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const handleSlotDrop = (ev: ScheduleEvent, newSlotIndex: number) => {
    const newSlot = TIME_SLOTS[newSlotIndex];
    if (!newSlot) return;
    updateEvent(ev.id, { startTime: newSlot.start, endTime: newSlot.end });
  };

  const handleBatchDelete = () => {
    if (selectedEventIds.length) deleteBatchEvents(selectedEventIds);
    setIsDeleteConfirmOpen(false);
    setIsSelectionMode(false);
    setSelectedEventIds([]);
  };

  const handleNoticeSubmit = (data: Partial<SystemNotice>) => {
    addNotice({
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: userProfile?.uid || "system",
    } as SystemNotice);
    setNoticeFormDate(null);
  };

  const handleAcademicSubmit = (data: Omit<ScheduleEvent, "id">) => {
    const newEvent = { ...data, id: crypto.randomUUID() };
    addEvent(newEvent);
    setWeekEvents((prev) => [...prev, newEvent]);
    setAcademicFormDate(null);
  };

  const handleAcademicUpdate = (data: Omit<ScheduleEvent, "id">) => {
    if (!editingAcademic) return;
    updateEvent(editingAcademic.id, data);
    // Atualiza weekEvents localmente para refletir imediatamente sem aguardar realtime
    setWeekEvents((prev) =>
      prev.map((e) => e.id === editingAcademic.id ? { ...e, ...data } : e)
    );
    setEditingAcademic(null);
  };

  const handleAcademicDelete = (id: string) => {
    useCourseStore.getState().deleteEvent(id);
    setWeekEvents((prev) => prev.filter((e) => e.id !== id));
    setEditingAcademic(null);
  };

  // ── Sidebar notices & academic events per day ─────────────────────────────
  const dayNotices = (dateStr: string) =>
    notices.filter((n) => {
      if (dateStr < n.startDate || dateStr > n.endDate) return false;
      if (n.targetSquadron && Number(n.targetSquadron) !== currentSquadron) return false;
      return true;
    });

  const dayAcademic = (dateStr: string) =>
    weekEvents.filter((e) => {
      if (e.date !== dateStr) return false;
      if (e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC") return false;
      // Filtra por esquadrão: "ALL" ou null/undefined aparece em todos; número específico só no esquadrão correspondente
      const ts = e.targetSquadron;
      if (ts !== "ALL" && ts != null && Number(ts) !== currentSquadron) return false;
      return true;
    });

  const today  = formatDate(new Date());
  const card   = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-sm";
  const text   = isDark ? "text-slate-100" : "text-slate-800";
  const muted  = isDark ? "text-slate-400" : "text-slate-500";
  const border = isDark ? "border-slate-700" : "border-slate-200";
  const sidebarBg = isDark ? "bg-slate-900/60" : "bg-slate-50/80";

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4 max-w-[1600px] mx-auto">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border ${card}`}>
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: cohortColorTokens.primary }} />
          <div>
            <h1 className={`text-base font-bold ${text}`}>{currentSquadron}º Esquadrão — Gantt Semanal</h1>
            <p className={`text-xs ${muted}`}>
              {formatDateForDisplay(formatDate(startOfWeek))} – {formatDateForDisplay(formatDate(addDays(startOfWeek, 4)))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && !isSelectionMode && (
            <button
              onClick={() => setIsSelectionMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-blue-400 ${text}`}
            >
              <MousePointer2 size={13} /> Selecionar
            </button>
          )}
          {canEdit && isSelectionMode && (
            <div className="flex items-center gap-2">
              <span className={`text-xs ${muted}`}>{selectedEventIds.length} selecionado(s)</span>
              <button onClick={() => setIsLinkModalOpen(true)} disabled={selectedEventIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-blue-600 border-blue-400 hover:bg-blue-500/10 disabled:opacity-40 transition-colors">
                <Link2 size={13} /> SAP
              </button>
              <button onClick={() => setIsDeleteConfirmOpen(true)} disabled={selectedEventIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-red-500 border-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors">
                <Trash2 size={13} /> Excluir
              </button>
              <button onClick={() => { setIsSelectionMode(false); setSelectedEventIds([]); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-slate-400 ${muted}`}>
                <X size={13} /> Cancelar
              </button>
            </div>
          )}
          <button onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className={`p-2 rounded-lg border transition-colors ${card} hover:border-blue-400`}>
            <ChevronLeft size={16} className={muted} />
          </button>
          <button onClick={() => setCurrentDate(new Date())}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-blue-400 ${text}`}>
            Hoje
          </button>
          <button onClick={() => setCurrentDate(addDays(currentDate, 7))}
            className={`p-2 rounded-lg border transition-colors ${card} hover:border-blue-400`}>
            <ChevronRight size={16} className={muted} />
          </button>
        </div>
      </div>

      {/* ── One card per work day ──────────────────────────────────────────── */}
      {weekDays.slice(0, 5).map((day, i) => {
        if (!day) return null;
        const dateStr  = formatDate(day);
        const isToday  = dateStr === today;
        const dayNum   = day.getDate();
        const monthShort = day.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
        const notices_  = dayNotices(dateStr);
        const academic_ = dayAcademic(dateStr);
        const hasSidebar = notices_.length > 0 || academic_.length > 0 || canEdit;

        return (
          <div key={dateStr}
            className={`rounded-xl border overflow-hidden ${card} ${isToday ? "ring-2 ring-blue-500/40" : ""}`}>

            {/* Day header */}
            <div className={`flex items-center gap-3 px-4 py-2 border-b ${border} ${isToday ? (isDark ? "bg-blue-900/20" : "bg-blue-50/50") : ""}`}>
              <span className={`text-xs font-semibold uppercase ${isToday ? "text-blue-500" : muted}`}>{DAYS_SHORT[i]}</span>
              <span className={`text-sm font-bold ${isToday ? "text-blue-500" : text}`}>{dayNum} {monthShort}.</span>
              {isToday && <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">HOJE</span>}
              <span className={`text-xs ${muted}`}>
                {weekEvents.filter(e => e.date === dateStr && e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC").length} aula(s)
              </span>
              {notices_.length > 0 && (
                <div className="flex gap-1 ml-auto">
                  {notices_.slice(0, 3).map((n) => (
                    <span key={n.id} title={n.description}
                      className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">
                      {n.title}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Body: Gantt + Sidebar */}
            <div className="flex">
              {/* Gantt */}
              <div className="flex-1 overflow-hidden px-3 py-2">
                <GanttView
                  date={dateStr}
                  events={weekEvents}
                  disciplines={disciplines}
                  classes={squadronClasses}
                  onEventClick={handleEventClick}
                  eventCounts={eventCounts}
                  canEdit={canEdit}
                  selectedEventIds={selectedEventIds}
                  onSelectEvent={handleSelectEvent}
                  isSelectionMode={isSelectionMode}
                  onSlotDrop={handleSlotDrop}
                />
              </div>

              {/* Sidebar */}
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
                          onClick={() => setNoticeFormDate(dateStr)}
                          className="text-[10px] text-blue-500 hover:text-blue-400 flex items-center gap-0.5 transition-colors"
                          title="Criar aviso"
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
                            <div key={n.id}
                              className={`rounded-lg border px-2 py-1.5 ${style.bg}`}>
                              <div className={`flex items-center gap-1 ${style.text} font-semibold text-[10px] leading-tight`}>
                                {style.icon}
                                <span className="truncate">{n.title}</span>
                              </div>
                              {n.description && (
                                <p className={`text-[9px] leading-tight mt-0.5 ${muted} line-clamp-2`}>
                                  {n.description}
                                </p>
                              )}
                              {n.startDate !== n.endDate && (
                                <p className={`text-[8px] mt-0.5 ${muted} opacity-70`}>
                                  até {n.endDate}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className={`mx-3 border-t ${border}`} />

                  {/* Eventos do dia (ACADEMIC) */}
                  <div className="px-3 pt-2 pb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${muted}`}>
                        <BookOpen size={10} /> Eventos
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => setAcademicFormDate(dateStr)}
                          className="text-[10px] text-purple-500 hover:text-purple-400 flex items-center gap-0.5 transition-colors"
                          title="Criar evento acadêmico"
                        >
                          <Plus size={10} /> Novo
                        </button>
                      )}
                    </div>

                    {academic_.length === 0 ? (
                      <p className={`text-[10px] italic ${muted} opacity-60`}>Sem eventos</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {academic_.map((ev) => (
                          <div
                            key={ev.id}
                            className={`rounded-lg border border-purple-400/30 bg-purple-500/10 px-2 py-1.5 transition-colors ${canEdit ? "cursor-pointer hover:bg-purple-500/20 hover:border-purple-400/60" : ""}`}
                            onClick={() => canEdit && setEditingAcademic(ev)}
                            title={canEdit ? "Clique para editar" : undefined}
                          >
                            <p className="text-[10px] font-semibold text-purple-300 leading-tight">
                              {ev.description || "Evento acadêmico"}
                            </p>
                            {ev.startTime && (
                              <p className={`text-[9px] mt-0.5 flex items-center gap-0.5 ${muted}`}>
                                🕐 {ev.startTime}{ev.endTime && ev.endTime !== ev.startTime ? ` – ${ev.endTime}` : ""}
                              </p>
                            )}
                            {ev.location && (
                              <p className={`text-[9px] flex items-center gap-0.5 ${muted}`}>
                                📍 {ev.location}
                              </p>
                            )}
                            {canEdit && (
                              <p className="text-[8px] text-purple-500/60 mt-0.5">toque para editar</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      {disciplines.length > 0 && (() => {
        const usedIds   = new Set(weekEvents.map((e) => e.disciplineId));
        const usedDiscs = disciplines.filter((d) => usedIds.has(d.id));
        if (!usedDiscs.length) return null;
        return (
          <div className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${muted}`}>Legenda</p>
            <div className="flex flex-wrap gap-2">
              {usedDiscs.map((d) => (
                <div key={d.id} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className={`text-[10px] ${muted}`}>{d.code} — {d.name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Edição de aula */}
      {isModalOpen && editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { setIsModalOpen(false); setEditingEvent(undefined); }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg mx-4">
            <EventForm
              initialData={editingEvent}
              onSubmit={(data) => { updateEvent(editingEvent.id, data); setIsModalOpen(false); setEditingEvent(undefined); }}
              onDelete={(id) => { useCourseStore.getState().deleteEvent(id); setIsModalOpen(false); setEditingEvent(undefined); }}
              onCancel={() => { setIsModalOpen(false); setEditingEvent(undefined); }}
            />
          </div>
        </div>
      )}

      {/* Criação de aviso */}
      {noticeFormDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setNoticeFormDate(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg mx-4">
            <NoticeForm
              initialData={{
                startDate: noticeFormDate,
                endDate: noticeFormDate,
                targetSquadron: currentSquadron,
                targetRoles: ["CADETE", "DOCENTE", "ADMIN", "SUPER_ADMIN"] as any,
              }}
              onSubmit={handleNoticeSubmit}
              onCancel={() => setNoticeFormDate(null)}
            />
          </div>
        </div>
      )}

      {/* Criação de evento acadêmico */}
      {academicFormDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setAcademicFormDate(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md mx-4">
            <AcademicEventForm
              initialData={{
                date: academicFormDate,
                type: "ACADEMIC" as any,
                disciplineId: "ACADEMIC",
                classId: `${currentSquadron}ESQ`,
                targetSquadron: currentSquadron,
                startTime: "",   // vazio = dia inteiro por padrão
                endTime: "",
              }}
              onSubmit={handleAcademicSubmit}
              onCancel={() => setAcademicFormDate(null)}
            />
          </div>
        </div>
      )}

      {/* Edição de evento acadêmico */}
      {editingAcademic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setEditingAcademic(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md mx-4">
            <AcademicEventForm
              initialData={editingAcademic}
              onSubmit={handleAcademicUpdate}
              onDelete={handleAcademicDelete}
              onCancel={() => setEditingAcademic(null)}
            />
          </div>
        </div>
      )}

      {/* SAP Link */}
      {isLinkModalOpen && (
        <LinkChangeRequestModal selectedEventIds={selectedEventIds} onClose={() => setIsLinkModalOpen(false)} />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Excluir aulas selecionadas"
        message={`Deseja excluir ${selectedEventIds.length} aula(s) selecionada(s)? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleBatchDelete}
        type="danger"
      />
    </div>
  );
};
