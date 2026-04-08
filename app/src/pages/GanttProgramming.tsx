import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, MousePointer2, Link2, Trash2, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useCourseStore } from "../store/useCourseStore";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToEventsByDateRange } from "../services/supabaseService";
import { GanttView } from "../components/GanttView";
import { EventForm } from "../components/EventForm";
import { LinkChangeRequestModal } from "../components/LinkChangeRequestModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  getStartOfWeek, addDays, formatDate, getWeekDays, formatDateForDisplay,
} from "../utils/dateUtils";
import { TIME_SLOTS } from "../utils/constants";
import type { ScheduleEvent, CourseYear } from "../types";
import { getCohortColorTokens } from "../utils/cohortColors";
import type { CohortColor } from "../types";

const DAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const GanttProgramming = () => {
  const { squadronId } = useParams<{ squadronId: string }>();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { userProfile } = useAuth();

  const {
    disciplines, classes, cohorts, notices,
    updateEvent, deleteBatchEvents, dataReady,
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

  const [weekEvents, setWeekEvents] = useState<ScheduleEvent[]>([]);
  const [yearlyEvents, setYearlyEvents] = useState<ScheduleEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calendarYear] = useState(new Date().getFullYear());

  // ── Selection / edit mode ────────────────────────────────────────────────────
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

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

  // ── eventCounts ──────────────────────────────────────────────────────────────
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
      const total =
        (disc?.ppcLoads && pkKey && disc.ppcLoads[pkKey]) ||
        disc?.load_hours ||
        group.length;
      group
        .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
        .forEach((ev, i) => { counts[String(ev.id)] = { current: i + 1, total }; });
    });
    return counts;
  }, [yearlyEvents, weekEvents, calendarYear, disciplines, classes]);

  // ── Classes for this squadron ────────────────────────────────────────────────
  const squadronClasses = useMemo(() => {
    const prefix = String(currentSquadron);
    const fromEvents = [...new Set(weekEvents
      .filter((e) => e.classId?.startsWith(prefix))
      .map((e) => e.classId))].sort();
    if (fromEvents.length) return fromEvents;
    return ["A","B","C","D","E","F"].map((l) => `${currentSquadron}${l}`);
  }, [weekEvents, currentSquadron]);

  // ── Cohort color ─────────────────────────────────────────────────────────────
  const cohortColorTokens = useMemo(() => {
    const targetEntryYear = calendarYear - currentSquadron + 1;
    const cohort = cohorts.find((c) => Number(c.entryYear) === targetEntryYear);
    return getCohortColorTokens((cohort?.color || "blue") as CohortColor);
  }, [cohorts, calendarYear, currentSquadron]);

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

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedEventIds([]);
  };

  const today = formatDate(new Date());

  const card   = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-sm";
  const text   = isDark ? "text-slate-100" : "text-slate-800";
  const muted  = isDark ? "text-slate-400" : "text-slate-500";
  const border = isDark ? "border-slate-700" : "border-slate-200";

  // ── Notices for the week ─────────────────────────────────────────────────────
  const weekNotices = useMemo(() => {
    return notices.filter((n) => {
      return weekDays.some((d) => {
        if (!d) return false;
        const ds = formatDate(d);
        return ds >= n.startDate && ds <= n.endDate;
      });
    });
  }, [notices, weekDays]);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4 max-w-[1400px] mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border ${card}`}>
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-8 rounded-full"
            style={{ backgroundColor: cohortColorTokens.primary }}
          />
          <div>
            <h1 className={`text-base font-bold ${text}`}>
              {currentSquadron}º Esquadrão — Gantt Semanal
            </h1>
            <p className={`text-xs ${muted}`}>
              {formatDateForDisplay(formatDate(startOfWeek))} – {formatDateForDisplay(formatDate(addDays(startOfWeek, 4)))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin toolbar */}
          {canEdit && !isSelectionMode && (
            <button
              onClick={() => setIsSelectionMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-blue-400 ${text}`}
            >
              <MousePointer2 size={13} />
              Selecionar
            </button>
          )}

          {canEdit && isSelectionMode && (
            <div className="flex items-center gap-2">
              <span className={`text-xs ${muted}`}>{selectedEventIds.length} selecionado(s)</span>
              <button
                onClick={() => setIsLinkModalOpen(true)}
                disabled={selectedEventIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-blue-600 border-blue-400 hover:bg-blue-500/10 disabled:opacity-40 transition-colors"
              >
                <Link2 size={13} />
                SAP
              </button>
              <button
                onClick={() => setIsDeleteConfirmOpen(true)}
                disabled={selectedEventIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-red-500 border-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
              >
                <Trash2 size={13} />
                Excluir
              </button>
              <button
                onClick={exitSelectionMode}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-slate-400 ${muted}`}
              >
                <X size={13} />
                Cancelar
              </button>
            </div>
          )}

          {/* Navigation */}
          <button
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className={`p-2 rounded-lg border transition-colors ${card} hover:border-blue-400`}
          >
            <ChevronLeft size={16} className={muted} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${card} hover:border-blue-400 ${text}`}
          >
            Hoje
          </button>
          <button
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
            className={`p-2 rounded-lg border transition-colors ${card} hover:border-blue-400`}
          >
            <ChevronRight size={16} className={muted} />
          </button>
        </div>
      </div>

      {/* ── One Gantt per work day ──────────────────────────────────────────── */}
      {weekDays.slice(0, 5).map((day, i) => {
        if (!day) return null;
        const dateStr = formatDate(day);
        const isToday = dateStr === today;
        const dayEvents = weekEvents.filter((e) => e.date === dateStr);
        const dayNum = day.getDate();
        const monthShort = day.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

        const dayNotices = weekNotices.filter(
          (n) => dateStr >= n.startDate && dateStr <= n.endDate
        );

        return (
          <div
            key={dateStr}
            className={`rounded-xl border overflow-hidden ${card} ${isToday ? "ring-2 ring-blue-500/40" : ""}`}
          >
            {/* Day header */}
            <div className={`flex items-center gap-3 px-4 py-2 border-b ${border} ${isToday ? (isDark ? "bg-blue-900/20" : "bg-blue-50/50") : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold uppercase ${isToday ? "text-blue-500" : muted}`}>
                  {DAYS_SHORT[i]}
                </span>
                <span className={`text-sm font-bold ${isToday ? "text-blue-500" : text}`}>
                  {dayNum} {monthShort}.
                </span>
                {isToday && (
                  <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                    HOJE
                  </span>
                )}
              </div>
              <span className={`text-xs ${muted}`}>
                {dayEvents.filter(e => e.type !== "ACADEMIC" && e.disciplineId !== "ACADEMIC").length} aula(s)
              </span>
              {dayNotices.length > 0 && (
                <div className="flex gap-1 ml-auto">
                  {dayNotices.map((n) => (
                    <span
                      key={n.id}
                      title={n.description}
                      className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded-full truncate max-w-[120px]"
                    >
                      {n.title}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Gantt */}
            <div className="px-3 py-2">
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
          </div>
        );
      })}

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      {disciplines.length > 0 && (() => {
        const usedIds = new Set(weekEvents.map((e) => e.disciplineId));
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

      {/* ── Event edit modal ─────────────────────────────────────────────────── */}
      {isModalOpen && editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setIsModalOpen(false); setEditingEvent(undefined); }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg mx-4">
            <EventForm
              initialData={editingEvent}
              onSubmit={(data) => {
                updateEvent(editingEvent.id, data);
                setIsModalOpen(false);
                setEditingEvent(undefined);
              }}
              onDelete={(id) => {
                useCourseStore.getState().deleteEvent(id);
                setIsModalOpen(false);
                setEditingEvent(undefined);
              }}
              onCancel={() => { setIsModalOpen(false); setEditingEvent(undefined); }}
            />
          </div>
        </div>
      )}

      {/* ── SAP Link modal ───────────────────────────────────────────────────── */}
      {isLinkModalOpen && (
        <LinkChangeRequestModal
          selectedEventIds={selectedEventIds}
          onClose={() => setIsLinkModalOpen(false)}
        />
      )}

      {/* ── Delete confirm ───────────────────────────────────────────────────── */}
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
